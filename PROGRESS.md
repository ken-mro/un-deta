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

## 2026-11-26 タスク1-6: バックアップ催促の判定
- やったこと: `tests/unit/backup-reminder.test.js`（7件、Red）→ `src/lib/backup-reminder.js` の `shouldRemindBackup({ records, lastBackupKey, dismissedKey, todayKey })` で Green
- 判断: 記録0件なら出さない。起点は「最後のバックアップ日（未実施なら最初の記録日）」と「あとで で閉じた日」の新しい方で、30日以上で表示。保存値が壊れていたら未実施扱い。時計が戻った（起点が未来）場合は出さない
- 申し送り: UI ではコピー成功時に lastBackupKey、催促を閉じたときに dismissedKey を保存する

## 2026-11-26 タスク1-7: 永続化アダプタ
- やったこと: `tests/unit/storage.test.js`（8件、Red）→ `src/lib/storage.js`（createStorage / getLocalStorage / requestPersist / STORAGE_KEY）で Green
- 判断: キー `un-deta:v1` に `{ v, records, lastBackupKey, dismissedKey }` を JSON 保存。読み込み時は検証して不正な日・値を捨てる（`__proto__` でのプロトタイプ汚染なし）。getItem/setItem の例外（SecurityError, QuotaExceeded）や localStorage 自体の取得失敗でも落ちない（load→既定値、save→false）。requestPersist は persisted() 済みなら再要求しない、非対応は 'unsupported'
- 申し送り: UI は save() が false のとき「保存できませんでした」を表示すること。起動時に requestPersist() を呼ぶ

## 2026-11-26 タスク1-8: プラットフォーム判定
- やったこと: `tests/unit/platform.test.js`（5件、Red）→ `src/lib/platform.js`（detectOS / isStandalone / detectPlatform）で Green。ロジックフェーズ完了（ユニット 80件）
- 判断: iPhone/iPad/iPod は ios、Mac を名乗りつつ maxTouchPoints>1 は iPadOS として ios、Android は android、他は other。standalone は display-mode: standalone か navigator.standalone（iOS）
- 申し送り: 次は UI フェーズ。E2E を先に書く。index.html には CSP メタタグ（default-src 'self'）を入れ、外部入力は textContent で表示すること。効能表現チェックの対象なので index.html / src に「治療」等の語を書かない（免責文は terms.html 側へ）

## 2026-11-26 タスク2-1: ホーム画面（今日の記録と保持）
- やったこと: `tests/e2e/home.spec.js`（6件×2ブラウザ、Red: 404）→ `index.html` / `src/styles.css` / `src/app.js` で Green（E2E 16件 pass）
- 判断: page.clock で日付固定。ボタンは aria-pressed で状態を表現、状態テキストは role=status。今日の記録の取り消しボタンを用意。保存失敗時は role=alert で通知。CSP メタタグ（default-src 'self'、inline script/style なし）。visibilitychange で日付跨ぎに追従。起動時に requestPersist()
- 申し送り: 状態テキストは textContent で設定。data-testid="today" / "today-status" を E2E が使用

## 2026-11-26 タスク2-2: 押下時の演出
- やったこと: `tests/e2e/feedback.spec.js`（4件×2、Red）→ ポップ表示「すっきり！」＋粒の飛散（出てない は「また明日〜」で粒なし）を CSS アニメーションで実装（E2E 24件 pass）
- 判断: 演出要素は aria-hidden（読み上げは状態テキスト）。1.5秒で非表示、連打時はタイマーを張り直してアニメを再生し直す。prefers-reduced-motion: reduce では全アニメーション・トランジションを無効化し、文言だけ静的に表示
- 申し送り: 新しいアニメーションを足すときも reduced-motion の一括無効化に乗る（!important）

## 2026-11-26 タスク2-3: 連続日数表示
- やったこと: `tests/e2e/streak.spec.js`（3件×2、Red）と共通ヘルパー `tests/e2e/helpers.js`（seed / fixToday / readSaved）→ ホームに「『出てない』が N日 続いています」を表示（E2E 30件 pass）
- 判断: 0日のときは非表示（毎日見て気にならないように）。計算は src/lib/streak.js をそのまま使用
- 申し送り: seed() は sessionStorage フラグで初回のみ仕込むので、reload を跨ぐテストでも使える

