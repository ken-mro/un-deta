// 月のカレンダーの組み立て（純粋関数）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthCalendar, addMonths, monthOf, isValidMonthKey } from '../../src/lib/month-calendar.js';
import { STATUS } from '../../src/lib/records.js';

test('monthOf / isValidMonthKey', () => {
  assert.equal(monthOf('2024-03-10'), '2024-03');
  assert.equal(isValidMonthKey('2024-12'), true);
  for (const k of ['2024-13', '2024-00', '2024-1', '24-01', '', null]) assert.equal(isValidMonthKey(k), false, String(k));
});

test('addMonths: 年跨ぎ・負の値', () => {
  assert.equal(addMonths('2024-12', 1), '2025-01');
  assert.equal(addMonths('2024-01', -1), '2023-12');
  assert.equal(addMonths('2024-03', -14), '2023-01');
  assert.equal(addMonths('2024-03', 0), '2024-03');
  assert.throws(() => addMonths('2024-3', 1), RangeError);
  assert.throws(() => addMonths('2024-03', 0.5), RangeError);
});

test('2024年2月（うるう年・木曜始まり）: 日曜始まりの週の行、前後は空白', () => {
  const cal = buildMonthCalendar({}, '2024-02', '2024-03-10');
  assert.equal(cal.year, 2024);
  assert.equal(cal.month, 2);
  for (const w of cal.weeks) assert.equal(w.length, 7);
  assert.equal(cal.weeks.length, 5);
  assert.deepEqual(cal.weeks[0].slice(0, 4), [null, null, null, null]);
  assert.equal(cal.weeks[0][4].date, '2024-02-01');
  const days = cal.weeks.flat().filter(Boolean);
  assert.equal(days.length, 29);
  assert.equal(days.at(-1).date, '2024-02-29');
  assert.equal(days.at(-1).day, 29);
  assert.deepEqual(cal.weeks.at(-1).slice(5), [null, null]);
});

test('6行になる月（2024年6月: 土曜始まりの30日）', () => {
  const cal = buildMonthCalendar({}, '2024-06', '2024-06-15');
  assert.equal(cal.weeks.length, 6);
  assert.equal(cal.weeks[0][6].date, '2024-06-01');
});

test('状態・今日・未来・その月の「出た」日数', () => {
  const records = { '2024-03-01': STATUS.DONE, '2024-03-09': STATUS.DONE, '2024-03-08': STATUS.NOT_YET, '2024-02-29': STATUS.DONE, '2024-03-20': STATUS.DONE };
  const cal = buildMonthCalendar(records, '2024-03', '2024-03-10');
  const by = Object.fromEntries(cal.weeks.flat().filter(Boolean).map((c) => [c.date, c]));
  assert.equal(by['2024-03-01'].status, STATUS.DONE);
  assert.equal(by['2024-03-08'].status, STATUS.NONE, '旧データの「出てない」は未記録');
  assert.equal(by['2024-03-10'].isToday, true);
  assert.equal(by['2024-03-09'].isToday, false);
  assert.equal(by['2024-03-10'].isFuture, false);
  assert.equal(by['2024-03-11'].isFuture, true);
  assert.equal(cal.doneCount, 2, '今日以前の「出た」だけを数える（未来・他の月は数えない）');
});

test('移動できる範囲: 今月より先には進めない', () => {
  assert.equal(buildMonthCalendar({}, '2024-03', '2024-03-10').canGoNext, false);
  assert.equal(buildMonthCalendar({}, '2024-02', '2024-03-10').canGoNext, true);
  assert.equal(buildMonthCalendar({}, '2024-03', '2024-03-10').canGoPrev, true);
});

test('不正な引数は例外', () => {
  assert.throws(() => buildMonthCalendar({}, '2024-13', '2024-03-10'), RangeError);
  assert.throws(() => buildMonthCalendar({}, '2024-03', '2024-02-30'), RangeError);
});

test('ちょっと出た: 状態を保ち、日数は別に数える', () => {
  const records = { '2024-03-01': STATUS.DONE, '2024-03-02': STATUS.LITTLE, '2024-03-03': STATUS.LITTLE, '2024-03-20': STATUS.LITTLE };
  const cal = buildMonthCalendar(records, '2024-03', '2024-03-10');
  const by = Object.fromEntries(cal.weeks.flat().filter(Boolean).map((c) => [c.date, c]));
  assert.equal(by['2024-03-02'].status, STATUS.LITTLE);
  assert.equal(cal.doneCount, 1);
  assert.equal(cal.littleCount, 2, '未来の分は数えない');
});
