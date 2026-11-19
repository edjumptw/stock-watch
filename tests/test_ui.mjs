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
 const ctx=vm.createContext({Intl,Date,Map,Number,String,Math,JSON,crypto:{},location:{hash:'#tools'},window:{addEventListener(type,fn){this[type]=fn;}},localStorage:{getItem:()=>raw,setItem(){}},document:{querySelector:()=>main,getElementById:element,createElement:()=>({click(){download=this.download;}})},Blob,URL:{createObjectURL(value){blob=value;return 'blob:test';},revokeObjectURL(){}},setTimeout(){}});
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

for(const [day,instant,expected] of [['2026-11-18','2026-11-18T21:00:00Z','美東 11/18（台北 11/19 05:00）'],['2026-07-16','2026-07-17T04:00:00+08:00','美東 07/16（台北 07/17 04:00）']]){
 context.dated={currency:'USD',date:day,dateTaipei:instant};assert.equal(vm.runInContext('closingDate(dated)',context),expected);
}
context.dated={currency:'TWD',date:'2026-11-18'};assert.equal(vm.runInContext('closingDate(dated)',context),'2026-11-18');
for(const amount of [0,null,undefined]){context.amount=amount;vm.runInContext(`quotes.set(stock.symbol,{price:2000,volume:amount,quoteTime:'2026-11-17T02:00:00Z'});`,context);assert.equal(vm.runInContext('displayed(stock).volume',context),stock.volume);assert.equal(vm.runInContext('latestVolume(stock)',context),'尚未取得');}
vm.runInContext(`quotes.set(stock.symbol,{price:2000,volume:123,quoteTime:'2026-11-17T00:45:00Z'});`,context);assert.equal(vm.runInContext('displayed(stock).close',context),stock.close);
// Simulate edit/delete handlers: rejected edits and cancelled deletion retain original data.
const fixture={version:1,settings:{capital:'',ratio:20,week:'',month:''},trades:[{id:'t',date:'2026-01-01',stock:'Test',price:100,stop:90,shares:100,reason:'original',sales:[{date:'2026-01-02',price:110,shares:10,review:'old'}]}]};
const edits=tradingHarness(JSON.stringify(fixture));
edits.ctx.window.confirm=()=>false;
edits.element('delete-edit-buy-0').onclick();assert.equal(JSON.parse((await edits.export()).text).trades.length,1);
for(const [key,value] of Object.entries({date:'2026-01-01',stock:'Changed',price:'100',shares:'100',stop:'110',reason:'new'}))edits.element('edit-buy-0-'+key).value=value;
edits.submit('edit-buy-0');assert.equal(JSON.parse((await edits.export()).text).trades[0].stock,'Test');
edits.element('edit-buy-0-stop').value='80';edits.submit('edit-buy-0');assert.equal(JSON.parse((await edits.export()).text).trades[0].stock,'Changed');
for(const [key,value] of Object.entries({date:'2026-01-02',price:'120',shares:'20',review:'changed'}))edits.element('edit-sale-0-0-'+key).value=value;
edits.submit('edit-sale-0-0');assert.equal(JSON.parse((await edits.export()).text).trades[0].sales[0].review,'changed');
edits.element('edit-sale-0-0-shares').value='101';edits.submit('edit-sale-0-0');assert.equal(JSON.parse((await edits.export()).text).trades[0].sales[0].shares,20);
edits.ctx.window.confirm=()=>true;edits.element('delete-edit-sale-0-0').onclick();assert.equal(JSON.parse((await edits.export()).text).trades[0].sales.length,0);
edits.element('delete-edit-buy-0').onclick();assert.equal(JSON.parse((await edits.export()).text).trades.length,0);
console.log('PASS: closing labels/DST, zero volume and pre-open guards, validated edits, deletions and cancellation');
// Future dates remain valid but require explicit confirmation before persisting.
const futureEdits=tradingHarness(JSON.stringify(fixture));let prompts=0;
futureEdits.ctx.window.confirm=text=>{prompts++;assert.match(text,/未來日期/);assert.match(text,/該日才會計入/);return false;};
for(const [key,value] of Object.entries({date:'2099-01-01',price:'120',shares:'20',review:'future'}))futureEdits.element('edit-sale-0-0-'+key).value=value;
futureEdits.submit('edit-sale-0-0');assert.equal(prompts,1);assert.equal(JSON.parse((await futureEdits.export()).text).trades[0].sales[0].date,'2026-01-02');assert.equal(futureEdits.element('edit-sale-0-0-review').value,'future');
futureEdits.ctx.window.confirm=()=>true;futureEdits.submit('edit-sale-0-0');assert.equal(JSON.parse((await futureEdits.export()).text).trades[0].sales[0].date,'2099-01-01');
// A quote refresh may patch DOM but must never call render or destroy charts.
const liveContext=vm.createContext({Intl,Date,Map,Set,Number,String,Math,JSON,AbortController,setTimeout,clearTimeout,location:{hash:'#NVDA'},document:{hidden:false,querySelector:()=>({}),querySelectorAll:()=>[]},fetch:async()=>({ok:true,json:async()=>({quotes:[]})})});
vm.runInContext(readFileSync('app.js','utf8').replace(/init\(\);\s*$/,''),liveContext);
liveContext.fixture=JSON.parse(readFileSync('data/index.json'));
vm.runInContext(`data=fixture;render=()=>{throw new Error('Unexpected full render')};patchQuotes=()=>{};charts=[{destroy(){throw new Error('Unexpected destroy')}}]`,liveContext);
await vm.runInContext('refreshQuotes()',liveContext);
// Count renders explicitly: refreshClosing catches render exceptions internally.
vm.runInContext('let renders=0;render=()=>renders++',liveContext);
liveContext.Trading={setStocks(stocks){liveContext.updatedStocks=stocks;}};
const originalData=vm.runInContext('data',liveContext);
liveContext.fetch=async()=>({ok:true,json:async()=>({...liveContext.fixture,updatedAt:'2099-01-01T00:00:00Z',stocks:liveContext.fixture.stocks.map(s=>({...s,updatedAt:'2099-01-01T00:00:00Z'}))})});
await vm.runInContext('refreshClosing()',liveContext);
assert.equal(vm.runInContext('renders',liveContext),0);
assert.equal(vm.runInContext('data',liveContext),originalData);
const changedData={...liveContext.fixture,stocks:liveContext.fixture.stocks.map((s,i)=>i===0?{...s,close:s.close+1}:s)};
liveContext.fetch=async()=>({ok:true,json:async()=>changedData});
await vm.runInContext('refreshClosing()',liveContext);
assert.equal(vm.runInContext('renders',liveContext),1);
assert.equal(vm.runInContext('data',liveContext),changedData);
assert.equal(liveContext.updatedStocks,changedData.stocks);
liveContext.fetch=async()=>{throw new Error('offline');};await vm.runInContext('refreshClosing()',liveContext);
assert.equal(vm.runInContext('data',liveContext),changedData);
assert.equal(vm.runInContext('renders',liveContext),1);
console.log('PASS: future-date confirm/cancel, quote refresh retains charts, closing refresh render counts and data identity, offline data retained');

