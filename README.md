# 收盤筆記 Stock Watch

網址：<https://edjumptw.github.io/stock-watch/>

追蹤國巨、台達電、台積電、光寶科、日月光投控、NVIDIA、特斯拉。首頁提供最新價格、當日漲跌、最新成交量、收盤成交量與收盤日期（美股並列美東交易日與台北收盤時間）；點選卡片可看近六個月收盤走勢、5／20／60 日均線、成交量、RSI(14)、每日短評及最多五則新聞（0–5 則）。漲紅跌綠，台幣與美元分開標示。

## 資料來源與計算

- 股價、成交量、股票分割事件：透過 [yfinance](https://github.com/ranaroussi/yfinance) 讀取 Yahoo Finance 公開資料，無須金鑰。美股日線以 Yahoo 為主，Stooq／Nasdaq 為備援，詳情頁會顯示收盤來源。使用 `auto_adjust=False`，保留實際收盤價，歷史序列使用供應端已調整股票分割的價格，不還原股息。
- 新聞：[Google News RSS](https://news.google.com/)，使用 `hl=zh-TW&gl=TW&ceid=TW:zh-Hant`，台股以公司名、美股以 NVIDIA／Tesla 搜尋，依發布日期由新到舊排序，以正規化空白後的完整標題或相同 URL 去重，再取最多五則（0–5 則），不同媒體名稱的標題仍保留。新聞可能包含同名議題，請開啟原文確認。
- 抓一年的日資料暖機，顯示最近 184 個日曆日；均線為收盤價簡單移動平均。RSI 採 Wilder 14 日平滑法，無漲跌時為 50，無跌幅但有漲幅時為 100。
- 每日短評共三句，依價格與 5／20／60 日均線排列判斷偏強、偏弱或中性，並列出 20 交易日漲跌、當日量相對前 20 日均量、RSI 與注意事項。量比高於 1.2 倍視為熱絡、低於 0.8 倍視為平淡；RSI 70／30 為參考界線。不產生目標價，不呼叫 AI API。
- 台股當日 14:00、美股當地 16:15 前的日資料不納入，避免未收盤資料。美股卡片台北日期為當地交易日 16:00（紐約收盤）換算為台北時間的日期，詳細圖橫軸則保留交易所交易日期。

## 更新時間

GitHub Actions 設定 11 個 cron，皆為台北時間：台股收盤後週一至週五 **14:07、14:37、15:13、16:23、17:47、19:11**，每日晚間 **20:17**，美股收盤後週二至週六 **05:43、06:19、07:29、08:41**。每次皆更新全清單；週末、休市時保留最近交易日，排程可能因 GitHub 排隊而延後。

至儲存庫 Actions → **Update market data and deploy** → **Run workflow** 可手動觸發。排程與手動流程抓資料、驗證、commit `data/*.json`，再透過官方 Pages Actions 部署。程式碼 push 只驗證並部署既有收盤資料，不因行情來源暫時失敗而擋住介面更新；修改股票清單後仍須手動執行更新。由於 bot commit 不會再觸發一般 push workflow，部署與更新放在同一流程內。

任何一檔抓取失敗會重試，三次仍失敗則停止，不發布不完整資料；既有網站保持上次成功內容，首頁顯示更新時間。資料來源可能延遲、修正或限流，應以交易所與公司公告為準。

## 怎麼加減股票

編輯根目錄 `stocks.json`，每個項目包含：

```json
{"symbol":"2330.TW","name":"台積電","query":"台積電","currency":"TWD"}
```

`symbol` 使用 Yahoo Finance 代號，`name` 為顯示名稱，`query` 為新聞關鍵字，`currency` 使用 TWD 或 USD。移除股票就刪除對應項目。提交後手動執行 workflow；首頁與詳細頁由清單自動產生。首頁台美股數量也會依清單計算。舊個股 JSON 可一併刪除，網站只顯示 `index.json` 中的清單。

## 本機執行與驗證

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/update_data.py
.venv/bin/python -m unittest discover -s tests -v
python3 -m http.server 8765
```

開啟 <http://localhost:8765>。圖表使用本地附帶的 Chart.js 4.4.8（MIT），歷史資料讀取靜態 JSON，v1.1 最新報價透過下方 Worker 讀取。驗收截圖放在 `screenshots/`。

## 之後可加

- 交易日曆與來源延遲提醒。
- 自選排序、比較區間與更多技術指標。
- 有需要再另案討論推播、登入及券商串接；本版不含這些功能，也不下單。

本頁為個人參考資料，非投資建議；技術指標與短評由程式依公開資料自動產生，不代表未來走勢。

瀏覽器驗收需另外安裝 Playwright，不是網站執行依賴：

```bash
.venv/bin/pip install playwright
.venv/bin/playwright install chromium
python3 -m http.server 8765
# 另開終端機
.venv/bin/python scripts/check_browser.py
# 或驗正式網址
SITE_URL=https://edjumptw.github.io/stock-watch/ .venv/bin/python scripts/check_browser.py
```

驗收程式會檢查七檔卡片、七個詳細頁、圖表資料集、0–5 則新聞（含無新聞提示）、390px 無溢出及瀏覽器錯誤，並儲存手機與桌面截圖。

## v1.1 盤中報價 Worker

前端每 60 秒（頁面可見時）讀取 <https://stock-watch-quotes.jumpbotofficejumpbotoffice.workers.dev/quotes>；回到頁面會重讀；每 15 分鐘及分頁重新可見時也會重抓收盤資料，內容改變才重畫圖表。台股報價優先來自證交所，美股與台股個別失敗時使用 Yahoo Finance（**可能延遲**），每檔顯示供應端報價時間（台北），休市時可能是最近交易日。報價相對前一交易日收盤計算漲跌；首頁漲跌檔數依目前顯示數字計算。歷史圖、迷你線圖、均線、RSI、短評維持收盤資料；卡片的技術強弱標籤也是收盤判斷。

Worker 程式碼與部署設定位於 `worker/`，僅提供固定七檔的 `GET /quotes`，不接受任意股票或上游 URL。只接受 `Origin: https://edjumptw.github.io`，包含缺少 Origin 的請求也會拒絕。CORS 限制瀏覽器來源，並非登入驗證；非瀏覽器客戶端可以偽造 Origin。台股全數成功時在 Cloudflare 各資料中心快取 20 秒，有退回 Yahoo 時快取 5 秒（不共用全球快取），沒有 KV、D1 或其他 Cloudflare 資源。未啟用付費方案，仍受帳號免費額度限制；上游限流或 Worker 額度耗盡時會回退。

前端請求超過 16 秒、來源失敗、格式錯誤或缺少個股時，對應卡片退回收盤 JSON 並標示狀態；不保留失敗前的盤中價。報價時間超過七天則視為不可用。價格縱軸根據四條價格／均線的有限值，取上下界並加留白，不強迫從零開始；成交量由零開始、RSI 固定 0–100。

重新部署（使用目前免費帳號，無須購買網域）：

```bash
npx wrangler@4.162.0 whoami
# 若尚未登入，於本機執行 npx wrangler@4.162.0 login
npx wrangler@4.162.0 deploy --config worker/wrangler.jsonc
node tests/test_worker.mjs
```

使用既有 workers.dev 子網域，不新增付費資源。若更換 Worker 網址，須一併修改 `app.js` 的 `QUOTE_URL` 並推送部署 GitHub Pages。加減股票時，也必須同步調整 Worker 的 `SYMBOLS` 白名單。憑證只由 wrangler 存於本機設定，**不得提交 token、cookie 或金鑰**。本機 localhost 不在允許來源，會正常顯示收盤回退；完整報價驗證請使用正式 Pages 來源。

v1.1 瀏覽器驗收（需 Playwright；會讀取真正 Worker 並保存首頁、詳細頁及回退畫面）：

```bash
.venv/bin/python scripts/check_quotes.py
# 尚未發布時，以正式來源載入本機檔案、連線真正 Worker
LOCAL_SITE=1 .venv/bin/python scripts/check_quotes.py
```

驗收包含七檔報價、拒絕非允許來源／任意代號、七檔縱軸範圍、390px 與桌面截圖，以及模擬失敗／部分／無效回應的回退；模擬資料不會寫入正式股價 JSON。

## 建議規則

v1.2 的「下一步建議」由 `scripts/recommendation.py` 使用已完成交易日的收盤、MA5／MA20／MA60、Wilder RSI(14) 與成交量固定計算，不呼叫 AI、不增加資料來源或金鑰。上述 11 個 cron 的 Actions 更新資料時一併重算，前端只顯示 JSON；Worker 盤中報價不影響建議與價位。日期使用交易所交易日期，休市保留最近收盤日。

下列規則依順序判斷，第一個符合者即為動作（等號依下列定義）：

1. **減碼**：RSI ≥ 75；或收盤同時低於 MA20、MA60 且量比 ≥ 1.2。適用已有持股者；無持股者先等穩定。
2. **分批買進**：MA5 > MA20 > MA60、收盤 ≥ MA20、40 ≤ RSI ≤ 65，且 0.8 ≤ 量比 < 1.5，條件必須全部符合。
3. **續抱**：收盤 ≥ MA20 ≥ MA60 且 40 ≤ RSI < 75。適用已有持股者，並非要求未持股者直接買進。
4. **觀望**：其餘情況，包含 RSI 超賣但趨勢尚未穩定，不單因 RSI 低就買進。

量比為當日成交量除以前 20 個交易日平均成交量（不含當日）；均量為零時量比設為零。支撐與壓力候選為近 20 個交易日（含當日）最低／最高**收盤價**、MA20、MA60；支撐只取 ≤ 當日收盤、壓力只取 ≥ 當日收盤的價位，按與收盤價距離各取最近 1–2 個不同數值。候選以程式儲存精度比較；同價只列一次，來源優先使用近 20 日收盤高低點，再 MA20、MA60。等於收盤價僅歸一側；最低收盤價優先歸地板，最高收盤價歸天花板，均線不跨側重複；不推算未來目標價，也不使用盤中高低價。每個價位都列出來源與幣別。

首頁每檔顯示動作與一句摘要；詳細頁提供兩句理由、價位與算法。每個區塊都標示「依 YYYY-MM-DD 收盤計算」及「僅供參考，非投資建議」。規則未考慮個人持股成本與風險承受度，不代表未來報酬。

## v1.3 證交所報價

台股批次讀取 MIS `getStockInfo.jsp`：`z` 為成交價、`y` 為昨收、`tlong` 為毫秒時間；`v` 原單位為張，**乘以 1000 換算為股**。`z` 缺值時盤中使用最佳一檔買賣中間價並明確標示，否則用 `trade.z` 最後成交；收盤後只採實際成交，不以中間價冒充收盤價。台北 09:00 前不採用試撮價，成交量必須大於 0；沒有有效價格、時間或量時該檔退回 Yahoo，不以零或昨收冒充報價。TWSE 最多請求 2 次、每次逾時 3.5 秒，缺漏個股退回 Yahoo（每次 7 秒上限），每檔回傳並顯示 `source`；台股全數成功快取 20 秒、有退回 Yahoo 時快取 5 秒，前端仍每 60 秒更新。

日線 NaN 繼續濾除，等下一次排程補完整日線；不以 regularMarketPrice 填入歷史收盤，避免日期、量與均線錯配。GitHub 排程不保證準時或必定執行，多次排程降低漏跑影響，必要時手動補跑。

## v1.6 交易工具

從頂端「交易工具」分頁進入，或開啟 [交易工具](https://edjumptw.github.io/stock-watch/#tools)。

- 買幾張計算器：輸入買價、停損價及願虧金額，計算可買股數、整張、零股與投入金額，選填總資金可查看投入佔比。
- 交易筆記：透過觀察清單股票下拉選單選股，也可選「其他」手動填寫，記下買進理由及停損價，賣出時填入價格、股數及檢討，可分批賣出並查看當初理由與實際結果的對照。買進及賣出筆記皆可修改、確認後刪除，離開工具頁再回來會保留未送出草稿；未來日期經提醒確認仍可儲存，到該日才計入期間損益。
- 下單前檢查：新增買進前須完成四項勾選。資金設定預設以 20% 為單檔警戒比例，可自行修改，超標時會再次提醒。
- 虧損煞車：設定每週與每月可接受虧損，達標時在所有分頁頂端提醒「先停手」。

金額統一使用新台幣，美股請先換算再記錄。損益未含手續費與稅，未賣出部分不列入。週統計從週一開始，日期以台北時區為準。淨損益包含獲利及虧損，煞車採「虧損累計」，只加總虧錢的賣出，不用獲利抵銷，畫面同時列出兩種金額供核對。單檔警告以相同股票名稱的剩餘持股買進成本加上本次投入計算，請統一股票名稱。

資料只存於目前瀏覽器的 localStorage，不會上傳伺服器，也不會下單。不同裝置不會同步，清除網站資料或使用無痕模式可能遺失，請定期按「匯出備份檔」。按「匯入備份檔」會驗證版本、日期、價格、股數及分批賣出總量，確認後取代目前筆記與設定，請先備份。

新增檔案為 `trading-core.js`（計算及資料驗證）與 `trading.js`（介面及本機儲存），部署流程會一併發布。執行以下檢查：

```bash
node tests/test_trading.cjs
node tests/test_ui.mjs
node tests/test_worker.mjs
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python scripts/check_browser.py
.venv/bin/python scripts/check_v16_browser.py
.venv/bin/python scripts/check_v162_browser.py
.venv/bin/python scripts/check_v163_browser.py
.venv/bin/python scripts/check_stock_picker.py
```

瀏覽器檢查需要 Playwright 及 Chromium。新功能測試使用合成交易資料，截圖依各驗收腳本存於 `screenshots/`。
