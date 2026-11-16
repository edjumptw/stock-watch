import unittest, json, math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from update_data import rsi
ROOT=Path(__file__).resolve().parents[1]
class MarketTests(unittest.TestCase):
    def test_wilder_rsi(self):
        self.assertEqual(rsi(list(range(30)))[-1],100)
        self.assertEqual(rsi(list(range(30,0,-1)))[-1],0)
        self.assertEqual(rsi([10]*30)[-1],50)
        sample=[44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28]
        self.assertAlmostEqual(rsi(sample)[-1],70.464,places=3)
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
                self.assertEqual(len(stock['news']),5)
                self.assertTrue(2<=len(stock['commentary'])<=4)
                for row in stock['history']:
                    self.assertTrue(0<=row['rsi']<=100)
                    self.assertTrue(all(math.isfinite(row[k]) for k in ('close','ma5','ma20','ma60','volume')))
                self.assertEqual(json.loads((ROOT/'data'/f"{stock['symbol']}.json").read_text()),stock)
if __name__=='__main__': unittest.main()
