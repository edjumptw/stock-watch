"""Public end-of-day prices and Google News, no credentials required."""
import json, math, time
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from email.utils import parsedate_to_datetime
import xml.etree.ElementTree as ET
import yfinance as yf
from recommendation import recommend

ROOT = Path(__file__).resolve().parents[1]
TZ = ZoneInfo('Asia/Taipei')

def rsi(values, n=14):
    result = [None] * len(values)
    gains = losses = 0
    for i in range(1, len(values)):
        change = values[i] - values[i-1]
        if i <= n:
            gains += max(change, 0) / n
            losses += max(-change, 0) / n
        else:
            gains = (gains*(n-1) + max(change, 0))/n
            losses = (losses*(n-1) + max(-change, 0))/n
        if i >= n:
            result[i] = 100 - 100/(1+gains/losses) if losses else (100 if gains else 50)
    return result

def news(query):
    url = 'https://news.google.com/rss/search?' + urlencode({'q':query, 'hl':'zh-TW','gl':'TW','ceid':'TW:zh-Hant'})
    with urlopen(Request(url, headers={'User-Agent':'Mozilla/5.0'}), timeout=40) as response:
        root = ET.fromstring(response.read())
    rows = []
    for item in root.findall('./channel/item'):
        date = parsedate_to_datetime(item.findtext('pubDate')).astimezone(TZ)
        link = item.findtext('link')
        if not link.startswith('https://'): continue
        rows.append({'title':item.findtext('title'), 'url':link, 'date':date.isoformat()})
    return sorted(rows, key=lambda x:x['date'], reverse=True)[:5]

def build(stock):
    now = datetime.now(TZ)
    df = yf.Ticker(stock['symbol']).history(period='1y', auto_adjust=False, repair=False)
    if df.empty: raise ValueError('No price data: '+stock['symbol'])
    # Ignore a currently trading daily candle; keep only completed sessions.
    market_tz = ZoneInfo('Asia/Taipei' if stock['currency']=='TWD' else 'America/New_York')
    local = now.astimezone(market_tz)
    cutoff = (14,0) if stock['currency']=='TWD' else (16,15)
    df = df[[d.date() < local.date() or (d.date() == local.date() and (local.hour,local.minute) >= cutoff) for d in df.index]]
    df = df.dropna(subset=['Close'])
    if len(df) < 100: raise ValueError('Insufficient history')
    close = df.Close.tolist()
    # Yahoo historical Close is already split-adjusted (not dividend-adjusted).
    adjusted = close.copy()
    averages = {n:[None if i<n-1 else sum(adjusted[i-n+1:i+1])/n for i in range(len(df))] for n in [5,20,60]}
    strength = rsi(adjusted)
    rows=[]
    start = now.date()-timedelta(days=184)
    for i,(date,row) in enumerate(df.iterrows()):
        if date.date() < start: continue
        rows.append({'date':date.date().isoformat(),'close':round(adjusted[i],4),'volume':int(row.Volume),
                     'rsi':None if strength[i] is None else round(strength[i],2),
                     **{f'ma{n}':round(averages[n][i],4) for n in averages}})
    last = rows[-1]; prev = adjusted[-2]; change=adjusted[-1]-prev
    perf = (adjusted[-1]/adjusted[-21]-1)*100
    volratio = float(df.Volume.iloc[-1])/float(df.Volume.iloc[-21:-1].mean()) if df.Volume.iloc[-21:-1].mean() else 0
    a,b,c = [averages[n][-1] for n in (5,20,60)]
    bias = '偏強' if adjusted[-1]>a>b>c else '偏弱' if adjusted[-1]<a<b<c else '中性'
    alignment = '短中長均線由上而下排列' if a>b>c else '短中長均線由下而上排列' if a<b<c else '均線交錯，方向尚未一致'
    caution = 'RSI 高於 70，留意短線過熱與拉回。' if strength[-1]>70 else 'RSI 低於 30，留意弱勢延續，低檔不等於止跌。' if strength[-1]<30 else 'RSI 位於 30–70 之間，留意價格能否站穩 20 日均線。'
    commentary = [f'技術面{bias}：{alignment}，近 20 個交易日漲跌 {perf:+.2f}%。',f'本日成交量為前 20 日均量的 {volratio:.2f} 倍，'+('交易較熱絡。' if volratio>1.2 else '量能較平淡。' if volratio<0.8 else '量能接近平常。'),f'RSI(14) 為 {strength[-1]:.1f}。'+caution]
    articles = news(stock['query'])
    if len(articles)!=5: raise ValueError('Expected five news items')
    return {**stock,'date':last['date'],'dateTaipei':df.index[-1].astimezone(TZ).isoformat(),'close':close[-1],
            'change':round(change,4),'changePct':round(change/prev*100,4),'volume':last['volume'],
            'bias':bias,'performance20':round(perf,2),'volumeRatio':round(volratio,2),
            'recommendation':recommend(rows),'commentary':commentary,'history':rows,'news':articles,'updatedAt':now.isoformat()}

def main():
    stocks=json.loads((ROOT/'stocks.json').read_text())
    results=[]
    for stock in stocks:
        for attempt in range(3):
            try:
                result=build(stock); results.append(result)
                print(stock['symbol'], result['date'], result['close'], flush=True)
                break
            except Exception:
                if attempt==2: raise
                time.sleep(5*(attempt+1))
    # Publish only after every symbol succeeds; never replace data with partial output.
    target=ROOT/'data'; target.mkdir(exist_ok=True)
    for result in results:
        (target/(result['symbol']+'.json')).write_text(json.dumps(result,ensure_ascii=False,allow_nan=False,indent=2)+'\n')
    (target/'index.json').write_text(json.dumps({'updatedAt':datetime.now(TZ).isoformat(),'stocks':results},ensure_ascii=False,allow_nan=False,indent=2)+'\n')

if __name__=='__main__': main()
