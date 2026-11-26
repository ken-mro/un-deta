# セットアップと実行（Ken 用）

## 1. 準備
```bash
mkdir un-deta && cd un-deta
# このキットのファイルをすべてコピー（.claude/ も含む）
git init && git add -A && git commit -m "chore: ループ開発キット"
chmod +x loop.sh scripts/verify.sh
```
Node.js 20 以上と Claude Code が必要です。
Playwright のブラウザは、最初のタスクでエージェントが `npx playwright install chromium webkit` を実行します。
ネットワーク制限で失敗する場合は、手動で実行してください。

## 2. まず1回だけ対話で試す（おすすめ）
```bash
claude
> PROMPT.md の指示に従って作業してください
```
1タスク分の動きと権限まわりを確認してから、ループに移ります。

## 3. ループを回す
```bash
./loop.sh        # 既定で最大40回
./loop.sh 60     # 回数を指定
```
- 終了条件は `scripts/verify.sh` が PASS すること。全テスト通過、PLAN.md 完了、規約の必須項目、外部リクエストなし、を機械的に判定します
- 3回連続でコミットが増えなければ自動停止します
- ログは `.loop-logs/`、進捗は `PROGRESS.md` と `git log` で確認できます

## 4. 完成後に人間がやること
- `HUMAN_TODO.md` の対応（問い合わせ先 `{{CONTACT}}` の差し替えなど）
- 利用規約・プライバシーポリシーの最終確認（エージェントが作成した下書きです。必要に応じて専門家に確認してください）
- 実機（iPhone / Android）での確認: ホーム画面への追加、オフライン起動、バックアップと機種変更の流れ
- GitHub にリポジトリ `un-deta` を作って push し、Pages を有効化
