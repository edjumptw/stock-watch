import unittest
from datetime import datetime, date
from zoneinfo import ZoneInfo
from unittest.mock import patch
import sys
from pathlib import Path
import pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'scripts'))
import update_data as u

CANDLE = dict(Open=155, High=160, Low=154, Close=156.14, Volume=333822100)
DAY = date(2026, 11, 16)
NOW = datetime(2026, 11, 17, 1, tzinfo=ZoneInfo('America/New_York'))

def frame(missing=False):
    days = ['2026-11-13'] if missing else ['2026-11-13', '2026-11-16']
    return pd.DataFrame([dict(CANDLE, Close=162.85)] + ([] if missing else [dict(CANDLE, Close=float('nan'))]),
                        index=pd.DatetimeIndex(days, tz='America/New_York'))

class FallbackTests(unittest.TestCase):
    def test_nan_and_absent_date_use_stooq_full_candle(self):
        for missing in (False, True):
            with self.subTest(missing=missing), patch.object(u, 'fetch_stooq', return_value={DAY:CANDLE}), patch.object(u, 'fetch_nasdaq', return_value={}):
                result = u.complete_us_history(frame(missing), 'NVDA', NOW)
                self.assertEqual(result.iloc[-1]['source'], 'Stooq')
                for key, value in CANDLE.items(): self.assertEqual(result.iloc[-1][key], value)
                self.assertEqual(result.iloc[0]['Close'], 162.85)
                self.assertEqual(result.iloc[0]['source'], 'Yahoo Finance')

    def test_stooq_error_or_missing_uses_nasdaq(self):
        for response in ({}, ValueError('not CSV')):
            kwargs = {'side_effect':response} if isinstance(response, Exception) else {'return_value':response}
            with patch.object(u, 'fetch_stooq', **kwargs), patch.object(u, 'fetch_nasdaq', return_value={DAY:CANDLE}):
                result = u.complete_us_history(frame(), 'NVDA', NOW)
                self.assertEqual(result.iloc[-1]['source'], 'Nasdaq')
                self.assertEqual(result.iloc[-1]['Close'], 156.14)

    def test_both_missing_keep_previous_close_without_new_date(self):
        with patch.object(u, 'fetch_stooq', return_value={}), patch.object(u, 'fetch_nasdaq', side_effect=TimeoutError()):
            result = u.complete_us_history(frame(), 'NVDA', NOW)
            self.assertEqual(len(result), 1)
            self.assertEqual(result.index[-1].date(), date(2026,11,13))
            self.assertEqual(result.iloc[-1]['Close'], 162.85)

    def test_prefer_yahoo_then_stooq_and_exclude_incomplete_session(self):
        tomorrow = date(2026,11,17)
        with patch.object(u, 'fetch_stooq', return_value={date(2026,11,13):CANDLE, DAY:CANDLE, tomorrow:CANDLE}), patch.object(u, 'fetch_nasdaq', return_value={DAY:dict(CANDLE, Close=157)}):
            result = u.complete_us_history(frame(), 'NVDA', NOW)
            self.assertEqual(result.iloc[0]['Close'], 162.85)
            self.assertEqual(result.iloc[-1]['Close'], 156.14)
            self.assertEqual(result.iloc[-1]['source'], 'Stooq')
            self.assertEqual(len(result), 2)

    def test_published_close_cannot_regress_when_upstreams_lose_a_date(self):
        old = {'currency':'USD','date':'2026-11-16','close':156.14,'source':'Stooq'}
        fresh = {'currency':'USD','date':'2026-11-13','close':162.85}
        self.assertIs(u.keep_previous_close(fresh, old), old)
        self.assertIs(u.keep_previous_close(old, fresh), old)
        self.assertIs(u.keep_previous_close(fresh, None), fresh)

    def test_parsers_reject_html_and_invalid_candles(self):
        with patch.object(u, 'fetch_text', return_value='<html>verification</html>'):
            with self.assertRaises(ValueError): u.fetch_stooq('NVDA', DAY, DAY)
        self.assertFalse(u.valid_candle(dict(CANDLE, Close=float('nan'))))
        self.assertFalse(u.valid_candle(dict(CANDLE, High=150)))
        self.assertFalse(u.valid_candle(dict(CANDLE, Volume=-1)))
        with patch.object(u, 'fetch_text', return_value='Date,Open,High,Low,Close,Volume\n2026-11-16,155,160,154,156.14,333822100\n'):
            self.assertEqual(u.fetch_stooq('NVDA',DAY,DAY), {DAY:CANDLE})
        import json
        with patch.object(u, 'fetch_text', return_value=json.dumps({'data':{'tradesTable':{'rows':[{'date':'11/16/2026','open':'$155','high':'$160','low':'$154','close':'$156.14','volume':'333,822,100'}]}}})):
            self.assertEqual(u.fetch_nasdaq('NVDA',DAY,DAY), {DAY:CANDLE})

if __name__ == '__main__': unittest.main()
