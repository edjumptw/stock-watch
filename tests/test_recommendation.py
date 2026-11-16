import unittest, sys, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from recommendation import recommend
class RecommendationTests(unittest.TestCase):
    def sample(self, **changes):
        rows=[dict(date='2026-11-13',close=100,ma5=99,ma20=98,ma60=95,rsi=60,volume=100) for _ in range(60)]
        rows[-1].update(changes)
        return rows
    def test_priority_and_boundaries(self):
        cases=[({},'分批買進'),({'rsi':75},'減碼'),({'rsi':74},'續抱'),({'volume':150},'續抱'),({'volume':80},'分批買進'),({'rsi':30},'觀望'),({'close':90,'volume':120},'減碼'),({'close':90,'volume':119},'觀望'),({'ma5':98},'續抱')]
        for changes,action in cases:
            with self.subTest(changes=changes):self.assertEqual(recommend(self.sample(**changes))['action'],action)
    def test_levels_and_published_recomputation(self):
        data=json.loads(Path('data/index.json').read_text())
        for s in data['stocks']:
            r=s['recommendation'];self.assertEqual(r,recommend(s['history']))
            self.assertEqual(r['date'],s['date']);self.assertEqual(len(r['reasons']),2)
            for key in ('support','resistance'):
                self.assertTrue(1<=len(r[key])<=2)
                self.assertEqual(len({p['price'] for p in r[key]}),len(r[key]))
                for p in r[key]:self.assertTrue(p['price']<=s['history'][-1]['close'] if key=='support' else p['price']>=s['history'][-1]['close'])
    def test_zero_volume_and_flat_prices(self):
        rows=self.sample(volume=0)
        for row in rows:row.update(volume=0,ma20=100,ma60=100)
        r=recommend(rows);self.assertEqual(r['volumeRatio'],0)
        self.assertEqual(len(r['support']),1);self.assertEqual(len(r['resistance']),1)
