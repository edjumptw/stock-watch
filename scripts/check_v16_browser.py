"""Local end-to-end checks and screenshots; all journal entries are synthetic."""
import json, mimetypes
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
URL='https://edjumptw.github.io/stock-watch/'
with sync_playwright() as p:
 browser=p.chromium.launch(args=['--no-sandbox'])
 page=browser.new_page(locale='zh-TW',viewport={'width':390,'height':844})
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 def route(r):
  path=Path(urlsplit(r.request.url).path.removeprefix('/stock-watch/') or 'index.html')
  r.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
 page.route(URL+'**',route)
 page.route('https://stock-watch-quotes.**',lambda r:r.abort())
 page.goto(URL+'#tools');page.wait_for_selector('#trade-calc')
 def fill(values):
  for key,value in values.items():page.locator('#'+key).fill(str(value))
 def submit(id):page.locator('#'+id+' button[type=submit]').click()
 def message(text):assert text in page.locator('#trade-message').inner_text()
 submit('trade-calc');message('買價請填')
 fill({'calc-price':100,'calc-stop':100,'calc-risk':1000});submit('trade-calc');message('停損價必須低於')
 fill({'calc-stop':95,'calc-risk':12345,'calc-capital':500000});submit('trade-calc')
 assert '2,469 股＝2 張＋469 股' in page.locator('#calc-result').inner_text()
 submit('trade-buy');message('請先完成四項')
 fill({'set-capital':100000,'set-ratio':20,'set-week':1000,'set-month':1000});submit('trade-settings')
 fill({'buy-stock':'測試股票 <script>','buy-price':100,'buy-stop':90,'buy-shares':1000,'buy-reason':'測試資料：依計畫買進，沒有追高。'})
 for i in range(4):page.locator('#check-'+str(i)).check()
 assert '超過設定 20%' in page.locator('#allocation-warning').inner_text()
 page.once('dialog',lambda d:d.dismiss());submit('trade-buy')
 assert page.locator('.trade-entry').count()==0
 page.once('dialog',lambda d:d.accept());submit('trade-buy');message('買進紀錄已儲存')
 page.locator('.trade-entry summary').click()
 fill({'sell-price-0':90,'sell-shares-0':1001,'sell-review-0':'測試檢討：按照計畫停損。'});submit('sell-0');message('賣出股數不可超過')
 fill({'sell-shares-0':100});submit('sell-0');message('賣出與檢討已儲存')
 assert '先停手' in page.locator('#trading-brake').inner_text()
 assert '剩餘 900 股' in page.locator('#trade-list').inner_text()
 assert '虧損累計 1,000 元' in page.locator('#trade-stats').inner_text()
 # Refreshing quote rendering must preserve unsaved calculator/buy values.
 fill({'buy-reason':'尚未儲存的理由'})
 page.evaluate('render(true)');assert page.locator('#buy-reason').input_value()=='尚未儲存的理由'
 with page.expect_download() as download:page.locator('#trade-export').click()
 backup=json.loads(Path(download.value.path()).read_text());assert len(backup['trades'])==1
 page.reload();page.wait_for_selector('.trade-entry');assert '剩餘 900 股' in page.locator('#trade-list').inner_text()
 page.locator('#trade-import').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"version":999}'})
 page.wait_for_function("document.querySelector('#trade-message').textContent.includes('匯入失敗')")
 assert page.locator('.trade-entry').count()==1
 page.once('dialog',lambda d:d.accept())
 page.locator('#trade-import').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(backup).encode()})
 page.wait_for_function("document.querySelector('#trade-message').textContent.includes('匯入完成')")
 for width in [390,1440]:
  page.set_viewport_size({'width':width,'height':900})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path=f'screenshots/v1.6-tools-{width}.png',full_page=True)
 page.locator('a[href="#"]').first.click();page.wait_for_selector('.stock-card')
 assert page.locator('.stock-card').count()==7
 assert page.locator('#trading-brake').is_visible()
 page.goto(URL+'#2330.TW');page.wait_for_selector('#price-chart');assert page.locator('canvas').count()==3
 # HTML-like user strings remain text, without executable markup.
 page.goto(URL+'#tools');page.wait_for_selector('.trade-entry')
 assert page.locator('.trade-entry script').count()==0
 assert not errors,errors
 # Storage failure reports failure and does not claim the entry was saved.
 page.evaluate("() => {Storage.prototype.setItem=function(){throw new Error('blocked')};}")
 submit('trade-settings');message('儲存失敗')
 browser.close()
print('PASS: 390/1440, calculator errors, checklist, allocation warning/cancel, partial sale, loss brake, reload persistence, JSON export/import/rejection, refresh preserves draft, storage failure, 7 cards/3 charts, no overflow/XSS/JS errors')
