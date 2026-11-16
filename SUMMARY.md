# 交付摘要

網址：<https://edjumptw.github.io/stock-watch/>

狀態：**全部完成，驗收通過（DONE）**。

## 做了什麼

- **首頁總覽**：建立七檔指定股票（國巨 `2327.TW`、台達電 `2308.TW`、台積電 `2330.TW`、光寶科 `2301.TW`、日月光投控 `3711.TW`、NVIDIA `NVDA`、特斯拉 `TSLA`）觀察清單卡片，顯示最新收盤價、當日漲跌與漲跌幅、成交量、資料日期（台北時間）及近 40 個交易日迷你走勢圖，台股與美股幣別分開標示、漲紅跌綠。
- **每檔詳細頁**：提供近六個月日收盤走勢圖並疊加 5／20／60 日簡單移動平均線（MA5／MA20／MA60）、每日成交量柱狀圖、Wilder RSI(14) 指標圖（含 70／30 參考線）。
- **每日短評（規則自動產生）**：依收盤價與 5／20／60 日均線排列、RSI(14)、近 20 個交易日漲跌幅與當日量能相對 20 日均量變化，自動產生 3 句白話短評（偏強／中性／偏弱、原因、注意事項），不寫任何目標價或預測明日價位，亦不呼叫任何付費 AI API。
- **相關新聞與免責聲明**：每檔抓取 Google News 繁體中文 RSS（台股以公司名、美股以英文名查詢）最新 5 則新聞標題、連結與台北時間日期；每頁底部固定顯示指定免責聲明。
- **自動更新與部署**：設定 GitHub Actions workflow（`.github/workflows/update.yml`），於台北時間每日 14:30（UTC 06:30，台股收盤後）與 06:00（UTC 22:00，美股收盤後）自動執行，並支援 `workflow_dispatch` 手動觸發，使用 `yfinance` 與 Google News RSS 更新 `data/*.json` 後自動 commit 並透過 GitHub Pages Actions 部署。
- **文件與測試**：撰寫繁體中文 `README.md`（說明加減股票方式、資料來源、更新時間與之後可加功能），並附上單元測試（`tests/`）與 Playwright 瀏覽器自動化驗收腳本（`scripts/check_browser.py`）。

## 驗收結果

| 項目 | 結果 |
| --- | --- |
| `git push` 與 GitHub Pages | 成功推送至 `main`，GitHub Pages 已啟用（`build_type=workflow`），網址 <https://edjumptw.github.io/stock-watch/> 可正常開啟 |
| 手動觸發 `workflow_dispatch` | GitHub Actions 手動觸發執行成功（Run [`43810107617`](https://github.com/edjumptw/stock-watch/actions/runs/43810107617) 等），7 檔股票皆有真實收盤數字與新聞，資料日期為最近完整交易日（2026-11-13） |
| 單元測試與語法檢查 | `python -m unittest discover -s tests -v` 與 `node --check app.js` 皆通過 |
| 手機寬度（390px）版面 | 390px 寬度下首頁與 7 檔詳細頁皆無水平溢出、無破版、無 JS 錯誤 |
| Headless 瀏覽器截圖 | 已將首頁與詳細頁截圖存於 `screenshots/home-mobile.png`、`screenshots/detail-mobile.png`、`screenshots/home-desktop.png` |
| `README.md`（繁中） | 已完整說明如何加減股票、資料來源、更新時間與之後可加的功能 |

## 遇到的問題與解決方式

1. **GitHub CLI 初期缺少 `workflow` 權限**：初次推送 `.github/workflows/update.yml` 時，因 OAuth token 缺少 `workflow` scope 被 GitHub 拒絕；待補充 `workflow` scope 授權後已順利推送並啟用 Actions 自動化部署。
2. **交易時段未收盤 K 線過濾**：為避免台股盤中（14:00 前）或美股盤中（美東 16:15 前）抓到尚未收盤的當日 K 線，於 `scripts/update_data.py` 加入市場時區與收盤時間判斷，確保只納入已收盤之完整交易日資料。
3. **Actions 並行推送衝突防護**：於 `.github/workflows/update.yml` 提交資料前加入 `git pull --rebase -X theirs origin main`，避免手動觸發與 push 觸發時間相近時發生 non-fast-forward push 失敗。

DONE
