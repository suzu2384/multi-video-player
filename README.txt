複数動画プレーヤー mobile fixed v4

GitHub Pagesの公開フォルダ直下へ、次の3ファイルをアップロードしてください。
- index.html
- styles-mobile-v4.css
- app-mobile-v4.js

以前の styles.css / app.js は参照されません。削除しても構いません。

修正内容:
- 事前準備ボタンと関連処理を完全削除
- スマホ縦画面の列数候補を1〜2だけに制限
- スマホ横画面の列数候補を1〜3だけに制限
- PCの列数候補は1〜6
- iPhoneの visualViewport と画面回転を使って選択肢を再生成
- 旧CSS/JSキャッシュを避けるためファイル名を変更
