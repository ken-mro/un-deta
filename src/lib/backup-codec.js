// バックアップ文字列のエンコード／デコード（DOM 非依存の純粋関数）
//
// 形式 v1: 先頭1文字 = フォーマットバージョン '1'、続けて base64url（パディングなし）で
//   [開始日: 1970-01-01 からの日数 3バイト BE]
//   [記録: 1日2bit（0=未記録, 1=出た, 2=出てない）、1バイトに4日、下位ビットから]
//   [CRC-8（多項式 0x07）: 上記バイト列に対して 1バイト]
// 空データは '1' のみ。末尾の未記録は詰める。
import { addDays, diffDays, isValidDateKey } from './date.js';
import { STATUS, isValidStatus } from './records.js';

export const FORMAT_VERSION = 1;
const EPOCH = '1970-01-01';
const MAX_INPUT_LENGTH = 50_000; // 約 200 年分。これを超える入力は処理しない
const MAX_DAY = diffDays(EPOCH, '9999-12-31'); // 日付キーで表せる最終日
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INDEX = new Map([...B64].map((c, i) => [c, i]));

const MESSAGES = {
  EMPTY: 'バックアップの文字列が入力されていません。',
  TOO_LONG: '文字列が長すぎます。貼り付けた内容をご確認ください。',
  MALFORMED: 'バックアップの文字列として読み取れませんでした。コピーした文字列をそのまま貼り付けてください。',
  UNKNOWN_VERSION: 'このアプリでは読み込めない形式です。アプリを最新にしてからお試しください。',
  CHECKSUM: '文字列の一部が欠けているか、書き換わっているようです。もう一度コピーし直してください。',
};

export class BackupError extends Error {
  constructor(code) {
    super(MESSAGES[code]);
    this.name = 'BackupError';
    this.code = code;
  }
}

function crc8(bytes) {
  let c = 0;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  }
  return c;
}

function toBase64url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.ceil(((Math.min(3, bytes.length - i)) * 8) / 6);
    for (let k = 0; k < chars; k++) out += B64[(n >> (18 - 6 * k)) & 63];
  }
  return out;
}

/** base64url → バイト列。不正なら null（末尾の余りビットは無視） */
function fromBase64url(str) {
  if (str.length % 4 === 1) return null;
  const bytes = [];
  let buf = 0;
  let bits = 0;
  for (const ch of str) {
    const v = B64_INDEX.get(ch);
    if (v === undefined) return null;
    buf = ((buf << 6) | v) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 0xff);
    }
  }
  return bytes;
}

/** 記録 → バックアップ文字列 */
export function encodeBackup(records) {
  const keys = Object.keys(records).sort();
  for (const k of keys) {
    if (!isValidDateKey(k) || k < EPOCH) throw new RangeError(`バックアップできない日付です: ${k}`);
    if (!isValidStatus(records[k]) || records[k] === STATUS.NONE) {
      throw new RangeError(`不正な状態値です: ${k}=${String(records[k])}`);
    }
  }
  if (keys.length === 0) return String(FORMAT_VERSION);
  const start = keys[0];
  const startDay = diffDays(EPOCH, start);
  if (startDay > MAX_DAY) throw new RangeError(`バックアップできない日付です: ${start}`);
  const span = diffDays(start, keys[keys.length - 1]) + 1;
  const data = new Array(Math.ceil(span / 4)).fill(0);
  for (const k of keys) {
    const i = diffDays(start, k);
    data[i >> 2] |= records[k] << ((i & 3) * 2);
  }
  const body = [(startDay >> 16) & 0xff, (startDay >> 8) & 0xff, startDay & 0xff, ...data];
  return String(FORMAT_VERSION) + toBase64url([...body, crc8(body)]);
}

/** バックアップ文字列 → 記録。不正なら BackupError（code: EMPTY / TOO_LONG / MALFORMED / UNKNOWN_VERSION / CHECKSUM） */
export function decodeBackup(input) {
  if (typeof input !== 'string') throw new BackupError('EMPTY');
  if (input.length > MAX_INPUT_LENGTH * 2) throw new BackupError('TOO_LONG');
  const s = input.replace(/\s+/g, '');
  if (s === '') throw new BackupError('EMPTY');
  if (s.length > MAX_INPUT_LENGTH) throw new BackupError('TOO_LONG');
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new BackupError('MALFORMED');
  if (s[0] !== String(FORMAT_VERSION)) throw new BackupError('UNKNOWN_VERSION');

  const payload = s.slice(1);
  if (payload === '') return Object.freeze({});
  const bytes = fromBase64url(payload);
  if (!bytes || bytes.length < 4) throw new BackupError('MALFORMED');
  const body = bytes.slice(0, -1);
  if (crc8(body) !== bytes[bytes.length - 1]) throw new BackupError('CHECKSUM');

  const startDay = (body[0] << 16) | (body[1] << 8) | body[2];
  if (startDay > MAX_DAY) throw new BackupError('MALFORMED');
  const start = addDays(EPOCH, startDay);
  const records = {};
  for (let i = 3; i < body.length; i++) {
    for (let k = 0; k < 4; k++) {
      const v = (body[i] >> (k * 2)) & 3;
      if (v === 0) continue;
      const offset = (i - 3) * 4 + k;
      if (v === 3 || startDay + offset > MAX_DAY) throw new BackupError('MALFORMED');
      records[addDays(start, offset)] = v;
    }
  }
  return Object.freeze(records);
}
