// 永続化アダプタ（localStorage ラッパ）と navigator.storage.persist() の安全な呼び出し
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, getLocalStorage, requestPersist, STORAGE_KEY } from '../../src/lib/storage.js';
import { STATUS, setStatus, emptyRecords } from '../../src/lib/records.js';

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _map: m,
  };
}
const throwing = (err = new Error('SecurityError')) => ({
  getItem() { throw err; },
  setItem() { throw err; },
  removeItem() { throw err; },
});

const DEFAULT = { records: {}, lastBackupKey: null, dismissedKey: null };

test('初回は既定値', () => {
  assert.deepEqual(createStorage(memoryStorage()).load(), DEFAULT);
});

test('保存して読み戻せる（記録・最終バックアップ日・催促を閉じた日）', () => {
  const mem = memoryStorage();
  const s = createStorage(mem);
  const records = setStatus(setStatus(emptyRecords(), '2024-01-01', STATUS.DONE), '2024-01-02', STATUS.DONE);
  assert.equal(s.save({ records, lastBackupKey: '2024-01-02', dismissedKey: null }), true);
  const loaded = createStorage(mem).load();
  assert.deepEqual(loaded, { records: { ...records }, lastBackupKey: '2024-01-02', dismissedKey: null });
  assert.ok(Object.isFrozen(loaded.records));
  assert.ok(mem._map.has(STORAGE_KEY));
});

test('壊れた JSON や想定外の値は既定値／不正な日だけ捨てて読む', () => {
  const mem = memoryStorage();
  mem.setItem(STORAGE_KEY, '{not json');
  assert.deepEqual(createStorage(mem).load(), DEFAULT);
  mem.setItem(STORAGE_KEY, 'null');
  assert.deepEqual(createStorage(mem).load(), DEFAULT);
  mem.setItem(STORAGE_KEY, JSON.stringify({ v: 1, records: { '2024-01-01': 1, '2024-02-30': 1, '2024-01-03': 3, __proto__x: 2, '2024-01-04': '2' }, lastBackupKey: 'x', dismissedKey: '2024-01-05' }));
  assert.deepEqual(createStorage(mem).load(), { records: { '2024-01-01': 1 }, lastBackupKey: null, dismissedKey: '2024-01-05' });
});

test('保存データ中の「出てない」(2) は未記録として読み込む（仕様変更: 「出た」だけを記録）', () => {
  const mem = memoryStorage();
  mem.setItem(STORAGE_KEY, JSON.stringify({ v: 1, records: { '2024-01-01': 1, '2024-01-02': 2 } }));
  assert.deepEqual(createStorage(mem).load().records, { '2024-01-01': 1 });
});

test('__proto__ を含む保存値でもプロトタイプ汚染しない', () => {
  const mem = memoryStorage();
  mem.setItem(STORAGE_KEY, '{"v":1,"records":{"__proto__":{"polluted":1}}}');
  const { records } = createStorage(mem).load();
  assert.equal(({}).polluted, undefined);
  assert.deepEqual(records, {});
});

test('ストレージが例外を投げても落ちない（読み: 既定値、書き: false）', () => {
  const s = createStorage(throwing());
  assert.deepEqual(s.load(), DEFAULT);
  assert.equal(s.save(DEFAULT), false);
  const quota = createStorage({ ...memoryStorage(), setItem() { throw new Error('QuotaExceededError'); } });
  assert.equal(quota.save(DEFAULT), false);
});

test('ストレージ自体がない（null）でも落ちない', () => {
  const s = createStorage(null);
  assert.deepEqual(s.load(), DEFAULT);
  assert.equal(s.save(DEFAULT), false);
  assert.equal(s.available, false);
});

test('getLocalStorage: アクセスで例外が出る環境では null', () => {
  const win = {};
  Object.defineProperty(win, 'localStorage', { get() { throw new Error('SecurityError'); } });
  assert.equal(getLocalStorage(win), null);
  assert.equal(getLocalStorage({}), null);
  const mem = memoryStorage();
  assert.equal(getLocalStorage({ localStorage: mem }), mem);
});

test('requestPersist: 対応・非対応・拒否・例外のどれでも落ちない', async () => {
  assert.equal(await requestPersist({ storage: { persist: async () => true } }), 'granted');
  assert.equal(await requestPersist({ storage: { persist: async () => false } }), 'denied');
  assert.equal(await requestPersist({ storage: { persisted: async () => true, persist: async () => { throw new Error('x'); } } }), 'granted');
  assert.equal(await requestPersist({ storage: { persist: async () => { throw new Error('x'); } } }), 'error');
  assert.equal(await requestPersist({ storage: { persist() { throw new Error('sync'); } } }), 'error');
  assert.equal(await requestPersist({ storage: {} }), 'unsupported');
  assert.equal(await requestPersist({}), 'unsupported');
  assert.equal(await requestPersist(undefined), 'unsupported');
});
