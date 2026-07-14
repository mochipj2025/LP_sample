# サンプルLP テンプレート

新しいサンプルLPを作るときは、このフォルダを丸ごとコピーして使います。

## 手順

1. `samples/_template/` を `samples/<新しいサンプル名>/`（例: `samples/salon/`）としてコピーする。
2. StructureMaker本体でプリセットを選び、「LP制作プロンプト」と「必要な画像プロンプト集」を出力してAIに渡す。
3. 生成された画像を `source/originals/` にいったん保存する（ファイル名はAIが付けたままでOK）。
4. 各画像を長辺720px程度・150KB前後にリサイズし、用途がわかる名前（`fv.png` / `concept.png` / `menu-1.png` / `gallery-1.png` / `proof-1.png` / `access.png` / `cta.png` など）にリネームして `images/` に置く。
5. AIが生成したLPコード（`index.html`）を、この`images/`フォルダと同じ階層に保存する（`index.html` 内の画像パスは `images/〇〇.png` を指すように統一する）。
6. 配布・バックアップ用にzip化する場合だけ `archive/` に入れる（普段は空でよい）。
7. `samples/index.html` の一覧に、このサンプル用のカードを1件追加する。

## フォルダ構成のルール

- 画像フォルダ名は必ず `images/`（`assets/images/` などは使わない。過去にhair-salonだけ揺れていたのを `images/` に統一済み）。
- `source/originals/`（生成直後の元画像）と `archive/`（zipバックアップ）は `.gitignore` でGit管理対象外。ローカル容量を圧迫してきたら、`images/` に最終版があることを確認した上で削除して問題ない。
- `index.html` は必ず `images/` 配下の相対パスで画像を参照する。
