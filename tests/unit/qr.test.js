// 自前 QR コードエンコーダ（バイトモード）の検証
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeQR, formatBits, versionBits, gfMul, rsRemainder, rsDivisor, dataCapacityBytes } from '../../src/lib/qr.js';

test('GF(256) 乗算（多項式 0x11D）', () => {
  assert.equal(gfMul(0, 0x53), 0);
  assert.equal(gfMul(1, 0x53), 0x53);
  assert.equal(gfMul(2, 0x80), 0x1d);
  assert.equal(gfMul(0x53, 0xca), gfMul(0xca, 0x53));
});

test('Reed-Solomon: 既知の例（ISO/IEC 18004 付録の 1-M "01234567"）', () => {
  // データ符号語 → 誤り訂正符号語 10 個
  const data = [0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11];
  const ecc = rsRemainder(data, rsDivisor(10));
  assert.deepEqual(ecc, [0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55]);
});

test('形式情報（BCH(15,5) + マスク 0x5412）の既知値', () => {
  assert.equal(formatBits('M', 0), 0b101010000010010);
  assert.equal(formatBits('L', 4), 0b110011000101111);
  assert.equal(formatBits('H', 7), 0b000100000111011);
});

test('型番情報（BCH(18,6)）の既知値', () => {
  assert.equal(versionBits(7), 0x07c94);
  assert.equal(versionBits(40), 0x28c69);
});

test('容量（バイトモード、誤り訂正 M）', () => {
  assert.equal(dataCapacityBytes(1, 'M'), 14);
  assert.equal(dataCapacityBytes(10, 'M'), 213);
  assert.equal(dataCapacityBytes(40, 'M'), 2331);
});

test('サイズ = 4×型番+17、最小の型番を選ぶ', () => {
  assert.equal(encodeQR('1').size, 21);
  assert.equal(encodeQR('A'.repeat(14)).size, 21);
  assert.equal(encodeQR('A'.repeat(15)).size, 25);
  const big = encodeQR('A'.repeat(500));
  assert.equal((big.size - 17) % 4, 0);
  assert.equal(big.version, (big.size - 17) / 4);
});

test('ファインダーパターンとタイミングパターン', () => {
  const { size, modules } = encodeQR('1AbC-_xyz');
  const finder = (x0, y0) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const d = Math.max(Math.abs(x - 3), Math.abs(y - 3));
      assert.equal(modules[y0 + y][x0 + x], d !== 2, `finder (${x0 + x},${y0 + y})`);
    }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  for (let i = 8; i < size - 8; i++) {
    assert.equal(modules[6][i], i % 2 === 0);
    assert.equal(modules[i][6], i % 2 === 0);
  }
  assert.equal(modules[size - 8][8], true, 'ダークモジュール');
});

test('形式情報が2箇所に同じ値で書かれている', () => {
  const { size, modules, mask } = encodeQR('hello');
  const bits = formatBits('M', mask);
  const bit = (i) => ((bits >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) assert.equal(modules[i][8], bit(i));
  for (let i = 0; i < 8; i++) assert.equal(modules[8][size - 1 - i], bit(i));
  for (let i = 8; i < 15; i++) assert.equal(modules[size - 15 + i][8], bit(i));
});

test('長すぎる文字列は例外', () => {
  assert.throws(() => encodeQR('A'.repeat(3000)), RangeError);
});

test('qrToSvgPath: 暗モジュールを 1x1 の正方形の path にする（静穏域 4 を足した座標）', async () => {
  const { qrToSvgPath } = await import('../../src/lib/qr.js');
  const d = qrToSvgPath([[true, false], [false, true]]);
  assert.equal(d, 'M4 4h1v1h-1zM5 5h1v1h-1z');
  const runs = qrToSvgPath([[true, true, true]]);
  assert.equal(runs, 'M4 4h3v1h-3z', '横に続く暗モジュールはまとめる');
});
