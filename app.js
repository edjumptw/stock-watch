'use strict';
let dataLoadError=null;
const main=document.querySelector('main');
const nf=new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2,minimumFractionDigits:2});
const number=n=>nf.format(n);
const signed=n=>(n>0?'+':'')+number(n);
const tone=n=>n>0?'up':n<0?'down':'';
const dateTime=s=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s));
const volume=n=>new Intl.NumberFormat('zh-TW').format(n);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const QUOTE_URL='https://stock-watch-quotes.jumpbotofficejumpbotoffice.workers.dev/quotes';
let data,charts=[],quotes=new Map(),quoteStatus='正在讀取最新報價…',refreshing=false;
const glossary={
 '收盤價／交易日':'當天最後成交價／市場實際開市的一天，20 個交易日不含休市日',
 '均線／收盤均價':'把一段時間每天收盤價加總後取平均，讓價格方向較容易看清',
 '支撐價':'地板：跌到附近常有人買，但仍可能跌破', '壓力價':'天花板：漲到附近常有人賣，但仍可能突破',
 'MA5／5日均線':'最近 5 個交易日的平均收盤價，看短期方向',
 'MA20／月線':'最近 20 個交易日的平均收盤價，看約一個月方向',
 'MA60／季線':'最近 60 個交易日的平均收盤價，看約一季方向',
 '量比／成交量倍數':'今日成交股數除以前 20 個交易日平均；1 倍是平常水準，2 倍是兩倍',
 '成交量／量能／均量':'買賣成交的股數；量能指交易熱度，均量指平均成交股數',
 '乖離':'價格離均線多遠；正值在均線上方，負值在下方，不代表一定反轉',
 '近 20 日表現':'目前收盤價相較 20 個交易日前漲跌幾％，不是未來報酬',
 'RSI(14)／相對強弱指標':'以近 14 日漲跌力道計算 0–100 分；高於 70 可能過熱，低於 30 可能偏弱，不能單獨當買賣訊號',
 '技術面／技術指標':'用歷史價格與成交量觀察走勢，不能保證未來',
 '均線排列／均線交錯':'短期均價高於中期、中期高於長期表示近期較強；相反較弱，交錯表示方向不一致',
 '偏強／偏弱／中性':'依價格與均線判斷近期相對較強、較弱或方向不明',
 '跌破／站穩／突破':'跌到參考線下方／維持在附近或上方／漲到參考線上方；單次跨線不保證趨勢',
 '過熱／拉回／回檔／止跌':'短期漲得急／漲後回落／下跌暫停；便宜或 RSI 低不等於不會再跌',
 '部位／布局／追價／接跌':'持有的股票金額／逐步買入／漲時急買／跌時急買',
 '買賣中間價':'買方願付與賣方要價的平均，只是參考價，並非實際成交',
 '分割調整／未還原股息':'歷史價格已配合拆股換算，但沒有把現金股息加回報酬'
};
const actionHelp={'減碼':'把已持有的股票分批賣掉一部分，降低投入金額','加碼':'在原有持股上再買一些，增加投入金額','分批買進':'把預計買入金額拆成數次，不一次全買','觀望':'暫時不新增買賣，等訊號更清楚','續抱':'已有持股先繼續持有，仍要留意風險'};
function explainTerms(){return `<details class="term-help"><summary>專業名詞白話說明（點開）</summary><dl>${Object.entries({...glossary,...actionHelp}).map(([term,help])=>`<dt>${escape(term)}</dt><dd>${escape(help)}</dd>`).join('')}</dl></details>`;}
function intraday(s,now=new Date()){
 const zone=s.currency==='TWD'?'Asia/Taipei':'America/New_York';
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const minutes=Number(parts.hour)*60+Number(parts.minute),start=s.currency==='TWD'?540:570,end=s.currency==='TWD'?810:960;
 if(['Sat','Sun'].includes(parts.weekday)||minutes<start||minutes>=end)return '<p class="intraday">已收盤（依一般交易時段）</p>';
 const q=usableQuote(s);
 if(!q)return '<p class="intraday">盤中提醒：即時價暫未取得，收盤建議維持不變。</p>';
 const qp=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(q.quoteTime)).map(p=>[p.type,p.value]));
 if(['year','month','day'].some(k=>parts[k]!==qp[k]))return '<p class="intraday">已收盤或今日尚無報價（以來源交易日為準）</p>';
 const levels=[...s.recommendation.support.map(p=>({...p,type:'地板價',support:true})),...s.recommendation.resistance.map(p=>({...p,type:'天花板價',support:false}))];
 const seen=new Set();
 const position=levels.filter(p=>{if(seen.has(p.price))return false;seen.add(p.price);return true;}).map(p=>`${q.price<p.price?'低於':q.price>p.price?'高於':'正好在'}${p.type} ${number(p.price)}${Math.abs(q.price/p.price-1)<=0.01?'（接近，距離 1% 內）':''}`).join('；')||'目前沒有可比較的地板或天花板價';
 const stale=now-new Date(q.quoteTime)>5*60000?'；報價非即時，請留意時間':'';
 return `<p class="intraday">盤中目前價 ${number(q.price)} ${escape(s.currency)}（${escape(q.source)}${q.priceType==='midpoint'?'，買賣中間價':''}、台北 ${dateTime(q.quoteTime)}${stale}）：${position}。僅提示位置，收盤建議不變。</p>`;
}

