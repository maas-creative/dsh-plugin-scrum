# 公開画像とロゴ

ロゴは組み込みのimagegenで制作したPNG原本です。両製品はインディゴ・青・ティールを共通の色調にし、Scrumは協調する経路、Dashboardは全体を見渡す構成を表しています。OMOやDSHのロゴをScrum／Dashboardのロゴとして流用していません。

READMEでは112px角で表示します。透明背景のため、使用先では十分なコントラストがある背景を選んでください。ロゴはPNGで、ベクター原稿ではありません。

スクリーンショットは公開用の架空データを使い、実際のアプリをブラウザで表示して撮影しました。画像生成による架空のUIではありません。認証URLやブラウザのアドレスバーは画像に含みません。画面には個人の履歴・プロジェクト・アカウントを使用していません。モデル実行の成果を示す画像ではありません。

## 再撮影

```sh
node scripts/readme-demo.mjs
```

表示されたローカルURLをブラウザで開きます。既存のデータや常駐版を変更せず、独立した一時環境で起動します。Ctrl-Cで停止すると一時環境を終了・削除します。

DSH Webでプレビューの案内を閉じ、サンプルセッションを開きます。上部のEnable hdt、Workersを操作します。`scrum-workspace.png`は1600×760で撮影し、`worker-models.png`は1600×1000でWorker modelsを開いた状態です。担当はblocked／未検証の表示用データで、モデル呼び出しは実行しません。実行した成果物や成功例として紹介しないでください。

DSHのロゴと標準UIはDSHの表示です。Scrum独自のUIであると誤認させないよう、READMEではDSH Web上の拡張と説明しています。

## 生成プロンプト

組み込みimagegenを使用。透明背景を指定。

```text
Use case: logo-brand. Create the final original logomark for 'Scrum', a professional open-source multi-agent orchestration plugin by MaaS Creative. Single square icon, no words or lettering. Flat crisp geometric design: three interlocking rounded pathways forming an abstract S and a coordinated relay loop, equal balanced weights. Deep indigo and clear blue with one restrained teal accent; excellent legibility at 32 pixels, broad negative space, centered, generous safe margins, premium calm software identity. Truly transparent background. No gradients, shadows, mockup, borders, text, watermarks, existing brand references. Deliver one finished mark, not a sheet of alternatives.
```
