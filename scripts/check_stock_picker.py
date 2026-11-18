"""Check dynamic watchlist options and preserve legacy journal records."""
import json
import mimetypes
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

URL = 'https://edjumptw.github.io/stock-watch/'
legacy = {'id': 'legacy', 'date': '2026-11-17', 'stock': '舊股票名稱',
          'price': 100, 'shares': 1000, 'stop': 90, 'reason': '舊理由',
          'sales': [{'date': '2026-11-18', 'price': 110, 'shares': 100, 'review': '舊檢討'}]}
state = {'version': 1, 'settings': {'capital': '', 'ratio': 20, 'week': '', 'month': ''}, 'trades': [legacy]}
watchlist = json.loads(Path('data/index.json').read_text())
# An extra fixture option proves the picker is driven by the loaded data, not a fixed list.
watchlist['stocks'].append({'symbol': 'TEST', 'name': '動態測試股票'})
with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox'])
    for width in (390, 1440):
        page = browser.new_page(locale='zh-TW', viewport={'width': width, 'height': 900})
        errors = []
        page.on('pageerror', lambda err: errors.append(str(err)))
        def route(r):
            path = Path(urlsplit(r.request.url).path.removeprefix('/stock-watch/') or 'index.html')
            if str(path) == 'data/index.json':
                r.fulfill(json=watchlist)
            else:
                r.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
        page.route(URL + '**', route)
        page.route('https://stock-watch-quotes.**', lambda r: r.abort())
        page.goto(URL + '#tools')
        page.evaluate('(state) => localStorage.setItem("stock-watch-trading-v1", JSON.stringify(state))', state)
        page.reload()
        select = page.locator('#buy-stock-select')
        page.wait_for_function("document.querySelector('#buy-stock-select').options.length > 2")
        expected = [s['symbol'] + ' ' + s['name'] for s in watchlist['stocks']]
        assert select.locator('option').all_text_contents() == ['請選擇股票'] + expected + ['其他（手動填寫）']
        assert not page.locator('#buy-stock').is_visible()
        assert '舊股票名稱' in page.locator('#trade-list').inner_text()
        assert '舊檢討' in page.locator('#trade-list').inner_text()
        select.select_option(expected[0])
        assert page.locator('#buy-stock').input_value() == expected[0]
        assert not page.locator('#buy-stock').is_visible()
        select.select_option('__other__')
        assert page.locator('#buy-stock').is_visible()
        assert page.locator('#buy-stock').input_value() == ''
        page.locator('#buy-stock').fill('手動股票')
        select.select_option('TEST 動態測試股票')
        for key, value in {'buy-price': '100', 'buy-shares': '10', 'buy-stop': '90', 'buy-reason': '選單買進'}.items():
            page.locator('#' + key).fill(value)
        for i in range(4):
            page.locator('#check-' + str(i)).check()
        page.locator('#trade-buy button').click()
        assert '買進紀錄已儲存' in page.locator('#trade-buy-message').inner_text()
        saved = page.evaluate('JSON.parse(localStorage.getItem("stock-watch-trading-v1"))')
        assert saved['trades'][0] == legacy
        assert saved['trades'][1]['stock'] == 'TEST 動態測試股票'
        assert select.input_value() == '' and not page.locator('#buy-stock').is_visible()
        select.select_option('__other__')
        page.locator('#buy-stock').fill('手動股票')
        for key, value in {'buy-price': '100', 'buy-shares': '10', 'buy-stop': '90', 'buy-reason': '手動買進'}.items():
            page.locator('#' + key).fill(value)
        for i in range(4):
            page.locator('#check-' + str(i)).check()
        page.locator('#trade-buy button').click()
        page.reload()
        page.wait_for_function("document.querySelector('#buy-stock-select').options.length > 2")
        assert page.locator('.trade-entry').count() == 3
        assert '手動股票' in page.locator('#trade-list').inner_text()
        assert page.evaluate('JSON.parse(localStorage.getItem("stock-watch-trading-v1")).trades[0]') == legacy
        select.select_option(expected[0])
        page.screenshot(path=f'screenshots/v1.6.3-stock-picker-{width}.png', full_page=True)
        select.select_option('__other__')
        page.locator('#buy-stock').fill('其他股票')
        page.screenshot(path=f'screenshots/v1.6.3-stock-manual-{width}.png', full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors, errors
        page.close()
    browser.close()
print('PASS: 390/1440 dynamic options, selection/manual/reset, both save paths, reload and unchanged legacy sales, no overflow/JS errors')
