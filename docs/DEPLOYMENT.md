# 發布說明 — 工地主任歷屆試題模擬練習

現行儲存庫：[susannnwu/past-exam-practice-of-site-supervisor](https://github.com/susannnwu/past-exam-practice-of-site-supervisor)。2026-11-05 已由 `site-supervisor-quiz` 更名，儲存庫 ID 與提交歷史不變；本機 origin 已同步。此次更名不包含程式碼推送或手動觸發 Pages。

## GitHub Pages

1. 核對 Git diff：65 份原始 PDF 不應有新增、刪除或修改。
2. 確認只有網站來源、必要衍生資料、工具、測試與文件；DATA、dist、test-results、憑證與快取不應提交。
3. 通過建置、資料與 HTTP 測試後，依使用者授權提交及推送，保留既有歷史，不強制推送。
4. 儲存庫 Settings → Pages 的 Source 選 GitHub Actions。
5. 手動執行發布 workflow。工作流程從來源建立 dist，通過基本資料及連結檢查後上傳 Pages artifact 並部署。

工作流程只使用 workflow_dispatch，不因一般推送自動發布。此文件不表示遠端設定或部署已完成。

## 更名

網站顯示名稱固定為 `工地主任歷屆試題模擬練習`；網址及儲存庫識別保留既有英文 slug，其他顯示名稱採中文。origin 與 HTTP 測試子路徑已對應新名稱；正式發布時仍須檢查 Pages 設定與新網站網址。

原 localStorage keys 與題目 ID 保持不變，但不同網址的瀏覽器儲存區彼此隔離，GitHub Pages 不會自動取得舊 Sites 的作答紀錄。

不再同步 Sites，也不另產生本機執行交付版。DATA 中的舊網站、來源與發布紀錄僅作歷史，不作現行發布來源。
