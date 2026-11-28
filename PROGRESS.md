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

## 2026-11-26 タスク2-8: 機種変更手順の説明
- やったこと: `tests/e2e/device-change.spec.js`（2件×2、Red）→ バックアップ節に `<details>`「機種変更するときは」（4ステップ＋iPhone の注意）を追加（E2E 82件 pass）
- 判断: 手順は「今の端末でコピー → 新しい端末でホーム画面に追加 → ホーム画面のアイコンから開く → 貼り付けて読み込む」。iOS は Safari とホーム画面アプリで保存場所が別々で、QR を Safari で開いても反映されない旨を明記。既存テストの getByText('追加のしかた') と衝突しない文言にした
- 申し送り: 次はバックアップ催促の表示（src/lib/backup-reminder.js を使用、dismissedKey を保存）

## 2026-11-26 タスク2-9: バックアップ催促の表示
- やったこと: `tests/e2e/backup-reminder.spec.js`（5件×2、Red）→ ホーム上部に「バックアップしておく？」節（バックアップする／あとで）を追加し、render() で shouldRemindBackup により表示切替（E2E 92件 pass）
- 判断: 「バックアップする」はコピーボタンへスクロール＆フォーカス（reduced-motion では smooth スクロールしない）。「あとで」で dismissedKey=今日を保存。コピー成功で lastBackupKey が更新され自動で消える。文言はバックアップ未実施／30日経過で出し分け
- 申し送り: 次はダークモード。色はすべて :root の CSS 変数に寄せてあるので、prefers-color-scheme: dark で上書きする

## 2026-11-26 タスク2-10: ダークモード
- やったこと: `tests/e2e/dark-mode.spec.js`（OS 設定への追従＋ライト／ダーク両方で主要15要素のコントラスト比 4.5:1 以上をページ内で計算。Red）→ `prefers-color-scheme: dark` で :root の CSS 変数を上書き（E2E 98件 pass）
- 判断: color-scheme: light dark（フォーム部品も追従）。色のハードコードを変数化（--border, --warn-*, --cell-*）。ダークのアクセントは明るい橙に暗い文字。QR は常に白地に黒のまま
- 申し送り: 警告バナーと催促が両方出ると「出た」ボタンが下がる。最終レビューで配置を検討してもよい

## 2026-11-26 タスク2-11: 端末内保存の表示とフッター
- やったこと: `tests/e2e/footer.spec.js`（2件×2、Red）→ ヘッダーに「データはこの端末の中だけに保存されます。どこにも送信しません。」、フッター（contentinfo）に ./terms.html・./privacy.html への相対リンクと運営者 ken_mro を追加（E2E 102件 pass）。UI フェーズ完了
- 判断: 「どこにも送信しません」と書いたので、PLAN 5 の外部リクエスト検知 E2E で必ず担保する。terms.html / privacy.html はまだ無い（PLAN 4 で作成）
- 申し送り: 次は PWA（manifest・アイコン・service worker）。アイコン PNG は依存なしで生成する必要あり（node の zlib で PNG を書く等）

## 2026-11-26 タスク3-1: manifest・アイコン・theme-color
- やったこと: `tests/unit/pwa-manifest.test.js`（manifest の必須項目・相対パス、PNG 実寸を IHDR で確認、SVG がパスのみ、index.html の link/meta。Red）と `tests/e2e/pwa-assets.spec.js` → `manifest.webmanifest`、`icons/`（icon.svg・icon-maskable.svg と PNG 5種）、`scripts/build-icons.mjs`、index.html の head で Green（ユニット101件・E2E 104件）
- 判断: アイコンはソフトクリーム型に顔（パスと図形のみ、フォント非依存）。PNG は開発依存の Playwright Chromium で SVG から生成（依存追加なし）。apple-touch-icon は全面塗り（iOS が角丸にする）。theme-color はライト #fbf8f3／ダーク #1b1714、manifest は start_url/scope とも ./
- 申し送り: アイコンを変えたら `node scripts/build-icons.mjs` で再生成。次は service worker（全アセットのプリキャッシュ、terms/privacy 含む）

