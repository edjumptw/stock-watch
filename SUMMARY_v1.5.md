# 盯盤網頁 v1.5 交件紀錄

## 做了什麼

- 所有既有專業名詞保留。建議區加入可點開、可鍵盤操作的白話字典：支撐價／壓力價、MA5／MA20 月線／MA60 季線、量比／成交量倍數、乖離、近 20 日表現、RSI、均線排列、偏強／偏弱等技術詞；涵蓋目前四種建議值「減碼、分批買進、續抱、觀望」及「加碼」。當前建議動作旁另有直接顯示的說明，支撐與壓力標題下有地板／天花板附註。
- 首頁與詳細頁的建議區新增盤中目前價、幣別、來源、台北報價時間、相對每條收盤支撐／壓力的位置；距離 1% 內標「接近」。超過 5 分鐘的價另提醒非即時，買賣中間價明示並非成交價。一般交易時段外顯示已收盤。
- 即時價只放記憶體 quotes，沒有回寫 JSON、history 或 recommendation。每日收盤建議演算法完全未改；即時更新保留字典開啟與鍵盤焦點狀態。
- Worker 證交所由單次 2.5 秒改為最多兩次、每次 3.5 秒；只重查缺失標的並保留先成功的單檔，兩次後仍缺失才用既有 Yahoo。正常批次快取維持 20 秒，含台股備用的批次縮至 5 秒。回傳每次耗時、HTTP／逾時／無效資料原因及單檔 fallbackReason；即使全部來源失敗也保留診斷。
- 台股卡片與詳細頁若用 Yahoo，明示「目前用備用報價（約延遲 20 分鐘）」。網頁請求上限改為 16 秒，容納兩次證交所加 Yahoo 退回的最長等待。
- 美股 dateTaipei 由「日線索引午夜」改以交易日紐約 16:00 換算，ZoneInfo 自動處理夏令／冬令；兩檔已發布 JSON 與 index 修成 `2026-11-17T05:00:00+08:00`。價格、歷史、來源、建議均未因時間修正變更。台股 dateTaipei 保持原處理。
- 工作開始先 git pull。開發期間排程提交 e2c6bb3，rebase 時完整保留新行情與新聞，再套美股時間修正。未改股票、付費／金鑰來源、排程、美股備用來源邏輯。

## 測試

- `.venv/bin/python -m unittest discover -s tests -v`：13 個通過。新增冬令 11/16 16:00 → 11/17 05:00、夏令 → 次日 04:00，以及 3 月／11 月切換日前後四個案例；原有美股備援與收盤建議測試保持通過。
- `node tests/test_worker.mjs`：來源／路徑限制、七檔、成交／中間／最後成交價、部分成功、逾時／429／壞 JSON 語意回應後重試復原、保留先成功單檔、正常 20 秒／退回 5 秒快取及診斷原因皆通過。
- `node tests/test_ui.mjs`：盤中位置、休市時段／週末、美股夏冬令、名詞與全部動作、備用標示、history／recommendation 不變通過。已加入既有 CI。
- `node --check app.js`、`git diff --check` 通過。
- Playwright Chromium 本機及正式站：390px／1440px 首頁＋七檔詳細頁、字典點開、三張圖表、美股正確 dateTaipei、無橫向溢出、無 JavaScript 錯誤通過。另以明確標記的 fixture 驗證盤中價、Yahoo 備用標示與資料不變，並測桌面轉手機後圖表重排。
- 截圖：`screenshots/v1.5-home-{390,1440}-production.png`、`v1.5-{2330.TW,NVDA}-{390,1440}-production.png`。備用情境截圖 `v1.5-backup-fixture-{390,1440}.png` 使用測試注入，非宣稱當時真實來源退回。
- 可重跑：`.venv/bin/python scripts/check_v15_browser.py`；本機檔案搭配正式 Origin 的檢查為 `LOCAL_SITE=1 .venv/bin/python scripts/check_v15_browser.py`。

## 盤中實測與原因

測量使用正式 Worker `/quotes`、合法 Origin、Playwright HTTP 請求；每次完成後間隔 21 秒，避免只測到 20 秒快取。完整原始 payload、Cache HIT／MISS、請求與伺服器時間及耗時存在 `measurements/`；以台股五檔為分母，美股不算退回。

