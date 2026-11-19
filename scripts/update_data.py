"""Public end-of-day prices and Google News, no credentials required."""
import csv, io, json, math, time
import pandas as pd
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
        link = item.findtext('link') or ''
        title = ' '.join((item.findtext('title') or '').split())
        if not title or not link.startswith('https://'): continue
        rows.append({'title':title, 'url':link, 'date':date.isoformat()})
    unique, titles, urls = [], set(), set()
    for row in sorted(rows, key=lambda x:x['date'], reverse=True):
        key = ' '.join(row['title'].rsplit(' - ', 1)[0].split())
        if key in titles or row['url'] in urls:
            continue
        unique.append(row)
        titles.add(key)
        urls.add(row['url'])
        if len(unique) == 5:
            break
    return unique

def fetch_text(url):
    headers = {'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,text/csv,*/*',
               'Referer': 'https://www.nasdaq.com/'}
    with urlopen(Request(url, headers=headers), timeout=30) as response:
        return response.read().decode('utf-8-sig')


def valid_candle(row):
    try:
        o, h, l, c, v = [float(row[k]) for k in ('Open', 'High', 'Low', 'Close', 'Volume')]
        return (all(math.isfinite(x) for x in (o, h, l, c, v)) and
                min(o, h, l, c) > 0 and v >= 0 and v.is_integer() and
                l <= min(o, c) <= max(o, c) <= h)
    except (KeyError, TypeError, ValueError):
        return False


def fetch_stooq(symbol, start, end):
    url = 'https://stooq.com/q/d/l/?' + urlencode({
        's': symbol.lower()+'.us', 'i': 'd',
        'd1': start.strftime('%Y%m%d'), 'd2': end.strftime('%Y%m%d')})
    reader = csv.DictReader(io.StringIO(fetch_text(url)))
    if not reader.fieldnames or not {'Date', 'Open', 'High', 'Low', 'Close', 'Volume'} <= set(reader.fieldnames):
        raise ValueError('Stooq did not return OHLCV CSV')
    return {datetime.strptime(r['Date'], '%Y-%m-%d').date():
            {k: float(r[k]) for k in ('Open', 'High', 'Low', 'Close', 'Volume')}
            for r in reader if valid_candle(r)}


def fetch_nasdaq(symbol, start, end):
    url = f'https://api.nasdaq.com/api/quote/{symbol}/historical?' + urlencode({
        'assetclass': 'stocks', 'fromdate': start.isoformat(),
        'todate': end.isoformat(), 'limit': 5000})
    payload = json.loads(fetch_text(url))
    rows = ((payload.get('data') or {}).get('tradesTable') or {}).get('rows') or []
    result = {}
    for row in rows:
        try:
            candle = {k: float(row[k.lower()].replace('$', '').replace(',', ''))
                      for k in ('Open', 'High', 'Low', 'Close', 'Volume')}
            if valid_candle(candle):
                result[datetime.strptime(row['date'], '%m/%d/%Y').date()] = candle
        except (KeyError, TypeError, ValueError):
            continue
    return result


def complete_us_history(df, symbol, local):
    """Keep Yahoo closes; fill only confirmed, complete backup session candles.

    Query the entire history window to also discover dates absent from Yahoo.
    Never synthesize weekday/holiday candles or use an intraday quote.
    """
    df = df.copy()
    df['source'] = 'Yahoo Finance'
    end = local.date() if (local.hour, local.minute) >= (16, 15) else local.date()-timedelta(days=1)
    start = df.index.min().date() if len(df) else end-timedelta(days=366)
    for source, fetch in [('Stooq', fetch_stooq), ('Nasdaq', fetch_nasdaq)]:
        try:
            candles = fetch(symbol, start, end)
        except Exception as exc:
            print(f'{symbol} {source} unavailable: {exc}', flush=True)
            continue
        for day, candle in sorted(candles.items()):
            if not start <= day <= end or not valid_candle(candle):
                continue
            stamp = pd.Timestamp(day, tz='America/New_York')
            if stamp in df.index and pd.notna(df.at[stamp, 'Close']):
                continue
            for key, value in candle.items():
                df.loc[stamp, key] = value
            df.loc[stamp, 'source'] = source
        # Nasdaq remains available for holes Stooq itself did not cover.
    return df.sort_index().dropna(subset=['Close'])

