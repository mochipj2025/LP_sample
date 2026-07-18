# サンプル画像の置き場所（LP）

このフォルダに `<プリセットID>.webp` を置くだけで、プリセットカードにサムネイル・
🔍拡大・右カラムの「仕上がり例」が自動で出ます。**コード変更は不要**。無くても崩れません。

| プリセット | ファイル名 |
|-----------|-----------|
| 飲食店の予約LP | resto.webp |
| カフェの集客LP | cafe.webp |
| 整体の新規集客LP | salon.webp |
| 美容室の指名LP | hair.webp |
| 講座の申込LP | seminar.webp |
| SaaSの無料登録LP | saas.webp |
| ECの購入LP | ec.webp |
| 個人サービスの問い合わせLP | personal.webp |

拡張子は **webp → png → jpg → jpeg** の順で最初に見つかったものを使用
（`js/app.js` および `v2/js/app.js` の `IMAGE_EXTS` と同じ順。変更時は両方を揃えること）。
別形式でもこの順で自動検出されるので動作はする。長辺720px・150KB以下推奨。