## 2026-11-26 タスク3-2: service worker
- やったこと: `tests/unit/sw-precache.test.js`（プリキャッシュ一覧＝src/・icons/・HTML・manifest の実ファイルと完全一致、相対パス、VERSION、同一オリジン GET のみ）と `tests/e2e/offline.spec.js`（オフライン起動・記録・保持、規約／ポリシー表示、クエリ付き起動）を先に書き Red → `sw.js` と app.js での登録で Green（ユニット105件・E2E 110件、WebKit 含む）
- 判断: install で cache.addAll（cache:'reload'）→ skipWaiting、activate で旧 `un-deta-*` を削除→ clients.claim。遷移はキャッシュ HTML（ignoreSearch、なければ index.html）、その他は stale-while-revalidate。外部オリジン・GET 以外は触らない。addAll が 404 で失敗しないよう terms.html / privacy.html の下書き（作成中）を先に作成し、中身は PLAN 4 で書く
- 申し送り: ファイルを追加したら sw.js の PRECACHE に足す（ユニットテストが検知する）。アセット更新時は VERSION を上げる。次はサブパス（/un-deta/）配信の E2E

## 2026-11-26 タスク3-3: サブパス配信
- やったこと: `tests/unit/serve-base.test.js`（5件、Red）→ `scripts/serve.mjs` に `base` オプション（`--base /un-deta/`）を追加して Green。`tests/e2e/subpath.spec.js`（3件×2）はテスト内で startServer({ base }) を起動して検証（E2E 116件 pass）
- 判断: base 外は 404（絶対パスの混入を検出できる）、末尾スラッシュなしは 301 で base へ。E2E では全レスポンスが /un-deta/ 配下かつ 400 未満であること、manifest の start_url/scope/icons、SW スコープとオフライン起動、フッターリンクと「アプリに戻る」を確認。既存の相対パス設計のため E2E は初回から pass
- 申し送り: Playwright 設定は変更なし（webServer は 1 つのまま）。次は PLAN 4（terms.html の本文）

## 2026-11-26 タスク4-1: terms.html
- やったこと: `tests/unit/terms.test.js`（必須見出し、医療機器でない・診断治療を目的としない・医療機関へ相談、データ消失を含む無保証・免責、日本法、ken_mro・{{CONTACT}}・制定日、効能表現なし、共通 CSS・CSP・外部読み込みなし。Red 6件）→ 本文を作成して Green（ユニット118件・E2E 116件）
- 判断: 消費者契約法を踏まえ免責に「故意・重大な過失の場合は除く」を明記。合意管轄は「運営者の所在地を管轄する裁判所」（要人間確認）。末尾の「アプリに戻る」は既存 E2E と名前が重複するため置かない。制定日 2026年11月26日
- 申し送り: HUMAN_TODO.md に {{CONTACT}} の差し替え、合意管轄・規約全体の専門家確認を書くこと

## 2026-11-26 タスク4-2: privacy.html
- やったこと: `tests/unit/privacy.test.js`（必須見出し、個人情報・記録データを一切収集しない、ブラウザのストレージのみ、アナリティクス・Cookie・外部送信なし、GitHub のアクセスログと公式ポリシーへのリンク（rel=noopener noreferrer）、機種変更・削除時、ken_mro・{{CONTACT}}・制定日、外部は <a href> のみ。Red 8件）→ 本文を作成し Green（ユニット127件・E2E 116件）
- 判断: GitHub の一般プライバシー ステートメント（日本語版 URL）が有効なことを web-fetch で確認（2026年4月27日版）。SW キャッシュに記録データは含まれない旨も明記。iOS の保存場所分離にも言及
- 申し送り: 次は HUMAN_TODO.md

## 2026-11-26 タスク4-3: HUMAN_TODO.md
- やったこと: `tests/unit/human-todo.test.js`（{{CONTACT}} を含む全配布ファイルが列挙されていること、主要確認事項。Red）→ `HUMAN_TODO.md` を作成して Green（ユニット129件）
- 判断: 公開前必須（{{CONTACT}} 差し替え＋sw.js VERSION 更新、規約・ポリシーの専門家確認：合意管轄・免責・制定日）、実機確認、GitHub Pages 公開、依存保守（pnpm audit/outdated、pnpm 12 検討、loop.sh の扱い）に分類
- 申し送り: 次は「規約・ポリシーの記述と実装の整合を確認するテスト」

