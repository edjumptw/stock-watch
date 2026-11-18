'use strict';
(function(root){
 const fail=m=>{throw new Error(m);};
 function positive(v,label){if(v===''||v===null||v===undefined||!Number.isFinite(Number(v))||Number(v)<=0)fail(label+'請填大於 0 的數字');return Number(v);}
 function size(price,stop,risk,capital=''){price=positive(price,'買價');stop=positive(stop,'停損價');risk=positive(risk,'願虧金額');if(stop>=price)fail('停損價必須低於買價');const shares=Math.floor(risk/(price-stop));if(!Number.isSafeInteger(shares)||!Number.isFinite(shares*price))fail('金額過大，請調整輸入');return {shares,lots:Math.floor(shares/1000),odd:shares%1000,total:shares*price,ratio:capital===''?null:shares*price/positive(capital,'總資金')*100};}
 const today=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)fail('請填有效日期');return v;}
 function shares(v){v=positive(v,'股數');if(!Number.isSafeInteger(v))fail('股數請填整數');return v;}
 const remaining=t=>t.shares-t.sales.reduce((n,s)=>n+s.shares,0);
 const pnl=(t,s)=>(s.price-t.price)*s.shares;
 function validate(raw){
  if(!raw||raw.version!==1||!Array.isArray(raw.trades)||raw.trades.length>10000||!raw.settings)fail('JSON 格式或版本不正確');
  const s=raw.settings,settings={capital:s.capital===''?'':positive(s.capital,'總資金'),ratio:positive(s.ratio,'投入比例'),week:s.week===''?'':positive(s.week,'每週虧損上限'),month:s.month===''?'':positive(s.month,'每月虧損上限')};if(settings.ratio>100)fail('投入比例不可超過 100%');
  const ids=new Set();const trades=raw.trades.map(t=>{
   if(!t||typeof t.id!=='string'||ids.has(t.id)||!t.id||!Array.isArray(t.sales))fail('交易識別碼或賣出資料不正確');ids.add(t.id);
   const text=(v,label)=>{if(typeof v!=='string'||!v.trim()||v.length>5000)fail(label+'不可空白或超過 5000 字');return v.trim();};
   const r={id:t.id,date:date(t.date),stock:text(t.stock,'股票'),price:positive(t.price,'買價'),shares:shares(t.shares),reason:text(t.reason,'買進理由'),stop:positive(t.stop,'停損價'),sales:[]};if(r.stop>=r.price)fail('停損價必須低於買價');
   r.sales=t.sales.map(s=>{const v={date:date(s.date),price:positive(s.price,'賣價'),shares:shares(s.shares),review:text(s.review,'檢討')};if(v.date<r.date)fail('賣出日期不可早於買進日期');return v;});if(remaining(r)<0)fail('賣出股數不可超過持股');return r;
  });return {version:1,settings,trades};
 }
 function stats(trades,now=new Date()){
  const end=today(now),d=new Date(end+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const starts={week:d.toISOString().slice(0,10),month:end.slice(0,7)+'-01'};
  return Object.fromEntries(Object.entries(starts).map(([key,start])=>{let net=0,loss=0;for(const t of trades)for(const s of t.sales)if(s.date>=start&&s.date<=end){const v=pnl(t,s);net+=v;loss+=Math.max(0,-v);}return [key,{net,loss,start,end}];}));
 }
 const brakes=(stat,settings)=>['week','month'].filter(k=>settings[k]!==''&&stat[k].loss>=Number(settings[k]));
 const api={size,today,date,positive,shares,remaining,pnl,validate,stats,brakes};if(typeof module!=='undefined')module.exports=api;else root.TradingCore=api;
})(globalThis);
