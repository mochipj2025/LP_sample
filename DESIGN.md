# PromptMaker シリーズ 設計図

**「はじめてでも、選んで作れる。」**がコンセプトのツール群。最初は「業種・用途を3つ選ぶだけ」のLP作成だけだったが、
画像作成・アイコン作成を含む**「シリーズ」**として育てていくうちに、選ぶ項目も出せるものも増えた。
「3つ選ぶだけ」という最初のシンプルさは各ツール内の最短ルート（プリセット1クリックなど）としては今も生きているが、
シリーズ全体のキャッチコピーとしては「はじめてでも、選んで作れる。」の方が実態に合っている。

## 1. プロダクト構造（3本柱）

| 系統 | id | ファイル | 状態 |
|---|---|---|---|
| LP作成 | `lp` | `js/template.lp.js` | 稼働中 |
| 画像作成 | `visual` | `js/template.visual.js` | 稼働中 |
| アイコン作成 | `icon` | `js/template.icon.js`（未作成） | 予定 |

タブ（`#tabs`）でいつでも切り替えられる。切り替えると入力・プリセット・出力がその系統のものに丸ごと入れ替わる（`app.js` の `switchTemplate()`）。

## 2. サイト構成（入口）

- `index.html` … 通常版。全項目を1画面で見ながら編集する、フル機能版。
- `wizard/index.html` … ステップ版。同じロジックを1ステップずつガイドする、初めての人向け。
- `tutorial.html` … 使い方ガイド（静的ページ、JSロジックとは独立）。冒頭に `#setup`（フォルダ作成・GitHubリポジトリ作成の手順とコピペ用プロンプト）を追加済み。
- `samples/index.html` … 完成LPのサンプル集（静的ページ）。

通常版とステップ版は **同じ `js/core.js` `js/template.*.js` `js/app.js` を共有**している。見た目や進め方が違うだけで、中身のロジックは1つ。

## 3. レイヤー構造

```
入口          index.html / wizard/index.html
               │
UI層          app.js（画面描画・状態管理・テンプレ非依存）
               │        └ wizard.js（ステップ進行の制御。app.js の上に薄く被せるだけ）
               │
テンプレート層  template.lp.js / template.visual.js / template.icon.js（予定）
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
- [ ] アイコン作成 PromptMaker（`template.icon.js`）― 作るなら `imageSlots` も最初から実装したい
- [ ] LP作成の深掘り（見出し複数パターン生成・SEOメタ情報・多言語対応など）
- [ ] 画像作成 × LP作成の連携強化（画像作成側で作ったテイストをLP側にそのまま引き継ぐ）
- [ ] マスコット・相棒キャラ作成（`template.companion.js`、相棒maker移植）― §7 の整理待ち。なお会話ベースで先行して
      `companion-character-maker` という単体スキル／コピペ用プロンプトを試作済み（プロジェクト外の成果物として作成、
      本リポジトリには未格納）。

## 7. 外部エコシステムとの関係（要整理・未解決）

このプロジェクト（`LPStructureMaker`）とは別に、同じ作者（もちすら氏）のリポジトリ
`github.com/mochi