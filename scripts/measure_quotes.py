"""Sample real production responses; retain both local and server clocks."""
import json,time,sys,datetime
from playwright.sync_api import sync_playwright
rows=[]
with sync_playwright() as p:
 browser=p.chromium.launch(args=['--no-sandbox'])
 page=browser.new_page()
 for i in range(int(sys.argv[2])):
  row={'timeTaipei':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()}
  start=time.monotonic()
  try:
   r=page.request.get('https://stock-watch-quotes.jumpbotofficejumpbotoffice.workers.dev/quotes',headers={'Origin':'https://edjumptw.github.io'},timeout=25000)
   row.update(status=r.status,serverDate=r.headers.get('date'),cache=r.headers.get('x-quote-cache'),seconds=round(time.monotonic()-start,3),payload=r.json())
  except Exception as e: row['error']=str(e)
  rows.append(row)
  with open(sys.argv[1],'w') as f: json.dump(rows,f,ensure_ascii=False,indent=2)
  if i+1<int(sys.argv[2]): time.sleep(21)
 browser.close()
print(sys.argv[1],len(rows))