## 2026-11-26 タスク4-4: 規約・ポリシーと実装の整合テスト
- やったこと: `tests/e2e/policy-consistency.spec.js`（5件×2）。一通り操作（記録・過去日修正・QR・読み込み）したあと、Cookie なし、保存は localStorage の un-deta:v1 のみ（sessionStorage・IndexedDB なし）、SW キャッシュは同一オリジンのアプリファイルのみでクエリ／記録データなし、通信は同一オリジンの GET のみでクエリなし、読み込むスクリプトは ./src/ のみ、を確認（E2E 126件）
- 判断: 実装が既に整合していたため初回 pass。検出力の確認として app.js に一時的に document.cookie を追加し失敗すること（ミューテーション確認）を見てから戻した。必須見出し・キーワードはユニット（terms/privacy.test.js）で担保済み
- 申し送り: 次は PLAN 5（アクセシビリティ E2E）。注意: E2E の seed() は sessionStorage を使うので、このファイルでは seed しないこと

## 2026-11-26 タスク5-1: アクセシビリティ E2E
- やったこと: `tests/e2e/a11y.spec.js`（9件×2）: 3ページの lang=ja・h1 1つ・見出しの飛び、全ボタン／リンク／入力欄／画像／ダイアログのアクセシブルな名前、キーボードだけで記録・過去日修正（ダイアログ内フォーカス・閉じたらセルへ）・バックアップ読み込み、フォーカスの outline、主要部品のタップ領域 44px 以上。Red で日付ダイアログの名前が空（開くまで見出し空）を検出 → 既定見出し「日付の記録を修正」を追加して Green（E2E 144件）
- 判断: macOS の WebKit は既定で Tab がフォーム部品にしか移らないため、WebKit では Alt+Tab を使う（ブラウザの仕様でアプリの問題ではない）
- 既知の制限: ヒートマップのセルは 14px（WCAG 2.5.8 の 24px 未満）。キーボード操作は可能だが、タッチでは小さい。必要なら HUMAN_TODO 側で判断（セル拡大は横スクロールが伸びる）

## 2026-11-26 タスク5-2: 外部リクエストなしの E2E
- やったこと: `tests/e2e/no-external.spec.js`（context.route で同一オリジン以外を記録・遮断、context の request 監視、CSP 違反イベントとコンソールの Refused も収集）で全ページ・全機能を操作して 0 件を確認。静的チェック `tests/unit/no-external-refs.test.js`（配布ファイル中の外部 URL は SVG 名前空間と privacy.html の GitHub リンクのみ、CSS の外部 url()/@import なし）も追加（ユニット132件・E2E 146件）
- 判断: ミューテーション確認で app.js に外部 fetch を足すと、CSP が送信前に遮断するため通信監視だけでは検出できなかった → securitypolicyviolation も失敗条件に追加し、検出できることを確認してから戻した
- 申し送り: 次は README.md

## 2026-11-26 タスク5-3: README.md
- やったこと: `tests/unit/readme.test.js`（必須見出し、実在するコマンド・パス、プライバシー要約、効能表現なし。Red）→ README.md を作成して Green（ユニット137件）
- 判断: 概要／使い方（ホーム画面追加・記録・修正・バックアップ・機種変更と iOS の注意）／プライバシー要約／ローカル起動（serve.mjs、--base）／テスト（pnpm install、playwright install、npm test、test:e2e、verify.sh、依存のセキュリティ設定、アイコン再生成）／GitHub Pages 手順（{{CONTACT}} 差し替え、Pages 設定、sw.js VERSION）
- 申し送り: 最後は「最終レビュー」。SPEC.md を1項目ずつ照合する

