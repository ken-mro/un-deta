// 月のカレンダーの描画（日付タップで修正ダイアログを開く）
import { buildMonthCalendar, addMonths, monthOf } from '../lib/month-calendar.js';
import { STATUS } from '../lib/records.js';
import { formatDateJa } from './heatmap-view.js';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

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

  const cellFor = (date) => grid.querySelector(`[data-cal-date="${date}"]`);

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
    if (btn && !btn.disabled) onSelect(btn.dataset.calDate);
  });

  function render(records, todayKey) {
    last = { records, todayKey };
    const key = monthKey ?? monthOf(todayKey);
    const cal = buildMonthCalendar(records, key, todayKey);
    title.textContent = `${cal.year}年${cal.month}月`;
    summary.textContent = `出た ${cal.doneCount}日`;
    next.disabled = !cal.canGoNext;
    grid.setAttribute('aria-label', `${cal.year}年${cal.month}月の記録`);

    const nodes = [];
    cal.weeks.flat().forEach((c, i) => {
      if (!c) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-day';
      btn.dataset.calDate = c.date;
      btn.dataset.status = String(c.status);
      btn.textContent = String(c.day);
      btn.setAttribute('aria-label', `${formatDateJa(c.date)} ${c.status === STATUS.DONE ? '出た' : '未記録'}${c.isToday ? '（今日）' : ''}`);
      if (c.isToday) btn.setAttribute('aria-current', 'date');
      if (c.isFuture) btn.disabled = true;
      if (c.day === 1) btn.style.gridColumnStart = String((i % 7) + 1);
      nodes.push(btn);
    });
    grid.replaceChildren(...nodes);
  }

  return {
    render,
    focus(date) {
      cellFor(date)?.focus();
    },
    weekdays: WEEKDAYS,
  };
}
