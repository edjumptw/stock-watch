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

// Exercise the existing UI handlers without adding a DOM dependency.
function tradingHarness(raw){
 const elements=new Map();let html='',download,blob;
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',disabled:false,addEventListener(type,fn){this[type]=fn;},querySelectorAll(){return [];},classList:{toggle(){}},focus(){},insertAdjacentHTML(_,text){this.innerHTML+=text;}});return elements.get(id);};
 const main={set innerHTML(value){html=value;},get innerHTML(){return html;}};
 const ctx=vm.createContext({Intl,Date,Map,Number,String,Math,JSON,crypto:{},location:{hash:'#tools'},window:{addEventListener(){}},localStorage:{getItem:()=>raw,setItem(){}},document:{querySelector:()=>main,getElementById:element,createElement:()=>({click(){download=this.download;}})},Blob,URL:{createObjectURL(value){blob=value;return 'blob:test';},revokeObjectURL(){}},setTimeout(){}});
 vm.runInContext(readFileSync('trading-core.js','utf8')+'\n'+readFileSync('trading.js','utf8')+'\nTrading.render();',ctx);
 return {ctx,element,main,export:async()=>{element('trade-export').onclick();return {text:await blob.text(),download};},submit:id=>element(id).submit({preventDefault(){}})};
}
for(const raw of ['{broken',JSON.stringify({version:999}), '']){
 const h=tradingHarness(raw),backup=await h.export();
 assert.equal(backup.text,raw);assert.match(backup.download,/原始備份/);
 assert.match(h.main.innerHTML,/id="trade-message" class="error"/);
 assert.match(h.element('trade-message').textContent,/損壞資料的原始備份/);
}
const h=tradingHarness(null);
assert.equal(JSON.parse((await h.export()).text).trades.length,0);
for(const [before,next,expected] of [['','1000','1000'],['1000','2000','2000'],['777','3000','777']]){
 h.element('calc-capital').value=before;
 for(const [id,value] of [['set-capital',next],['set-ratio','20'],['set-week',''],['set-month','']])h.element(id).value=value;
 h.submit('trade-settings');assert.equal(String(h.element('calc-capital').value),expected);
}
for(const [risk,capital,pattern] of [['1','1000',/無法買進至少 1 股/],['100','100',/超過總資金/],['100','1000',/超過單檔警戒比例/]]){
 for(const [id,value] of [['calc-price','100'],['calc-stop','90'],['calc-risk',risk],['calc-capital',capital]])h.element(id).value=value;
 h.submit('trade-calc');assert.match(h.element('calc-result').textContent,pattern);
}
// A failed initial fetch on #tools must remain visible after returning home.
const main={innerHTML:''};
const failed=vm.createContext({Intl,Date,Map,Number,String,Math,console:{error(){}},location:{hash:'#tools'},window:{addEventListener(){}},document:{querySelector:()=>main,querySelectorAll:()=>[]},Trading:{render(){},banner(){},leave(){}},fetch:async()=>{throw new Error('offline');}});
vm.runInContext(readFileSync('app.js','utf8').replace(/init\(\);\s*$/,''),failed);
await vm.runInContext('init()',failed);
vm.runInContext("location.hash='';render()",failed);
assert.match(main.innerHTML,/暫時無法讀取資料/);assert.match(main.innerHTML,/重新載入/);
console.log('PASS: raw damaged backups, initial error style, capital sync, sizing warnings, failed tools-to-home navigation');
