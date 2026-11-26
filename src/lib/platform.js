// プラットフォーム判定（純粋関数）。ブラウザの値は呼び出し側で集めて渡す:
//   detectPlatform({
//     userAgent: navigator.userAgent,
//     maxTouchPoints: navigator.maxTouchPoints,
//     displayModeStandalone: matchMedia('(display-mode: standalone)').matches,
//     navigatorStandalone: navigator.standalone === true,
//   })

/** @returns {'ios'|'android'|'other'} */
export function detectOS({ userAgent = '', maxTouchPoints = 0 } = {}) {
  const ua = String(userAgent);
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  // iPadOS 13+ の Safari は Mac を名乗る。タッチ点数で見分ける
  if (/Macintosh/.test(ua) && Number(maxTouchPoints) > 1) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

/** ホーム画面から起動されているか */
export function isStandalone({ displayModeStandalone = false, navigatorStandalone = false } = {}) {
  return displayModeStandalone === true || navigatorStandalone === true;
}

export function detectPlatform(env = {}) {
  return { os: detectOS(env), standalone: isStandalone(env) };
}
