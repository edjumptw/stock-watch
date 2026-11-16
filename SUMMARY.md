# 交付摘要

網址：<https://edjumptw.github.io/stock-watch/>

狀態：**部分完成，派單標記 FAILED**。網站已部署；自動更新未能啟用，未將全部驗收標示為通過。

## 已完成

- 七檔指定股票總覽、收盤價、漲跌、成交量及台北日期。
- 各股近六個月收盤圖、5／20／60 日均線、成交量柱狀圖、Wilder RSI(14) 與 70／30 參考線。
- 每股三句規則短評，涵蓋均線、RSI、20 日漲跌與量能，沒有目標價或付費 API。
- 每股 Google News 繁中 RSS 最新五則標題、日期與連結；每頁底部保留指定免責聲明。
- 更新程式、資料 JSON、排程 workflow、繁中 README 與瀏覽器驗收程式已保存。

## 驗收結果

| 項目 | 結果 |
| --- | --- |
| git push | 網站、資料、README、截圖與本摘要成功推送 main |
| GitHub Pages | 已開啟 main 根目錄部署，正式網址可讀取 |
| Pages 建置 | [43808714278](https://github.com/edjumptw/stock-watch/actions/runs/43808714278) 成功 |
| 真實行情 | 本機實際抓取成功，正式網址 JSON 七檔都有價格與成交量 |
| 最近收盤日 | 全部 2026-11-13；驗收時間為 2026-11-16 台北下午收盤前 |
| RSI／JSON 檢查 | `python -m unittest discover -s tests -v` 兩項測試通過，包含七檔逐筆檢查與 RSI 參考數值 |
| JavaScript | `node --check app.js` 通過 |
| 390px 手機版 | 本機與正式網址皆通過，七個詳細頁無水平溢出、無 JS 錯誤 |
| 圖表與新聞 | 七檔詳細頁皆有三張圖、四條價格線、RSI 參考線；五則新聞檢查通過 |
| headless 截圖 | `screenshots/home-mobile.png`、`detail-mobile.png`、`home-desktop.png`，最後一次由正式網址截取 |
| 手動資料更新 workflow | **未通過：GitHub 拒絕上傳 workflow，尚無法觸發** |

## 遇到的問題與接續方式

目前 GitHub CLI token 只有 repo、read:org、gist scopes，缺少 workflow scope。推送 `.github/workflows/update.yml` 時 GitHub 回覆：`refusing to allow an OAuth App to create or update workflow ... without workflow scope`。這是 GitHub 權限限制，不是自動安全審查拒絕。

已以不包含 workflow 的版本上線，完整 workflow 保存在本機，另有 `implementation-backup` 本機分支保留先前完整實作。沒有把任何金鑰存入儲存庫。

接續時先讓擁有者完成 GitHub CLI 補充授權，再執行：

```bash
gh auth refresh -h github.com -s workflow
git push origin main
gh api repos/edjumptw/stock-watch/pages --method PUT -f build_type=workflow
gh workflow run update.yml --ref main
gh run list --workflow update.yml
# 取得 run ID 後確認資料更新與部署皆成功
gh run watch RUN_ID --exit-status
```

workflow 已設定台北 14:30／06:00 與 workflow_dispatch；資料抓取、檢查、commit 和 Pages 部署放在同一流程，避免 bot commit 不再觸發部署。啟用成功後需刪除 README 的待授權註記、更新本摘要，才可改寫 DONE 為 done。

前端參考 modern-web-guidance 的 responsive-design 與 card 指引：標題以 rem 搭配 clamp 調整，頁面使用 dvh，避免手機瀏覽器工具列造成高度問題（"Use dynamic viewport units (`dvh`, `dvw`) instead of `vh`/`vw`"）；股票卡片以 `<article class="stock-card">` 為根節點，標題連結設 `.card-link` 並以 `::after` 鋪滿點擊區域（"use `<article>` as the card root, whether or not it links to a destination"）。

## 2026-11-16 再次派單檢查

- `gh auth status` 仍只有 `gist`、`read:org`、`repo` scopes；本機無 SSH 金鑰或其他憑證。
- 再次推送含 `.github/workflows/update.yml` 的 commit 仍被拒：`refusing to allow an OAuth App to create or update workflow .github/workflows/update.yml without workflow scope`。
- 結論：需擁有者在互動終端機執行 `gh auth refresh -h github.com -s workflow` 完成瀏覽器授權後，依上方步驟接續；在此之前無法完成「手動跑一次 workflow」驗收。
