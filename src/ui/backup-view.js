// バックアップ画面: 書き出し（コピー）と読み込み（上書き／統合）
import { encodeBackup, decodeBackup, BackupError } from '../lib/backup-codec.js';
import { analyzeImport, mergeRecords, overwriteRecords } from '../lib/import-merge.js';
import { countRecords, onlyDone } from '../lib/records.js';
import { formatDateJa } from './heatmap-view.js';
import { encodeQR, qrToSvgPath } from '../lib/qr.js';

const $ = (id) => document.getElementById(id);

/**
 * @param {object} deps
 * @param {() => {records: object, lastBackupKey: string|null}} deps.getState
 * @param {(patch: object) => void} deps.update 状態を更新して保存・再描画する
 * @param {() => string} deps.todayKey
 */
export function createBackupView({ getState, update, todayKey }) {
  const exportText = $('export-text');
  const importText = $('import-text');
  const status = $('backup-status');
  const error = $('import-error');
  const dialog = $('import-dialog');
  const steps = ['import-step-choose', 'import-step-overwrite'].map($);
  let pending = null; // 読み込もうとしている記録

  const showStep = (id) => steps.forEach((s) => (s.hidden = s.id !== id));
  const setStatus = (msg) => (status.textContent = msg);
  const setError = (msg) => (error.textContent = msg);

  $('btn-copy').addEventListener('click', async () => {
    setStatus('');
    const text = exportText.value;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('unsupported');
      await navigator.clipboard.writeText(text);
      update({ lastBackupKey: todayKey() });
      setStatus('コピーしました。メモアプリなど、なくさない場所に貼り付けて保存してください。');
    } catch {
      exportText.focus();
      exportText.select();
      setStatus('自動でコピーできませんでした。選択した文字列を長押し（パソコンは右クリック）してコピーしてください。');
    }
  });

  $('btn-import').addEventListener('click', () => {
    setError('');
    setStatus('');
    let incoming;
    try {
      // 仕様変更により「出た」だけを取り込む（旧形式の「出てない」は未記録として扱う）
      incoming = onlyDone(decodeBackup(importText.value));
    } catch (e) {
      setError(e instanceof BackupError ? e.message : 'バックアップの文字列として読み取れませんでした。');
      return;
    }
    pending = incoming;
    const a = analyzeImport(getState().records, incoming);
    $('import-summary').textContent =
      `読み込む記録: ${countRecords(incoming)}日分（新しく増える日 ${a.added}日・すでに記録がある日 ${a.same}日）。` +
      '今の記録と「統合」するか、読み込んだ内容で「上書き」するかを選んでください。';
    showStep('import-step-choose');
    dialog.showModal();
  });

  function apply(records) {
    update({ records });
    importText.value = '';
    pending = null;
    dialog.close();
    setStatus(`読み込みました（${countRecords(records)}日分の記録があります）。`);
  }

  dialog.addEventListener('click', (e) => {
    const action = e.target.closest('button')?.dataset.action;
    if (!action || !pending) return;
    const current = getState().records;
    switch (action) {
      // 記録は「出た」だけなので衝突は起きない（どちらを優先しても結果は同じ）
      case 'merge':
        return apply(mergeRecords(current, pending, { preferIncoming: true }));
      case 'overwrite': {
        const n = countRecords(current);
        if (n === 0) return apply(overwriteRecords(current, pending));
        $('overwrite-warning').textContent =
          `今の記録（${n}日分）はすべて消えて、読み込んだ記録（${countRecords(pending)}日分）に置き換わります。元に戻せません。`;
        return showStep('import-step-overwrite');
      }
      case 'overwrite-confirm':
        return apply(overwriteRecords(current, pending));
      case 'cancel':
        pending = null;
        return dialog.close();
    }
  });

  dialog.addEventListener('close', () => {
    pending = null;
  });

  const SVG_NS = 'http://www.w3.org/2000/svg';
  let lastQrText = null;
  function renderQR(text) {
    if (text === lastQrText) return;
    lastQrText = text;
    const box = $('qr-box');
    let qr;
    try {
      qr = encodeQR(text, 'M');
    } catch {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = '記録が多すぎて QR コードにできません。文字列の「コピー」を使ってください。';
      box.replaceChildren(p);
      return;
    }
    const n = qr.size + 8;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'バックアップのQRコード');
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('class', 'qr');
    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('width', String(n));
    bg.setAttribute('height', String(n));
    bg.setAttribute('fill', '#fff');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', qrToSvgPath(qr.modules));
    path.setAttribute('fill', '#000');
    svg.append(bg, path);
    box.replaceChildren(svg);
  }

  return {
    render() {
      const { records, lastBackupKey } = getState();
      exportText.value = encodeBackup(records);
      renderQR(exportText.value);
      $('last-backup').textContent = lastBackupKey
        ? `最後のバックアップ: ${formatDateJa(lastBackupKey).replace(/（.）$/, '')}`
        : 'まだバックアップしていません。';
    },
  };
}
