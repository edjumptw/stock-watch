# Stock Watch v1.1 交付摘要

- 網站：<https://edjumptw.github.io/stock-watch/>
- 報價 Worker：<https://stock-watch-quotes.jumpbotofficejumpbotoffice.workers.dev/quotes>
- 部署程式碼：`worker/index.js`、`worker/wrangler.jsonc`；README 已寫重新部署與驗收命令。
- Worker 版本：`060b32bd-bda1-4e76-9a10-fbabe9f294f0`。

## 完成內容

1. 使用已登入帳號透過 wrangler 部署單一 workers.dev Worker，未購買網域、未啟用付費方案、未建立 KV／D1 等其他 Cloudflare 資源，沒有金鑰寫入 repo。
2. 僅接受 `https://edjumptw.github.io` Origin，拒絕其他來源或缺少 Origin；僅允許固定七檔，路徑限定 `GET /quotes`（另提供 OPTIONS），拒絕任意代號、URL 或查詢參數。CORS 是瀏覽器來源限制，非身分驗證，非瀏覽器仍可偽造 Origin。
3. 成功報價以 Cache API 快取 45 秒，正式端點已觀察 `X-Quote-Cache: HIT`；快取各資料中心獨立。供應端 Yahoo Finance 無需金鑰，資料可能延遲或限流，不能保證交易所即時行情。
4. 首頁與詳細頁使用最新報價與漲跌，顯示供應端報價時間（台北），頁面可見時每 60 秒讀取，切回頁面重讀。請求逾時（10 秒）、失敗、格式無效或缺少個股時退回既有收盤 JSON，並清除前一次盤中價與顯示回退說明。
5. 收盤圖、均線、RSI、短評與技術強弱維持原有收盤資料。價格縱軸由收盤及三條均線的實際範圍加留白決定，成交量從零、RSI 固定 0–100，價格刻度格式統一。
6. 已推送 main。原流程因 Google News HTTP 503 擋住介面部署，已將程式碼 push 改為驗證並部署既有完整收盤資料；排程／手動更新維持全部成功後才發布。

## 驗收

- `node --check app.js`、`node tests/test_worker.mjs`、Python 2 個資料／RSI 測試通過。
- 正式網址 `.venv/bin/python scripts/check_quotes.py` 通過：七檔真實報價、來源／任意代號拒絕、七檔價格縱軸、390px 無溢出、無 JS 錯誤，以及上游失敗、部分缺漏、無效報價回退。
- 手動完整資料更新與部署成功：[Actions 43816425373](https://github.com/edjumptw/stock-watch/actions/runs/43816425373)；Google News 503 為暫時性故障，重試後恢復。
- 前端部署成功：[Actions 43816408412](https://github.com/edjumptw/stock-watch/actions/runs/43816408412)。
- 真實報價截圖：`screenshots/home-mobile.png`、`screenshots/home-desktop.png`、`screenshots/detail-mobile.png`、`screenshots/detail-desktop.png`。
- 模擬斷線後使用真實收盤資料截圖：`screenshots/fallback-mobile.png`、`screenshots/fallback-desktop.png`。
- localhost 非允許來源，預期顯示收盤回退；正式來源的完整驗收已通過。

DONE
