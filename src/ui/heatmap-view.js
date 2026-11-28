// ヒートマップ（直近1年）の描画。見るだけの表示で、押しても反応しない（修正は月のカレンダーから）。
import { parseDateKey } from '../lib/date.js';
import { buildHeatmap } from '../lib/heatmap.js';
import { STATUS, STATUS_LABEL } from '../lib/records.js';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

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

/** @param {HTMLElement} root 描画先 */
export function createHeatmapView(root) {
  function render(records, todayKey) {
    const { weeks, monthLabels } = buildHeatmap(records, todayKey);
    const doneCount = weeks.flat().filter((c) => c?.status === STATUS.DONE).length;
    const littleCount = weeks.flat().filter((c) => c?.status === STATUS.LITTLE).length;
    const label = `直近1年で「出た」日: ${doneCount}日${littleCount ? `（ちょっと ${littleCount}日）` : ''}`;

    // マスを1つずつ読み上げず、まとめて伝える（role="img" の子は読み上げ対象外になる）
    const grid = el('div', { class: 'heatmap-grid', role: 'img', 'aria-label': label });
    grid.style.setProperty('--weeks', String(weeks.length));
    grid.append(el('span', { class: 'heatmap-corner' }));
    monthLabels.forEach((label) => grid.append(el('span', { class: 'heatmap-month' }, label ?? '')));
    WEEKDAYS.forEach((w, i) => {
      const wd = el('span', { class: 'heatmap-weekday' }, i % 2 === 1 ? w : '');
      wd.style.gridRow = String(i + 2);
      grid.append(wd);
    });
    weeks.forEach((week, wi) => {
      week.forEach((c, di) => {
        const node = c
          ? el('span', { class: 'heatmap-cell', 'data-date': c.date, 'data-status': String(c.status), title: `${formatDateJa(c.date)} ${STATUS_LABEL[c.status]}` })
          : el('span', { class: 'heatmap-empty' });
        if (c?.date === todayKey) node.classList.add('is-today');
        node.style.gridColumn = String(wi + 2);
        node.style.gridRow = String(di + 2);
        grid.append(node);
      });
    });
    root.replaceChildren(grid);
  }

  return {
    render,
    scrollToEnd() {
      root.scrollLeft = root.scrollWidth;
    },
  };
}
