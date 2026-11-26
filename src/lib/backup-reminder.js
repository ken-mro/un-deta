// バックアップ催促の判定（純粋関数）
import { diffDays, isValidDateKey } from './date.js';

export const REMIND_AFTER_DAYS = 30;

/**
 * @param {object} p
 * @param {Record<string, number>} p.records 記録
 * @param {string|null} p.lastBackupKey 最後にバックアップ（コピー）した日
 * @param {string|null} [p.dismissedKey] 催促を「あとで」で閉じた日
 * @param {string} p.todayKey 今日
 */
export function shouldRemindBackup({ records, lastBackupKey, dismissedKey = null, todayKey }) {
  const keys = Object.keys(records);
  if (keys.length === 0) return false;
  const valid = (k) => (isValidDateKey(k) ? k : null);
  const backup = valid(lastBackupKey);
  // 起点: 最後のバックアップ日（未実施なら最初の記録日）と「あとで」の日のうち新しい方
  const candidates = [backup ?? keys.sort()[0], valid(dismissedKey)].filter(Boolean);
  const baseline = candidates.sort().at(-1);
  return diffDays(baseline, todayKey) >= REMIND_AFTER_DAYS;
}
