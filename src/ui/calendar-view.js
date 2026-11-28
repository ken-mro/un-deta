// 月のカレンダーの描画（日付タップで修正ダイアログを開く。「まとめて記録」中はタップ・なぞりで直接記録する）
import { buildMonthCalendar, addMonths, monthOf } from '../lib/month-calendar.js';
import { addDays, isValidDateKey } from '../lib/date.js';
import { STATUS, STATUS_LABEL } from '../lib/records.js';
import { strokeTarget } from '../lib/bulk-paint.js';
import { formatDateJa } from './heatmap-view.js';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * @typedef {object} BulkHandlers まとめて記録の保存先（app.js が持つ状態を変える）
 * @property {() => void} start まとめて記録を始めたとき（取り消し用に今の記録を覚える）
 * @property {(date: string, target: number) => boolean} paint 1日分を記録する。変わったら true
 * @property {() => void} commit ひと筆が終わったとき（画面全体を描き直す）
 * @property {() => void} revert 始める前の記録に戻す
 */

const dayLabel = (date, status, isToday) => `${formatDateJa(date)} ${STATUS_LABEL[status]}${isToday ? '（今日）' : ''}`;

/**
 * @param {HTMLElement} root カレンダー節の要素
 * @param {(date: string) => void} onSelect 日付が選ばれたとき
 * @param {BulkHandlers} bulk まとめて記録
 */
