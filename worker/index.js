const ORIGIN = 'https://edjumptw.github.io';
const SYMBOLS = ['2327.TW', '2308.TW', '2330.TW', '2301.TW', '3711.TW', 'NVDA', 'TSLA'];
const cors = {'Access-Control-Allow-Origin': ORIGIN, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Content-Type': 'application/json; charset=utf-8'};
const reply = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {...cors, 'Cache-Control': 'no-store'}});
export default {
  async fetch(request, env, ctx) {
    if (request.headers.get('Origin') !== ORIGIN) return new Response('Forbidden', {status: 403});
    if (!['GET', 'OPTIONS'].includes(request.method)) return reply({error: 'Method not allowed'}, 405);
    const url = new URL(request.url);
    if (url.pathname !== '/quotes' || url.search) return reply({error: 'Not found'}, 404);
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
    const key = new Request(`${url.origin}/cached-quotes-v3`);
    const cached = await caches.default.match(key);
    if (cached) return new Response(cached.body, {headers: {...cors, 'Cache-Control': 'no-store', 'X-Quote-Cache': 'HIT'}});
    const taiwan = fetchTaiwan().catch(() => new Map());
    const results = await Promise.allSettled(SYMBOLS.map(async symbol => {
      if (symbol.endsWith('.TW')) {
        const quote = (await taiwan).get(symbol);
        if (quote) return quote;
      }
      return fetchYahoo(symbol);
    }));
    const quotes = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    if (!quotes.length) return reply({error: 'Quotes unavailable', reasons: results.map(r => r.reason?.message)}, 502);
    const body = JSON.stringify({source: 'TWSE / Yahoo Finance', fetchedAt: new Date().toISOString(), quotes});
    ctx.waitUntil(caches.default.put(key, new Response(body, {headers: {'Cache-Control': 'public, max-age=20', 'Content-Type': 'application/json'}})));
    return new Response(body, {headers: {...cors, 'Cache-Control': 'no-store', 'X-Quote-Cache': 'MISS'}});
  }
};

async function fetchYahoo(symbol) {
      const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`, {headers: {'User-Agent': 'Mozilla/5.0'}, signal: AbortSignal.timeout(7000)});
      if (!response.ok) throw new Error('Upstream HTTP ' + response.status);
      const meta = (await response.json()).chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice, previousClose = meta?.chartPreviousClose ?? meta?.previousClose;
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(previousClose) || previousClose <= 0 || !Number.isFinite(meta.regularMarketTime)) throw new Error('Invalid quote');
      return {symbol, source: 'Yahoo Finance', price, previousClose, change: price - previousClose, changePct: (price / previousClose - 1) * 100, volume: meta.regularMarketVolume ?? null, currency: meta.currency, quoteTime: new Date(meta.regularMarketTime * 1000).toISOString()};
}

const positive = value => typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
export function parseTaiwan(row, now = Date.now()) {
  const symbol = `${row.c}.TW`;
  if (!SYMBOLS.includes(symbol) || row.ex !== 'tse') throw new Error('Invalid Taiwan symbol');
  const previousClose = positive(row.y), timestamp = positive(row.tlong);
  if (!previousClose || !timestamp || timestamp > now + 60000 || now - timestamp > 7 * 86400000) throw new Error('Invalid Taiwan quote');
  const local = new Date(timestamp + 8 * 3600000);
  const closed = local.getUTCHours() * 60 + local.getUTCMinutes() >= 810;
  const bid = positive(row.b?.split('_')[0]), ask = positive(row.a?.split('_')[0]);
  // Midpoints are indicative prices, never closing trades.
  let price = positive(row.z), priceType = 'trade';
  if (!price && closed) price = positive(row.trade?.z);
  if (!price && !closed && bid && ask && bid <= ask) { price = (bid + ask) / 2; priceType = 'midpoint'; }
  if (!price) price = positive(row.trade?.z);
  const volume = typeof row.v === 'string' && /^\d+$/.test(row.v) ? Number(row.v) * 1000 : NaN;
  if (!price || !Number.isSafeInteger(volume)) throw new Error('Invalid Taiwan price or volume');
  return {symbol, source: 'TWSE', priceType, price, previousClose, change: price - previousClose,
    changePct: (price / previousClose - 1) * 100, volume, currency: 'TWD', quoteTime: new Date(timestamp).toISOString()};
}
async function fetchTaiwan() {
  const url = new URL('https://mis.twse.com.tw/stock/api/getStockInfo.jsp');
  url.search = new URLSearchParams({ex_ch: SYMBOLS.filter(s => s.endsWith('.TW')).map(s => 'tse_' + s.toLowerCase()).join('|'), json: '1', delay: '0', _: String(Date.now())});
  const response = await fetch(url, {headers: {'User-Agent': 'Mozilla/5.0', Referer: 'https://mis.twse.com.tw/stock/index.jsp'}, signal: AbortSignal.timeout(2500)});
  if (!response.ok) throw new Error('TWSE unavailable');
  const payload = await response.json();
  if (payload.rtcode !== '0000' || !Array.isArray(payload.msgArray)) throw new Error('Invalid Taiwan response');
  const quotes = new Map();
  for (const row of payload.msgArray) {
    try { const quote = parseTaiwan(row); quotes.set(quote.symbol, quote); } catch { /* Per-symbol Yahoo fallback. */ }
  }
  return quotes;
}