function closingDate(s){
 if(s.currency!=='USD')return escape(s.date);
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(s.dateTaipei)).map(p=>[p.type,p.value]));
 return `美東 ${escape(s.date.slice(5).replace('-','/'))}（台北 ${parts.month}/${parts.day} ${parts.hour}:${parts.minute}）`;
}
function usableQuote(s){const q=quotes.get(s.symbol);if(!q)return null;if(s.currency==='TWD'){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(q.quoteTime)).map(p=>[p.type,p.value]));if(Number(parts.hour)*60+Number(parts.minute)<540)return null;}return q;}
function latestVolume(s){const q=usableQuote(s);return Number.isFinite(q?.volume)&&q.volume>0?`${volume(q.volume)} 股`:'尚未取得';}
function displayed(s){const q=usableQuote(s);return q?{...s,close:q.price,change:q.change,changePct:q.changePct,volume:Number.isFinite(q.volume)&&q.volume>0?q.volume:s.volume}:s;}
function quoteLabel(s){const q=usableQuote(s);return q?`最新報價 · ${escape(q.source ?? 'Yahoo Finance')}${q.priceType==='midpoint'?'（買賣中間價）':''}${s.currency==='TWD'&&q.source==='Yahoo Finance'?'<br><strong class="fallback-warning">目前用備用報價（約延遲 20 分鐘）</strong>':''}<br>報價時間（台北） ${dateTime(q.quoteTime)}`:`收盤資料 · ${closingDate(s)}<br>最新報價未取得，使用收盤資料`;}
function patchQuotes(){
 if(!data||location.hash==='#tools')return;
 let symbol;try{symbol=decodeURIComponent(location.hash.slice(1));}catch{return;}const stock=data.stocks.find(s=>s.symbol===symbol);
 const update=(root,s)=>{const current=displayed(s),price=root.querySelector('.price'),change=root.querySelector('.change');if(price)price.firstChild.textContent=number(current.close);if(change){change.className='change '+tone(current.change);change.textContent=`${signed(current.change)}　(${signed(current.changePct)}%)`;}const label=root.querySelector('.quote-label');if(label)label.innerHTML=quoteLabel(s);const live=root.querySelector('.latest-volume');if(live)live.textContent=latestVolume(s);const hint=root.querySelector('.intraday');if(hint)hint.outerHTML=intraday(s);};
 document.querySelectorAll('.quote-status').forEach(el=>el.textContent=quoteStatus);
 if(stock)update(main,stock);else if(!symbol){document.querySelectorAll('.stock-card').forEach((el,i)=>update(el,data.stocks[i]));const current=data.stocks.map(displayed),up=current.filter(s=>s.change>0).length,down=current.filter(s=>s.change<0).length,stats=document.querySelectorAll('.summary strong');if(stats[1])stats[1].firstChild.textContent=up;if(stats[2]){stats[2].firstChild.textContent=down;stats[2].querySelector('span').textContent=`持平 ${current.length-up-down} 檔`;}}
}
let closingRefresh=false;
async function refreshClosing(){
 if(closingRefresh||document.hidden)return;closingRefresh=true;
 try{const response=await fetch('data/index.json',{cache:'no-cache'});if(!response.ok)throw new Error('Closing HTTP '+response.status);const next=await response.json();if(!Array.isArray(next.stocks)||!next.stocks.length)throw new Error('Invalid closing data');const substantive=value=>JSON.stringify(value,(key,v)=>key==='updatedAt'?undefined:v);if(substantive(next)!==substantive(data)){data=next;Trading.setStocks(data.stocks);render(true);}}
 catch{document.querySelectorAll('.quote-status').forEach(el=>el.textContent=quoteStatus+'；收盤資料更新暫時失敗，稍後重試');}finally{closingRefresh=false;}
}
async function refreshQuotes(){
  if(refreshing||document.hidden)return;
  refreshing=true;
  try{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),16000);
    let response,payload;
    try{response=await fetch(QUOTE_URL,{signal:controller.signal,credentials:'omit',cache:'no-store'});if(!response.ok)throw new Error('Quote HTTP '+response.status);payload=await response.json();}finally{clearTimeout(timeout);}
    if(!Array.isArray(payload.quotes))throw new Error('Invalid quotes');
    const next=new Map();
    for(const q of payload.quotes){const stock=data.stocks.find(s=>s.symbol===q.symbol);if(stock&&q.currency===stock.currency&&[q.price,q.change,q.changePct].every(Number.isFinite)&&q.price>0&&Number.isFinite(Date.parse(q.quoteTime))&&Date.now()-Date.parse(q.quoteTime)<7*86400000&&Date.parse(q.quoteTime)<=Date.now()+60000)next.set(q.symbol,q);}
    quotes=next;quoteStatus=`最新報價 ${quotes.size} / ${data.stocks.length} 檔 · 每 60 秒更新；可能延遲，以報價時間為準`;
  }catch{quotes=new Map();quoteStatus='最新報價暫時無法取得，已退回收盤資料';}
  finally{refreshing=false;patchQuotes();}
}