def closing_time_taipei(day, currency):
    # Daily candle indexes denote session dates at midnight, not closing instants.
    zone = ZoneInfo('America/New_York' if currency == 'USD' else 'Asia/Taipei')
    hour, minute = (16, 0) if currency == 'USD' else (13, 30)
    return datetime.fromisoformat(str(day)).replace(hour=hour, minute=minute, tzinfo=zone).astimezone(TZ).isoformat()

def build(stock):
    now = datetime.now(TZ)
    df = yf.Ticker(stock['symbol']).history(period='1y', auto_adjust=False, repair=False)
    if df.empty and stock['currency']=='TWD': raise ValueError('No price data: '+stock['symbol'])
    # Ignore a currently trading daily candle; keep only completed sessions.
    market_tz = ZoneInfo('Asia/Taipei' if stock['currency']=='TWD' else 'America/New_York')
    local = now.astimezone(market_tz)
    cutoff = (14,0) if stock['currency']=='TWD' else (16,15)
    df = df.loc[[d.date() < local.date() or (d.date() == local.date() and (local.hour,local.minute) >= cutoff) for d in df.index]]
    if stock['currency']=='USD':
        df = complete_us_history(df, stock['symbol'], local)
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
        rows.append({**({'source':row['source'], **{k.lower():round(float(row[k]),4) for k in ('Open','High','Low')}} if stock['currency']=='USD' else {}), 'date':date.date().isoformat(),'close':round(adjusted[i],4),'volume':int(row.Volume),
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
    return {**stock, **({'source':last['source']} if stock['currency']=='USD' else {}),'date':last['date'],'dateTaipei':closing_time_taipei(last['date'], stock['currency']) if stock['currency']=='USD' else df.index[-1].astimezone(TZ).isoformat(),'close':close[-1],
            'change':round(change,4),'changePct':round(change/prev*100,4),'volume':last['volume'],
            'bias':bias,'performance20':round(perf,2),'volumeRatio':round(volratio,2),
            'recommendation':recommend(rows),'commentary':commentary,'history':rows,'news':articles,'updatedAt':now.isoformat()}

def keep_previous_close(result, previous):
    # A temporary upstream gap must not roll a published US close backwards.
    if (result['currency'] == 'USD' and previous and
            previous['date'] > result['date']):
        return previous
    return result


def main():
    stocks=json.loads((ROOT/'stocks.json').read_text())
    results=[]
    for stock in stocks:
        for attempt in range(3):
            try:
                result=build(stock)
                previous_path=ROOT/'data'/(stock['symbol']+'.json')
                previous=json.loads(previous_path.read_text()) if previous_path.exists() else None
                result=keep_previous_close(result, previous)
                if previous and {k:v for k,v in result.items() if k != 'updatedAt'} == {k:v for k,v in previous.items() if k != 'updatedAt'}:
                    result['updatedAt'] = previous['updatedAt']
                results.append(result)
                print(stock['symbol'], result['date'], result['close'], f"news={len(result['news'])}", flush=True)
                break
            except Exception:
                if attempt==2: raise
                time.sleep(5*(attempt+1))
    # Publish only after every symbol succeeds; never replace data with partial output.
    target=ROOT/'data'; target.mkdir(exist_ok=True)
    for result in results:
        (target/(result['symbol']+'.json')).write_text(json.dumps(result,ensure_ascii=False,allow_nan=False,indent=2)+'\n')
    old_index = json.loads((target/'index.json').read_text()) if (target/'index.json').exists() else {}
    stamp = old_index.get('updatedAt') if old_index.get('stocks') == results else datetime.now(TZ).isoformat()
    (target/'index.json').write_text(json.dumps({'updatedAt':stamp,'stocks':results},ensure_ascii=False,allow_nan=False,indent=2)+'\n')

if __name__=='__main__': main()
