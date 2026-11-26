// 月のカレンダーの描画（日付タップで修正ダイアログを開く）
import { buildMonthCalendar, addMonths, monthOf } from '../lib/month-calendar.js';
import { addDays, isValidDateKey } from '../lib/date.js';
import { STATUS } from '../lib/records.js';
import { formatDateJa } from './heatmap-view.js';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const STATUS_LABEL = { [STATUS.NONE]: '未記録', [STATUS.DONE]: '出た', [STATUS.LITTLE]: 'ちょっと出た' };

/**
 * @param {HTMLElement} root カレンダー節の要素
 * @param {(date: string) => void} onSelect 日付が選ばれたとき
 */
export function createCalendarView(root, onSelect) {
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
    onSelect(btn.dataset.calDate);
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
      btn.setAttribute('aria-label', `${formatDateJa(c.date)} ${STATUS_LABEL[c.status]}${c.isToday ? '（今日）' : ''}`);
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
