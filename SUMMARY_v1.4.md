# v1.4 美股日線備援交件紀錄

## 做了什麼

- 美股日線依序採 Yahoo → Stooq 公開 CSV → Nasdaq 官網歷史 API；只填補 Yahoo Close 為 NaN 或整日缺列的日期，已有 Yahoo 收盤保持優先。
- 備援必須有完整、有限且合理的 OHLCV，日期不得晚於紐約已完成交易日（沿用 16:15 緩衝）。不依平日推造交易日、不使用即時報價冒充收盤。
- 美股 history 新增 open/high/low/source，既有 close/volume 合成完整 OHLCV；最上層 source 對應最後一列。詳細頁收盤日期旁顯示「收盤來源：Stooq／Nasdaq／Yahoo Finance」，來源字串沿用 escape 轉義。
- 兩備援都缺資料時保留有效舊收盤；若新抓結果日期比已發布資料舊，沿用原整檔結果。全批次失敗時沿用既有不寫檔機制。
- 未修改台股取數、建議演算法、股票清單、排程或 Worker。本機完整跑一次後，台股 JSON 回復交件前內容，index 內亦同步保持原資料。

## 測試

- `.venv/bin/python -m unittest discover -s tests -v`：11 個通過，含 6 個新增測試方法（NaN／缺日用 Stooq、Stooq 缺日或錯誤改 Nasdaq、全部缺失維持舊日、Yahoo/Stooq 優先序及未完成日排除、已發布日期不可倒退、CSV/API 解析與非法 OHLCV）。
- `node tests/test_worker.mjs`：原有全部通過，Worker 未改。
- `node --check app.js`、`git diff --check` 通過。
- Playwright 本機 390px NVDA／TSLA 詳細頁：日期、Nasdaq 標示、圖表、無橫向溢出及無 JS 錯誤通過；截圖 `screenshots/v1.4-{NVDA,TSLA}-mobile.png`。

## 實際取數（台北時間）

第一次 `.venv/bin/python scripts/update_data.py` 完整成功；美股資料建立時間如下。當時紐約為 11/16 收盤後，最新完整交易日為 2026-11-16。

| 股票 | 取數開始時間 2026-11-17 | 交易日 | Open | High | Low | Close | Volume（股） | 來源 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| NVDA | 10:32:01.279619 +08:00 | 2026-11-16 | 159.015 | 163.20 | 155.01 | 156.14 | 333822100 | Nasdaq |
| TSLA | 10:32:03.043720 +08:00 | 2026-11-16 | 387.00 | 389.7983 | 375.63 | 379.74 | 30242400 | Nasdaq |

直接重查 Yahoo 五日日線，兩檔 11/16 Close 均為 NaN；沒有拿 Worker 報價補資料。來源端點：

- Stooq：`https://stooq.com/q/d/l/?s=nvda.us&i=d`（TSLA 同樣格式），附 d1/d2 範圍。
- Nasdaq：`https://api.nasdaq.com/api/quote/NVDA/historical?assetclass=stocks&fromdate=2026-11-10&todate=2026-11-16&limit=5000`（實作查一年範圍，日期必須 ISO）。

## 跨來源抽核與未完成門檻

**指定的 Stooq／Yahoo <0.5% 抽核尚未完成，不能宣稱全案驗收通過。** Stooq 的 .com、www、.pl、指定與不限日期 CSV 均回傳 HTML 瀏覽器驗證頁，瀏覽器下載亦未取得有效 CSV。程式正確拒絕這些內容並採 Nasdaq，未偽造 Stooq 價格或來源。

另外實際完成 Nasdaq／Yahoo 同日抽核（與指定 Stooq 抽核分開記錄），計算 `abs(備援收盤 / Yahoo收盤 - 1) * 100`：

| 股票 | 日期 | Yahoo Close | Nasdaq Close | 價差 % |
| --- | --- | ---: | ---: | ---: |
| NVDA | 2026-11-13 | 162.85000610351562 | 162.85 | 0.00000374794% |
| TSLA | 2026-11-13 | 390.2200012207031 | 390.22 | 0.000000312824% |

兩者皆小於 0.5%。取數時間及數值機器紀錄：`data/validation_v1.4.json`。

## 限制

- 公開來源有驗證頁、限流或延遲，不能保證每次補齊；當日缺資料保留舊日期，不造假。
- 第二次完整重跑遇 Google News HTTP 429，三次重試後退出；第一次成功的 JSON 未被覆寫。本次未擴大修改新聞功能。
- Stooq 可能採股息調整價、Nasdaq 歷史拆股口徑也可能與 Yahoo 不同；既有 Yahoo 歷史不被覆蓋。這次補值為最新單日，未宣稱所有歷史公司行動皆已跨源調整；指定 Stooq 比對仍待來源恢復後完成。
- 收盤資料日期沿用既有台北日線時間標籤，不變更原時區契約；交易日以 `date` 欄位判定。

## 部署驗證

