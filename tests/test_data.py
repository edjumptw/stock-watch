import unittest, json, math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from unittest.mock import Mock, patch
import pandas as pd
from update_data import rsi, build, news, TZ
from datetime import datetime, timedelta
ROOT=Path(__file__).resolve().parents[1]
class MarketTests(unittest.TestCase):
    def test_wilder_rsi(self):
        self.assertEqual(rsi(list(range(30)))[-1],100)
        self.assertEqual(rsi(list(range(30,0,-1)))[-1],0)
        self.assertEqual(rsi([10]*30)[-1],50)
        sample=[44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28]
        self.assertAlmostEqual(rsi(sample)[-1],70.464,places=3)
    def test_build_accepts_news_counts(self):
        dates=pd.bdate_range(end=datetime.now(TZ).date()-timedelta(days=1), periods=200, tz=TZ)
        history=pd.DataFrame({'Close':range(100,300), 'Volume':[1000]*200}, index=dates)
        stock={'symbol':'TEST.TW','currency':'TWD','query':'test'}
        with patch('update_data.yf.Ticker') as ticker:
            ticker.return_value.history.return_value=history
            for count in (0,2,5):
                with self.subTest(count=count):
                    articles=[{'title':'Test','url':'https://example.com','date':'2026-01-01'}]*count
                    with patch('update_data.news', return_value=articles):
                        self.assertEqual(build(stock)['news'],articles)

    def test_news_caps_results_at_five(self):
        items=''.join(f'<item><title>News {i}</title><link>https://example.com/{i}</link>'
                      '<pubDate>Wed, 18 Nov 2026 00:00:00 GMT</pubDate></item>' for i in range(7))
        response=Mock()
        response.__enter__=Mock(return_value=response)
        response.__exit__=Mock(return_value=False)
        response.read.return_value=f'<rss><channel>{items}</channel></rss>'.encode()
        with patch('update_data.urlopen', return_value=response):
            self.assertEqual(len(news('test')),5)

    def test_news_deduplicates_after_sort_and_backfills(self):
        articles=[('Same - Media', 'old', 1), (' Same   - Media ', 'new', 9),
                  ('Same - Other', 'other', 8), ('Different', 'other', 7),
                  ('', 'empty', 10), ('Unsafe', 'unsafe', 10)]
        articles += [(f'Extra {i}', f'extra{i}', 6-i) for i in range(5)]
        items=''.join(f'<item><title>{title}</title><link>{"http" if url=="unsafe" else "https"}://example.com/{url}</link>'
                      f'<pubDate>Wed, 18 Nov 2026 {hour:02}:00:00 GMT</pubDate></item>'
                      for title,url,hour in articles)
        response=Mock()
        response.__enter__=Mock(return_value=response)
        response.__exit__=Mock(return_value=False)
        response.read.return_value=f'<rss><channel>{items}</channel></rss>'.encode()
        with patch('update_data.urlopen', return_value=response):
            rows=news('test')
        self.assertEqual([r['title'] for r in rows],
                         ['Same - Media', 'Same - Other', 'Extra 0', 'Extra 1', 'Extra 2'])
        self.assertEqual(rows[0]['url'], 'https://example.com/new')

    def test_published_data(self):
        data=json.loads((ROOT/'data/index.json').read_text())
        expected=json.loads((ROOT/'stocks.json').read_text())
        self.assertEqual([s['symbol'] for s in data['stocks']],[s['symbol'] for s in expected])
        for stock in data['stocks']:
            with self.subTest(symbol=stock['symbol']):
                self.assertGreater(stock['close'],0)
                self.assertGreater(stock['volume'],0)
                self.assertGreater(len(stock['history']),100)
                self.assertEqual(stock['history'][-1]['date'],stock['date'])
                self.assertAlmostEqual(stock['close'],stock['history'][-1]['close'],places=3)
                self.assertTrue(0<=len(stock['news'])<=5)
                for article in stock['news']:
                    self.assertTrue({'title','url','date'} <= article.keys())
                self.assertTrue(2<=len(stock['commentary'])<=4)
                for row in stock['history']:
                    self.assertTrue(0<=row['rsi']<=100)
                    self.assertTrue(all(math.isfinite(row[k]) for k in ('close','ma5','ma20','ma60','volume')))
                self.assertEqual(json.loads((ROOT/'data'/f"{stock['symbol']}.json").read_text()),stock)
if __name__=='__main__': unittest.main()
