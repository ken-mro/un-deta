// インポートの「上書き」「統合」（純粋関数）
// 衝突 = 同じ日に両方とも記録があり、値が異なる日。

/** 上書き: 読み込んだ内容で置き換える */
export const overwriteRecords = (_current, incoming) => Object.freeze({ ...incoming });

/** 取り込み前の確認用サマリ */
export function analyzeImport(current, incoming) {
  const conflicts = [];
  let added = 0;
  let same = 0;
  for (const date of Object.keys(incoming).sort()) {
    if (!Object.hasOwn(current, date)) added += 1;
    else if (current[date] === incoming[date]) same += 1;
    else conflicts.push({ date, current: current[date], incoming: incoming[date] });
  }
  const onlyCurrent = Object.keys(current).filter((d) => !Object.hasOwn(incoming, d)).length;
  return { added, same, conflicts, onlyCurrent };
}

/**
 * 統合: 両方の記録を合わせる。未記録は相手の記録を消さない。
 * 衝突日の扱いは options.preferIncoming（true=読み込む側を優先 / false=今の記録を優先）で必ず指定する。
 */
export function mergeRecords(current, incoming, options) {
  if (typeof options?.preferIncoming !== 'boolean') {
    throw new TypeError('mergeRecords: 衝突時の扱い（preferIncoming）を指定してください');
  }
  return Object.freeze(options.preferIncoming ? { ...current, ...incoming } : { ...incoming, ...current });
}
