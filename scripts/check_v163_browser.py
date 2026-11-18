"""Verify v1.6.3 retains v1.6.2 wording and form feedback with synthetic local journal data."""
import mimetypes
import os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

URL = os.environ.get('SITE_URL', 'https://edjumptw.github.io/stock-watch/')
LIVE = os.environ.get('LIVE') == '1'
with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    for width in (390, 1440):
        page = browser.new_page(locale='zh-TW', viewport={'width': width, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        if not LIVE:
            def route(r):
                path = Path(urlsplit(r.request.url).path.removeprefix('/stock-watch/') or 'index.html')
                r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
            page.route(URL + '**', route)
        page.route('https://stock-watch-quotes.**', lambda r: r.abort())
        page.goto(URL + '#tools')
        page.wait_for_selector('#trade-calc')

        def fill(values):
            for key, value in values.items():
                page.locator('#' + key).fill(str(value))

        def submit(form):
            page.locator('#' + form + ' button[type=submit]').click()

        def message(form, text):
            el = page.locator('#' + form + '-message')
            assert el.is_visible() and text in el.inner_text(), (form, text)
            assert el.evaluate("el => el.closest('form, article').contains(el)")
            assert page.evaluate('document.activeElement.id') == form + '-message'
            if page.locator('#' + form).count():
                assert page.locator('#' + form + ' [role=status]').count() >= 1
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')

        assert page.locator('.eyebrow').inner_text() == '交易筆記'
        assert page.locator('#trade-export').inner_text() == '匯出備份檔'
        assert page.locator('label[for=trade-import]').inner_text() == '匯入備份檔'
        page.locator('.term-help summary').click()
        assert page.locator('.term-help dt').all_text_contents() == ['停損', '零股', '滑價', '已實現損益', '張', '集中風險']
        assert page.locator('.form-message:visible').count() == 0
        for key, label, value in [('calc-price', '買價', 100), ('calc-stop', '停損價', 95), ('calc-risk', '這筆最多願意虧多少元', 12345)]:
            submit('trade-calc'); message('trade-calc', '請填寫：' + label)
            fill({key: value})
        submit('trade-calc'); message('trade-calc', '計算完成')
        assert '1 到 999 股' in page.locator('#calc-result').inner_text()
        assert '實際成交價比你設的停損價更差' in page.locator('#calc-result').inner_text()
        fill({'calc-price': ''}); submit('trade-calc'); message('trade-calc', '請填寫：買價')
        assert page.locator('#calc-result').inner_text() == ''
        fill({'calc-price': 100}); submit('trade-calc')
        fill({'set-ratio': ''}); submit('trade-settings'); message('trade-settings', '請填寫：單檔投入警戒比例')
        fill({'set-ratio': 101}); submit('trade-settings'); message('trade-settings', '不可超過 100%')
        fill({'set-ratio': 20}); submit('trade-settings'); message('trade-settings', '設定已儲存')
        page.locator('#buy-stock-select').select_option('__other__')
        for key, label, value in [('buy-date', '買進日期', '2026-11-18'), ('buy-stock', '股票', '驗收測試'), ('buy-price', '買進價格', 100), ('buy-shares', '買進股數', 1000), ('buy-stop', '停損價', 90), ('buy-reason', '買進理由', '依計畫買進')]:
            fill({key: ''}); submit('trade-buy'); message('trade-buy', '請填寫：' + label)
            fill({key: value})
        for i in range(4):
            submit('trade-buy'); message('trade-buy', '請勾選：')
            page.locator('#check-' + str(i)).check()
        submit('trade-buy'); message('trade-buy', '買進紀錄已儲存')
        page.locator('.trade-entry summary').click()
        for key, label, value in [('sell-date-0', '賣出日期', '2026-11-18'), ('sell-price-0', '賣出價格', 90), ('sell-shares-0', '賣出股數', 100), ('sell-review-0', '檢討', '依計畫停損')]:
            fill({key: ''}); submit('sell-0'); message('sell-0', '請填寫：' + label)
            fill({key: value})
        fill({'sell-shares-0': 1001}); submit('sell-0'); message('sell-0', '不可超過持股')
        page.screenshot(path=f'screenshots/v1.6.3-errors-{width}.png', full_page=True)
        fill({'sell-shares-0': 100}); submit('sell-0'); message('sell-0', '賣出與檢討已儲存')
        assert '剩餘 900 股' in page.locator('.trade-entry').inner_text()
        page.screenshot(path=f'screenshots/v1.6.3-tools-{width}.png', full_page=True)
        fill({'sell-price-0': 110, 'sell-shares-0': 900, 'sell-review-0': '全數賣出'})
        submit('sell-0'); message('sell-0', '賣出與檢討已儲存')
        assert page.locator('#sell-0').count() == 0
        page.evaluate("() => {Storage.prototype.setItem=function(){throw new Error('blocked')}}")
        submit('trade-settings'); message('trade-settings', '儲存失敗')
        assert not errors, errors
        page.close()
    browser.close()
print('PASS: 390/1440 wording, six terms, every required field, checkbox feedback, local success/error, partial/full sale, storage failure, no overflow/JS errors')
