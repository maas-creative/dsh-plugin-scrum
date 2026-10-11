# 表示設計の参照: Arc UI

ユーザー指定の参照サイト: https://uiarc.dev/
確認日: 2026-10-10。実ブラウザでChat threadの表示を確認し、公式コンポーネント仕様を照合した。以下はScrum／Dashboardへの適用方針であり、実装済みの報告ではない。

## 適用する表示方法

- 状態は短いバッジにまとめる。接続とhdtモードを分け、色だけで状態を伝えない。停止・再開は会話上部に置き、会話の下へ移動しない。
- 担当一覧の第一階層には作業名、状態、役割、モデル、待機・失敗理由を表示する。長い結果本文、絶対パス、ハッシュ、詳細ログは展開して読めるようにする。異常の理由は折りたたみに隠さない。
- 右側パネルで状態バッジと停止操作をもう一組重ねるのではなく、担当・成果物の情報を主役にする。会話上部は運転状態と操作、右側は作業の詳細という役割にする。
- 会話、実行ログ、作業履歴はそれぞれ適切な表示にする。会話には発言のまとまり、時刻、送信失敗、最新発言への移動を用いる。実行ログをチャットの吹き出しへ一括で入れない。
- 余白、文字サイズ、角丸、境界線、状態色は共通のトークンで管理する。DSHの既存テーマと公開UIスロットに合わせ、他のプラグインのDOMへスタイルを上書きしない。
- 動きは更新箇所の把握を助ける短い遷移に限定する。停止操作やエラーの確認をアニメーションで遅らせず、reduced motionに対応する。

## 参照元

- Badge: https://uiarc.dev/components/badge — 短い状態、文字による状態伝達、意味に対応した色。
- Expandable card: https://uiarc.dev/components/expandable-card — 要約を常時表示し、詳細を必要時に展開する。狭い画面の幅を越えない。
- Chat thread: https://uiarc.dev/components/chat-thread — 発言のまとまり、送信状態、最新発言への移動。公式仕様も会話とシステムログを区別している。
- License: https://uiarc.dev/license — 無料コンポーネントはMIT。ソースを取り込む場合は著作権・ライセンス表示を保持する。今回は表示方法の参照であり、ソースや有料コンポーネントは取り込んでいない。


Applied in 0.6.2: compact header badges and top hdt controls, worker-first sidebar, visible failure reasons, native result/artifact disclosure, scoped spacing/border tokens. DSH base chat was not replaced. UI fixture screenshot: output/playwright/scrum-arc-ui.png. Six regression tests and actual DSH Web enable/disclosure/stop checks passed. Client files copied to resident installation.
