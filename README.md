# Past Exam Practice of Site Supervisor

工地主任歷年考古題練習網站。以 GitHub 為唯一維護與發布來源，透過 GitHub Pages 提供使用；不再交付本機執行版或同步 Sites。

網站功能版本 **V2.6.8**。網站由本儲存庫維護，發布狀態以 GitHub Actions 與 Pages 為準。

儲存庫：[susannnwu/past-exam-practice-of-site-supervisor](https://github.com/susannnwu/past-exam-practice-of-site-supervisor)。已於 2026-11-05 完成遠端儲存庫與專案顯示名稱更名，本機 origin 已同步。

[開發說明](docs/DEVELOPMENT.md)｜[發布說明](docs/DEPLOYMENT.md)｜[資料與授權](docs/DATA.md)

## 功能

48 張試卷、2,400 題，年份由新到舊，同年場次第 1、2、3 次排序；情境題分組。每題 2 分，送分題獨立標示。

支援自動儲存、續答、90 分鐘正數計時、旗幟與勾選、計算紙及多次作答。交卷及「再做一次」都先確認；結果一覽可跳至完整選項檢討，歷次紀錄保留當次答案與標記。Light／Dark／System 位於頁尾。

作答紀錄保存在目前瀏覽器，不會跨裝置或網址自動同步。改到 GitHub Pages 後，不會自動帶入舊 Sites 網址的紀錄。

## 標準目錄

```text
GitHub/
├── index.html           網站唯一入口
├── src/                 JavaScript 與 CSS
├── data_set/            原始 PDF、轉錄題庫、必要圖片
├── scripts/             建置與資料維護工具
├── tests/               現行測試及回歸基準
├── docs/                開發、發布、資料說明
├── .github/workflows/   GitHub Pages 工作流程
├── package.json         瀏覽器測試依賴
├── requirements.txt     PDF 稽核依賴
├── LICENSE
└── AGENTS.md
```

`dist/`、`test-results/` 及擷取快取是可忽略的建置／測試產物，不上傳 Git。舊版本、輸入、Excel、備份、Sites 來源及過去交付成果都在此目錄外的 `../DATA/`。

## 檢查與發布

```text
python scripts/prepare_site.py
python tests/validate_quiz_data.py
python tests/verify_site.py
npm test
```

GitHub Actions 產生 `dist`、核對題庫與來源連結，再發布 Pages。工作流程僅手動觸發；推送與首次 Pages 設定依使用者當次授權執行。

原始 **65 份 PDF** 從既有 Git 紀錄沿用，內容與路徑不變，不需刪除再上傳。新版轉錄題庫及 410 張裁切圖片為必要新增資料。

## 授權與限制

[MIT License](LICENSE) 僅涵蓋自行撰寫的程式碼，**不包含 PDF、題目內容、答案或任何圖片**，包括題庫 JS、測試基準及 Excel 中的轉錄內容。素材權利歸各自權利人。

112 年第 3 次的 74 筆答案欄位已依原始答案校正。舊分類 Excel 尚未套用該次更正，全庫未逐題人工專業解題複核。多人帳號隔離及跨裝置同步尚未提供；實體 iPhone／Safari 尚未實測。
