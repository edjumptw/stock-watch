import os,json,mimetypes
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
URL='https://edjumptw.github.io/stock-watch/'
WORKER='https://stock-watch-quotes.jumpbotofficejumpbotoffice.workers.dev/quotes'
local=os.environ.get('LOCAL_SITE')=='1'
with sync_playwright() as p:
 browser=p.chromium.launch(args=['--no-sandbox'])
 page=browser.new_page()
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 if local:
  def route(r):
   path=Path(urlsplit(r.request.url).path.removeprefix('/stock-watch/') or 'index.html')
   r.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
  page.route(URL+'**',route)
 for width in [390,1440]:
  page.set_viewport_size({'width':width,'height':900})
  page.goto(URL)
  page.wait_for_selector('.term-help')
  page.wait_for_function("!quoteStatus.includes('正在讀取')")
  assert page.locator('.stock-card').count()==7
  page.locator('.term-help summary').first.click()
  assert page.locator('.term-help').first.get_attribute('open') is not None
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  if not local: page.screenshot(path=f'screenshots/v1.5-home-{width}-production.png',full_page=True)
  for symbol in ['2327.TW','2308.TW','2330.TW','2301.TW','3711.TW','NVDA','TSLA']:
   page.goto(URL+'#'+symbol)
   page.wait_for_selector('#price-chart')
   assert page.locator('canvas').count()==3
   assert page.locator('.intraday').count()==1
   page.locator('.term-help summary').click()
   assert page.locator('.term-help dd').count()>=20
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,symbol)
   if symbol in ['2330.TW','NVDA'] and not local:page.screenshot(path=f'screenshots/v1.5-{symbol}-{width}-production.png',full_page=True)
  assert json.loads(Path('data/NVDA.json').read_text())['dateTaipei']==page.evaluate("data.stocks.find(s=>s.symbol==='NVDA').dateTaipei")
 # Controlled quote and trading-time fixtures exercise live UI without changing production data.
 page.goto(URL+'#2330.TW');page.wait_for_selector('.intraday')
 before=page.evaluate('JSON.stringify(data.stocks)')
 page.evaluate("""() => {
  quotes.set('2330.TW',{symbol:'2330.TW',source:'Yahoo Finance',price:2100,quoteTime:'2026-11-17T04:00:00Z'});
  const RealDate=Date;
  window.Date=class extends RealDate { constructor(...args){super(...(args.length?args:['2026-11-17T04:01:00Z']));} static now(){return new RealDate('2026-11-17T04:01:00Z').getTime();} };
  render(true);
 }""")
 assert '盤中目前價 2,100.00' in page.locator('.intraday').inner_text()
 assert '目前用備用報價（約延遲 20 分鐘）' in page.locator('.quote-label').inner_text()
 assert before==page.evaluate('JSON.stringify(data.stocks)')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 if not local:page.screenshot(path='screenshots/v1.5-backup-fixture-1440.png',full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 page.wait_for_function('document.documentElement.scrollWidth<=innerWidth')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 if not local:page.screenshot(path='screenshots/v1.5-backup-fixture-390.png',full_page=True)
 assert not errors,errors
 browser.close()
print('PASS: 390/1440 homepage + all 7 details, expanded glossary, charts, live/backup fixtures, unchanged data, no overflow or JS errors; local=',local)