## 2026-11-26 タスク5-4: 最終レビュー（SPEC 照合）— 完了
- SPEC 照合結果（すべて実装・検証済み）:
  - コンセプト: 2択・1タップ／日本語 UI／効能表現なし（verify.sh・各ユニット）／相対パス（subpath E2E）
  - 技術方針: バニラ ESM・ビルドなし／manifest・sw.js・アイコン一式（pwa-manifest）／外部リクエストなし（no-external E2E＋静的チェック、CSP）／完全オフライン（offline E2E）／「データはこの端末の中だけに保存されます」（footer E2E）／ロジックは src/lib の純粋関数（ユニット）／依存は devDependencies のみ
  - 機能1〜6: home / feedback / streak / heatmap / dark-mode / footer の各 E2E
  - データ消失対策: persist()（ユニット＋今回追加の persist E2E）／standalone 警告と OS 別案内（install-guide）／バックアップ v1・コピー・貼り付け・QR・上書き／統合・衝突確認・エラー（backup-codec・import-merge・backup・qr）／30日催促（backup-reminder）／機種変更と iOS の保存場所分離（device-change）
  - 規約・ポリシー: terms / privacy の必須項目（ユニット）、同じデザイン・オフライン表示、ken_mro・{{CONTACT}}・制定日、HUMAN_TODO、実装との整合（policy-consistency E2E）
  - 品質: README／アクセシビリティ（a11y E2E、コントラスト）／ローカル時刻の日付境界（date ユニットを複数 TZ で確認、E2E は page.clock）
- 追加したこと: 起動時の persist() 呼び出しを E2E で確認（ミューテーション確認済み）
- 最終結果: `bash scripts/verify.sh` → VERIFY: PASS（ユニット137件・E2E 152件）。`pnpm audit` 既知の脆弱性なし
- 完了。残りは HUMAN_TODO.md（{{CONTACT}} 差し替え、規約の専門家確認、実機確認、GitHub Pages 公開）

## 2026-11-26 仕様変更6-1: ロジック（「出た」だけを記録）
- 経緯: ユーザーがチャットで「『出てない』は記録しない（案1）」と決定。SPEC.md は設定で編集不可のため PLAN.md 6章に変更内容を記録（SPEC.md 本体の更新は人間に依頼）
- やったこと: `tests/unit/since.test.js`（6件）、records の onlyDone、storage の「出てない」除外テストを先に書き Red → `src/lib/since.js`（daysSinceLastDone）、`onlyDone`、storage の正規化で Green。「出てない」連続日数（streak.js とそのテスト）は仕様から外れたため削除。sw.js の PRECACHE も追従（ユニット136件）
- 判断: バックアップ形式 v1（2bit）は互換のため据え置き。STATUS.NOT_YET 定数はコーデック互換用に残す
- 申し送り: app.js がまだ streak.js を import しているので、次のホームのタスクで直す（このコミット単体では E2E が落ちる）

## 2026-11-26 仕様変更6-2: ホーム
- やったこと: E2E を先に更新（home: 「出てない」ボタンがないこと、since.spec 新設＝「前回の『出た』から N日」、feedback・a11y・dark-mode の「出てない」依存を除去。streak.spec は削除）→ index.html から「出てない」ボタン削除、app.js を daysSinceLastDone に切替、演出は「すっきり！」のみ（関連 E2E 70件 pass）
- 判断: N=0（今日出た）と記録なしは非表示。a11y のキーボード操作は「出た」→「今日の記録を取り消す」で確認
- 申し送り: heatmap / backup / qr の E2E は「出てない」(2) を含むデータを使っているため現在失敗中。次のタスク（ヒートマップ）とその次（バックアップ）で直す

## 2026-11-26 仕様変更6-3: ヒートマップと修正ダイアログ
- やったこと: heatmap.spec を先に更新（旧データの 2 は未記録表示、ダイアログに「出てない」がない、「出た」記録で日数表示が更新、凡例は2つ）、a11y / policy-consistency / no-external のダイアログ操作を「出た」に → index.html・heatmap-view・app.js・CSS から「出てない」を除去して Green
- 判断: 「出てない」用の枠線スタイルと --cell-not-yet を削除。ボタン用クラス .btn-not-yet は読み込みダイアログでも使うため .btn-pill に改名
- 申し送り: backup / qr の E2E が残り（次のタスク）

