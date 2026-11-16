from playwright.sync_api import sync_playwright
import os
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(os.environ.get('SITE_URL','http://localhost:8765'))
    page.wait_for_selector('.stock-card')
    assert page.locator('.stock-card').count()==7
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path='screenshots/home-mobile.png',full_page=True)
    page.locator('.stock-card').first.click()
    page.wait_for_selector('#price-chart')
    assert page.locator('canvas').count()==3
    assert page.locator('.news li').count()==5
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path='screenshots/detail-mobile.png',full_page=True)
    for symbol in ['2327.TW','2308.TW','2330.TW','2301.TW','3711.TW','NVDA','TSLA']:
        page.goto(os.environ.get('SITE_URL','http://localhost:8765')+'/#'+symbol)
        page.wait_for_selector('#price-chart')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert page.evaluate("Chart.getChart(document.getElementById('price-chart')).data.datasets.length")==4
        assert page.evaluate("Chart.getChart(document.getElementById('rsi-chart')).data.datasets.length")==3
    page.set_viewport_size({'width':1440,'height':1000})
    page.goto(os.environ.get('SITE_URL','http://localhost:8765'))
    page.wait_for_selector('.stock-card')
    page.screenshot(path='screenshots/home-desktop.png',full_page=True)
    assert not errors,errors
    print('PASS: 390px homepage and all 7 detail pages, charts, news, no overflow or JS errors')
    browser.close()
