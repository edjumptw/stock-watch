import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
from update_data import closing_time_taipei

class CloseTimeTests(unittest.TestCase):
    def test_us_winter_and_summer(self):
        self.assertEqual(closing_time_taipei('2026-11-16', 'USD'), '2026-11-17T05:00:00+08:00')
        self.assertEqual(closing_time_taipei('2026-07-16', 'USD'), '2026-07-17T04:00:00+08:00')
    def test_dst_boundaries(self):
        for day, result in [('2026-03-06','2026-03-07T05:00:00+08:00'),('2026-03-09','2026-03-10T04:00:00+08:00'),('2026-10-30','2026-10-31T04:00:00+08:00'),('2026-11-02','2026-11-03T05:00:00+08:00')]:
            self.assertEqual(closing_time_taipei(day, 'USD'), result)
