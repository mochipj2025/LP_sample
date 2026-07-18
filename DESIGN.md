# PromptMaker シリーズ 設計図

**「はじめてでも、選んで作れる。」**がコンセプトのツール群。最初は「業種・用途を3つ選ぶだけ」のLP作成だけだったが、
画像作成・アイコン作成を含む**「シリーズ」**として育てていくうちに、選ぶ項目も出せるものも増えた。
「3つ選ぶだけ」という最初のシンプルさは各ツール内の最短ルート（プリセット1クリックなど）としては今も生きているが、
シリーズ全体のキャッチコピーとしては「はじめてでも、選んで作れる。」の方が実態に合っている。

## 1. プロダクト構造（4本柱）

| 系統 | id | ファイル | 状態 |
|---|---|---|---|
| LP作成 | `lp` | `js/template.lp.js` | 稼働中 |
| 画像作成 | `visual` | `js/template.visual.js` | 稼働中 |
| アイコン作成 | `icon` | `js/template.icon.js` | 稼働中 |
| マスコット作成 | `mascot` | `js/template.mascot.js` | 稼働中（2026-07-18追加） |

タブ（`#tabs`）でいつでも切り替えられる。切り替えると入力・プリセット・出力がその系統のものに丸ごと入れ替わる（`app.js` の `switchTemplate()`）。

## 2. サイト構成（入口）

- `index.html` … フル機能版。全項目を1画面で見ながら編集する。ヘッダーの主ボタンは
  「はじめる（迷ったらこちら）」＝v2 へ。冒頭に「これは何？」イントロカード（LPの定義＋3行）を常設し、
  直接来た人にも用途が伝わるようにした。
- `v2/index.html` … ステップ版。情報設計をやり直した**初めての人の既定入口**。現状はLP作成のみ対応（`v2/NOTES.md` 参照）。
  末尾に出口リンク（完成サンプル／フル機能版）を常設し、袋小路にしない。
- `tutorial.html` … 使い方ガイド（静的ページ、JSロジックとは独立）。「これは何のツール？」の紹介と
  「もっと詳しく」（出力タイプ・こだわる道・業種早見表）。index にイントロを置いたので役割は「詳しい版」。
- `samples/index.html` … 完成LPのサンプル集（静的ページ）。

**入口ごとにマスコット（相棒）を配置**し、そのページで「今なにをする場所か」を一言で伝える。
画像は `assets/mascot/*.webp`（各20〜30KB）。用途対応：`think`＝これは何/設計図、`launch`＝発進/出力、
`image`＝画像を用意、`setup`＝準備/掲載情報、`done`＝完成/サンプル、`plain`＝汎用。共通スタイルは
`css/style.css` の「20. マスコット」節（`.mascot-note` / `.mascot-hint`）。

`~~wizard/index.html~~` … 旧ステップ版。2026-07-17 に **`_archive/wizard/` へ退避（失敗ログとして保管）**。
v2 へ置き換え済みで、以前からどこからもリンクされない孤児だった。退避理由は `_archive/README.md` 参照。

フル機能版とステップ版は **同じ `js/core.js` `js/template.*.js` `js/app.js` を共有**している。見た目や進め方が違うだけで、中身のロジックは1つ。

## 3. レイヤー構造

```
入口          index.html / v2/index.html
               │
UI層          app.js（画面描画・状態管理・テンプレ非依存）
               │        └ v2/js/app.js（ステップ進行の制御。app.js の上に薄く被せるだけ）
               │          ※旧 wizard.js は _archive/ へ退避
               │
テンプレート層  template.lp.js / template.visual.js / template.icon.js
               │        ↑ ここだけに「業種・出力内容の知識」を書く
               │
コア層        core.js（テンプレート登録の仕組み・共通ユーティリティ）
```

**原則：新しい系統を1つ足したいときは、`template.〇〇.js` を1本追加して `core.js` に登録するだけでよい。**
`app.js` と `wizard.js` は「どのテンプレか」を一切知らない作りなので、この2ファイルは変更不要（実際、画像作成を追加したときも無変更で動いた）。

## 4. テンプレートの共通インターフェース