## 2026-11-26 仕様変更6-4: バックアップ読み込み
- やったこと: backup.spec を先に更新（データは「出た」のみ、統合は確認なしで合わさる、読み込みデータ中の「出てない」は統合・上書きとも無視）、qr.spec のデータも更新 → backup-view で decode 結果を onlyDone で正規化、衝突確認ステップ（HTML・JS）を撤去して Green（ユニット136件・E2E 156件）
- 判断: サマリは「読み込む記録 N日分（新しく増える日・すでに記録がある日）」。import-merge.js の衝突処理（preferIncoming 必須）は汎用ロジックとして残す
- 申し送り: 次は規約・ポリシー・README の更新と問い合わせ先の差し替え

## 2026-11-26 仕様変更6-5: 規約・ポリシー・README と問い合わせ先
- やったこと: terms / privacy / readme / human-todo のテストを先に更新（{{CONTACT}} が残っていない・mailto リンク、「出てない」を記録する記述なし、README は「前回の『出た』から」、HUMAN_TODO で問い合わせ先は完了・SPEC.md 更新を依頼。Red 7件）→ 各文書を更新して Green（ユニット140件）
- 判断: 問い合わせ先はユーザー指定の bacon.dev.6396@gmail.com を mailto リンクで掲載（公開ページに載る旨と迷惑メールの可能性を HUMAN_TODO に注記）。sw.js の VERSION を 2 に。SPEC.md の差し替え内容を HUMAN_TODO に具体的に列挙

## 2026-11-26 仕様変更6-6: 最終確認 — 完了
- `bash scripts/verify.sh` → VERIFY: PASS（ユニット140件・E2E 156件）。`pnpm audit` 既知の脆弱性なし。sw.js VERSION=2
- 残り: HUMAN_TODO.md（SPEC.md の更新、規約の確認、実機確認、GitHub Pages 公開）

## 2026-11-26 公開準備: SPEC 更新版・規約の再点検・リポジトリ作成
- SPEC.md は設定で編集不可のため、PLAN 6章を反映した `SPEC.updated.md` を作成（人間が SPEC.md に置き換える）
- 規約の再点検: 「規約の変更」を民法548条の4（定型約款の変更: 変更の旨・内容・効力発生日の事前周知、利益適合性または合理性）に沿う文言に修正（テスト追加）。sw.js VERSION=3
- GitHub に公開リポジトリ ken-mro/un-deta を作成（push は設定で禁止のため人間が実施）。追跡ファイルの秘密情報スキャン済み

## 2026-11-26 公開完了
- 人間が SPEC.md を置き換えて push（2467269）。エージェントが `gh api` で GitHub Pages（main / root）を有効化し、ビルド成功
- 公開 URL https://ken-mro.github.io/un-deta/ をブラウザで確認: 起動、365日のヒートマップ、SW スコープ /un-deta/ で activated・制御下、外部リクエスト0件、manifest・アイコン5種・terms・privacy が 200（問い合わせ先 mailto あり、{{CONTACT}} なし、SW VERSION=3）、記録→再読み込みで保持→取り消し（確認後に記録は削除）
- human-todo テストを「SPEC 反映済み」に更新。残りの HUMAN_TODO: 規約・ポリシーの専門家確認、実機確認、依存の保守

## 2026-11-26 機能追加7-1: 月のカレンダーのロジック
- やったこと: `tests/unit/month-calendar.test.js`（7件、Red）→ `src/lib/month-calendar.js`（isValidMonthKey / monthOf / addMonths / buildMonthCalendar）で Green。sw.js の PRECACHE に追加（ユニット148件）
- 判断: 日曜始まり、前後の空白は null。セルは date/day/status/isToday/isFuture。「出た」日数は今日以前のその月だけ。旧データの 2 は未記録。canGoNext は今月より前のときだけ