修正前 `measurements/v1.5-before.json`：2026/11/17 台北 12:45:32–12:48:08，8 次均為 MISS。1／8 次至少一檔退回＝12.5%；該次五檔全部 Yahoo，單檔合計 5／40＝12.5%。12:47:20 發出那次耗時 2.618 秒，12:47:44 下一次即全部 TWSE。初探 `v1.5-initial-probe.json` 也保留一次五檔 Yahoo（伺服器 12:45:12、payload 取數 12:45:05）；不混入固定間隔八次分母。

原版程式把 TWSE 的所有例外吞成空 Map，同一批五檔便一起退回；退回結果又快取 20 秒，足以解釋「一次五檔都退、稍後全恢復」的傳播方式。這次 2.618 秒接近 2.5 秒上限，與逾時相符，但未有舊版診斷，**不能據此斷言 10:24 的原因，也不能宣稱已證實 TWSE 限流或 Cloudflare 故障**。新版新增可檢驗原因，詳見下方實測結果。

修正後 `measurements/v1.5-after.json`：2026/11/17 台北 12:48:31–12:55:32，共 12 次請求；11 次取得 HTTP 200（10 MISS、1 HIT），1 次客戶端報告 25 秒 timeout、未取得 Worker HTTP 回應。有效回應中退回為 **0／11 次＝0%**，單檔 **0／55＝0%**；只看 MISS 亦為 0／10 次、0／50 檔。連線無回應另列 **1／12＝8.33%**，不可混算成 TWSE 成功或 Yahoo 退回，也無法單憑此判斷是哪一段連線故障。統計摘要另存 `measurements/v1.5-statistics.json`。

12:48:55 回應證交所第一次耗時 2,871ms、五檔成功，超過舊版 2,500ms 上限；12:55:10 回應更直接留下第一試 **3,500ms TimeoutError**，第二試 **1,394ms 五檔成功**，證明新版能從實際上游逾時恢復。本輪有效回應未見 HTTP 429 或解析失敗；不能因此排除其他時段限流。相較修正前 12.5% 退回，新版短期樣本為 0%，仍不能推論全天退回率必然為 0。

新舊樣本皆在台股盤中。程式採每次完成後等待 21 秒，實際時間以 JSON 為準；其中一次客戶端 timeout 造成採樣空檔，並非宣稱整段時間毫無間斷。


## 部署

- 功能 commit `8c2c410` 已推 main，GitHub Pages workflow [44019624453](https://github.com/edjumptw/stock-watch/actions/runs/44019624453) 成功。
- Worker 已部署，版本 `1389642f-cb0a-4c7e-9d64-5901c95d6797`。
- 正式網址：https://edjumptw.github.io/stock-watch/ 。正式瀏覽器測試及截圖已完成。
- 測試補強 commit `ab367df`：補驗快取 TTL 與全部來源失敗診斷；[workflow 44019719669](https://github.com/edjumptw/stock-watch/actions/runs/44019719669) 成功。
- 正式站 app.js、style.css、data/NVDA.json、data/TSLA.json、data/index.json 與本機逐位元相同（2026/11/17 台北約 12:49 核對）。

## 限制

- 抽樣僅反映短時段與測試所在 Cloudflare 節點；不能當全天 SLA，也不能證明未來不退回。重試仍失敗會明示 Yahoo，沒有將舊 TWSE 價冒充即時價。
- 盤中判定使用台北／紐約一般平日交易時段，加上報價是否同一當地日期；未加入交易所假日、臨時休市與美股提前收盤日曆。這些時段可能顯示當日舊價，但來源時間與非即時提醒會保留。
- Yahoo 約延遲 20 分鐘是提醒，不保證固定延遲；以畫面報價時間為準。證交所無當下成交時的買賣中間價是指示價格。
- 美股一般日收盤以紐約 16:00 換算，未擴大處理提前收盤；本次只修指定一般收盤時間換算與測試。

## 建議

日後若需假日／美股提前收盤精確顯示，可另派交易日曆需求；若要全天退回率與長期根因統計，可另派持續監測。本次未擴做。

【交接】通知誰：Kinki／執董；紀錄存哪：本摘要、measurements/v1.5-*.json、screenshots/v1.5-*、GitHub main 與上述部署紀錄；誰經手：Codex；誰接手、下一步：Kinki 可依 SUMMARY 重跑正式站測試，之後再遇備用報價時保留 `/quotes` 的 diagnostics.twse 與 fallbackReason，對照發生時間定位原因。本次不發外部訊息。

## Modern Web Guidance

- **html**：我依「use `<details>` and `<summary>` for a native disclosure pattern without JS」採原生可鍵盤操作的名詞字典，並保留 summary 第一子節點，避免只能滑鼠懸停才能讀說明。