新しい `template.〇〇.js` を作るときに実装するもの：

```js
global.PromptMaker.registerTemplate({
  id: 'icon',              // 必須・一意
  name: 'アイコン作成',      // タブに出る名前
  icon: '🔶',               // タブに出る絵文字
  enabled: true,            // false なら「準備中」バッジ付きで無効表示
  fields: FIELDS,           // 入力項目（type: chips / textarea / repeater）
  presets: PRESETS,         // ワンクリックプリセット
  defaults: DEFAULT_STATE,  // 初期値
  build: build,             // (state) => string ※必須。これが最終出力
  wireframe: wireframe,     // (state) => block[] ※任意。無ければ見取り図が自動で非表示
  imageSlots: imageSlots    // (state) => slot[] ※任意。無ければ「画像を用意する」ステップが自動で非表示
});
```

`build()` だけが必須。`wireframe` と `imageSlots` は「その系統に意味がある時だけ」実装すればよく、無ければ UI側が自動で該当パーツを隠す。

`imageSlots` を実装すると、UI側（`app.js`）がすでに持っている
「画像を選ぶ→自動でWebPへ変換→スロットidをファイル名にしてリネーム→まとめてZIP書き出し」という
仕組みを、テンプレート側は一切書かずにそのまま使える。テンプレートの責務は `{id, label, ratio, prompt}` の配列を
返すことだけ（`id` がそのままファイル名になる）。当初「画像作成には無い」を実例にしていたが、
画像作成でも「AIに作らせた画像を戻してリネーム・WebP化・ZIPでまとめたい」というニーズがあったため、
`template.visual.js` にも追加した。`build()` が作るパターン別プロンプトと同じロジックを
`imageSlots()` からも呼んでいるので、二重管理にはなっていない（詳細は `js/template.visual.js` 内のコメント参照）。
`wireframe`（見取り図）は今も画像作成には無い＝「1セクションずつの積み木」という概念自体が無いため。

## 5. データの流れ（1テンプレートを使うとき）

```
① 入力（fields）→ ② state{} → ③ template.build(state) → ④ プロンプト文字列 → ⑤ コピーして外部AIに貼る
```

`state` はテンプレートが変わっても同じ形（key→value のプレーンオブジェクト。`repeater` 型だけ配列を持つ）。

## 6. 今後のロードマップ

- [x] 画像作成に `imageSlots` を追加（アップロード→自動リネーム→WebP変換→ZIP書き出しをLP作成と共有）
- [x] `tutorial.html` に「はじめに：フォルダ＆GitHubリポジトリ準備」を追加（コピペ用プロンプト付き）
- [x] アイコン作成 PromptMaker（`template.icon.js`）― favicon・SNSアイコン・UI機能アイコンなど、
      小さく表示される「印」向け。`imageSlots` も最初から実装済み。テイストの語彙はLP作成・画像作成と共通
- [x] マスコット作成 PromptMaker（`template.mascot.js`、2026-07-18）― かたち・モチーフ・いろ等の素材ボタンの
      組み合わせでキャラを作る方式。世界観（かわいい／サイバーパンク／スチームパンク）で固定プロンプトを差替、
      `imageSlots` は三面図（正面／横／背面）。LP作成の掲載情報にも「マスコット・相棒キャラ」欄を追加し、
      入力があるとLP出力に登場指示を自動で差し込む。プロンプトはChatGPT Image 2.0向けに構造化（構図/画風/一貫性/背景/注意）。
- [x] LP作成にGEO/AEO対応を追加（2026-07-18）― Googleマップのリンク欄（`infoMapUrl`）、業種別
      schema.org構造化データ（`schemaTypeOf`）＋FAQPage、NAP表記一致の指示をLP制作プロンプト／設計図に自動同梱。
- [x] LP作成にSEOメタ情報の指示を追加（2026-07-18）― title/meta description/OGP/Twitter Card/canonical/
      lang=ja、見出し階層、img alt、faviconをLP制作プロンプト／設計図に自動同梱。
