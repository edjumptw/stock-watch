import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const context=vm.createContext({Intl,Date,Map,Number,String,Math,document:{querySelector:()=>({})}});
vm.runInContext(readFileSync('app.js','utf8').replace(/init\(\);\s*$/,''),context);
const stock=JSON.parse(readFileSync('data/2330.TW.json'));
context.stock=stock;
const old=JSON.stringify(stock);
vm.runInContext(`quotes.set(stock.symbol,{source:'TWSE',price:2100,quoteTime:'2026-11-17T04:00:00Z'});`,context);
let result=vm.runInContext(`intraday(stock,new Date('2026-11-17T04:01:00Z'))`,context);
assert.match(result,/盤中目前價 2,100.00/);assert.match(result,/地板價|天花板價/);assert.match(result,/收盤建議不變/);
assert.match(vm.runInContext(`intraday(stock,new Date('2026-11-17T06:00:00Z'))`,context),/已收盤/);
assert.match(vm.runInContext(`intraday(stock,new Date('2026-11-21T04:00:00Z'))`,context),/已收盤/);
assert.equal(JSON.stringify(stock),old);
assert.match(vm.runInContext(`explainTerms()`,context),/乖離/);
for(const action of ['減碼','加碼','觀望','續抱','分批買進'])assert.match(vm.runInContext(`explainTerms()`,context),new RegExp(action));
vm.runInContext(`quotes.set(stock.symbol,{source:'Yahoo Finance',price:2100,quoteTime:'2026-11-17T04:00:00Z'});`,context);
assert.match(vm.runInContext('quoteLabel(stock)',context),/目前用備用報價（約延遲 20 分鐘）/);
for(const [symbol,instant,open] of [['NVDA','2026-11-17T15:00:00Z',true],['NVDA','2026-07-16T14:00:00Z',true],['NVDA','2026-11-17T22:00:00Z',false]]){
 context.us={...stock,symbol,currency:'USD'};
 vm.runInContext(`quotes.set('NVDA',{source:'Yahoo Finance',price:150,quoteTime:'${instant}'});`,context);
 assert.match(vm.runInContext(`intraday(us,new Date('${instant}'))`,context),open?/盤中目前價/:/已收盤/);
}
console.log('PASS: live position, market sessions/DST, glossary/actions, backup warning, immutable history/recommendation');
