# Scrum — DSH plugin 0.7.0

## Initial release scope

This is an early release for macOS arm64, Node.js 24+, and DeepSeek Harness 0.2.0-rc.2. Current regression tests pass; sustained high-load operation and other operating systems are not certified. Authentication, paid model accounts and macOS permissions are configured by each user. No personal sessions or credentials are shipped.

Clone this repository and install its pinned dependencies:

```sh
git clone https://github.com/maas-creative/dsh-plugin-scrum.git
cd dsh-plugin-scrum
npm ci
# Install uv first: https://docs.astral.sh/uv/getting-started/installation/
npm run test:prepare
npm test
```

Optional project/deadline management UI: [Dashboard](https://github.com/maas-creative/dsh-plugin-dashboard). The two plugins remain independent.


Scrum and Dashboard are independent products with separate folders and packages. Scrum runs as a standalone DSH plugin or together with the Dashboard plugin.

ユーザーが指定した名称の、担当エージェントへの汎用委譲・実行タスク・成果物確認を管理するプラグインです。Scrum開発手法そのものの製品ではありません。

## 起動

Node.js 24以上、DeepSeek Harness 0.2.0-rc.2を使用します。ダッシュボードからのIPC接続と、単独DSH内の起動を選択できます。同じ実行ストアを二重に起動できません。

```yaml
- insert:
    - id: scrum
      name: /absolute/path/to/Scrum/lifecycle-entry.mjs
      config:
        standalone:
          dataDir: /absolute/path/to/scrum-data
```

単独起動ではScrum専用の`execution.sqlite`とDSHのagent/session/goalサービスを使います。設定を省略しても、必要なホストサービスがあると単独ランタイムを起動します。`standalone:false`は明示的な無効化です。DashboardのDBや既存`dashboard.sqlite`を共有・移行しません。

通常の自然言語の依頼は親が解釈し、`task_create`に本文・出力・完了条件を渡し、`task`で担当へ委譲します。cwdは親から継承でき、プロジェクト登録は不要です。担当結果を`background_output`で読み、`scrum_review`で成果物とハッシュを確認します。

```
hdt 完了条件を満たす原稿を作成し、検証して保存してください
/hdt 同じ依頼を計画・委譲・確認・終了まで進めてください
/scrum start {"goal":"完成原稿を検証する","concurrency":2}
/scrum-panel
/scrum status
/scrum pause
/scrum resume
/scrum-doctor
```

HardTackle（ユーザー指定のモード名）の標準入口は`hdt 依頼内容`と`/hdt 依頼内容`です。旧`ulw`・`/ulw`・`ultrawork`も互換入口として使えます。内部の永続キーは履歴・再開互換のため維持します。

`hdt`だけならモードを有効にし、架空の目標を作りません。引用・コード・質問・担当報告は開始指示にしません。明示停止後は新しい本人のHardTackle指示または再開操作が必要です。

Dashboard同時利用の契約は[execution-contract.md](execution-contract.md)。Dashboardが業務IDと実行IDを紐付け、業務完了や提出受付を判断します。旧`./ledger`と`./planner`は明示的な互換利用用です。単独コアは業務台帳を読みません。

初期設定のモデルはGPT 6.1 Sol / lowです。モデル割り当て・明示した代替モデル列は設定画面から変更できます。ツール実行後・認証不足には自動代替を適用しません。

## 実行と確認

- 親別の状態、停止後の遅延結果の拒否、前景・背景委譲、既存担当セッションへの追加指示。
- 役割・カテゴリ・スキルによる委譲。担当から親の制御ツールを利用できません。
- 名前付きTeam、メンバー、claim/lease/heartbeat、shutdown要求と応答。
- 正本タスクを参照するDAG、依存関係、checkpoint、再試行、定義ハッシュ、作成の重複抑制、永続イベント、履歴再構成、overflow付きカーソル取得。
- Boulder/Atlas/hyperplan/ulw-research/refactor/handoffの工程と依存条件。作業報告だけでは完成になりません。
- 子の終了報告を元の親に永続配送し、親の応答中は待機。日付変更後も元の親に届けます。
- 大容量ファイルのstreaming hash・保存版、フォルダmanifest、レビューとハッシュ照合、進捗反映。
- Gitプロジェクトでは隔離worktreeを作り、差分とfingerprintを確認してから明示的に統合します。共有フォルダ・dirtyな元リポジトリへ勝手に落としません。

DSHの標準goalに実際の目標・phase・revisionを保存します。**継続の実行主体はScrumに一本化し、DSH標準round driverはdisarmedにします。** 台帳を更新しない二つ目の継続ループを起動しません。HardTackleは実ユーザーのキーワードで指示モードを有効にし、コード・引用・配送通知では有効にしません。モード指定だけでは目標を作成しません。

## メモリ・編集・操作

Git Markdownメモリはworktree間で共有します。履歴・diff・rollback・修復・検証済みbundleのbackup/restore、出典付きSQLite移行、人物カード・aliases・persona・human・boundaries・soul告知に対応します。自動recallは独立実装の語句検索・CJK BM25・順位融合を使用し、実ユーザーの会話と各セッションを区別します。埋め込み検索とは称しません。

reflection/dream/factsは出典付きの整理案を隔離worktreeで検証し、正本のHEAD・提案hash・記録を照合して適用します。外部へのメモリ同期は`/memory-remote`から本人が明示操作します。モデルからのremote操作ツールはありません。

Hashline、LSP、AST-grep、条件付きルール、ディレクトリ文書、プロジェクトのコマンド、保存セッションの検索を利用できます。ASTのapplyはDSHの版確認付きwriteを経由し、古いpreviewや重なった編集を拒否します。プロジェクトコマンドは実際のagent turnをキューに入れます。

ブラウザはowned/attachedを明示し、JS状態と接続を保持します。connectedモードは外部BrowserSkill CLI/daemonと対象ChromiumのBrowserSkill拡張が必要です（[導入手順](skills/browser/references/install.md)）。回収可能な起動APIを実測した対応版はbsk 0.3.2です。`bsk --version`と`bsk status --json`でCLI/稼働daemonを確認し、古い環境は`bsk update`後にdaemonを再起動してください。接続はremote作成前に対応APIを確認し、不足時は明示エラーで停止します。ownedはPlaywrightが専用ブラウザを起動し、attachedは明示CDP endpointへ接続するため、BrowserSkill依存とは別です。`browser_stop`後は`/scrum-browser-resume`が必要です。実PTY・stdout/stderr監視はUTF-8境界を保持し、終了通知を所有agentのinboxへ入れます。通知だけで停止中のagentを起こしません。

Mac arm64のdesktopエンジンを同梱します。画像はDSH attachmentとして返します。入力はホスト全体のlease・OS権限・ネイティブ緊急停止が必要です。`/scrum-desktop-resume`は本人の操作です。このMacの常駐版専用Nodeで、画面取得・所有する試験ウィンドウへの入力・Accessibility操作と明示停止を実機確認しています。他の利用者のMacでは、その実行ファイルへの許可設定が必要です。

## MCPと配送

`DSH_HOME/scrum/mcp.json`の`mcpServers`を使います。stdio/HTTP、役割別allowTools、allowResources、allowPrompts、OAuth PKCEに対応します。OAuthは`/scrum-mcp-login SERVER`で開始し、認証後にセッションを再起動します。トークンは0600で保存します。スキル内のコマンドや未承認サーバーは無条件に起動しません。

Threadの9操作・relayの8操作は台帳に保存します。HTTP外部配送は明示設定・信頼したendpoint・認証・本人による特定message IDの送信が必要です。単独起動config.relayを指定した場合だけ`/scrum-relay-send`を登録します。応答不明は勝手に再送しません。このHTTPスキーマはScrum独自のもので、OpenClawとの互換性を確認したとは主張しません。

## 確認範囲と残り

実DSHと実モデルで、親のtask呼出し→担当の書込・再読込→親の内容とhash確認→成果物登録→タスク完了を確認しています。Git隔離・停止・競合・既存記録保持、MCPのローカルprotocol/OAuth fixture、実ブラウザ・PTY・Mac画像も試験しています。

移植は参照コミット `59d23b5c1ddc2a02210ede4cb485f88996fd02bd` の188分類と確定不足43件の受入契約に照合しています。固定モデル・DSHホストへの相違は対応表で区別します。通常／HardTackleの親子実行、Claude互換フック、メモリ自動処理、外部GitHub OAuthの更新・失効・再認証・再起動、常駐版Nodeでの所有ウィンドウ操作を検証しています。GitHubリポジトリへの書き込みや全ブラウザへの互換性は、この検証の範囲に含みません。24時間試験はユーザー指示で実施しません。旧DAGイベントにはsnapshotがなく、過去状態を捏造せず再構成不可を返します。

GitHubの専用App自動登録手順は [GITHUB_SETUP.md](GITHUB_SETUP.md) を参照してください。共通Appは使いません。登録・認可をGitHubで確定した後、Client ID・secret・戻り先設定を手入力せず保存します。

機能照合の基準commitは`59d23b5c1ddc2a02210ede4cb485f88996fd02bd`です。OMOの保護されるコード・プロンプト・スキル・デスクトップバイナリを、独立実装または別途ライセンスを確認した実装へ置換しています。各OSSの既存著作権表示は維持します。独立実装部分の配布設定はAGPL-3.0-onlyです。別途取得したOSSは元のライセンスと著作権表示を維持します。公開用パッケージの最終検証が完了するまで、公開準備の完了とは判定しません。GitHub・npmへの公開は別工程です。詳細は[NOTICE.md](NOTICE.md)と[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)を参照してください。

実モデルの追加検証: `openai-codex/gpt-6.1-sol/low` の隔離Reflection分析、自動Git反映、会話の処理済み位置の更新を確認しました。モデルジョブは既定で無効です。管理者が有効化すると、自動Reflection/Dreamは永続した統合方針に従って反映します。手動整理案は明示適用まで保持します。

Dream・recall judgeもGPT 6.1 Sol lowの実応答を確認済みです。追加提示なしの結果は候補検索の網羅性を証明しません。英語の全文質問を検索語へ展開する上流query plannerを取り込み、引用句とパス由来の語を保持する試験を通過しています。全メモリ自動方針・予算の同等性は引き続き照合対象です。

LSP format/renameはDSH edit-intent・replaceIfVersionを使用します。作業フォルダ外、未観測のrename対象、resource create/delete/path rename、確認注釈は拒否またはpreview-onlyです。

Claude command/HTTP hookは既定無効です。管理者の`claudeHooks.enabled:true`と明示した設定で登録済みイベントを接続します。[設定と制限](CLAUDE_HOOKS.md)を参照してください。native deny/ask/cancelをallowへ変更せず、toolの自動再実行もしません。

### 原音声の解析担当

Scrumの管理者設定で `audio: {enabled: true, provider: "antigravity", model: "antigravity-gemini-3.7-flash"}` を指定すると有効になります。ホストにはログイン済みの `antigravity-auth` が必要です。単体パッケージでは既定無効で、認証プラグインなしでも起動できます。設定変更後はセッションを再起動してください。

音声担当だけが原音声を受け取り、最終回答はGPT 6.1 Sol lowが生成します。上記カタログモデルは `gemini-3-flash` へ接続します。一つの音声ストリーム、120秒、12 MiBまで全量を送り、超過時は切り詰めず失敗します。元データのハッシュと実測した長さを保持します。音・順序・確信度の記述は推定であり、全量送信は全ての音の認識を保証しません。無効時は一般的な音響分析を文字起こしへ置き換えません。

### PreCompact provider

Disable the `compaction-basic` loader entry and insert `dsh-plugin-scrum/compaction` under a new ID, retaining the existing BasicCompactionEngine configuration. Configure `claudeHooks` on Scrum as usual. The provider uses the public `summarize` override and appends hook context to a fresh summarization input. It does not edit the session log or routed model request. Manual compaction uses `trigger: manual`, automatic compaction uses `trigger: auto`. The dashboard DSH patch selects this provider.

### Claude Code MCP設定の取込み

`DSH_HOME/scrum/mcp.json`に`"claudeCode":{"enabled":true,"allowedEnvVars":["SEARCH_API_KEY"]}`を設定すると、`~/.claude.json`、`CLAUDE_CONFIG_DIR/.mcp.json`（既定は`~/.claude/.mcp.json`）、作業ディレクトリの`.mcp.json`、`.claude/.mcp.json`の順で読み込みます。同名サーバーは後の設定を優先し、`disabled:true`は継承したサーバーを除外します。`scope:"local"`は`projectPath`配下でのみ適用します。最後にScrum自身の`mcpServers`を重ねるため、ここで役割別`allowTools`等を指定できます。環境変数の`${NAME}`と`${NAME:-default}`は標準環境変数と`allowedEnvVars`のみ展開します。追加した設定を使うにはセッションを再起動してください。

### 継続状態と設定の再読み込み

`/scrum-reload`でカスタムコマンドの追加・変更・削除を反映します。組込みコマンドは上書きしません。Dashboardの「エージェント設定を再読み込み」も同じDSHコマンドを呼びます。AGENTS・ルールは各応答、担当定義は委譲時にディスクから読み込みます。MCPやホストのプラグイン構成はこのコマンドの対象ではなく、セッション再起動が必要です。

親の最新台帳にはワークフローの段階・チェックポイント・依存関係から計算した実行可能タスクを渡します。タスクの成果物が確認済みでも、所有する担当・Team・監視の終了が残る間はワークフローを完了にしません。

ThreadのforkはDSHの公開`buildForkSeed`で履歴と親子関係を引き継ぎます。`thread_read`は独立した読み取り実装を利用し、`max_bytes`、`cursor`、履歴変更時の`cursor_stale`を扱います。先頭の1項目だけで上限を超える場合は、項目を飛ばしたり上限を超えて返したりせず、`message_too_large`と上限を増やす手順を返します。

## エージェントによるOAuth設定

親エージェントは `oauth_setup` で `discover → plan → apply → authorize → verify` を実行できます。`plan` の input は name、purpose、url、scopes、scopeReasons、allowTools（役割ごとの許可ツール）を指定します。GitHubでは provider=github と permissions を指定し、個人専用GitHub AppのManifestを生成します。共通アプリは使いません。

登録・認可・切断の直前にDSHの質問ツールが要求先と権限を確認します。エージェントから承認フラグや秘密を渡すことはできません。標準MCP OAuthの動的登録に対応していれば登録要求まで自動送信します。非対応サービスは browser-required を返し、開発者コンソールでの登録と本人認証が必要です。既存の専用クライアントは600モードのJSONファイル（clientId/clientSecret）から読み込めます。設定後は skill_mcp が再起動なしで新しい役割別許可を読み込みます。

status のトークン有無は接続成功とは別です。verify は実際にMCPの初期化とツール一覧取得を行います。disconnect はローカル設定とトークンを無効化し、提供元での認可取消は別途必要と明示します。現在の自動設定対象はMCP OAuthとGitHub Appで、任意サービスの管理APIを汎用的に代行する機能ではありません。

## Computer Use

独立実装のSwiftヘルパーと、別途MITライセンスのPeekabooを使用します。OMOのsenpi-desktopバイナリは配布候補に含めません。Mac arm64の画面・アクセシビリティ・マウス・キーボード操作を computer ツールから利用できます。今日の親エージェントと実行担当に接続し、計画用の子セッションと読み取り専用担当ではOS操作を拒否します。

初期値はread_only=trueです。入力する場合はread_only=falseを指定します。入力経路はセッション間の排他制御とネイティブの緊急停止を必須にします。停止ショートカットはControl+Option+Command+Escape。computer_stopでも停止でき、停止後はユーザーが /scrum-desktop-resume を明示して再開します。macOSの権限不足は /scrum-doctor で確認できます。

DSH Webの公開UI拡張APIで、会話上部に「Scrum接続済み／未接続」と「hdt有効／停止」を常時表示します。会話上部のボタンで有効化・停止・再開できます。上部の「担当一覧」から右側のScrumタブを開くと、役割・モデル・実行状態・待機／失敗理由・成果物・確認状態・結果を表示します。接続失敗時は実行状態を推測せず、操作を無効にします。表示の更新はモデルを呼び出しません。

右側の「担当モデルの設定」からモデルを選択すると保存され、次に起動する担当へ適用されます。推論強度はlow固定です。DSHのプロバイダー／モデル一覧を読み取るため、接続先が追加された場合も手書きの候補一覧を更新する必要はありません。通常のバンドル導入ではPluginsのScrum設定ページも使えます。Scrumを公式プラグインとして表示する登録は行いません。

このUIはDSH WebのUIです。Dashboard独自UI（4318）の会話画面には、この拡張を自動挿入しません。TUI／SDK利用時のコマンドも維持します。`client-source.js`が原本、`npm run build:client`で配布用`client.js`を生成します。ホストやDSH本体のコードは書き換えません。

## Antigravity OAuth configuration

Bundled Google OAuth client identifiers and secrets are not distributed. Antigravity OAuth requires your own `ANTIGRAVITY_CLIENT_ID` and `ANTIGRAVITY_CLIENT_SECRET` in the process environment. Configure your approved OAuth application with the callback URI documented by the adapter (`http://localhost:51121/oauth-callback`). A missing configuration fails before authentication requests. Provider access and Google approval are not implied by this release. OpenAI and other configured providers remain available independently.
