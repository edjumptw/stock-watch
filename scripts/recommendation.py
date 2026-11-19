"""Deterministic closing-data rules; no network or portfolio assumptions."""
def recommend(history):
    last = history[-1]
    close, ma5, ma20, ma60, rsi = (last[k] for k in ('close','ma5','ma20','ma60','rsi'))
    previous = history[-21:-1]
    average = sum(r['volume'] for r in previous) / len(previous)
    ratio = last['volume'] / average if average else 0
    if rsi >= 75 or (close < ma20 and close < ma60 and ratio >= 1.2):
        action = '減碼'
        summary = '已有持股可考慮分批降低部位，先留意回檔風險。'
        reason = ('RSI 已達 75，短線漲幅可能過熱。' if rsi >= 75 else '收盤跌破月線與季線，且成交量達前 20 日均量的 1.2 倍。')
        reasons = [reason, '已有持股可分批降低部位；尚未持股先等價格穩定，避免急著追價或接跌。']
    elif ma5 > ma20 > ma60 and close >= ma20 and 40 <= rsi <= 65 and 0.8 <= ratio < 1.5:
        action = '分批買進'
        summary = '均線向上且量能適中，可考慮小額分批布局。'
        reasons = ['短中長均線依序向上排列，收盤仍在月線之上。', 'RSI 介於 40 至 65，成交量為前 20 日均量的 0.8 至未滿 1.5 倍，可考慮小額分批買進，跌破支撐再重新評估。']
    elif close >= ma20 >= ma60 and 40 <= rsi < 75:
        action = '續抱'
        summary = '已有持股可續抱，盯住月線與下方支撐。'
        reasons = ['收盤站在月線之上，月線也未低於季線，趨勢仍有支撐。', 'RSI 介於 40 至未滿 75；已有持股可續抱，尚未持股先等更合適的分批買點。']
    else:
        action = '觀望'
        summary = '買進條件尚未齊備，先等趨勢與量能更明確。'
        reasons = ['均線、RSI 或量能尚未同時符合買進與續抱條件。', '先看價格能否站穩月線與季線；RSI 偏低也不代表已止跌，暫緩新增部位。']
    candidates = [
        {'price': min(r['close'] for r in history[-20:]), 'source': '近 20 日最低收盤價'},
        {'price': max(r['close'] for r in history[-20:]), 'source': '近 20 日最高收盤價'},
        {'price': ma20, 'source': 'MA20（近 20 日收盤均價）'},
        {'price': ma60, 'source': 'MA60（近 60 日收盤均價）'},
    ]
    # Equality belongs to the low first, otherwise the high; MAs alone use support.
    equality_support = candidates[0]['price'] == close or candidates[1]['price'] != close
    def levels(support):
        eligible = [p for p in candidates if ((p['price'] < close if support else p['price'] > close) or (p['price'] == close and support == equality_support))]
        eligible.sort(key=lambda p: abs(p['price'] - close))
        result = []
        for p in eligible:
            if not any(x['price'] == p['price'] for x in result):
                result.append(p)
            if len(result) == 2: break
        return result
    return {'date': last['date'], 'action': action, 'summary': summary, 'reasons': reasons,
            'support': levels(True), 'resistance': levels(False), 'volumeRatio': round(ratio, 4)}
