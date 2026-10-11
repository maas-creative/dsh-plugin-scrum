# GitHub公開前のライセンス確認（2026-10-10）

公開主体の表示案: MaaS Creative。自社作成部分の著作権表示と、第三者の既存著作権表示を区別する。既存の著作権者名を置換しない。

## 結論

同じライセンスによる派生版の提供を求め、ネットワーク経由の改変版にもソース提供義務を設けたい場合、AGPL-3.0-onlyを候補とする。商用利用自体は禁止しない。著作権表示の維持と商標・会社名の使用許諾は別である。

ただし現状の二製品へ一括適用することは未承認。OMO由来部分の追加許諾または、保護されるコード・文章を流用しない独立実装への置換と由来監査が必要。

## 確認した原資料

- OMO参照commit 59d23b5c1ddc2a02210ede4cb485f88996fd02bd: https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/59d23b5c1ddc2a02210ede4cb485f88996fd02bd/LICENSE.md
- OMO現行dev: https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/LICENSE.md
- どちらもSustainable Use License 1.0。社内事業目的・非商用・個人利用に制限され、配布は無償かつ非商用目的。再許諾不可。通知保持・改変通知も必要。
- AGPL本文: https://opensource.org/license/agpl-3.0 （第5条、第13条）
- OSS定義: https://opensource.org/osd （商用を含む利用・再配布を認める要件）

## ローカル照合

Scrum: package.jsonのlicenseはvendor/omo/LICENSE.md参照。vendor/omoとvendor/desktopにSUL本文あり。workpool.mjs、context.mjs、memory-filesystem.mjs等から実際にOMO移植コードを利用。READMEも社内・個人利用と記載。単にライセンスファイルを差し替えてAGPLとして公開してはいけない。

Dashboard: package.jsonにlicense指定なし。THIRD_PARTY_NOTICES.mdにはデジタル庁とMarkedのMIT表示。vendorとscriptsには過去の移植関連ファイルも残る。独立Dashboardの公開ソース・配布物を確定し、不要なScrum移植資材を除外してもコード由来が残らないか確認が必要。現時点でAGPL適合を実証したとは扱わない。

## 公開準備の残作業

1. 全同梱ファイル・生成物・依存ライブラリを由来、元commit、ライセンス別に分類。OMOの移植されたプロンプト・スキル文面も対象。
2. ScrumのSUL部分について追加許諾の取得または独立実装への置換を選び、既存機能の回帰試験を保持する。非商用限定のSUL準拠公開と、商用利用可能なAGPL公開は別方針。
3. 自社作成部分の権利帰属を確認し、正式なLICENSE、著作権表示、改変表示、第三者NOTICEを整備。
4. 公開用ツリーを作成。work、実行履歴、台帳、OAuth資格情報、個人資料、スクリーンショット、ローカル環境・絶対パスなどを選別。git add .で一括公開しない。
5. クリーン環境で単独・同時導入を検証し、GitHub組織の正式なIDと公開先権限を確認して、二つの独立リポジトリへ公開。

この調査ではGitHub公開、ライセンス変更、上流への連絡を実施していない。
