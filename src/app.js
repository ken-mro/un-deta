// アプリのエントリポイント（DOM 操作）。ロジックは src/lib/ の純粋関数に置く。
import { toDateKey } from './lib/date.js';
import { STATUS, getStatus, setStatus, clearStatus } from './lib/records.js';
import { daysSinceLastDone } from './lib/since.js';
import { createHeatmapView, formatDateJa } from './ui/heatmap-view.js';
import { detectPlatform } from './lib/platform.js';
import { createBackupView } from './ui/backup-view.js';
import { createCalendarView } from './ui/calendar-view.js';
import { shouldRemindBackup } from './lib/backup-reminder.js';
import { createStorage, getLocalStorage, requestPersist } from './lib/storage.js';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const STATUS_TEXT = {
  [STATUS.NONE]: 'まだ記録していません',
  [STATUS.DONE]: '今日は「出た」',
};

const $ = (id) => document.getElementById(id);
const storage = createStorage(getLocalStorage(window));
let state = storage.load();

const todayKey = () => toDateKey(new Date());

function formatToday(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAYS[date.getDay()]}）`;
}

function persist(next) {
  state = next;
  $('save-error').hidden = storage.save(state);
}

function render() {
  const key = todayKey();
  const status = getStatus(state.records, key);
  document.querySelector('[data-testid="today"]').textContent = formatToday(new Date());
  document.querySelector('[data-testid="today-status"]').textContent = STATUS_TEXT[status];
  $('btn-done').setAttribute('aria-pressed', String(status === STATUS.DONE));
  $('btn-clear-today').hidden = status === STATUS.NONE;

  const since = daysSinceLastDone(state.records, key);
  const sinceEl = document.querySelector('[data-testid="since"]');
  sinceEl.hidden = since === null || since === 0;
  sinceEl.textContent = since ? `前回の「出た」から ${since}日` : '';

  calendar.render(state.records, key);
  heatmap.render(state.records, key);
  backupView.render();

  $('backup-reminder').hidden = !shouldRemindBackup({ ...state, todayKey: key });
  $('reminder-text').textContent = state.lastBackupKey
    ? '最後のバックアップから30日以上たちました。端末の故障や機種変更にそなえて、記録を書き出しておきませんか。'
    : 'まだ一度もバックアップしていません。端末の故障や機種変更にそなえて、記録を書き出しておきませんか。';
}

// ---- バックアップ催促 ----
$('btn-reminder-go').addEventListener('click', () => {
  const copy = $('btn-copy');
  copy.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  copy.focus({ preventScroll: true });
});
$('btn-reminder-later').addEventListener('click', () => {
  persist({ ...state, dismissedKey: todayKey() });
  render();
});

// ---- ヒートマップと日付ごとの修正 ----
const STATUS_NAME = { [STATUS.NONE]: '未記録', [STATUS.DONE]: '出た' };
const dayDialog = $('day-dialog');
let editingDate = null;
let returnFocus = null; // 閉じたあとにフォーカスを戻すビュー

function openDayDialog(date, view) {
  editingDate = date;
  returnFocus = view;
  $('day-dialog-title').textContent = formatDateJa(date);
  $('day-dialog-current').textContent = `いまの記録: ${STATUS_NAME[getStatus(state.records, date)]}`;
  dayDialog.showModal();
}

const heatmap = createHeatmapView($('heatmap'), (date) => openDayDialog(date, heatmap));
const calendar = createCalendarView($('calendar'), (date) => openDayDialog(date, calendar));

dayDialog.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.set !== undefined && editingDate) {
    persist({ ...state, records: setStatus(state.records, editingDate, Number(btn.dataset.set)) });
  }
  dayDialog.close();
});

dayDialog.addEventListener('close', () => {
  render();
  if (editingDate) returnFocus?.focus(editingDate);
  editingDate = null;
  returnFocus = null;
});

// 押下時の演出（見た目だけ。読み上げは状態テキストで行う）
let celebrationTimer;
function celebrate() {
  const fx = document.querySelector('[data-testid="celebration"]');
  fx.querySelector('.celebration-text').textContent = 'すっきり！';
  fx.hidden = true;
  void fx.offsetWidth; // アニメーションを最初から再生し直す
  fx.hidden = false;
  clearTimeout(celebrationTimer);
  celebrationTimer = setTimeout(() => {
    fx.hidden = true;
  }, 1500);
}

function recordToday() {
  persist({ ...state, records: setStatus(state.records, todayKey(), STATUS.DONE) });
  render();
  celebrate();
}

$('btn-done').addEventListener('click', recordToday);
$('btn-clear-today').addEventListener('click', () => {
  persist({ ...state, records: clearStatus(state.records, todayKey()) });
  render();
});

// 日付をまたいで開きっぱなしでも、戻ってきたら今日の表示に更新する
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    state = storage.load();
    render();
  }
});

// ---- バックアップ ----
const backupView = createBackupView({
  getState: () => state,
  update: (patch) => {
    persist({ ...state, ...patch });
    render();
  },
  todayKey,
});

// ---- ホーム画面に追加していないときの警告と案内 ----
function setupInstallBanner() {
  const { os, standalone } = detectPlatform({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    displayModeStandalone: window.matchMedia?.('(display-mode: standalone)').matches === true,
    navigatorStandalone: navigator.standalone === true,
  });
  $('install-banner').hidden = standalone;
  document.querySelector('[data-testid="install-guide"]').dataset.os = os;
  // 該当しない OS の手順は取り除く（読み上げや検索で混ざらないように）
  document.querySelectorAll('[data-guide-os]').forEach((ol) => {
    if (ol.dataset.guideOs === os) ol.hidden = false;
    else ol.remove();
  });
}

setupInstallBanner();
render();
heatmap.scrollToEnd();
requestPersist();

// オフライン動作のための service worker（相対パスなのでサブパス配信でも動く）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
    /* 登録できなくてもアプリは動く */
  });
}
