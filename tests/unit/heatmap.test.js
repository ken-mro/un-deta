// ヒートマップのレイアウト（直近1年、週ごとの列・日曜始まり）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeatmap, dayOfWeek, HEATMAP_DAYS } from '../../src/lib/heatmap.js';
import { STATUS } from '../../src/lib/records.js';

test('dayOfWeek: 0=日曜（タイムゾーン非依存）', () => {
  assert.equal(dayOfWeek('2024-03-10'), 0); // 日曜
  assert.equal(dayOfWeek('2024-03-16'), 6);
  assert.equal(dayOfWeek('2000-01-01'), 6);
});

test('直近1年（今日を含む365日）を週ごとの列に並べる', () => {
  const { weeks, start, end } = buildHeatmap({}, '2024-03-10');
  assert.equal(HEATMAP_DAYS, 365);
  assert.equal(end, '2024-03-10');
  assert.equal(start, '2023-03-12');
  for (const w of weeks) assert.equal(w.length, 7);
  const cells = weeks.flat().filter(Boolean);
  assert.equal(cells.length, 365);
  assert.equal(cells[0].date, start);
  assert.equal(cells.at(-1).date, end);
  // 各列は日曜始まり
  for (const w of weeks) w.forEach((c, i) => c && assert.equal(dayOfWeek(c.date), i));
});

test('範囲外（1年より前・未来）は null で埋める', () => {
  const { weeks } = buildHeatmap({}, '2024-03-13'); // 水曜
  const last = weeks.at(-1);
  assert.equal(last[3].date, '2024-03-13');
  assert.deepEqual(last.slice(4), [null, null, null]);
  const first = weeks[0];
  const firstIdx = first.findIndex(Boolean);
  assert.equal(first[firstIdx].date, '2023-03-15');
  assert.ok(first.slice(0, firstIdx).every((c) => c === null));
});

test('各セルに状態を持つ', () => {
  const { weeks } = buildHeatmap({ '2024-03-09': STATUS.DONE, '2024-03-08': STATUS.NOT_YET, '2022-01-01': STATUS.DONE }, '2024-03-10');
  const byDate = Object.fromEntries(weeks.flat().filter(Boolean).map((c) => [c.date, c.status]));
  assert.equal(byDate['2024-03-09'], STATUS.DONE);
  assert.equal(byDate['2024-03-08'], STATUS.NONE, '旧データの「出てない」は未記録として扱う');
  assert.equal(byDate['2024-03-07'], STATUS.NONE);
  assert.equal(byDate['2022-01-01'], undefined, '範囲外は含めない');
});

test('月ラベル: その月の1日を含む列に付ける', () => {
  const { monthLabels, weeks } = buildHeatmap({}, '2024-03-10');
  const labels = monthLabels.filter(Boolean);
  assert.equal(monthLabels.length, weeks.length);
  assert.ok(labels.includes('4月') && labels.includes('1月') && labels.includes('3月'));
  const idx = monthLabels.indexOf('1月');
  assert.ok(weeks[idx].some((c) => c?.date === '2024-01-01'));
});

test('うるう年の年跨ぎでも 365日', () => {
  const { weeks } = buildHeatmap({}, '2024-12-31');
  assert.equal(weeks.flat().filter(Boolean).length, 365);
});

test('ちょっと出た はそのまま、旧データの「出てない」は未記録として扱う', () => {
  const { weeks } = buildHeatmap({ '2024-03-09': STATUS.LITTLE, '2024-03-08': STATUS.NOT_YET }, '2024-03-10');
  const byDate = Object.fromEntries(weeks.flat().filter(Boolean).map((c) => [c.date, c.status]));
  assert.equal(byDate['2024-03-09'], STATUS.LITTLE);
  assert.equal(byDate['2024-03-08'], STATUS.NONE);
});