## 2026-11-26 機能追加7-2: カレンダーの UI
- やったこと: `tests/e2e/calendar.spec.js`（8件×2: 今月表示と「出た」日数、曜日見出しと1日の列、前後の月移動・今月より先は不可・年跨ぎ、タップで記録／取り消しがホーム・ヒートマップに反映、ホームの記録が反映、未来は disabled、閉じたらフォーカス復帰。Red）→ `src/ui/calendar-view.js`、index.html の「カレンダー」節、app.js でダイアログを共通化（開いたビューへフォーカスを戻す）で Green（ユニット148件・E2E 172件）
- 判断: マスは data-cal-date（ヒートマップの data-date と区別）。「出た」は塗り＋点の印、今日は aria-current="date"＋枠。月移動は今月なら「今月に追従」状態に戻す。calendar-view.js のプリキャッシュ漏れをユニットとオフライン E2E が検出 → 追加、sw.js VERSION=4
- 申し送り: 次はキーボード操作（矢印・PageUp/PageDown）とアクセシビリティ・タップ領域の E2E

## 2026-11-26 機能追加7-3: カレンダーのキーボード操作・アクセシビリティ — 完了
- やったこと: calendar.spec にキーボード操作（roving tabindex、矢印 ±1/±7 日、未来へは移動しない、月の境目で隣の月へ、PageUp/PageDown、1/31→2/29 の丸め）、a11y.spec にタップ領域（マス・月移動ボタン 44px 以上）、dark-mode.spec にカレンダー文字のコントラストを追加 → calendar-view.js に実装。月末丸めの不具合（存在しない日付で例外）をテストで先に再現してから修正
- README・HUMAN_TODO を更新。`bash scripts/verify.sh` → VERIFY: PASS（ユニット148件・E2E 184件）
- 公開サイトへの反映は人間の `git push` が必要

## 2026-11-26 不具合修正: 狭い画面でカレンダーの右側が切れる
- 原因: カレンダーの列を minmax(2.75rem, 1fr) にしていたため、7列＋隙間で約332px必要で、幅 344px（Galaxy Z Fold5 のカバー画面など）以下ではみ出していた
- やったこと: `tests/e2e/narrow-layout.spec.js`（幅 320/344/360/375px でカレンダー・曜日・月移動ボタン・各マスが画面内、ページの横スクロールなし）で 320/344 の失敗を再現 → 列を minmax(0, 1fr) にして Green。高さ 2.9rem は維持。sw.js VERSION=5

## 2026-11-26 変更: ヒートマップは見るだけ（修正はカレンダーから）
- 経緯: ユーザー要望「これまでの記録は小さすぎて押せないので、押しても反応しないように。反応するのはカレンダーだけでいい」
- やったこと: heatmap.spec を「表示専用」に書き直し（ボタンなし・押してもダイアログが開かない・フォーカスされない・cursor が pointer でない・読み上げは「直近1年で『出た』日: N日」・カレンダーへの案内）。ヒートマップ経由の修正テストはカレンダー側（キャンセル、今日のマス）と a11y のキーボード修正（カレンダー経由）に移した。Red → heatmap-view.js を span＋role="img" の表示専用に書き換え、app.js の onSelect を削除、説明文を変更して Green（E2E 194件）
- テスト修正のミス: policy-consistency は時計を固定していないため固定日付のマスが存在せずタイムアウト → 「今月の押せる最初のマス」を使うように修正
- README・HUMAN_TODO 更新、sw.js VERSION=6

## 2026-11-26 機能追加8-1: 「ちょっと出た」のロジック
- やったこと: records（STATUS.LITTLE=3、isValidStatus、normalizeRecords、設定・上書き）、コーデック（2bit=3 を「ちょっと出た」として往復）、storage（3 を保持）、since（起点に含める）、month-calendar（状態保持・littleCount）、heatmap（3 は保持・2 は未記録）のテストを先に更新 Red 10件 → 実装して Green（ユニット155件、E2E 194件は変更なしで pass）
- 判断: 形式 v1 のまま値 3 を割り当て（旧バックアップとも互換）。onlyDone は normalizeRecords に改名（isRecorded を追加）。仕様変更前のヒートマップのテスト1件（2 をそのまま返す期待）は現仕様（未記録扱い）に合わせて修正