export function createCalendarView(root, onSelect, bulk) {
  const title = root.querySelector('[data-testid="calendar-title"]');
  const summary = root.querySelector('[data-testid="calendar-summary"]');
  const grid = root.querySelector('.calendar-grid');
  const prev = root.querySelector('[data-cal-nav="prev"]');
  const next = root.querySelector('[data-cal-nav="next"]');
  let monthKey = null; // null = 今月に追従
  let last = { records: {}, todayKey: '' };
  let focusDate = null; // roving tabindex で Tab が止まる日

  const cellFor = (date) => grid.querySelector(`[data-cal-date="${date}"]`);

  /** 日付へフォーカスを移す（別の月なら表示を切り替える。未来の日には移らない） */
  function moveTo(date) {
    if (date > last.todayKey) return;
    const current = monthOf(last.todayKey);
    const target = monthOf(date);
    monthKey = target >= current ? null : target;
    focusDate = date;
    render(last.records, last.todayKey);
    cellFor(date)?.focus();
  }

  /** 同じ日にちで n か月ずらす（月末に丸め、今日より先にはしない） */
  function shiftMonth(date, n) {
    const month = addMonths(monthOf(date), n);
    let day = Number(date.slice(8));
    let d = `${month}-${String(day).padStart(2, '0')}`;
    while (!isValidDateKey(d)) d = `${month}-${String(--day).padStart(2, '0')}`;
    if (d <= last.todayKey) return d;
    // 今月なら今日に丸める。未来の月には行かない
    return month === monthOf(last.todayKey) ? last.todayKey : null;
  }

  grid.addEventListener('keydown', (e) => {
    const btn = e.target.closest('[data-cal-date]');
    if (!btn) return;
    const date = btn.dataset.calDate;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      moveTo(addDays(date, delta));
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const target = shiftMonth(date, e.key === 'PageUp' ? -1 : 1);
      if (target) moveTo(target);
    }
  });

  function go(delta) {
    const current = monthOf(last.todayKey);
    const target = addMonths(monthKey ?? current, delta);
    monthKey = target >= current ? null : target;
    render(last.records, last.todayKey);
  }
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cal-date]');
    if (!btn || btn.disabled) return;
    focusDate = btn.dataset.calDate;
    if (bulkOn) {
      // タップ・なぞりは pointer イベントで処理済み。キーボード（Enter / Space）のときだけここで1日分を切り替える
      if (e.detail === 0) {
        paintStroke(btn);
        endStroke();
        cellFor(focusDate)?.focus();
      }
      return;
    }
    onSelect(btn.dataset.calDate);
  });

  // ---- まとめて記録 ----
  const toggleBtn = root.querySelector('#btn-bulk');
  const bar = root.querySelector('#bulk-bar');
  const actions = root.querySelector('#bulk-actions');
  const bulkStatus = root.querySelector('#bulk-status');
  const brushBtns = [...root.querySelectorAll('[data-brush]')];
  let bulkOn = false;
  let brush = STATUS.DONE;
  let stroke = null; // { target, last, dates: [] }

  function setBulk(on) {
    bulkOn = on;
    bar.hidden = !on;
    actions.hidden = !on;
    toggleBtn.hidden = on;
    root.classList.toggle('is-bulk', on);
    bulkStatus.textContent = '';
    if (on) bulk.start();
  }

  toggleBtn.addEventListener('click', () => {
    setBulk(true);
    brushBtns.find((b) => Number(b.dataset.brush) === brush)?.focus();
  });
  root.querySelector('#btn-bulk-done').addEventListener('click', () => {
    setBulk(false);
    toggleBtn.focus();
  });
  root.querySelector('#btn-bulk-revert').addEventListener('click', () => {
    bulk.revert();
    bulkStatus.textContent = 'まとめて記録で変えた分を取り消しました';
  });
  for (const b of brushBtns) {
    b.addEventListener('click', () => {
      brush = Number(b.dataset.brush);
      brushBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
  }

  /** ひと筆に1日を加える（最初の日で「付ける」か「消す」かが決まる） */
  function paintStroke(btn) {
    if (!btn || btn.disabled) return;
    const date = btn.dataset.calDate;
    if (!stroke) stroke = { target: strokeTarget(Number(btn.dataset.status), brush), last: null, dates: [] };
    if (stroke.last === date) return;
    stroke.last = date;
    if (!bulk.paint(date, stroke.target)) return;
    stroke.dates.push(date);
    btn.dataset.status = String(stroke.target);
    btn.setAttribute('aria-label', dayLabel(date, stroke.target, date === last.todayKey));
    btn.classList.remove('is-painted');
    void btn.offsetWidth; // 続けて塗っても動きを最初から
    btn.classList.add('is-painted');
  }

  function endStroke() {
    if (!stroke) return;
    const { target, dates } = stroke;
    stroke = null;
    if (dates.length === 0) return;
    const subject = dates.length === 1 ? formatDateJa(dates[0]) : `${dates.length}日分`;
    bulkStatus.textContent = target === STATUS.NONE ? `${subject}の記録を消しました` : `${subject}を「${STATUS_LABEL[target]}」にしました`;
    bulk.commit();
  }

  const cellAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest?.('[data-cal-date]');
    return el && grid.contains(el) ? el : null;
  };

  function onMove(e) {
    if (stroke) paintStroke(cellAt(e.clientX, e.clientY));
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    endStroke();
  }

  grid.addEventListener('pointerdown', (e) => {
    if (!bulkOn || e.button !== 0) return;
    const btn = e.target.closest('[data-cal-date]');
    if (!btn || btn.disabled) return;
    e.preventDefault(); // 文字の選択・長押しメニューを出さない
    paintStroke(btn);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  });

  function render(records, todayKey) {
    last = { records, todayKey };
    const key = monthKey ?? monthOf(todayKey);
    const cal = buildMonthCalendar(records, key, todayKey);
    title.textContent = `${cal.year}年${cal.month}月`;
    summary.textContent = `出た ${cal.doneCount}日${cal.littleCount ? `（ちょっと ${cal.littleCount}日）` : ''}`;
    next.disabled = !cal.canGoNext;
    grid.setAttribute('aria-label', `${cal.year}年${cal.month}月の記録`);

    // Tab が止まる日: 表示中の月にあればその日、なければ今日、それもなければ1日
    const inMonth = (d) => d && monthOf(d) === key && d <= todayKey;
    if (!inMonth(focusDate)) focusDate = inMonth(todayKey) ? todayKey : `${key}-01`;

    const nodes = [];
    cal.weeks.flat().forEach((c, i) => {
      if (!c) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day';
      btn.dataset.calDate = c.date;
      btn.dataset.status = String(c.status);
      btn.textContent = String(c.day);
      btn.setAttribute('aria-label', dayLabel(c.date, c.status, c.isToday));
      if (c.isToday) btn.setAttribute('aria-current', 'date');
      if (c.isFuture) btn.disabled = true;
      btn.tabIndex = c.date === focusDate ? 0 : -1;
      if (c.day === 1) btn.style.gridColumnStart = String((i % 7) + 1);
      nodes.push(btn);
    });
    grid.replaceChildren(...nodes);
  }

  return {
    render,
    focus(date) {
      focusDate = date;
      grid.querySelectorAll('[data-cal-date][tabindex="0"]').forEach((c) => (c.tabIndex = -1));
      const cell = cellFor(date);
      if (cell) {
        cell.tabIndex = 0;
        cell.focus();
      }
    },
    weekdays: WEEKDAYS,
  };
}
