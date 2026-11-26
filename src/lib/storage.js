// 永続化アダプタ。localStorage（または同じインターフェース）をラップし、例外が出ても落ちない。
// 保存値は信頼せず、読み込み時に検証して不正な部分は捨てる。
import { isValidDateKey } from './date.js';
import { STATUS } from './records.js';

export const STORAGE_KEY = 'un-deta:v1';
const DATA_VERSION = 1;

const defaults = () => ({ records: Object.freeze({}), lastBackupKey: null, dismissedKey: null });
const keyOrNull = (k) => (isValidDateKey(k) ? k : null);

function sanitizeRecords(raw) {
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const k of Object.keys(raw)) {
      const v = raw[k];
      if (isValidDateKey(k) && (v === STATUS.DONE || v === STATUS.NOT_YET)) out[k] = v;
    }
  }
  return Object.freeze(out);
}

/** window から localStorage を安全に取り出す（使えなければ null） */
export function getLocalStorage(win = globalThis) {
  try {
    const ls = win?.localStorage;
    return ls && typeof ls.getItem === 'function' ? ls : null;
  } catch {
    return null;
  }
}

/** @param {Storage|null} backend */
export function createStorage(backend) {
  return {
    available: backend != null,
    load() {
      if (!backend) return defaults();
      try {
        const text = backend.getItem(STORAGE_KEY);
        if (text == null) return defaults();
        const data = JSON.parse(text);
        if (!data || typeof data !== 'object') return defaults();
        return {
          records: sanitizeRecords(data.records),
          lastBackupKey: keyOrNull(data.lastBackupKey),
          dismissedKey: keyOrNull(data.dismissedKey),
        };
      } catch {
        return defaults();
      }
    },
    /** 保存できたら true */
    save({ records, lastBackupKey = null, dismissedKey = null }) {
      if (!backend) return false;
      try {
        backend.setItem(STORAGE_KEY, JSON.stringify({ v: DATA_VERSION, records, lastBackupKey, dismissedKey }));
        return true;
      } catch {
        return false;
      }
    },
  };
}

/**
 * navigator.storage.persist() を安全に呼ぶ。
 * @returns {Promise<'granted'|'denied'|'unsupported'|'error'>}
 */
export async function requestPersist(nav = globalThis.navigator) {
  const storage = nav?.storage;
  if (!storage || typeof storage.persist !== 'function') return 'unsupported';
  try {
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return 'granted';
    return (await storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'error';
  }
}
