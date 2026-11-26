// 日付ユーティリティ。日付の境界はローカル時刻で判定する。
// 日付は 'YYYY-MM-DD' 形式の文字列キーで扱い、計算は UTC 上で行って夏時間の影響を受けないようにする。

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

const pad = (n, w = 2) => String(n).padStart(w, '0');

/** Date をローカル日付キー 'YYYY-MM-DD' にする */
export function toDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('toDateKey: 有効な Date が必要です');
  }
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parts(key) {
  if (typeof key !== 'string') return null;
  const m = KEY_RE.exec(key);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = new Date(Date.UTC(2000, mo - 1, d));
  utc.setUTCFullYear(y); // 0〜99 年も正しく扱う
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== mo - 1 || utc.getUTCDate() !== d) return null;
  return { y, mo, d, utc: utc.getTime() };
}

function mustParts(key) {
  const p = parts(key);
  if (!p) throw new RangeError(`不正な日付キーです: ${String(key)}`);
  return p;
}

/** 'YYYY-MM-DD' として正しく、かつ実在する日付か */
export function isValidDateKey(key) {
  return parts(key) !== null;
}

/** 日付キーをローカル時刻 0 時の Date にする */
export function parseDateKey(key) {
  const { y, mo, d } = mustParts(key);
  const date = new Date(2000, mo - 1, d);
  date.setFullYear(y);
  return date;
}

function fromUtc(ms) {
  const u = new Date(ms);
  return `${pad(u.getUTCFullYear(), 4)}-${pad(u.getUTCMonth() + 1)}-${pad(u.getUTCDate())}`;
}

/** 日付キーに n 日（整数、負も可）を足す */
export function addDays(key, n) {
  if (!Number.isInteger(n)) throw new RangeError('addDays: 日数は整数で指定してください');
  return fromUtc(mustParts(key).utc + n * DAY_MS);
}

/** b - a の日数 */
export function diffDays(a, b) {
  return Math.round((mustParts(b).utc - mustParts(a).utc) / DAY_MS);
}
