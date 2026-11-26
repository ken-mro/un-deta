// ヒートマップの描画とキーボード操作（roving tabindex）
import { addDays, parseDateKey } from '../lib/date.js';
import { buildHeatmap } from '../lib/heatmap.js';
import { STATUS } from '../lib/records.js';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const STATUS_LABEL = { [STATUS.NONE]: '未記録', [STATUS.DONE]: '出た' };

export function formatDateJa(key) {
  const d = parseDateKey(key);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

/**
 * @param {HTMLElement} root 描画先
 * @param {(date: string) => void} onSelect セルが選ばれたとき
 */
export function createHeatmapView(root, onSelect) {
  let focusDate = null;
  let range = { start: '', end: '' };

  const cellFor = (date) => root.querySelector(`[data-date="${date}"]`);

  function moveFocus(date) {
    if (date < range.start || date > range.end) return;
    const next = cellFor(date);
    if (!next) return;
    root.querySelectorAll('[data-date][tabindex="0"]').forEach((c) => c.setAttribute('tabindex', '-1'));
    next.setAttribute('tabindex', '0');
    next.focus();
    focusDate = date;
  }

  root.addEventListener('click', (e) => {
    const target = e.target.closest('[data-date]');
    if (!target) return;
    moveFocus(target.dataset.date);
    onSelect(target.dataset.date);
  });

  root.addEventListener('keydown', (e) => {
    const target = e.target.closest('[data-date]');
    if (!target) return;
    const delta = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      moveFocus(addDays(target.dataset.date, delta));
    } else if (e.key === 'Home') {
      e.preventDefault();
      moveFocus(range.start);
    } else if (e.key === 'End') {
      e.preventDefault();
      moveFocus(range.end);
    }
  });

  function render(records, todayKey) {
    const { weeks, monthLabels, start, end } = buildHeatmap(records, todayKey);
    range = { start, end };
    if (!focusDate || focusDate < start || focusDate > end) focusDate = end;
    const hadFocus = root.contains(document.activeElement);

    const grid = el('div', { class: 'heatmap-grid', role: 'group', 'aria-label': `${formatDateJa(start)}から${formatDateJa(end)}までの記録` });
    grid.style.setProperty('--weeks', String(weeks.length));
    grid.append(el('span', { class: 'heatmap-corner', 'aria-hidden': 'true' }));
    monthLabels.forEach((label) => grid.append(el('span', { class: 'heatmap-month', 'aria-hidden': 'true' }, label ?? '')));
    WEEKDAYS.forEach((w, i) => {
      const wd = el('span', { class: 'heatmap-weekday', 'aria-hidden': 'true' }, i % 2 === 1 ? w : '');
      wd.style.gridRow = String(i + 2);
      grid.append(wd);
    });
    weeks.forEach((week, wi) => {
      week.forEach((c, di) => {
        const node = c
          ? el('button', {
              type: 'button',
              class: 'heatmap-cell',
              'data-date': c.date,
              'data-status': String(c.status),
              tabindex: c.date === focusDate ? '0' : '-1',
              'aria-label': `${formatDateJa(c.date)} ${STATUS_LABEL[c.status]}${c.date === todayKey ? '（今日）' : ''}`,
            })
          : el('span', { class: 'heatmap-empty', 'aria-hidden': 'true' });
        if (c?.date === todayKey) node.classList.add('is-today');
        node.style.gridColumn = String(wi + 2);
        node.style.gridRow = String(di + 2);
        grid.append(node);
      });
    });
    root.replaceChildren(grid);
    if (hadFocus) cellFor(focusDate)?.focus();
  }

  return {
    render,
    focus: (date) => moveFocus(date),
    scrollToEnd() {
      root.scrollLeft = root.scrollWidth;
    },
  };
}
