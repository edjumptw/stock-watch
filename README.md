# 收盤筆記 Stock Watch

網址：<https://edjumptw.github.io/stock-watch/>

追蹤國巨、台達電、台積電、光寶科、日月光投控、NVIDIA、特斯拉。首頁提供收盤價、當日漲跌、成交量與台北日期；點選卡片可看近六個月收盤走勢、5／20／60 日均線、成交量、RSI(14)、每日短評及五則新聞。漲紅跌綠，台幣與美元分開標示。

## 資料來源與計算

- 股價、成交量、股票分割事件：透過 [yfinance](https://github.com/ranaroussi/yfinance) 讀取 Yahoo Finance 公開資料，無須金鑰。使用 `auto_adjust=False`，保留實際收盤價，歷史序列使用供應端已調整股票分割的價格，不還原股息。
- 新聞：[Google News RSS](https://news.google.com/)，使用 `hl=zh-TW&gl=TW&ceid=TW:zh-Hant`，台股以公司名、美股以 NVIDIA／Tesla 搜尋，依發布日期取最新五則。新聞可能重複或包含同名議題，請開啟原文確認。
- 抓一年的日資料暖機，顯示最近 184 個日曆日；均線為收盤價簡單移動平均。RSI 採 Wilder 14 日平滑法，無漲跌時為 50，無跌幅但有漲幅時為 100。
- 每日短評共三句，依價格與 5／20／60 日均線排列判斷偏強、偏弱或中性，並列出 20 交易日漲跌、當日量相對前 20 日均量、RSI 與注意事項。量比高於 1.2 倍視為熱絡、低於 0.8 倍視為平淡；RSI 70／30 為參考界線。不產生目標價，不呼叫 AI API。
- 台股當日 14:00、美股當地 16:15 前的日資料不納入，避免未收盤資料。美股卡片台北日期為當地交易日午夜轉為台北時間的日期，詳細圖橫軸則保留交易所交易日期。

## 更新時間

GitHub Actions 每日台北 **14:30**（UTC 06:30）與 **06:00**（UTC 前日 22:00）執行。兩次皆更新全清單；週末、休市時保留最近交易日。排程可能因 GitHub 排隊而延後，美股遇夏令時間也固定於台北 06:00 更新。

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

驗收程式會檢查七檔卡片、七個詳細頁、圖表資料集、五則新聞、390px 無溢出及瀏覽器錯誤，並儲存手機與桌面截圖。

## v1.1 盤中報價 Worker

前端每 60 秒（頁面可見時）讀取 <https://stock-watch-quotes.jumpbotofficejumpbotoffice.workers.dev/quotes>；回到頁面會重讀。最新報價來自 Yahoo Finance，**可能延遲**，每檔顯示供應端報價時間（台北），休市時可能是最近交易日。報價相對前一交易日收盤計算漲跌；首頁漲跌檔數依目前顯示數字計算。歷史圖、迷你線圖、均線、RSI、短評維持收盤資料；卡片的技術強弱標籤也是收盤判斷。

Worker 程式碼與部署設定位於 `worker/`，僅提供固定七檔的 `GET /quotes`，不接受任意股票或上游 URL。只接受 `Origin: https://edjumptw.github.io`，包含缺少 Origin 的請求也會拒絕。CORS 限制瀏覽器來源，並非登入驗證；非瀏覽器客戶端可以偽造 Origin。成功回應在 Cloudflare 各資料中心快取 45 秒（不共用全球快取），沒有 KV、D1 或其他 Cloudflare 資源。未啟用付費方案，仍受帳號免費額度限制；上游限流或 Worker 額度耗盡時會回退。

請求超過 10 秒、來源失敗、格式錯誤或缺少個股時，對應卡片退回收盤 JSON 並標示狀態；不保留失敗前的盤中價。報價時間超過七天則視為不可用。價格縱軸根據四條價格／均線的有限值，取上下界並加留白，不強迫從零開始；成交量由零開始、RSI 固定 0–100。

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
