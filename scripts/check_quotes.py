"""Verify deployed quote integration, fallbacks and scale bounds; screenshots use real quotes."""
import os
from pathlib import Path
import mimetypes
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

url = os.environ.get('SITE_URL', 'https://edjumptw.github.io/stock-watch/')
worker = 'https://stock-watch-quotes.jumpbotofficejumpbotoffice.workers.dev/quotes'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    if os.environ.get('LOCAL_SITE'):
        def local_site(route):
            name = urlsplit(route.request.url).path.removeprefix('/stock-watch/') or 'index.html'
            path = Path(name)
            if path.is_file():
                route.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(name)[0] or 'application/octet-stream')
            else:
                route.fulfill(status=404)
        page.route('https://edjumptw.github.io/stock-watch/**', local_site)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    response = page.request.get(worker, headers={'Origin': 'https://edjumptw.github.io'})
    assert response.status == 200, response.text()
    payload = response.json()
    assert len(payload['quotes']) == 7
    for origin in ['https://evil.example', 'null', '']:
        assert page.request.get(worker, headers={'Origin': origin}).status == 403
    assert page.request.get(worker+'?symbol=AAPL', headers={'Origin': 'https://edjumptw.github.io'}).status == 404
    page.goto(url)
    page.wait_for_function("document.querySelector('.quote-status')?.textContent.includes('7 / 7')")
    assert page.locator('.stock-card .quote-label').count() == 7
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path='screenshots/home-mobile.png', full_page=True)
    page.locator('.stock-card').first.click()
    page.wait_for_selector('#price-chart')
    page.screenshot(path='screenshots/detail-mobile.png', full_page=True)
    for symbol in ['2327.TW','2308.TW','2330.TW','2301.TW','3711.TW','NVDA','TSLA']:
        page.goto(url+'#'+symbol)
        page.wait_for_function("document.querySelector('.quote-status')?.textContent.includes('7 / 7')")
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert page.evaluate("""() => {
            const c = Chart.getChart(document.getElementById('price-chart'));
            const values=c.data.datasets.flatMap(d=>d.data).filter(Number.isFinite);
            return c.scales.y.min>0 && c.scales.y.min<=Math.min(...values) && c.scales.y.max>=Math.max(...values)
              && Chart.getChart(document.getElementById('volume-chart')).scales.y.min===0
              && Chart.getChart(document.getElementById('rsi-chart')).scales.y.max===100;
        }""")
    page.set_viewport_size({'width':1440,'height':1000})
    page.goto(url)
    page.wait_for_function("document.querySelector('.quote-status')?.textContent.includes('7 / 7')")
    page.screenshot(path='screenshots/home-desktop.png', full_page=True)
    page.locator('.stock-card').first.click()
    page.wait_for_selector('#price-chart')
    page.screenshot(path='screenshots/detail-desktop.png', full_page=True)
    # A subsequent upstream failure must discard the previously displayed live values.
    page.route(worker, lambda route: route.abort())
    page.evaluate('refreshQuotes()')
    page.wait_for_function("document.querySelector('.quote-status').textContent.includes('已退回收盤資料')")
    assert page.evaluate('quotes.size') == 0
    assert page.locator('.detail-price .price').inner_text().replace(',', '').startswith(str(page.evaluate('data.stocks[0].close')).rstrip('0').rstrip('.'))
    page.screenshot(path='screenshots/fallback-desktop.png', full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path='screenshots/fallback-mobile.png', full_page=True)
    page.unroute(worker)
    # A partial response uses live quotes only for the available symbols.
    partial = {**payload, 'quotes':payload['quotes'][:1]}
    page.route(worker, lambda route: route.fulfill(json=partial, headers={'Access-Control-Allow-Origin':'https://edjumptw.github.io'}))
    page.goto(url)
    page.wait_for_function("document.querySelector('.quote-status')?.textContent.includes('1 / 7')")
    assert page.locator('.stock-card .quote-label', has_text='最新報價未取得').count() == 6
    page.unroute(worker)
    page.route(worker, lambda route: route.fulfill(json={'quotes':[{'symbol':'AAPL','price':999}]}))
    page.evaluate('refreshQuotes()')
    assert page.evaluate('quotes.size') == 0
    assert not errors, errors
    browser.close()
print('PASS: deployed live quotes, origin/allowlist, seven price scales, desktop/mobile screenshots, failure/partial/invalid fallback')