// Route-away detaches the original nodes and restores them with their listeners/state.
const draft=tradingHarness(null),node={marker:'original-tools-dom'};let restored;
draft.main.childNodes=[node];draft.ctx.document.createDocumentFragment=()=>({nodes:[],append(...nodes){this.nodes.push(...nodes);draft.main.childNodes=[];}});
draft.main.replaceChildren=fragment=>{restored=fragment.nodes;draft.main.childNodes=fragment.nodes;};
draft.element('buy-reason').value='unsaved';draft.element('calc-result').textContent='calculated';draft.element('sell-review-0').value='draft review';
vm.runInContext('Trading.leave()',draft.ctx);assert.equal(draft.main.childNodes.length,0);
vm.runInContext('Trading.render()',draft.ctx);assert.equal(restored[0],node);assert.equal(draft.element('buy-reason').value,'unsaved');assert.equal(draft.element('calc-result').textContent,'calculated');assert.equal(draft.element('sell-review-0').value,'draft review');
console.log('PASS: route-away detaches and restores the same tools DOM nodes');

// Old handlers must resolve trades by ID after another tab reorders the list.
const other={...fixture.trades[0],id:'other',stock:'Other',sales:[]};
const reordered={...fixture,trades:[other,fixture.trades[0]]};
const storageUpdate=(h,state)=>h.ctx.window.storage({key:'stock-watch-trading-v1',newValue:JSON.stringify(state)});
const stale=tradingHarness(JSON.stringify(fixture));
storageUpdate(stale,reordered);
for(const [key,value] of Object.entries({date:'2026-01-01',stock:'By ID',price:'100',shares:'100',stop:'80',reason:'updated'}))stale.element('edit-buy-0-'+key).value=value;
stale.submit('edit-buy-0');
let saved=JSON.parse((await stale.export()).text);
assert.equal(saved.trades[0].stock,'Other');assert.equal(saved.trades[1].stock,'By ID');
const staleDelete=tradingHarness(JSON.stringify(fixture));storageUpdate(staleDelete,reordered);staleDelete.ctx.window.confirm=()=>true;
staleDelete.element('delete-edit-buy-0').onclick();
assert.deepEqual(JSON.parse((await staleDelete.export()).text).trades.map(t=>t.id),['other']);
const missing=tradingHarness(JSON.stringify(fixture));storageUpdate(missing,{...fixture,trades:[other]});missing.ctx.window.confirm=()=>true;
missing.element('delete-edit-buy-0').onclick();assert.match(missing.element('trade-message').textContent,/請重新整理/);
for(const [key,value] of Object.entries({date:'2026-01-01',stock:'Wrong',price:'100',shares:'100',stop:'80',reason:'updated'}))missing.element('edit-buy-0-'+key).value=value;
missing.submit('edit-buy-0');assert.match(missing.element('edit-buy-0-message').textContent,/請重新整理/);
assert.deepEqual(JSON.parse((await missing.export()).text).trades.map(t=>t.id),['other']);
// Sales have no IDs in version 1: reject a stale sale index when that list changes.
const staleSale=tradingHarness(JSON.stringify(fixture));
const newSales=[{date:'2026-01-03',price:120,shares:5,review:'other tab'},...fixture.trades[0].sales];
storageUpdate(staleSale,{...fixture,trades:[{...fixture.trades[0],sales:newSales}]});staleSale.ctx.window.confirm=()=>true;
staleSale.element('delete-edit-sale-0-0').onclick();assert.match(staleSale.element('trade-message').textContent,/請重新整理/);
for(const [key,value] of Object.entries({date:'2026-01-02',price:'120',shares:'20',review:'stale'}))staleSale.element('edit-sale-0-0-'+key).value=value;
staleSale.submit('edit-sale-0-0');assert.match(staleSale.element('edit-sale-0-0-message').textContent,/請重新整理/);
assert.deepEqual(JSON.parse((await staleSale.export()).text).trades[0].sales,newSales);
console.log('PASS: cross-tab edits/deletions follow trade IDs, missing trades and stale sale indices rejected');

