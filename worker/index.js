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
    const key = new Request(`${url.origin}/cached-quotes-v1`);
    const cached = await caches.default.match(key);
    if (cached) return new Response(cached.body, {headers: {...cors, 'Cache-Control': 'no-store', 'X-Quote-Cache': 'HIT'}});
    const results = await Promise.allSettled(SYMBOLS.map(async symbol => {
      const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`, {headers: {'User-Agent': 'Mozilla/5.0'}, signal: AbortSignal.timeout(7000)});
      if (!response.ok) throw new Error('Upstream HTTP ' + response.status);
      const meta = (await response.json()).chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice, previousClose = meta?.chartPreviousClose ?? meta?.previousClose;
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(previousClose) || previousClose <= 0 || !Number.isFinite(meta.regularMarketTime)) throw new Error('Invalid quote');
      return {symbol, price, previousClose, change: price - previousClose, changePct: (price / previousClose - 1) * 100, volume: meta.regularMarketVolume ?? null, currency: meta.currency, quoteTime: new Date(meta.regularMarketTime * 1000).toISOString()};
    }));
    const quotes = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    if (!quotes.length) return reply({error: 'Quotes unavailable', reasons: results.map(r => r.reason?.message)}, 502);
    const body = JSON.stringify({source: 'Yahoo Finance', fetchedAt: new Date().toISOString(), quotes});
    ctx.waitUntil(caches.default.put(key, new Response(body, {headers: {'Cache-Control': 'public, max-age=45', 'Content-Type': 'application/json'}})));
    return new Response(body, {headers: {...cors, 'Cache-Control': 'no-store', 'X-Quote-Cache': 'MISS'}});
  }
};
