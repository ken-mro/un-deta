// 右側の欄（広い画面のとき）に出す内容の切り替え: カレンダー／これまでの記録。
// 表示・非表示は CSS（.widgets[data-active]）が広い画面のときだけ行う。スマホの幅では両方を縦に並べる。

/**
 * @param {HTMLElement} root `.widgets` の要素
 * @param {(name: string) => void} [onShow] 切り替えたとき（表示されたあとに呼ぶ）
 */
export function createWidgetSwitch(root, onShow) {
  const buttons = [...root.querySelectorAll('[data-widget]')];

  function show(name) {
    root.dataset.active = name;
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.widget === name));
    onShow?.(name);
  }

  for (const b of buttons) b.addEventListener('click', () => show(b.dataset.widget));
  show(buttons.find((b) => b.getAttribute('aria-pressed') === 'true')?.dataset.widget ?? buttons[0].dataset.widget);
  return { show };
}
