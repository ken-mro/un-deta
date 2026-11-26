#!/usr/bin/env bash
# Ralph 方式の自律ループ。
# 毎回フレッシュな Claude Code セッションに PROMPT.md を渡し、
# scripts/verify.sh が PASS したら終了する。
#
# 使い方: ./loop.sh [最大イテレーション数(既定 40)]
set -u
cd "$(dirname "$0")"

MAX=${1:-40}
FAIL_STREAK_LIMIT=3   # verify が改善しないまま連続でコミットが増えない回数の上限
mkdir -p .loop-logs

no_progress=0
for i in $(seq 1 "$MAX"); do
  echo "===== iteration $i / $MAX ($(date '+%F %T')) ====="
  before=$(git rev-parse HEAD 2>/dev/null || echo none)

  claude -p "$(cat PROMPT.md)" \
    --permission-mode acceptEdits \
    --output-format text \
    > ".loop-logs/iter-$(printf %03d "$i").log" 2>&1

  after=$(git rev-parse HEAD 2>/dev/null || echo none)
  tail -n 5 ".loop-logs/iter-$(printf %03d "$i").log"

  if bash scripts/verify.sh > .loop-logs/verify-latest.log 2>&1; then
    echo "✅ VERIFY PASS — 完成しました（iteration $i）"
    exit 0
  fi

  if [ "$before" = "$after" ]; then
    no_progress=$((no_progress + 1))
    echo "⚠️ コミットなし（$no_progress / $FAIL_STREAK_LIMIT）"
    if [ "$no_progress" -ge "$FAIL_STREAK_LIMIT" ]; then
      echo "🛑 進捗が止まったので停止します。PROGRESS.md と HUMAN_TODO.md、.loop-logs/ を確認してください。"
      exit 2
    fi
  else
    no_progress=0
  fi
done

echo "🛑 最大イテレーション数に達しました。.loop-logs/verify-latest.log を確認してください。"
exit 1