## 2026-11-26 機能追加8-2: ホームの「ちょっと出た」
- やったこと: `tests/e2e/little.spec.js`（5件×2: 記録と保持、付け替えと取り消し、演出「ちょっとすっきり」、N日の起点、「出た」より小さい）と a11y・dark-mode に #btn-little を追加（Red）→ index.html にボタン、app.js で状態テキスト・aria-pressed・演出の出し分け、CSS（--little-bg/--little-text をライト／ダークで定義、粒は少なめ）で Green

## 2026-11-26 機能追加8-3: カレンダー・ヒートマップ・修正ダイアログの「ちょっと出た」
- やったこと: little.spec にカレンダー（data-status=3・読み上げ「ちょっと出た」・見出し「出た N日（ちょっと M日）」・背景色の区別）、修正ダイアログの選択、ヒートマップ（別色・読み上げ・凡例3つ）を追加、heatmap.spec の凡例・dark-mode のコントラスト対象も更新（Red）→ index.html（ダイアログのボタン・凡例）、calendar-view / heatmap-view のラベルと集計、CSS（--cell-little、カレンダーは薄い塗り＋小さい点）で Green（E2E 210件）
- 見た目の確認で、カレンダー見出しの日数が途中で折り返していたため、日数を月名の下の行に分けた

## 2026-11-26 機能追加8-4: バックアップ・文書・SPEC 更新版 — 完了
- バックアップ: 「ちょっと出た」を含む書き出し・読み込み（旧「出てない」は無視）の E2E を追加（ロジック対応済みのため初回 pass）。「出た」と「ちょっと出た」が同じ日にぶつかる場合の確認ステップ（読み込む側を優先／今の記録を優先／やめる）を、E2E を先に書いてから復活（SPEC の元の要件に沿う）
- 文書: terms / privacy / README / ヒートマップの説明文を更新（テスト追加）。SPEC.md は編集不可のため `SPEC.updated.md` を用意し HUMAN_TODO に置き換えを依頼。sw.js VERSION=7
- `bash scripts/verify.sh` → VERIFY: PASS

## 2026-11-27 デザイン調整: ボタンのキャラクター化・カレンダーの点を削除
- 経緯: ユーザー要望「カレンダーの点は不要」「出た／ちょっと出たのボタンをそれっぽく」
- やったこと: `tests/e2e/button-design.spec.js`（ボタンに aria-hidden の SVG と文字ラベル、出たボタンは丸い塗りなし、カレンダーに ::after の点なし、ちょっと出たは枠で未記録と区別）を先に書き Red → 「出た」はアイコンと同じソフトクリーム型のキャラクター（インライン SVG、色は CSS 変数でダーク追従、押すと少しつぶれる）＋大きな文字、「ちょっと出た」は小さい1段のキャラ付きの丸ボタンに。カレンダーの点を削除し、ちょっと出たは細い枠で区別。sw.js VERSION=8（E2E 226件）
- 失敗と修正: 押下中に CSS の ::before で「✓」を付けたら読み上げ名が「✓ 出た」に変わり既存テストが失敗 → ✓ を削除（押下中は枠で示す）

## 2026-11-27 デザイン調整: キャラクターの頭の形
- 経緯: ユーザー要望「キャラクターの頭のところがそれっぽくない」
- やったこと: てっぺんが横に突き出た旗のような形だったため、候補4案を描き比べ、上の段から丸くふくらみ先端が小さく巻く形（A案）を採用。ボタンのキャラクター（viewBox を上に拡張）、ちょっと出たの小アイコン、icons/icon.svg・icon-maskable.svg を同じ形にそろえ、`node scripts/build-icons.mjs` で PNG を再生成。sw.js VERSION=9
- 追記: ユーザーの指定で頭の形を C 案（先がとがって片側へ流れる形）に変更。ボタン・小アイコン・アプリアイコン（PNG 再生成）をそろえ、sw.js VERSION=10