- [x] 画像作成の既定比率を1:1→4:5（縦長SNS）に変更（2026-07-18）― 主要SNSが投稿画像を1:1固定で扱わなくなったため
- [x] 画像作成・アイコン作成・マスコット作成のプリセットにも見本画像プロンプトを整備（2026-07-18）
      ― `assets/presets/{visual,icon,mascot}/README.md` に、各プリセットの実出力から生成したプロンプトを掲載
- [ ] LP作成の深掘り（見出し複数パターン生成・多言語対応など）
- [ ] 画像作成 × LP作成の連携強化（画像作成側で作ったテイストをLP側にそのまま引き継ぐ）
- [ ] v2（ステップ版）を画像作成・アイコン作成・マスコット作成にも対応させる（JOURNEY.md「質問ゲート型ウィザード」参照）

## 7. 外部エコシステムとの関係（要整理・未解決）

このプロジェクト（`LPStructureMaker`）とは別に、同じ作者（もちすら氏）のリポジトリ
`github.com/mochipj2025/Promptmaker002` に、すでに次のツール群が存在することが判明した。

**本番ツール（7本）**
- `simple-character-promptmaker/` … キャラクタープロンプトメーカー（全部入り・詳細編集）
- `real-portrait-maker/` … リアルポートレートMaker
- `art-character-maker/` … アートキャラクターMaker（水彩・絵本・版画調）
- `anime-comic-maker/` … 漫画・アニメキャラMaker
- `content-kit/` … Content Prompt Kit（漫画カット・雑誌ページ・SNS素材）
- `lp-structure-maker/` … **LP構成Maker（このプロジェクトと役割が重なる可能性が高い）**
- `five-question-character-maker/` … 本の世界転生オリキャラMaker

**Dev試作（2本）**
- `dev/companion-maker.html` … あなただけの相棒maker（§2フェーズ2の候補、上述）
- `dev/character-promptmaker/` … キャラ案メモ maker

**未解決の論点**

1. **`lp-structure-maker/` との関係が最重要。** 向こうのREADME記載では「販売型・予約申込型・登録型・アプリ型・世界観型など8種類」から選ぶ設計になっており、このプロジェクトの「業種（飲食店・美容室・SaaS…）」ベースの設計とは分類軸が異なる。同一ツールの別バージョンなのか、意図的に別系統として両立させるのか、要確認。
2. ~~キャラクター系がすでに5本＋試作2本もある。相棒maker（マスコット作成）を新規に足すなら...~~ ― **解決済み（2026-07-18）**。「薄く統合」方針で `template.mascot.js` を実装。別リポの5本は汎用キャラプロンプトメーカーであるのに対し、本実装は「このLP/ブランド専用・トーン継承・`imageSlots`によるLP素材ワークフロー連携」に絞ることで重複を避けた（詳細はJOURNEY.md該当節）。
3. この2つのリポジトリ（`LPStructureMaker` 単体プロジェクトと `Promptmaker002` モノレポ）を将来的に統合するのか、独立のまま保つのかも未決定。

**現時点の方針**：論点2（相棒maker/マスコット作成の可否）は上記の通り解決・実装済み。論点1（`lp-structure-maker`との関係）と論点3（リポジトリ統合可否）は依然未解決で、今後整理が必要。

## 8. 運用メモ（管理者向け）

### プリセットの見本画像を足す

見本画像が無いプリセットは絵文字で表示される（表示ロジックはそのまま維持され、画像の有無で
UIが壊れることはない）。画像を足す手順：

1. Visual PromptMaker などでLPの完成イメージ画像を作る。
2. **長辺720px・png**（150KB以下が目安）に整え、`assets/presets/<テンプレid>/<プリセットID>.png`
   （例 `assets/presets/lp/resto.png`）で保存。拡張子は png → webp → jpg → jpeg の順で
   自動検出される（`js/app.js` の `IMAGE_EXTS`。同梱画像は現在すべて png）。
3. ツールを開き直すと、サムネイル・拡大・仕上がり例に自動で反映される（コード変更は不要）。

（旧 `tutorial.html` の「見本画像の足し方」カードから移設。エンドユーザー向けの内容ではなく
運用メモのため、ここに置く。）