- 實作與資料 commit：`3f61958b5a581bdcf37b40c2502d410a3757ec12`，已推 main。
- [GitHub Actions 44004092041](https://github.com/edjumptw/stock-watch/actions/runs/44004092041)：update（含 11 個 Python 測試與原有 Worker 測試）及 deploy 步驟成功；此 push 流程按既有設計不重抓行情，部署的是本機實際成功取回的完整資料。
- 正式網址 https://edjumptw.github.io/stock-watch/ ：app.js 與本機逐位元相同，兩檔正式 JSON 與本機內容相同。
- Playwright 正式站 390px／1440px 均通過 NVDA、TSLA 日期 2026-11-16、「收盤來源：Nasdaq」、三張圖表、無橫向溢出及無 JS 錯誤。
- 正式站截圖 `screenshots/v1.4-{NVDA,TSLA}-{390,1440}-production.png` 已保存；台北約 10:36 驗證。
- 摘要及正式站截圖另以交件紀錄 commit 推 main；既存未追蹤 tasks/ 保持原狀。

## 第二次派單複查（2026-11-17 10:38 台北）

- 重試 Stooq：curl（stooq.com、stooq.pl，含日期範圍）仍回 JavaScript 瀏覽器驗證頁；headless Chromium 直接下載得到 0 位元組空檔，先開報價頁再下載亦同。未嘗試破解或繞過驗證。程式遇空檔或 HTML 會拋錯並改走 Nasdaq，行為正確。
- **Stooq／Yahoo <0.5% 抽核仍無法完成。**
- 新增佐證：Yahoo 此時已補上 11/16 收盤，拿來與先前 Nasdaq 補值同日比對（取數 2026-11-17 10:38:33 +08:00）：

| 股票 | 日期 | Yahoo Close（事後） | Nasdaq 補值 | 價差 % |
| --- | --- | ---: | ---: | ---: |
| NVDA | 2026-11-16 | 156.13999938964844 | 156.14 | 0.00000039% |
| TSLA | 2026-11-16 | 379.739990234375 | 379.74 | 0.0000026% |

- 正式站 NVDA、TSLA JSON 仍為 2026-11-16、來源 Nasdaq；最近一次 workflow 44004092041 成功。下次排程若 Yahoo 已有該日，依設計會改標「Yahoo Finance」（Yahoo 優先）。
- 11 個 Python 單元測試重跑通過。紀錄已寫入 `data/validation_v1.4.json` 的 `recheck`。

【交接】通知誰：Kinki／紀錄存哪：SUMMARY_v1.4.md、data/validation_v1.4.json、screenshots/v1.4-* 與 Git commit／誰經手：Codex（初版）、Claude（第二次複查）／誰接手、下一步：Kinki 於 Stooq 可正常回傳 CSV 時補做 11/13 同日 Yahoo 比對，門檻 <0.5%，再完成全部驗收並回報執董。其餘功能與部署驗證見本摘要。

## Modern Web Guidance

我查閱了文字插入與 sanitize-untrusted-html 指南；這次僅沿用既有 escape 插入純文字來源，未引入新的 HTML API 或套用額外指南改造。

## 本次派單驗收複查（2026-11-17 10:44 台北）

- 現有 main 已包含實作、單元測試、實際取數及部署；本次重新執行 11 個 Python 測試、Worker 測試、app.js 語法檢查及 diff 空白檢查，均通過，未更動功能或資料。
- 直接讀取正式站 JSON：NVDA 為 2026-11-16、156.14 USD、Nasdaq；TSLA 為 2026-11-16、379.74 USD、Nasdaq。正式站 app.js 包含「收盤來源：」顯示程式。
- 最新已完成 workflow [44004515361](https://github.com/edjumptw/stock-watch/actions/runs/44004515361) 成功，對應 main `711691c38ddd880925537827fe0e806fbaa6e7f6`。
- 再次直接請求 Stooq NVDA CSV（20261112–20261116），仍取得 HTML JavaScript 瀏覽器驗證頁，沒有有效 OHLCV CSV。指定 Stooq／Yahoo 價差 <0.5% 抽核依然無法完成；既有 Nasdaq／Yahoo 比對不能替代此驗收條件。
- 本次派單結果為 **FAILED（驗收條件未全數滿足）**；功能、正式站及資料已保存，失敗原因只限上述跨來源抽核。

【交接】通知誰：Kinki／紀錄存哪：本摘要與 data/validation_v1.4.json／誰經手：Codex／誰接手、下一步：來源恢復提供公開 CSV 後，補做 NVDA、TSLA 同日 Stooq／Yahoo 比對並記錄取數時間與價差，再完成驗收。

## 第三次派單複查（2026-11-17 10:44 台北）

- 再次以 curl 請求 Stooq NVDA、TSLA CSV（20261110–20261117）：仍回 HTML JavaScript 瀏覽器驗證頁，無 OHLCV；未嘗試繞過驗證。
- 11 個 Python 單元測試、Worker 測試重跑均通過；main 與 origin 同步，最近 workflow 44004515361 成功。功能與資料未更動。
- **指定 Stooq／Yahoo <0.5% 抽核仍無法完成，本次派單仍回報 FAILED，原因僅此一項。**

【交接】通知誰：Kinki／紀錄存哪：本摘要、data/validation_v1.4.json／誰經手：Claude（第三次複查）／誰接手、下一步：Stooq 恢復公開 CSV 後補做同日比對；或由執董決定是否以已完成的 Nasdaq／Yahoo 比對（<0.000004%）替代此驗收條件。再派同一單前請先確認 Stooq 可用，否則結果相同。
