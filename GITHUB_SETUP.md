# GitHub接続の設定

設定画面の「GitHubを設定」から開始します。

1. 「GitHubで登録を確認」を押します。
2. GitHubにログインし、あなた専用アプリの名前と読み取り権限を確認して登録します。GitHubで本人確認を求められたら、その画面で行います。
3. Dashboardに戻ったら「GitHubを認証」を押し、GitHub側で認可します。
4. 「エージェント設定を再読み込み」を押します。実行中の担当には次回起動時から反映されます。

Client ID、client secret、Redirect URLは自動設定します。初期の担当ツール許可は本人情報を取得する `get_me` のみです。リポジトリのツールを追加する際は、アクセス先リポジトリと役割ごとの許可を別途設定してください。

## ポートと戻り先

OAuthは起動中のDashboardと同じHTTPリスナーを使います。4321番などの専用ポートは開かないので、他のアプリとの認証ポート競合はありません。登録時の実際のDashboardポートを、GitHub App Manifestのcallback_urlsに入れます。

Dashboard自体のポートを後から変更した場合はGitHub AppのCallback URLも一致させる必要があります。その場合は認可開始前に理由を表示して停止します。別のポートを勝手に選んでGitHubの登録と不一致にすることはありません。複数端末は端末ごとに自分のアプリを登録してください。

## 認証情報と配布

アプリは登録した利用者の所有です。読み取り専用、本人アカウント限定、Webhook無効で登録します。認証情報はDSH_HOME/scrum/mcp.json、トークンは同じフォルダ内のmcp-authに保存します。フォルダは0700、ファイルは0600です。公開するソース・配布パッケージへこれらのファイルを含めないでください。

GitHub App Manifestで生成されるアプリ署名用秘密鍵とWebhook secretは、このOAuth接続では使わず保存しません。共有の認証サーバーや配布共通secretは不要です。ただしChatGPTなどの運営側が用意する共通アプリと異なり、利用者自身による登録確認は初回に必要です。

## 中断・復旧

登録開始の状態は1時間だけ有効です。Dashboardが再起動しても戻り先のstateを検証できます。認証中にDashboardを再起動した場合は「GitHubを認証」から再開してください。GitHub側でアプリを削除した場合は、ローカルの専用設定も整理してから登録し直してください。既存のGitHub MCP設定がある場合は自動上書きしません。

参照: https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest

GitHubのManifestでは無効なWebhookにも公開URLが必要です。予約された例示ドメイン https://example.com/github/webhook を設定し、active:false とイベントなしを維持します。送信は行いません。これはOAuthの戻り先ではありません。
