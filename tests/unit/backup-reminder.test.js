// バックアップ催促の判定
// - 記録が0件なら出さない
// - 最後のバックアップ日から30日以上経過したら出す
// - 一度もバックアップしていなければ、最初の記録日から30日以上で出す
// - 「あとで」で閉じた日（dismissedKey）からも30日は出さない
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldRemindBackup, REMIND_AFTER_DAYS } from '../../src/lib/backup-reminder.js';
import { STATUS, emptyRecords, setStatus } from '../../src/lib/records.js';

const r1 = setStatus(emptyRecords(), '2024-01-01', STATUS.DONE);

test('30日', () => assert.equal(REMIND_AFTER_DAYS, 30));

test('記録0件なら出さない', () => {
  assert.equal(shouldRemindBackup({ records: emptyRecords(), lastBackupKey: null, todayKey: '2025-01-01' }), false);
  assert.equal(shouldRemindBackup({ records: emptyRecords(), lastBackupKey: '2020-01-01', todayKey: '2025-01-01' }), false);
});

test('最後のバックアップから29日は出さない、30日で出す', () => {
  assert.equal(shouldRemindBackup({ records: r1, lastBackupKey: '2024-01-10', todayKey: '2024-02-08' }), false);
  assert.equal(shouldRemindBackup({ records: r1, lastBackupKey: '2024-01-10', todayKey: '2024-02-09' }), true);
});

test('一度もバックアップしていない: 最初の記録日から30日で出す', () => {
  assert.equal(shouldRemindBackup({ records: r1, lastBackupKey: null, todayKey: '2024-01-30' }), false);
  assert.equal(shouldRemindBackup({ records: r1, lastBackupKey: null, todayKey: '2024-01-31' }), true);
});

test('「あとで」で閉じた日からも30日は出さない', () => {
  const base = { records: r1, lastBackupKey: '2024-01-01' };
  assert.equal(shouldRemindBackup({ ...base, dismissedKey: '2024-02-15', todayKey: '2024-03-01' }), false);
  assert.equal(shouldRemindBackup({ ...base, dismissedKey: '2024-02-15', todayKey: '2024-03-16' }), true);
});

test('保存値が壊れていても落ちず、バックアップ未実施として扱う', () => {
  assert.equal(shouldRemindBackup({ records: r1, lastBackupKey: 'garbage', todayKey: '2024-01-31' }), true);
  assert.equal(shouldRemindBackup({ records: r1, lastBackupKey: 'garbage', dismissedKey: 123, todayKey: '2024-01-15' }), false);
});

test('時計が戻っていても（基準日が未来）出さない', () => {
  assert.equal(shouldRemindBackup({ records: r1, lastBackupKey: '2030-01-01', todayKey: '2024-06-01' }), false);
});
