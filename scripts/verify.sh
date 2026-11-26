#!/usr/bin/env bash
# 機械的な完了判定。ループはこのスクリプトの成否で終了を判断する。
# エージェントはこのファイルを変更してはいけない。
set -u
cd "$(dirname "$0")/.."

fail=0
step() { echo; echo "== $1"; }
ng()   { echo "NG: $1"; fail=1; }

step "必須ファイル"
for f in index.html manifest.webmanifest sw.js terms.html privacy.html README.md HUMAN_TODO.md package.json; do
  [ -f "$f" ] || ng "$f がありません"
done
ls tests/unit/*.test.* >/dev/null 2>&1 || ng "tests/unit にユニットテストがありません"
ls tests/e2e/*.spec.* >/dev/null 2>&1  || ng "tests/e2e に E2E テストがありません"

step "テストの skip / only 禁止"
if grep -rnE '\.(skip|only)\(|test\.fixme|\{ *skip: *true' tests/ 2>/dev/null; then
  ng "skip / only / fixme が含まれています"
fi

step "外部 URL の読み込み禁止（アプリ本体）"
app_files=$(ls *.html *.js *.webmanifest 2>/dev/null; find src -type f 2>/dev/null)
if [ -n "$app_files" ]; then
  # 規約・ポリシー内の <a href> による外部リンクは許可。src/href/import/fetch による読み込みを検出
  if grep -nE '(src=|import[^;]*from|fetch\(|url\(|@import)[^"'"'"']*["'"'"']?https?://' $app_files; then
    ng "外部リソースの読み込みがあります"
  fi
fi

step "効能表現の禁止"
if grep -nE '便秘(を|が)?(改善|解消|治)|健康にな|治療|治る' index.html src -r 2>/dev/null; then
  ng "効能をうたう表現があります"
fi

step "規約・ポリシーの必須項目"
for kw in "医療機器" "免責" "禁止事項" "準拠法"; do
  grep -q "$kw" terms.html 2>/dev/null || ng "terms.html に「$kw」がありません"
done
for kw in "収集" "端末" "GitHub" "問い合わせ"; do
  grep -q "$kw" privacy.html 2>/dev/null || ng "privacy.html に「$kw」がありません"
done

step "ユニットテスト"
npm test || ng "ユニットテスト失敗"

step "E2E テスト"
npm run test:e2e || ng "E2E テスト失敗"

step "PLAN の残タスク"
if grep -nE '^\s*- \[ \]' PLAN.md; then
  ng "PLAN.md に未完了タスクがあります"
fi

echo
if [ $fail -eq 0 ]; then echo "VERIFY: PASS"; exit 0; else echo "VERIFY: FAIL"; exit 1; fi