## 2026-11-26 タスク2-4: ヒートマップと日付タップでの修正・取り消し
- やったこと: レイアウトの純粋関数 `src/lib/heatmap.js`（buildHeatmap / dayOfWeek、ユニット6件）と E2E `tests/e2e/heatmap.spec.js`（7件×2）を先に書き Red → `src/ui/heatmap-view.js` と `<dialog>` で Green（ユニット86件・E2E 44件 pass）
- 判断: 今日を含む365日、日曜始まりの週列。セルは button（aria-label「2024年3月9日（土） 出た」）、roving tabindex で Tab 1回・矢印で ±1日/±7日・Home/End。出てない は枠線表示で色以外でも区別。修正は showModal ダイアログ（出た／出てない／記録を消す／キャンセル、Esc で閉じる）、閉じたらセルにフォーカスを戻す。DOM は createElement で構築（innerHTML 不使用）、style は CSSOM 経由なので CSP style-src 'self' に抵触しない
- 申し送り: 初期表示で右端（今日）へスクロール。曜日ラベルはスクロールで隠れる（必要なら sticky 化）

## 2026-11-26 タスク2-5: ホーム画面追加の警告と OS 別案内
- やったこと: `tests/e2e/install-guide.spec.js`（UA を iPhone/Android/Windows に切替、standalone は matchMedia を差し替えて再現。Red）→ index.html に警告バナー＋`<details>` の手順、app.js で detectPlatform により出し分け（E2E 54件 pass）
- 判断: standalone なら非表示。警告文「このままだと記録が消える可能性があります」。手順は折りたたみで、該当 OS 以外の手順は DOM から削除（textContent に混ざらないように）。iOS は Safari で開く旨も案内。PC は一般的な案内＋こまめなバックアップを促す
- 申し送り: 「下の『バックアップ』」と案内しているので、バックアップ画面はホームの下部に置くこと

## 2026-11-26 タスク2-6: バックアップ画面
- やったこと: `tests/e2e/backup.spec.js`（9件×2、期待値は src/lib の encodeBackup で計算。Red）→ `src/ui/backup-view.js` とホーム下部のバックアップ節・読み込みダイアログで Green（E2E 72件 pass）
- 判断: コピー成功で lastBackupKey=今日を保存し「最後のバックアップ: 〜」を表示。クリップボード不可なら文字列を選択して手動コピーを案内（lastBackupKey は更新しない）。読み込みは decode→サマリ表示→「統合／上書き／やめる」。統合で衝突があれば「読み込む側を優先／今の記録を優先」を確認。上書きは今の記録がある場合のみ件数付きで再確認。エラーは BackupError の文言を role=alert に textContent で表示
- 申し送り: 次の QR 表示は「書き出す」の下に置く想定（同じ encodeBackup の文字列）

## 2026-11-26 タスク2-7: QRコード表示
- やったこと: `tests/unit/qr.test.js`（GF 乗算、ISO 付録の RS 例、形式／型番情報の既知値、容量、構造など10件）と `tests/e2e/qr.spec.js`（3件×2）を先に書き Red → 自前エンコーダ `src/lib/qr.js`（バイトモード、型番1〜40、L/M/Q/H、マスク選択、qrToSvgPath）とバックアップ節の `<details>` 内に SVG 表示で Green（ユニット96件・E2E 78件）
- 検証: macOS CoreImage（CIDetector）で型番1〜40・日本語・実バックアップ文字列の25件をデコードし全一致。ブラウザ描画（ダークモード）のスクショも一致。検証スクリプトはリポジトリ外（依存を増やさないため）
- 判断: 誤り訂正 M。QR は常に白地に黒。収まらない長さ（約2300文字超）は「コピーを使って」と表示。QR の aria-label は既存のラベル検索と部分一致しないよう「バックアップのQRコード」。QR を開くだけでは移行されずアプリ内で貼り付けが必要な旨を併記
- 申し送り: 次は機種変更手順の説明（iOS のストレージ分離）
