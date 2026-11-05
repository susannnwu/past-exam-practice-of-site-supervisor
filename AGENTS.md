# Past Exam Practice of Site Supervisor — 專案補充規則 V0.1.14

更新日期：2026-11-05。通用工作模式由全域 AGENTS.md 維護，本檔只記本專案補充。

- 本目錄是唯一網站維護與 Git 工作目錄。上層僅保留 `DATA` 與 `GitHub`；所有舊資料、備份、輸入、Excel、交付與驗證紀錄放在 `../DATA`，不複製進此儲存庫。
- 網站名稱統一為 `Past Exam Practice of Site Supervisor`，GitHub 儲存庫為 `susannnwu/past-exam-practice-of-site-supervisor`，已於 2026-11-05 完成更名。remote 與測試子路徑保持一致；未推送的程式不得宣稱已上線。
- 以 GitHub／GitHub Pages 為唯一發布來源。不再交付本機執行版或同步 Sites；舊 Site 及其來源僅留作歷史，不自行刪除或關閉。
- 結構固定：根目錄 `index.html`，`src` 放 JS／CSS，`data_set` 放資料資產，`scripts` 放工具，`tests` 放測試，`docs` 放文件。原始 PDF 不移入 Input，也不改名或另複製一份進 Git。
- 沿用既有 GitHub 提交歷史及 65 份原始 PDF。提交前核對 PDF 沒有增刪修改；不重寫歷史或強制推送。一般整理只準備變更，不自行 commit／push；依使用者當次明確授權執行遠端操作。
- `dist` 是可忽略的 Pages 建置產物，不是本機交付。測試使用 HTTP 與 GitHub 專案子路徑，使用隔離瀏覽器 context。設定 `QUIZ_TEST_OUTPUT` 可將紀錄寫到 `../DATA`；保留 localStorage keys 及穩定題目 ID。
- 作答草稿、歷次紀錄、計時、標記與筆跡必須分開保存。歷史快照不得被目前標記或答案重算覆寫；90 分鐘正數計時，暫停及背景不計入，不強制交卷。
- 旗幟／勾選按鈕保留輔助閱讀標籤；答對符號用 ○。結果一覽使用當次交卷的標記。交卷及再做一次均先確認。
- 每題 2 分。修改題庫後必須執行 `scripts/audit_sources.py` 核對原 PDF；結構測試不能代替答案來源驗證。允許的歷史更正見 `tests/fixtures/answer-corrections-v2.3.json`。
- MIT 僅涵蓋自行撰寫的程式碼，不含任何 PDF、題目內容、答案或圖片；轉錄格式與測試基準也不在授權內。
- 多人帳號隔離與網站分享權限分開處理，不因登入網站就假設瀏覽器作答資料已隔離或同步。

舊規則與本次快照保留在上層 `DATA/01-Output/工作規則_V0.1.2`，只作追溯。
