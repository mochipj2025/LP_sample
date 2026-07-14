# automation/ ― 将来のAI自動化用の置き場（設計メモ）

いまはまだ「画像プロンプトをコピー→別のAIで生成→手動アップロード」「LP制作プロンプトをコピー→Claude/ChatGPTに貼る」という、人がAIとの間を仲介する運用です。
将来的にAI APIを直接叩いて、画像生成〜LPコード生成までを自動化する構想があるので、そのための土台をここに用意しています。

## 方針：ロジックは二重管理しない

`js/core.js` と `js/template.lp.js` は、`state`（業種・読み手・ゴールなど）から
「画像スロットごとのプロンプト」(`imageSlots(state)`) と「LP制作プロンプト」(`build(state)`)
を作るロジックそのものです。ブラウザ専用に書かれていましたが、末尾を次のように直しただけで、
**Node からも同じファイルをそのまま `require` して使えます**（ロジックの複製は一切していません）。

```js
require('../js/core.js');            // 先に読み込むと global.PromptMaker が用意される
const lp = require('../js/template.lp.js'); // 登録済みの 'lp' テンプレートを直接受け取る

const state = { type: 'サロン・整体', reader: '迷っている人（比較検討）', goal: '予約する', tone: '信頼・誠実', volume: 'しっかり（長め）' };

lp.imageSlots(state);        // -> [{ id, label, ratio, prompt }, ...] 画像生成APIに渡す1枚ずつのジョブ
lp.build({ ...state, output: 'LP制作プロンプト（コードまで）' }); // -> LPコード生成AIに渡す1本のプロンプト
```

つまり、ブラウザ側(`index.html`の「②画像を用意する」「③出力」)とサーバー側(将来の自動化)で、
**プロンプトの中身が絶対にズレない**構成になっています。整体の解剖学的な指定や「実物を反映」チェックの注記のような
プロンプトの改善も、この2ファイルを直すだけで両方に効きます。

## 想定しているアーキテクチャ

```
ブラウザ(index.html)
   │  state（業種・読み手・ゴールなど）を作る。今まで通り手動コピーもできる
   ▼
（将来）ローカルサーバー / スクリプト（このフォルダに実装予定）
   │  1. state を受け取り、core.js + template.lp.js で同じプロンプトを再生成
   │  2. imageSlots() の各プロンプトを画像生成APIに渡し、images/<id>.png を保存
   │  3. build(state, output: 'LP制作プロンプト') をコード生成APIに渡し、index.html を生成
   ▼
samples/<新しいサンプル名>/  （samples/_template/ と同じ構成）
```

APIキーをブラウザのJSに直接書くのは安全ではないため、**API呼び出しは必ずこのローカルサーバー/スクリプト側で行う**方針です
（ブラウザからは `state` のJSONだけをこのサーバーに渡す）。

## まだ実装していないもの

- 実際の画像生成API・コード生成APIの呼び出し部分（どのプロバイダを使うか次第で変わるため、決まってから実装）
- ブラウザ側から「🤖 自動生成」のようにこのサーバーへ `state` を送るボタン
- APIキーを保存する `.env`（`.gitignore` 済み。コミットしないこと）

## 次にやること（プロバイダが決まったら）

1. `automation/server.js`（仮）を作り、`express` などで `POST /generate` を1本用意する。
2. リクエストボディの `state` から `imageSlots(state)` / `build(state)` を呼んで、実際にAPIへ投げる。
3. 生成結果を `samples/_template/README.md` の手順と同じ形で `images/` に保存し、コード生成結果を `index.html` として保存する。
4. `index.html` に「🤖 自動生成」ボタンを足し、`fetch('http://localhost:PORT/generate', {method:'POST', body: JSON.stringify(state)})` する。
