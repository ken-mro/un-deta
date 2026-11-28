// アプリのエントリポイント（DOM 操作）。ロジックは src/lib/ の純粋関数に置く。
import { toDateKey } from './lib/date.js';
import { STATUS, getStatus, setStatus, clearStatus } from './lib/records.js';
import { daysSinceLastDone } from './lib/since.js';
import { createHeatmapView, formatDateJa } from './ui/heatmap-view.js';
import { detectPlatform } from './lib/platform.js';
import { createBackupView } from './ui/backup-view.js';
import { createCalendarView } from './ui/calendar-view.js';
import { shouldRemindBackup } from './lib/backup-reminder.js';
import { paintDay } from './lib/bulk-paint.js';
import { createStorage, getLocalStorage, requestPersist } from './lib/storage.js';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const STATUS_TEXT = {
  [STATUS.NONE]: 'まだ記録していません',
  [STATUS.DONE]: '今日は「出た」',
  [STATUS.LITTLE]: '今日は「ちょっと出た」',
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
  $('btn-little').setAttribute('aria-pressed', String(status === STATUS.LITTLE));
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
  $('backup-panel').open = true;
  const copy = $('btn-copy');
  copy.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  copy.focus({ preventScroll: true });
});
$('btn-reminder-later').addEventListener('click', () => {
  persist({ ...state, dismissedKey: todayKey() });
  render();
});

// ---- ヒートマップと日付ごとの修正 ----
const STATUS_NAME = { [STATUS.NONE]: '未記録', [STATUS.DONE]: '出た', [STATUS.LITTLE]: 'ちょっと出た' };
const dayDialog = $('day-dialog');
let editingDate = null;
let returnFocus = null; // 閉じたあとにフォーカスを戻すビュー

function openDayDialog(date, view) {
  editingDate = date;
  returnFocus = view;
  $('day-dialog-title').textContent = formatDateJa(date);
  const current = getStatus(state.records, date);
  $('day-dialog-current').textContent = `いまの記録: ${STATUS_NAME[current]}`;
  dayDialog.querySelectorAll('[data-set][aria-pressed]').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.set) === current));
    b.disabled = false;
  });
  dayDialog.querySelector('[data-testid="day-celebration"]').hidden = true;
  dayDialog.showModal();
}

const heatmap = createHeatmapView($('heatmap'));
// まとめて記録: 1日ごとにすぐ保存し、ひと筆が終わったら画面全体を描き直す
let bulkSnapshot = null;
const calendar = createCalendarView($('calendar'), (date) => openDayDialog(date, calendar), {
  start() {
    bulkSnapshot = state.records;
  },
  paint(date, target) {
    const next = paintDay(state.records, date, target, todayKey());
    if (next === state.records) return false;
    persist({ ...state, records: next });
    return true;
  },
  commit: () => render(),
  revert() {
    if (bulkSnapshot) persist({ ...state, records: bulkSnapshot });
    render();
  },
});

// 記録してから閉じるまでの時間（演出を見せる。reduced-motion では短く）
const DAY_CLOSE_DELAY_MS = 1300;
const DAY_CLOSE_DELAY_REDUCED_MS = 600;
let dayCloseTimer;

dayDialog.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn || btn.disabled) return;
  if (btn.dataset.set === undefined || !editingDate) {
    dayDialog.close();
    return;
  }
  const status = Number(btn.dataset.set);
  if (status === STATUS.NONE) {
    persist({ ...state, records: clearStatus(state.records, editingDate) });
    dayDialog.close();
    return;
  }
  // 今日の記録と同じように: すぐ保存して、押した感触と「すっきり」の演出を見せてから閉じる
  persist({ ...state, records: setStatus(state.records, editingDate, status) });
  render();
  $('day-dialog-current').textContent = `いまの記録: ${STATUS_NAME[status]}`;
  dayDialog.querySelectorAll('[data-set][aria-pressed]').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.set) === status));
    b.disabled = true; // 演出中の二度押しを防ぐ
  });
  celebrate(dayDialog.querySelector('[data-testid="day-celebration"]'), status);
  clearTimeout(dayCloseTimer);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  dayCloseTimer = setTimeout(() => dayDialog.close(), reduced ? DAY_CLOSE_DELAY_REDUCED_MS : DAY_CLOSE_DELAY_MS);
});

dayDialog.addEventListener('close', () => {
  clearTimeout(dayCloseTimer);
  render();
  if (editingDate) returnFocus?.focus(editingDate);
  editingDate = null;
  returnFocus = null;
});

// 押下時の演出（見た目だけ。読み上げは状態テキストで行う）
const celebrationTimers = new WeakMap();
function celebrate(fx, status) {
  fx.querySelector('.celebration-text').textContent = status === STATUS.LITTLE ? 'ちょっとすっきり' : 'すっきり！';
  fx.classList.toggle('is-quiet', status === STATUS.LITTLE);
  fx.hidden = true;
  void fx.offsetWidth; // アニメーションを最初から再生し直す
  fx.hidden = false;
  clearTimeout(celebrationTimers.get(fx));
  celebrationTimers.set(
    fx,
    setTimeout(() => {
      fx.hidden = true;
    }, 1500),
  );
}

function recordToday(status) {
  persist({ ...state, records: setStatus(state.records, todayKey(), status) });
  render();
  celebrate(document.querySelector('[data-testid="celebration"]'), status);
}

$('btn-done').addEventListener('click', () => recordToday(STATUS.DONE));
$('btn-little').addEventListener('click', () => recordToday(STATUS.LITTLE));
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
