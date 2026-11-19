from playwright.sync_api import sync_playwright
import os
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(os.environ.get('SITE_URL','http://localhost:8765').rstrip('/'))
    page.wait_for_selector('.stock-card')
    assert page.locator('.stock-card').count()==7
    assert page.locator('.recommendation-compact').count()==7
    assert page.locator('.recommendation-disclaimer').count()==7
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path='screenshots/v1.2-home-mobile.png',full_page=True)
    page.locator('.stock-card .card-link').first.click()
    page.wait_for_selector('#price-chart')
    assert page.locator('canvas').count()==3
    assert 0 <= page.locator('.news li').count() <= 5
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path='screenshots/v1.2-detail-mobile.png',full_page=True)
    for symbol in ['2327.TW','2308.TW','2330.TW','2301.TW','3711.TW','NVDA','TSLA']:
        page.goto(os.environ.get('SITE_URL','http://localhost:8765').rstrip('/')+'/#'+symbol)
        page.wait_for_selector('#price-chart')
        assert page.locator('.recommendation-full').count()==1
        assert page.locator('.watch-levels li').count()>=2
        assert '依 ' in page.locator('.recommendation-date').inner_text()
        page.screenshot(path='screenshots/v1.2-'+symbol+'-mobile.png',full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert page.evaluate("Chart.getChart(document.getElementById('price-chart')).data.datasets.length")==4
        assert page.evaluate("Chart.getChart(document.getElementById('rsi-chart')).data.datasets.length")==3
    page.set_viewport_size({'width':1440,'height':1000})
    page.goto(os.environ.get('SITE_URL','http://localhost:8765').rstrip('/'))
    page.wait_for_selector('.stock-card')
    page.screenshot(path='screenshots/v1.2-home-desktop.png',full_page=True)
    assert not errors,errors
    print('PASS: 390px homepage and all 7 detail pages, charts, news, no overflow or JS errors')
    browser.close()