// Exercise the real patchQuotes against card nodes, retaining closing volume.
const nodes={'.price':{firstChild:{textContent:'old'}},'.change':{},'.quote-label':{},'.latest-volume':{textContent:'old'},'.closing-volume':{textContent:'closing volume unchanged'}};
const card={querySelector:selector=>nodes[selector]??null};
const patchContext=vm.createContext({Intl,Date,Map,Set,Number,String,Math,JSON,location:{hash:''},document:{querySelector:()=>({}),querySelectorAll:selector=>selector==='.stock-card'?[card]:[]}});
vm.runInContext(readFileSync('app.js','utf8').replace(/init\(\);\s*$/,''),patchContext);
patchContext.stock=stock;
vm.runInContext(`data={stocks:[stock]};quotes.set(stock.symbol,{price:2100,change:10,changePct:0.5,volume:123456,source:'TWSE',quoteTime:'2026-11-17T02:00:00Z'});patchQuotes()`,patchContext);
assert.equal(nodes['.price'].firstChild.textContent,'2,100.00');
assert.equal(nodes['.latest-volume'].textContent,'123,456 股');
assert.equal(nodes['.closing-volume'].textContent,'closing volume unchanged');
assert.match(nodes['.change'].textContent,/\+10.00/);assert.match(nodes['.quote-label'].innerHTML,/TWSE/);
vm.runInContext(`quotes.get(stock.symbol).volume=0;patchQuotes()`,patchContext);
assert.equal(nodes['.latest-volume'].textContent,'尚未取得');
assert.equal(nodes['.closing-volume'].textContent,'closing volume unchanged');
assert.equal(vm.runInContext('data.stocks[0].volume',patchContext),stock.volume);
console.log('PASS: real patchQuotes updates card price/latest volume and retains closing volume');
