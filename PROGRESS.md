# PROGRESS

各イテレーションの最後に、やったこと・判断したこと・申し送りを追記する。

---

## 2026-11-26 タスク0-1: package.json / .gitignore / ディレクトリ構成
- やったこと: `tests/unit/project-structure.test.js` を先に書き（Red: ENOENT）、package.json（type: module, private, `npm test`=node --test, `npm run test:e2e`=playwright）、.gitignore（.loop-logs/ 等）、src/lib・tests/e2e を作成（Green 5件）
- 判断: パッケージマネージャは pnpm@11.1.2。サプライチェーン対策として `.npmrc`（ignore-scripts, save-exact, engine-strict）と `pnpm-workspace.yaml`（minimumReleaseAge 7日, blockExoticSubdeps, trustPolicy no-downgrade, strictDepBuilds）を追加。テストで設定の存在を固定
- 申し送り: CLAUDE.md に「依存パッケージとセキュリティ」節を追加。ループ内で依存を追加しないこと。Node は 22 以上（node --test の glob を使うため）

## 2026-11-26 タスク0-2: node --test の確認と scripts/serve.mjs
- やったこと: `tests/unit/serve.test.js`（9件、Red: モジュールなし）→ 依存なしの `scripts/serve.mjs`（`startServer({root, port})` を export、CLI 起動も可）で Green。`npm test` は 14件 pass
- 判断: 127.0.0.1 のみで待ち受け、GET/HEAD 以外は 405、パストラバーサル（`..`、`%2e%2e`、`%2f`、`\`、シンボリックリンク）とドットファイル（.git 等）を拒否、不正エンコード・NUL は 400、nosniff ヘッダ付与。フィクスチャは `tests/fixtures/site/`
- 申し送り: サブパス（/un-deta/）対応は PLAN 3 のタスクで `startServer` にオプションを足す想定。既定ポート 4173

## 2026-11-26 タスク0-3: Playwright 導入
- やったこと: `tests/unit/playwright-config.test.js` と `tests/e2e/smoke.spec.js` を先に書き（Red）、`pnpm add -D --save-exact @playwright/test@1.65.1`、`playwright.config.js`（chromium / Mobile Safari=webkit iPhone 13、webServer=serve.mjs:4173、forbidOnly、reuseExistingServer:false）で Green。ユニット15件・E2E 4件 pass
- 判断: 依存は3パッケージのみ、`pnpm audit` で既知の脆弱性なし。devices の iPhone プリセットは browserName を持たない（defaultBrowserType のみ）ため明示指定。ブラウザ（chromium, webkit）はインストール済み
- 申し送り: スモーク E2E は `tests/fixtures/site/index.html` を開くだけ。アプリの index.html ができたら本物の E2E を追加していく。verify.sh の残 NG は未作成ファイルと未完了タスクのみ

## 2026-11-26 タスク1-1: 日付ユーティリティ
- やったこと: `tests/unit/date.test.js`（7件、Red: モジュールなし）→ `src/lib/date.js`（toDateKey / parseDateKey / isValidDateKey / addDays / diffDays）で Green
- 判断: 日付は 'YYYY-MM-DD' 文字列キーで扱う。境界はローカル時刻（toDateKey は getFullYear 等）、加減算・差分は UTC ミリ秒で計算し夏時間の影響を排除。実在しない日（2023-02-29 等）は RangeError。TZ=America/New_York, Europe/London, Pacific/Chatham, Asia/Tokyo で全件 pass を確認
- 申し送り: 以降のロジックは日付キー文字列を受け渡す前提で作る（Date オブジェクトを持ち回らない）

## 2026-11-26 タスク1-2: 記録ストア
- やったこと: `tests/unit/records.test.js`（6件、Red）→ `src/lib/records.js`（STATUS, emptyRecords, getStatus, setStatus, clearStatus, countRecords, isValidStatus）で Green
- 判断: 記録は凍結したプレーンオブジェクト `{ 'YYYY-MM-DD': 1|2 }`。未記録はキーなし（0 は保存しない）。STATUS 値はバックアップの 2bit と一致（0/1/2）。不正キー（`__proto__` 含む）・不正状態は RangeError
- 申し送り: 連続日数・エンコードはこの形を入力にする

## 2026-11-26 タスク1-3: 「出てない」連続日数
- やったこと: `tests/unit/streak.test.js`（9件、Red）→ `src/lib/streak.js` の `notYetStreak(records, todayKey)` で Green
- 判断（仕様の固定）: 基準日から過去へ「出てない」を数え「出た」で停止。未記録は数えず途切れさせない（長期間の未記録や年跨ぎでも継続）。今日が未記録でも過去の連続を表示。基準日より未来の記録は無視
- 申し送り: UI では今日のキーを toDateKey(new Date()) で渡すこと

## 2026-11-26 タスク1-4: バックアップのエンコード／デコード
- やったこと: `tests/unit/backup-codec.test.js`（16件、Red）→ `src/lib/backup-codec.js`（encodeBackup / decodeBackup / BackupError / FORMAT_VERSION）で Green
- 判断（形式 v1）: 先頭1文字 '1' がバージョン、続けて base64url で [開始日=1970-01-01 からの日数 3B][1日2bit・1Bに4日・下位から][CRC-8]。空データは '1'。1年分で約130文字。空白・改行は無視。エラーは code（EMPTY/TOO_LONG/MALFORMED/UNKNOWN_VERSION/CHECKSUM）と丁寧な日本語メッセージ。入力長上限 5万文字
- ファズテストで「年 10000 以降の日付を生成して RangeError が漏れる」バグを発見し修正（9999-12-31 までに制限、回帰テスト追加）
- 申し送り: UI は BackupError の message をそのまま表示してよい（textContent で表示すること）

## 2026-11-26 タスク1-5: インポートの上書き／統合
- やったこと: `tests/unit/import-merge.test.js`（7件、Red）→ `src/lib/import-merge.js`（overwriteRecords / analyzeImport / mergeRecords）で Green
- 判断: 衝突＝両方に記録があり値が異なる日。統合は `preferIncoming` の指定が必須（未指定は TypeError＝確認を飛ばせない）。未記録は相手の記録を消さない。analyzeImport で added / same / conflicts / onlyCurrent を返し、UI の確認ダイアログに使う
- 申し送り: UI では「上書き」選択時に onlyCurrent 件数が消えることを明示して確認するとよい
