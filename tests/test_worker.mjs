import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {default: worker, parseTaiwan}=await import('data:text/javascript;base64,'+Buffer.from(await readFile('worker/index.js','utf8')).toString('base64'));
let cache, calls=0;
globalThis.caches={default:{match:async()=>cache?.clone(),put:async(k,v)=>{cache=v.clone();}}};
globalThis.fetch=async url=>{calls++;const symbol=decodeURIComponent(new URL(url).pathname.split('/').at(-1));return Response.json({chart:{result:[{meta:{regularMarketPrice:100,chartPreviousClose:80,regularMarketTime:Date.now()/1000,currency:symbol.endsWith('.TW')?'TWD':'USD',regularMarketVolume:1234}}]}});};
const waits=[],ctx={waitUntil:p=>waits.push(p)};
const req=(path='/quotes',origin='https://edjumptw.github.io',method='GET')=>new Request('https://worker.example'+path,{method,headers:origin?{Origin:origin}:{}});
for(const origin of ['https://evil.example','null',''])assert.equal((await worker.fetch(req('/quotes',origin),{},ctx)).status,403);
assert.equal(calls,0);
assert.equal((await worker.fetch(req('/quotes?symbol=AAPL'),{},ctx)).status,404);
assert.equal((await worker.fetch(req('/quotes','https://edjumptw.github.io','POST'),{},ctx)).status,405);
assert.equal((await worker.fetch(req('/quotes','https://edjumptw.github.io','OPTIONS'),{},ctx)).status,204);
const first=await worker.fetch(req(),{},ctx),body=await first.json();
assert.equal(body.quotes.length,7);assert.equal(body.quotes[0].changePct,25);assert.equal(first.headers.get('Access-Control-Allow-Origin'),'https://edjumptw.github.io');
await Promise.all(waits);assert.equal(calls,8);
assert.equal((await worker.fetch(req(),{},ctx)).headers.get('X-Quote-Cache'),'HIT');assert.equal(calls,8);
cache=undefined;globalThis.fetch=async()=>new Response('',{status:429});
assert.equal((await worker.fetch(req(),{},ctx)).status,502);
console.log('PASS: origin/method/path restrictions, seven-symbol allowlist, quote parsing, cache and upstream failure');

const now=Date.parse('2026-11-17T02:00:00Z');
const row={c:'2330',ex:'tse',z:'100',y:'80',v:'123',tlong:String(now),a:'102_103_',b:'100_99_',trade:{z:'99'}};
assert.equal(parseTaiwan(row,now).price,100);
assert.equal(parseTaiwan(row,now).volume,123000);
assert.equal(parseTaiwan({...row,z:'-'},now).price,101);
assert.equal(parseTaiwan({...row,z:'-',a:'-'},now).price,99);
assert.equal(parseTaiwan({...row,z:'-',tlong:String(Date.parse('2026-11-17T05:30:00Z'))},Date.parse('2026-11-17T05:31:00Z')).price,99);
for(const patch of [{y:'-'},{v:'-'},{tlong:'-'},{z:'0',a:'-',trade:{}},{tlong:String(now+120000)}]) assert.throws(()=>parseTaiwan({...row,...patch},now));
cache=undefined;calls=0;
globalThis.fetch=async url=>{
  calls++;
  if(new URL(url).hostname==='mis.twse.com.tw')return Response.json({rtcode:'0000',msgArray:[{...row,tlong:String(Date.now())}]});
  return Response.json({chart:{result:[{meta:{regularMarketPrice:100,chartPreviousClose:80,regularMarketTime:Date.now()/1000,currency:String(url).includes('.TW')?'TWD':'USD'}}]}});
};
const mixed=await (await worker.fetch(req(),{},ctx)).json();
assert.equal(mixed.quotes.find(q=>q.symbol==='2330.TW').source,'TWSE');
assert.equal(mixed.quotes.filter(q=>q.source==='Yahoo Finance').length,6);
assert.equal(calls,7);
await Promise.all(waits);
for(const fail of [()=>{throw new DOMException('timeout','TimeoutError');},()=>Response.json({rtcode:'0000',msgArray:[{...row,y:'-'}]}),()=>Response.json({rtcode:'error'})]) {
 cache=undefined;
 const base=globalThis.fetch;
 globalThis.fetch=async url=>new URL(url).hostname==='mis.twse.com.tw'?fail():base(url);
 const result=await (await worker.fetch(req(),{},ctx)).json();
 assert.equal(result.quotes.length,7);assert(result.quotes.every(q=>q.source==='Yahoo Finance'));
 await Promise.all(waits);globalThis.fetch=base;
}
console.log('PASS: TWSE trades/midpoint/last trade/close, lots conversion, invalid fields, partial batch and timeout fallback');
