// アプリのエントリポイント（DOM 操作）。ロジックは src/lib/ の純粋関数に置く。
import { toDateKey } from './lib/date.js';
import { STATUS, getStatus, setStatus, clearStatus } from './lib/records.js';
import { createStorage, getLocalStorage, requestPersist } from './lib/storage.js';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const STATUS_TEXT = {
  [STATUS.NONE]: 'まだ記録していません',
  [STATUS.DONE]: '今日は「出た」',
  [STATUS.NOT_YET]: '今日は「出てない」',
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
  $('btn-not-yet').setAttribute('aria-pressed', String(status === STATUS.NOT_YET));
  $('btn-clear-today').hidden = status === STATUS.NONE;
}

function record(status) {
  persist({ ...state, records: setStatus(state.records, todayKey(), status) });
  render();
}

$('btn-done').addEventListener('click', () => record(STATUS.DONE));
$('btn-not-yet').addEventListener('click', () => record(STATUS.NOT_YET));
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

render();
requestPersist();
