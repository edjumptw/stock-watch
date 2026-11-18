# 盯盤網頁 v1.6.2 修正摘要

依 `tasks/v1.6.2_fix.md` 完成三項修正，修改範圍為 `trading.js`、`style.css` 與 `index.html`，另附瀏覽器驗證腳本及截圖。行情資料、交易運算、觀察清單、報價來源與既有版面配置均未更動，沒有接券商或上傳交易資料。

## 修正內容

1. 交易工具頁的英文小標改為「交易筆記」，計算結果旁補上零股與滑價的白話說明。備份操作改為「匯出備份檔」「匯入備份檔」，附上下載、取代本機資料及先備份的說明，並新增可展開的六項名詞說明：停損、零股、滑價、已實現損益、張、集中風險。
2. 計算器、資金設定、買進及賣出的成功與錯誤提示，都顯示在各自表單按鈕附近，同時支援螢幕閱讀器公告與焦點定位。必填欄位空白時顯示欄位名稱，未勾選的下單前檢查也逐項指出。部分賣出後保持表單展開，全數賣出後將成功提示保留在原交易卡片內。
3. `index.html` 所有 CSS、JavaScript 資源的版本參數統一為 `?v=1.6.2`，包含圖表程式庫。

## 驗證

以下檢查全部通過：

- `node tests/test_trading.cjs`：原有交易測試。
- `node tests/test_ui.mjs`、`node tests/test_worker.mjs`：原有前端與報價測試。
- `.venv/bin/python -m unittest discover -s tests -v`：13 項 Python 測試。
- `.venv/bin/python scripts/check_v162_browser.py`：390px、1440px 逐欄空白提示、四項勾選、各表單成功與錯誤提示、部分及全數賣出、儲存失敗、名詞說明，兩種寬度均無橫向捲動或 JavaScript 錯誤。
- 沿用 v1.6 瀏覽器流程，在暫存副本調整提示位置的斷言後，通過備份匯出、匯入、錯誤檔案拒絕、重新整理保留資料、集中風險確認、虧損煞車、觀察清單七張卡片與個股三張圖表檢查。
- `node --check trading.js`、`git diff --check`。

瀏覽器使用獨立測試環境與虛構交易紀錄，不會修改使用者瀏覽器內的資料。

## 截圖

- [390px 完整畫面](screenshots/v1.6.2-tools-390.png)
- [1440px 完整畫面](screenshots/v1.6.2-tools-1440.png)
- [390px 錯誤提示](screenshots/v1.6.2-errors-390.png)
- [1440px 錯誤提示](screenshots/v1.6.2-errors-1440.png)

## 正式站與交付

修正提交為 `deea188`，已推送至 `main`，[GitHub Pages 部署成功](https://github.com/edjumptw/stock-watch/actions/runs/44235685565)。正式站的五個 CSS／JavaScript 資源均已確認使用 `?v=1.6.2`，並以 `LIVE=1 .venv/bin/python scripts/check_v162_browser.py` 在 [交易工具頁](https://edjumptw.github.io/stock-watch/#tools) 重跑 390px、1440px 的表單驗證，全部通過。

本摘要連結的四張截圖均更新為正式站操作結果，使用獨立瀏覽器環境與虛構交易資料，測試時停用外部報價請求。交付時間為台北 2026 年 11 月 18 日 12:15 前，早於派單期限 13:00。
