// バックアップ文字列のエンコード／デコード
// 形式 v1: 先頭1文字 = フォーマットバージョン '1'、続けて base64url（パディングなし）で
//   [開始日: 1970-01-01 からの日数 3バイト BE][記録: 1日2bit, 1バイトに4日, 下位ビットから][CRC-8 1バイト]
//   空データは '1' のみ。末尾の未記録は詰める。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeBackup, decodeBackup, BackupError, FORMAT_VERSION } from '../../src/lib/backup-codec.js';
import { STATUS, emptyRecords, setStatus } from '../../src/lib/records.js';
import { addDays } from '../../src/lib/date.js';

const { DONE, NOT_YET } = STATUS;
const build = (entries) => entries.reduce((r, [k, s]) => setStatus(r, k, s), emptyRecords());
const roundTrip = (r) => decodeBackup(encodeBackup(r));

test('先頭はフォーマットバージョン、残りは base64url の文字のみ', () => {
  assert.equal(FORMAT_VERSION, 1);
  const s = encodeBackup(build([['2024-01-01', DONE]]));
  assert.equal(s[0], '1');
  assert.match(s.slice(1), /^[A-Za-z0-9_-]+$/);
});

test('空データ', () => {
  assert.equal(encodeBackup(emptyRecords()), '1');
  assert.deepEqual(roundTrip(emptyRecords()), {});
});

test('1日分（出た／出てない）', () => {
  for (const s of [DONE, NOT_YET]) {
    const r = build([['2024-02-29', s]]);
    assert.deepEqual(roundTrip(r), { '2024-02-29': s });
  }
});

test('1年分（毎日記録）でも往復一致し、短い', () => {
  let r = emptyRecords();
  for (let i = 0; i < 366; i++) r = setStatus(r, addDays('2024-01-01', i), i % 3 === 0 ? NOT_YET : DONE);
  const s = encodeBackup(r);
  assert.deepEqual(decodeBackup(s), { ...r });
  assert.ok(s.length <= 135, `1年分で ${s.length} 文字`);
});

test('歯抜け（未記録を挟む）', () => {
  const r = build([['2023-12-30', NOT_YET], ['2024-01-02', DONE], ['2024-01-03', NOT_YET], ['2024-03-15', DONE]]);
  assert.deepEqual(roundTrip(r), { ...r });
});

test('貼り付け時の前後・途中の空白や改行は無視', () => {
  const r = build([['2024-01-01', DONE], ['2024-01-05', NOT_YET]]);
  const s = encodeBackup(r);
  const messy = `  ${s.slice(0, 4)}\n ${s.slice(4)}\t `;
  assert.deepEqual(decodeBackup(messy), { ...r });
});

test('デコード結果は凍結された記録オブジェクト', () => {
  assert.ok(Object.isFrozen(roundTrip(build([['2024-01-01', DONE]]))));
});

const expectError = (input, code) => {
  assert.throws(
    () => decodeBackup(input),
    (e) => e instanceof BackupError && e.code === code && typeof e.message === 'string' && e.message.length > 0,
    `${JSON.stringify(input)} → ${code}`,
  );
};

test('不正な文字列は丁寧なエラーで弾く', () => {
  expectError('', 'EMPTY');
  expectError('   \n', 'EMPTY');
  expectError(undefined, 'EMPTY');
  expectError('1abc!def', 'MALFORMED'); // 使えない文字
  expectError('1A', 'MALFORMED'); // 短すぎ
  expectError('1AAA', 'MALFORMED'); // 開始日 + CRC に満たない
  expectError('こんにちは', 'MALFORMED');
});

test('1文字でも書き換わっていれば検出する（CRC）', () => {
  const s = encodeBackup(build([['2024-01-01', DONE], ['2024-01-02', NOT_YET], ['2024-01-03', DONE]]));
  const i = 3;
  const swapped = s.slice(0, i) + (s[i] === 'A' ? 'B' : 'A') + s.slice(i + 1);
  expectError(swapped, 'CHECKSUM');
  expectError(s.slice(0, -1), 'CHECKSUM'); // 末尾欠け
});

test('未知のバージョンは別エラー', () => {
  expectError('2AAAAAA', 'UNKNOWN_VERSION');
  expectError('9xyz', 'UNKNOWN_VERSION');
  expectError('AAAA', 'UNKNOWN_VERSION');
});

test('2bit=3 は「ちょっと出た」として読める（形式 v1 のまま）', () => {
  // 開始日 0 日目（1970-01-01）に 3 を入れたデータを自前で組み立てる
  const bytes = [0, 0, 0, 0b11];
  const crc = crc8(bytes);
  const b64 = Buffer.from([...bytes, crc]).toString('base64url');
  assert.deepEqual(decodeBackup('1' + b64), { '1970-01-01': STATUS.LITTLE });
});

test('ちょっと出た を含む記録の往復', () => {
  const r = build([['2024-01-01', DONE], ['2024-01-02', STATUS.LITTLE], ['2024-01-05', STATUS.LITTLE]]);
  assert.deepEqual(roundTrip(r), { ...r });
});

test('極端に長い入力は処理せず弾く', () => {
  expectError('1' + 'A'.repeat(100_000), 'TOO_LONG');
});

test('エンコード前の記録に不正なものがあれば例外', () => {
  assert.throws(() => encodeBackup({ '1969-12-31': DONE }), RangeError);
  assert.throws(() => encodeBackup({ '2024-01-01': 4 }), RangeError);
});

// テスト用 CRC-8（多項式 0x07）
function crc8(bytes) {
  let c = 0;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  }
  return c;
}

// 再現可能な擬似乱数（mulberry32）
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('ランダムな記録 300 通りで往復一致', () => {
  const rand = rng(42);
  for (let n = 0; n < 300; n++) {
    let r = emptyRecords();
    const start = addDays('2015-01-01', Math.floor(rand() * 5000));
    const days = Math.floor(rand() * 800);
    for (let i = 0; i < days; i++) {
      const x = rand();
      if (x < 0.3) r = setStatus(r, addDays(start, i), DONE);
      else if (x < 0.5) r = setStatus(r, addDays(start, i), NOT_YET);
    }
    assert.deepEqual(decodeBackup(encodeBackup(r)), { ...r });
  }
});

test('ファズ: どんな入力でも BackupError 以外の例外を出さない', () => {
  const rand = rng(7);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_ =+/!あ\n';
  for (let n = 0; n < 3000; n++) {
    const len = Math.floor(rand() * 40);
    let s = rand() < 0.7 ? '1' : '';
    for (let i = 0; i < len; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
    try {
      const r = decodeBackup(s);
      assert.ok(Object.isFrozen(r));
    } catch (e) {
      assert.ok(e instanceof BackupError, `${JSON.stringify(s)}: ${e}`);
    }
  }
});

test('回帰: 9999-12-31 を超える日付になる入力は MALFORMED（ファズで発見）', () => {
  expectError('1Q6xHudzMsGJ6', 'MALFORMED');
});