function badge(s){return `<span class="badge ${s.bias==='偏弱'?'weak':''}">${escape(s.bias)}</span>`;}
function spark(s){const values=s.history.slice(-40).map(r=>r.close),min=Math.min(...values),max=Math.max(...values);const points=values.map((v,i)=>`${i*300/(values.length-1)},${52-(v-min)/(max-min||1)*45}`).join(' ');return `<svg class="spark" viewBox="0 0 300 58" preserveAspectRatio="none" aria-hidden="true"><path d="M0 57H300" stroke="#edf0e9"/><polyline points="${points}" fill="none" stroke="${s.change>=0?'#b96657':'#4f896d'}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;}
function recommendation(s,full=false){
  const r=s.recommendation;
  const levels=(key,label)=>`<div><h3>${label}（${escape(s.currency)}）<small class="plain-help">${key==='support'?'地板：附近常有人買，仍可能跌破':'天花板：附近常有人賣，仍可能突破'}</small></h3><ul>${r[key].map(p=>`<li><b>${number(p.price)}</b> · ${escape(p.source)}</li>`).join('')}</ul></div>`;
  return `<section class="recommendation ${full?'panel recommendation-full':'recommendation-compact'}"><h${full?'2':'3'}>下一步建議 <span class="badge">${escape(r.action)}</span></h${full?'2':'3'}><p class="plain-help">${escape(r.action)}：${escape(actionHelp[r.action]??'請參考下方說明')}</p>${intraday(s)}${explainTerms()}${full?r.reasons.map(p=>`<p>${escape(p)}</p>`).join(''):`<p>${escape(r.summary)}</p>`}${full?`<h3>要盯的價位</h3><div class="watch-levels">${levels('support','支撐價')}${levels('resistance','壓力價')}</div><p class="note">從近 20 日收盤高低點、MA20 與 MA60，依收盤價上下各取最近 1–2 個不同價位；等於收盤價僅歸一側，最低價優先歸地板、最高價歸天花板。這些是歷史參考線，並非預測目標價。</p>`:''}<p class="recommendation-date">依 ${escape(r.date)} 收盤計算</p><p class="recommendation-disclaimer">僅供參考，非投資建議</p></section>`;
}
function card(stock){const s=displayed(stock);return `<article class="stock-card"><div class="card-head"><div><h2><a class="card-link" href="#${encodeURIComponent(s.symbol)}">${escape(s.name)}</a></h2><div class="symbol">${escape(s.symbol)} · ${s.currency==='TWD'?'台股':'美股'}</div></div>${badge(s)}</div><div class="price">${number(s.close)}<small>${s.currency}</small></div><div class="change ${tone(s.change)}">${signed(s.change)}　(${signed(s.changePct)}%)</div><p class="quote-label">${quoteLabel(stock)}</p>${spark(stock)}<div class="card-bottom"><span>最新成交量<br><b class="latest-volume">${latestVolume(stock)}</b></span><span>收盤成交量<br><b>${volume(stock.volume)} 股</b></span><span>收盤日期<br><b>${closingDate(stock)}</b></span></div>${recommendation(stock)}<span class="open">查看走勢與短評 <span aria-hidden="true">↗</span></span></article>`;}
function overview(){document.title='收盤筆記 · Stock Watch';const current=data.stocks.map(displayed),up=current.filter(s=>s.change>0).length,down=current.filter(s=>s.change<0).length;main.innerHTML=`<div class="intro"><div><p class="eyebrow">DAILY MARKET JOURNAL</p><h1>盤中追蹤，收盤看脈絡。</h1><p>七檔台美股的報價與每日筆記，從數字到趨勢。</p></div><div class="update">收盤資料更新 ${dateTime(data.updatedAt)}<br>Asia/Taipei · 台股：證交所優先，失敗改用 Yahoo；美股：Yahoo，可能延遲</div></div><p class="quote-status" role="status">${escape(quoteStatus)}</p><div class="summary"><div><small>追蹤標的</small><strong>${data.stocks.length}<span>台股 ${data.stocks.filter(s=>s.currency==='TWD').length} · 美股 ${data.stocks.filter(s=>s.currency==='USD').length}</span></strong></div><div><small>報價上漲</small><strong>${up}<span>檔標的</span></strong></div><div><small>報價下跌</small><strong>${down}<span>持平 ${data.stocks.length-up-down} 檔</span></strong></div></div><div class="section-head"><h2>我的觀察清單</h2><span>漲紅跌綠 · 幣別分開顯示</span></div><div class="grid">${data.stocks.map(card).join('')}</div><p class="note">各市場交易日不同，以每張卡片日期為準。線條顯示近 40 個交易日走勢；點選卡片查看近六個月資料。</p>`;}
function chart(id,history,series,{bar=false,min,max}={}){const ctx=document.getElementById(id); charts.push(new Chart(ctx,{type:bar?'bar':'line',data:{labels:history.map(r=>r.date),datasets:series.map(([key,label,color])=>({label,data:history.map(r=>r[key]),borderColor:color,backgroundColor:bar?history.map((r,i)=>i&&r.close<history[i-1].close?'#7eaa93':'#c88477'):color,borderWidth:bar?0:1.8,pointRadius:0,tension:0,spanGaps:false}))},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{intersect:false,mode:'index'},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${bar?volume(c.parsed.y):number(c.parsed.y)}`}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:5,maxRotation:0,color:'#718075',font:{size:10},callback:function(v){return this.getLabelForValue(v).slice(5);}}},y:{min,max,grid:{color:'#edf1eb'},ticks:{includeBounds:false,color:'#718075',font:{size:10},maxTicksLimit:5,callback:v=>bar?new Intl.NumberFormat('zh-TW',{notation:'compact'}).format(v):number(v)}}}}}));}
function detail(s){const current=displayed(s);document.title=`${s.name} · 收盤筆記`;const last=s.history.at(-1);main.innerHTML=`<a class="back" href="#">← 返回觀察清單</a><div class="intro"><div><p class="eyebrow">${escape(s.symbol)} / ${s.currency==='TWD'?'TAIWAN':'UNITED STATES'}</p><h1>${escape(s.name)}</h1>${badge(s)}</div><div class="detail-price"><div class="price">${number(current.close)}<small>${s.currency}</small></div><div class="change ${tone(current.change)}">${signed(current.change)}　(${signed(current.changePct)}%)</div></div></div><p class="quote-label">${quoteLabel(s)}</p><p class="quote-status" role="status">${escape(quoteStatus)}</p><div class="detail-meta"><span>收盤日期：${closingDate(s)}${s.currency==='USD'?` · 收盤來源：${escape(s.source ?? 'Yahoo Finance')}`:''}</span><span>收盤成交量：${volume(s.volume)} 股</span><span>最後更新：${dateTime(s.updatedAt)}</span></div>${recommendation(s,true)}<section class="panel"><h2>近六個月收盤走勢</h2><div class="legend">${[['收盤','#18342b'],['MA 5','#b2914b'],['MA 20','#6899ac'],['MA 60','#b27e9f']].map(([l,c])=>`<span><i style="background:${c}"></i>${l}</span>`).join('')}</div><div class="chart-wrap"><canvas id="price-chart" role="img" aria-label="近六個月收盤價格與5、20、60日均線"></canvas></div><p class="note">${escape(s.history[0].date)} — ${escape(s.date)} · ${s.currency} · 歷史價格依股票分割調整，未還原股息</p></section><section class="panel"><h2>成交量 <small>（股）</small></h2><div class="chart-wrap small"><canvas id="volume-chart" role="img" aria-label="每日成交量柱狀圖"></canvas></div></section><section class="panel"><div class="section-head"><h2>RSI（14）</h2><span>最新 ${number(last.rsi)} · 70 / 30 參考線</span></div><div class="chart-wrap small"><canvas id="rsi-chart" role="img" aria-label="RSI十四日相對強弱指標，介於零與一百"></canvas></div></section><section class="panel analysis"><h2>每日短評 <span class="badge">規則自動產生</span></h2>${s.commentary.map(p=>`<p>${escape(p)}</p>`).join('')}</section><section class="panel"><div class="section-head"><h2>相關新聞</h2><span>Google News · 最新 ${s.news.length} 則</span></div><ul class="news">${s.news.map(n=>`<li><a href="${escape(n.url)}" target="_blank" rel="noopener noreferrer">${escape(n.title)} <span aria-hidden="true">↗</span><span class="sr-only">（另開視窗）</span></a><time datetime="${escape(n.date)}">${dateTime(n.date)}（台北）</time></li>`).join('')}</ul>${s.news.length===0?'<p>目前沒有相關新聞</p>':''}</section>`;
chart('price-chart',s.history,[['close','收盤','#18342b'],['ma5','MA 5','#b2914b'],['ma20','MA 20','#6899ac'],['ma60','MA 60','#b27e9f']],priceBounds(s.history));chart('volume-chart',s.history,[['volume','成交量','#7eaa93']],{bar:true,min:0});chart('rsi-chart',s.history.map(r=>({...r,upper:70,lower:30})),[['rsi','RSI','#806893'],['upper','70','#c2b99b'],['lower','30','#c2b99b']],{min:0,max:100});}
function priceBounds(history){
  const values=history.flatMap(r=>['close','ma5','ma20','ma60'].map(k=>r[k])).filter(Number.isFinite);
  const low=Math.min(...values),high=Math.max(...values),padding=Math.max((high-low)*0.08,high*0.01);
  return {min:Math.max(0,low-padding),max:high+padding};
}
function render(preserveScroll=false){document.querySelectorAll('.site-nav a').forEach(a=>{if(a.getAttribute('href')===(location.hash==='#tools'?'#tools':'#'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});if(location.hash==='#tools'){charts.forEach(c=>c.destroy());charts=[];Trading.render();Trading.banner();return;}Trading.leave();Trading.banner();if(!data){main.innerHTML=dataLoadError?'<h1>暫時無法讀取資料</h1><p class="error">請稍後重新整理，或至 GitHub 查看更新狀態。</p><button onclick="location.reload()">重新載入</button>':'<p role="status">正在讀取收盤資料…</p>';return;}const scroll=window.scrollY,opened=[...document.querySelectorAll('.term-help')].map(d=>d.open),focused=[...document.querySelectorAll('.term-help summary')].indexOf(document.activeElement);charts.forEach(c=>c.destroy());charts=[];let symbol;try{symbol=decodeURIComponent(location.hash.slice(1));}catch{symbol='unknown';}const stock=data.stocks.find(s=>s.symbol===symbol);if(stock)detail(stock);else if(symbol){main.innerHTML='<h1>找不到這檔股票</h1><a href="#">返回觀察清單</a>';}else overview();if(preserveScroll){document.querySelectorAll('.term-help').forEach((d,i)=>d.open=!!opened[i]);if(focused>=0)document.querySelectorAll('.term-help summary')[focused]?.focus({preventScroll:true});}window.scrollTo(0,preserveScroll?scroll:0);}
async function init(){window.addEventListener('hashchange',()=>render());if(location.hash==='#tools')Trading.render();try{const response=await fetch('data/index.json',{cache:'no-cache'});if(!response.ok)throw new Error('HTTP '+response.status);data=await response.json();Trading.setStocks(data.stocks);render();refreshQuotes();setInterval(refreshQuotes,60000);setInterval(refreshClosing,15*60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshQuotes();refreshClosing();}});}catch(error){dataLoadError=error;render();console.error(error);}}
init();
