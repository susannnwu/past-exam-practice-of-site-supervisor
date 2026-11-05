# 開發說明 — 工地主任歷屆試題模擬練習

本儲存庫維護唯一的 GitHub Pages 網站，不另維護可下載的本機版。開發預覽與測試只用於驗證相同來源。

## 環境

Node.js 22 以上、Python 3.10 以上。瀏覽器測試依賴版本固定於 package.json；PDF 稽核依賴固定於 requirements.txt。

```text
npm install
npx playwright install chromium
python -m pip install -r requirements.txt
```

網站本身無 npm 執行期依賴。若已安裝 Chrome，可用 `BROWSER_EXECUTABLE` 指定執行檔，略過下載 Chromium。舊 Excel 工具與分類成果保留於 DATA，不屬這份網站專案。

## 驗證

```text
python scripts/prepare_site.py
python tests/validate_quiz_data.py
python tests/verify_site.py
npm test
```

第一步生成被 Git 忽略的 `dist`；它是部署產物，不是使用者交付版。`npm test` 暫時啟動綁定 127.0.0.1 的 HTTP server，模擬 GitHub Pages 專案子路徑，測試根目錄原始碼與 dist，測完即關閉 server。

測試包含作答、續答、歷次檢討、題號跳轉、計算紙、再做一次、交卷確認與模式切換。使用全新 browser context，不碰使用者現有紀錄。預設輸出至被忽略的 `test-results`；`QUIZ_TEST_OUTPUT` 可指定到儲存庫外的 DATA 驗證區。

所有內容編輯根目錄來源，不要編輯 dist 或 DATA 中的歷史副本。網頁相對連結須能在儲存庫子路徑運作，不能假設部署於網域根目錄。

[發布](DEPLOYMENT.md)｜[資料與來源稽核](DATA.md)
