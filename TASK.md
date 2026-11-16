# 外包單：陳執董盯盤網頁 v1（外包給 Codex）

## 成品、讀者、用途
- 讀者：陳執董本人（用手機看，繁體中文，台灣用語）。
- 成品：一個靜態網頁，部署在 GitHub Pages：https://edjumptw.github.io/stock-watch/ ，程式碼放在本資料夾（已 git init，remote = https://github.com/edjumptw/stock-watch.git，本機 gh 已用 edjumptw 登入，可直接 push）。
- 用途：每天看 7 檔股票的起伏、技術面強弱與新聞，作投資參考。

## 股票清單（代號必須用這些）
國巨 2327.TW、台達電 2308.TW、台積電 2330.TW、光寶科 2301.TW、日月光投控 3711.TW、NVIDIA NVDA、特斯拉 TSLA。

## 功能（v1 只做這些）
1. 首頁總覽：7 檔卡片，顯示最新收盤價、當日漲跌與漲跌幅、成交量、資料日期（台北時間）。
2. 每檔詳細：近 6 個月日 K 或收盤走勢圖，疊 5/20/60 日均線；成交量柱狀圖；RSI(14)。
3. 每日短評（規則產生，不呼叫任何付費 AI API）：每檔依均線排列、RSI、20 日漲跌、量能變化，寫 2–4 句白話「偏強／中性／偏弱、原因、要注意什麼」。不得寫任何目標價或「明天會漲到多少」。
4. 相關新聞：每檔抓 Google News RSS（繁中，台股用公司名、美股用英文名）最新 5 則標題＋連結＋日期。
5. 每頁底部固定免責聲明：「本頁為個人參考資料，非投資建議；技術指標與短評由程式依公開資料自動產生，不代表未來走勢。」
6. 自動更新：GitHub Actions 排程，台股收盤後（台北 14:30）與美股收盤後（台北 06:00）各跑一次，抓資料（可用 yfinance）產生 data/*.json 後 commit，網頁讀 JSON 顯示。也支援手動觸發 workflow_dispatch。

## 不做的事（本次範圍外，想到只記在 README 的「之後可加」）
- 不做 LINE/Slack 推播、不做登入、不接券商、不下單、不用任何需付費或需金鑰的 API、不放任何金鑰進 repo。

## 驗收標準（做完自己先驗）
- `git push` 成功，GitHub Pages 已開啟（gh api 設定 Pages 從 main 分支或 Actions 部署），網址能打開。
- 手動跑一次 workflow 成功，7 檔都有真實數字，日期是最近交易日。
- 手機寬度（390px）版面不破。
- 用 headless 瀏覽器截圖首頁與一檔詳細頁，存到 /workspace/stock-watch/screenshots/。
- README.md（繁中）寫清楚：怎麼加減股票、資料來源、更新時間、之後可加的功能。

## 完成後
寫一份短摘要 /workspace/stock-watch/SUMMARY.md：網址、做了什麼、驗收結果、遇到的問題。最後寫 DONE 記號。