## 2026-11-28 操作感の調整: 開閉の分かりやすさ・バックアップ欄・日付指定の記録
- 経緯: ユーザー要望「『追加のしかた』が押せると分からない」「バックアップも『機種変更するときは』同様に最初は閉じる」「日付を指定して記録するときも当日と近い操作感に」
- やったこと: `tests/e2e/disclosure.spec.js`・`day-dialog.spec.js` を先に書き Red → 開閉できる見出し（追加のしかた・バックアップ・QR・機種変更）に枠と矢印（開くと下向き）を付け、「追加のしかた」には「タップで開く」を表示。バックアップ欄を `<details class="backup-panel">` にして初期は閉じる（催促の「バックアップする」で自動で開く）。修正ダイアログの「出た」「ちょっと出た」をホームと同じキャラクターのボタンにし、いまの記録を押下状態で表示、押すとダイアログ内で「すっきり！」「ちょっとすっきり」の演出を出してから閉じる（1.3秒、reduced-motion では 0.6秒で動きなし）。sw.js VERSION=11
- 既存テスト: バックアップ欄の中身を操作する E2E に、操作前に欄を開く `openBackup()`（helpers.js）を追加しただけで、検証内容は変えていない。E2E 246件・verify PASS
- 申し送り: SPEC（SPEC.updated.md 含む）にはバックアップ欄の初期状態・修正ダイアログの演出の記述がないため、必要なら人間が追記する
- 追記（同日）: ユーザーの指定で、開閉できる項目の見た目を以前の「機種変更するときは」の形（色付きの箱に見出しと中身を入れる、枠線なし）にそろえた。矢印と「タップで開く」は残す。バックアップ欄の中の箱（QR・機種変更）は外の箱と区別できるよう白地（ダークでは暗い面）に。disclosure.spec.js の見た目の検証を「枠」から「色付きの箱」に変更。sw.js VERSION=12
- 追記（同日）: ユーザーの指定で「追加のしかた」の「タップで開く」を削除（矢印は残す）。見出しが「追加のしかた」だけであることをテストで固定。sw.js VERSION=13

## 2026-11-28 まとめて記録（カレンダーをタップ・なぞって一気に記録）
- 経緯: ユーザー要望「1つ1つ登録するのが面倒な方に、出た／ちょっと出たを選んで、日をタップまたはなぞるだけで一気に登録。もう一回タップで未登録」
- やったこと: `tests/unit/bulk-paint.test.js`・`tests/e2e/bulk.spec.js` を先に書き Red → `src/lib/bulk-paint.js`（ひと筆の最初の日で「付ける／消す」を決める `strokeTarget`、未来の日を変えない `paintDay`）。カレンダー見出しの横に「まとめて記録」ボタン、押すと記録する内容（出た／ちょっと出た）の選択と説明、日付はタップ・なぞり（pointer イベント＋elementFromPoint）で即保存、キーボードは Enter / Space で1日ずつ、結果は role=status で読み上げ。「変更を取り消す」で開始前の記録に戻し、「完了」で通常（タップで修正ダイアログ）に戻る。まとめて記録中はカレンダー上で touch-action:none（なぞってもスクロールしない）。sw.js にファイル追加・VERSION=14
- 申し送り: 実機（iPhone / Android）の指でのなぞりは未確認（E2E はマウスのドラッグで検証）。SPEC には未記載なので必要なら人間が追記

### コード整理（まとめて記録のあと）
- やったこと: 状態名 `STATUS_LABEL` を records.js に一本化／`setStatus` を変化なしなら同じオブジェクトを返す形にし `paintDay` を簡素化／修正ダイアログのキャラクター SVG と演出はホームのものを起動時に複製（HTML の二重管理をやめた）／ダイアログの状態表示を `showDayStatus` に共通化、記録時の即時再描画をやめ閉じるときの1回に／開閉項目の CSS を `.disclosure` クラスにまとめ、`.bulk-bar` も同じ箱の規則へ／E2E の `calendar`・`day` ロケータを helpers.js に共通化。sw.js VERSION 15。
- 判断: なぞり中の1日ごとの保存は、途中で閉じても失わないための意図的な設計なので残した。
- 申し送り: verify PASS（E2E 266）。
