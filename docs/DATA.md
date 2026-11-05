# 資料說明 — 工地主任歷屆試題模擬練習

原始 65 份 PDF 沿用既有 GitHub 內容與路徑。新版需要 `data_set/quiz-data.js` 與 410 張題目裁切圖片；僅更新必要衍生資料，不刪除再上傳 PDF，也不忽略整個 data_set。

資料夾以年份與場次保存原卷；不要將原始試題放到 Input，或為了網站再建立一份重複 PDF 目錄。`data_set/interim` 僅是擷取快取，不提交。

48 張可作答試卷、2,400 題、386 個情境。原卷中的 112 年第 1 次四張掃描卷目前未納入可作答題庫。題目與試卷 ID 必須穩定。

## 重建及稽核

```text
python scripts/inspect_tables.py
python scripts/rebuild_questions.py --images
python scripts/audit_sources.py
python tests/validate_quiz_data.py
```

修改題庫前保留版本，重建後必須重新核對原始題目及答案 PDF；結構測試不能代替來源驗證。中文斷行接合不可引入字詞間多餘空白。

112 年第 3 次的 74 筆答案欄位更正清單在 `tests/fixtures/answer-corrections-v2.3.json`。歷史作答重算只影響呈現，不覆寫原始快照。分類 Excel 保留在 DATA 舊資料區，其中答案尚未套用該次更正，已填分類不得隨意覆寫。

MIT 只涵蓋自行撰寫的程式碼，排除所有 PDF、圖片、題幹、情境、選項、答案，以及題庫 JS、Excel、測試基準中的轉錄內容。原始權利歸各自權利人。
