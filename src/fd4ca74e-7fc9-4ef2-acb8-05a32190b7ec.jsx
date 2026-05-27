// ════════════════════════════════════════════════════════════════════
// Dashboard — comprehensive redesign v2
// Overview(4-stock) · Chart(VP+RSI+MACD) · Technical · Financials
// Deep Dive(narrative) · News(hub+live) · Risk · Quant(expanded)
// ════════════════════════════════════════════════════════════════════

const { useState: dsUseState, useMemo: dsUseMemo, useEffect: dsUseEffect, useRef: dsUseRef } = React;

// ── Number / market-cap formatting ───────────────────────────────
// Consistent presentation across the dashboard: "5.73T" → "5.73 T".
// Accepts strings like "5.73T", "728.5B", "1.01T", "$2.17T" or a raw number.
function fmtMcap(v){
  if(v==null) return '—';
  if(typeof v==='number'){
    const abs=Math.abs(v);
    if(abs>=1e12) return (v/1e12).toFixed(2)+' T';
    if(abs>=1e9)  return (v/1e9 ).toFixed(1)+' B';
    if(abs>=1e6)  return (v/1e6 ).toFixed(1)+' M';
    return v.toFixed(0);
  }
  const m=String(v).match(/^\s*(\$)?\s*([\d.,]+)\s*([KMBTkmbt])\s*$/);
  if(!m) return v;
  const sign=m[1]||'';
  return sign+m[2]+' '+m[3].toUpperCase();
}
window.fmtMcap=fmtMcap;

// ── Dashboard-specific responsive styles ─────────────────────────
(function injectDashResponsive(){
  if(document.getElementById('gt-dash-responsive')) return;
  const s=document.createElement('style');
  s.id='gt-dash-responsive';
  s.textContent=`
    /* ── Tab bar scroll on small screens ── */
    @media (max-width: 900px) {
      .gt-tabs-row { overflow-x: auto; -webkit-overflow-scrolling: touch;
        scrollbar-width: none; padding-bottom: 2px; }
      .gt-tabs-row::-webkit-scrollbar { display: none; }
    }
    @media (max-width: 768px) {
      .gt-dash-grid  { grid-template-columns: 1fr !important; }
      .gt-dash-rail  { border-right: none !important; border-top: 1px dashed rgba(255,255,255,.08) !important; }
      .gt-kpi-grid   { grid-template-columns: repeat(2, 1fr) !important; }
      .gt-quote-name { font-size: 48px !important; }
      .gt-quote-px   { font-size: 28px !important; }
      .gt-quote-head { padding: 18px 16px 0 !important; }
      .gt-dash-main  { padding: 16px 14px !important; }
      .gt-dash-rail  { padding: 16px 14px !important; }
      .gt-quote-meta { gap: 10px !important; }
      .gt-signals-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .gt-fin-toggle  { flex-wrap: wrap !important; }
    }
    @media (max-width: 480px) {
      .gt-kpi-grid   { grid-template-columns: 1fr !important; }
      .gt-quote-name { font-size: 38px !important; }
      .gt-signals-grid { grid-template-columns: 1fr !important; }
    }

    /* ── Deep Dive readability helpers ── */
    .gt-dd-takeaways {
      display: grid; gap: 8px;
      padding: 14px 16px 16px;
      background: linear-gradient(135deg, rgba(139,92,246,.08), rgba(34,211,238,.05));
      border: 1px solid rgba(139,92,246,.25);
      border-left: 3px solid #8b5cf6;
      margin-bottom: 18px;
    }
    .gt-dd-takeaways-title {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 9px; letter-spacing: 1.4px; color: #c7baff;
      font-weight: 700; text-transform: uppercase;
    }
    .gt-dd-bullet {
      display: grid; grid-template-columns: 16px 1fr; gap: 10px;
      font-size: 13px; color: #eef0ff; line-height: 1.55;
    }
    .gt-dd-bullet::before { content: none; }
    .gt-dd-bullet-marker {
      color: #22d3ee; font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-weight: 700; line-height: 1.55;
    }
    .gt-dd-body p {
      font-size: 13px; color: #eef0ff; line-height: 1.7;
      letter-spacing: 0.1px; margin: 0 0 12px 0;
    }
    .gt-dd-body p:last-child { margin-bottom: 0; }
    .gt-key {
      color: #c7baff; font-weight: 700;
      background: rgba(139,92,246,.10);
      padding: 1px 5px; border-radius: 3px;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 0.92em; letter-spacing: 0.3px;
    }
    .gt-tkr {
      color: #22d3ee; font-weight: 700;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      letter-spacing: 1px;
    }
    .gt-metric {
      color: #34d399; font-weight: 700;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
    }
    .gt-metric-down { color: #fb7185; font-weight: 700;
      font-family: 'JetBrains Mono', ui-monospace, monospace; }

    /* ── Mixed-media grid utility ── */
    .gt-mixed-grid {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 18px;
      align-items: start;
    }
    @media (max-width: 760px) {
      .gt-mixed-grid { grid-template-columns: 1fr; }
    }
    .gt-mixed-card {
      padding: 12px 14px;
      background: rgba(255,255,255,.02);
      border: 1px solid rgba(255,255,255,.08);
      border-left: 2px solid #22d3ee;
    }
    .gt-mixed-card-label {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 9px; color: #8b95b8; letter-spacing: 1.2px;
      text-transform: uppercase; margin-bottom: 6px;
    }

    /* ── Live tick pulse ── */
    @keyframes gtPxPulse {
      0%   { text-shadow: 0 0 0 transparent; }
      40%  { text-shadow: 0 0 14px currentColor; }
      100% { text-shadow: 0 0 0 transparent; }
    }
    .gt-px-pulse { animation: gtPxPulse 1.2s ease-out; }

    /* ── Refactor: top ticker row (NVDA · AMD · MU · TSM) — uniform grid ── */
    .gt-ticker-row {
      display: grid !important;
      grid-template-columns: repeat(4, minmax(0,1fr)) !important;
      gap: 14px !important;
      flex-wrap: nowrap !important;
      min-width: 480px;
    }
    .gt-ticker-row > button {
      display: grid !important;
      grid-template-rows: auto auto !important;
      align-items: start !important;
      gap: 6px !important;
      padding: 12px 14px 14px !important;
      min-width: 0 !important;
    }
    @media (max-width: 900px) {
      .gt-ticker-row { grid-template-columns: repeat(2, minmax(0,1fr)) !important; min-width: 0; }
    }

    /* ── Refactor: ticker card price/% baseline alignment ── */
    .gt-tk-line2 {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }

    /* ── Refactor: Status dots (Bullish / Bearish / Neutral) ── */
    .gt-dot {
      display: inline-block;
      width: 9px; height: 9px;
      border-radius: 50%;
      flex-shrink: 0;
      vertical-align: middle;
    }
    .gt-dot-bull { background: #34d399; box-shadow: 0 0 9px rgba(52,211,153,.8); }
    .gt-dot-bear { background: #fb7185; box-shadow: 0 0 9px rgba(251,113,133,.8); }
    .gt-dot-neut { background: #fbbf24; box-shadow: 0 0 9px rgba(251,191,36,.7); }
    @keyframes gtDotPulse {
      0%,100% { transform: scale(1);   opacity: 1; }
      50%     { transform: scale(.78); opacity: .55; }
    }
    .gt-dot-live { animation: gtDotPulse 1.8s ease-in-out infinite; }

    /* ── Refactor: tab active glow (boosted) ── */
    .gt-tab-active {
      text-shadow: 0 0 14px currentColor, 0 0 28px currentColor !important;
    }
    .gt-tab-active::after {
      content: '';
      position: absolute;
      left: 8%; right: 8%; bottom: -1px;
      height: 2px; border-radius: 1px;
      background: currentColor;
      box-shadow: 0 0 10px currentColor, 0 0 18px currentColor;
    }

    /* ── Refactor: neon growth (financials) ── */
    .gt-grow-up   { color: #34d399; text-shadow: 0 0 10px rgba(52,211,153,.55); font-weight: 700; }
    .gt-grow-down { color: #fb7185; text-shadow: 0 0 10px rgba(251,113,133,.55); font-weight: 700; }

    /* ── Refactor: scenario progress bar (Bull/Base/Bear) ── */
    .gt-scn-bar {
      height: 9px;
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.07);
      border-radius: 100px;
      position: relative;
      overflow: hidden;
    }
    .gt-scn-bar-fill {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      border-radius: 100px;
      transition: width .9s cubic-bezier(.4,0,.2,1);
    }
    .gt-scn-bar-fill.bull { background: linear-gradient(90deg, rgba(52,211,153,.4), #34d399); box-shadow: 0 0 12px rgba(52,211,153,.55); }
    .gt-scn-bar-fill.base { background: linear-gradient(90deg, rgba(34,211,238,.4), #22d3ee);  box-shadow: 0 0 12px rgba(34,211,238,.55); }
    .gt-scn-bar-fill.bear { background: linear-gradient(90deg, rgba(251,113,133,.4), #fb7185); box-shadow: 0 0 12px rgba(251,113,133,.55); }

    /* ── Hide benign cross-origin "Script error." sink (TradingView iframe) ── */
    #__bundler_err { display: none !important; }

    /* ── Refactor: stock card alignment (Overview 4-card grid) ── */
    .gt-stk-card {
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      gap: 10px;
    }
    .gt-stk-head {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: start;
    }
    .gt-stk-name {
      color: rgba(199,186,255,.85) !important;  /* IMPROVED CONTRAST */
      font-size: 10.5px;
      line-height: 1.35;
      letter-spacing: 0.15px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .gt-stk-spark {
      position: relative;
      width: 100%;
    }
    .gt-stk-spark-label {
      position: absolute;
      top: 2px; right: 2px;
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 8px;
      letter-spacing: 1.3px;
      color: rgba(160,172,200,.7);
      text-transform: uppercase;
      background: rgba(10,14,28,.55);
      padding: 1px 5px;
      border-radius: 3px;
      pointer-events: none;
    }
  `;
  document.head.appendChild(s);
})();

const TABS = ['Overview','Chart','Technical','Financials','Deep Dive','News','Risk & Scenario','Quant Model'];

// ── Live clock ───────────────────────────────────────────────────
function useLiveClock(tz='America/New_York') {
  const [now, setNow] = dsUseState(()=>new Date());
  dsUseEffect(()=>{
    const id=setInterval(()=>setNow(new Date()),1000);
    return()=>clearInterval(id);
  },[]);
  try {
    return new Intl.DateTimeFormat('en-US',{timeZone:tz,hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(now);
  } catch(e){ return now.toLocaleTimeString('en-US',{hour12:false}); }
}

function isInSession(tz,open,close){
  try{
    const now=new Date();
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',hour12:false,hour:'2-digit',minute:'2-digit'}).formatToParts(now);
    const wd=parts.find(p=>p.type==='weekday')?.value;
    if(wd==='Sat'||wd==='Sun') return false;
    const h=+parts.find(p=>p.type==='hour').value;
    const m=+parts.find(p=>p.type==='minute').value;
    const cur=h*60+m;
    const [oh,om]=open.split(':').map(Number);
    const [ch,cm]=close.split(':').map(Number);
    return cur>=oh*60+om&&cur<=ch*60+cm;
  }catch(e){return false;}
}

function LiveClock({tz,label,open,close}){
  const t=useLiveClock(tz);
  const on=isInSession(tz,open,close);
  return(
    <span style={{display:'inline-flex',alignItems:'baseline',gap:5,fontFamily:GT.fontMono,fontSize:10,color:'rgba(160,172,200,.92)'}}>
      <span style={{display:'inline-block',width:5,height:5,borderRadius:'50%',background:on?GT.green:'rgba(160,172,200,.5)',boxShadow:on?`0 0 5px ${GT.green}`:'none'}}/>
      <span style={{color:on?GT.text:'rgba(180,192,218,.95)',fontWeight:700}}>{label}</span>
      <span style={{color:on?'rgba(210,218,235,.9)':'rgba(160,172,200,.85)'}}>{t}</span>
    </span>
  );
}

// ── Improved Tab Bar ─────────────────────────────────────────────
// Icons stripped per UX spec — text-only tabs read cleaner against the
// starfield bg. Group still drives the active-state accent color.
const TAB_META = {
  'Overview':        { group:'market' },
  'Chart':           { group:'market' },
  'Technical':       { group:'market' },
  'Financials':      { group:'fundamental' },
  'Deep Dive':       { group:'fundamental' },
  'News':            { group:'fundamental' },
  'Risk & Scenario': { group:'quant' },
  'Quant Model':     { group:'quant' },
};

const GROUP_COLORS = { market:'#8b5cf6', fundamental:'#22d3ee', quant:'#f472b6' };

function QuoteHead({t,tab,setTab}){
  const {palette,headline}=useTheme();
  const up=t.chg>=0;
  const c=up?GT.green:GT.red;
  // Pulse the price element each time a live-tick event fires.
  const [pulseKey,setPulseKey]=dsUseState(0);
  dsUseEffect(()=>{
    const onTick=()=>setPulseKey(k=>k+1);
    window.addEventListener('live-tick',onTick);
    return()=>window.removeEventListener('live-tick',onTick);
  },[]);
  return(
    <div className="gt-quote-head" style={{padding:'24px 28px 0',borderBottom:`1px dashed ${palette.edge}`}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:28,alignItems:'flex-end',paddingBottom:18}}>
        <div style={{minWidth:0}}>
          <Kicker>// {t.sym} · {t.exchange} · USD · MCAP {fmtMcap(t.mcap)}</Kicker>
          <h2 className="gt-clip-r gt-quote-name" style={{margin:'4px 0 0',fontFamily:headline,fontSize:72,fontWeight:400,lineHeight:0.95,letterSpacing:-2.5,color:GT.text}} key={'name-'+t.sym}>
            {t.display}<span style={{color:palette.b}}>.</span>
          </h2>
          <div className="gt-quote-meta" style={{display:'flex',alignItems:'baseline',gap:14,marginTop:12,flexWrap:'wrap'}}>
            <span className="gt-quote-px gt-px-pulse" style={{fontFamily:GT.fontMono,fontSize:38,fontWeight:700,color:GT.text,letterSpacing:-0.8,lineHeight:1}} key={'px-'+t.sym+'-'+pulseKey}>
              <NumberFlicker value={t.px.toFixed(2)} ms={520}/>
            </span>
            <span className="gt-px-pulse" style={{fontFamily:GT.fontMono,fontSize:14,color:c,fontWeight:700}} key={'chg-'+t.sym+'-'+pulseKey}>
              {up?'▲':'▼'} {up?'+':''}{t.chg.toFixed(2)} ({up?'+':''}{t.chgPct.toFixed(2)}%)
            </span>
            <span style={{display:'inline-flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <LiveClock tz="America/New_York" label="NY" open="09:30" close="16:00"/>
              <LiveClock tz="Europe/London" label="LDN" open="08:00" close="16:30"/>
              <LiveClock tz="Asia/Taipei" label="TPE" open="09:00" close="13:30"/>
              <span style={{fontFamily:GT.fontMono,fontSize:10,color:'rgba(160,172,200,.88)',letterSpacing:0.4}}>
                VOL {t.vol} · O {t.open} H {t.high} L {t.low}
              </span>
            </span>
            <span style={{padding:'5px 12px',background:t.rating==='BUY'?GT.green:t.rating==='HOLD'?GT.amber:GT.red,color:'#0a0e1c',fontFamily:GT.fontMono,fontSize:10,fontWeight:700,letterSpacing:1.2,borderRadius:100}}>
              {t.rating} · PT ${t.target}
            </span>
          </div>
          <div style={{marginTop:10,fontFamily:headline,fontSize:16,color:'rgba(160,172,200,.85)',fontStyle:'italic',letterSpacing:-0.1,maxWidth:680}}>
            "{t.one_liner}"
          </div>
        </div>
      </div>

      {/* Tab bar with groups */}
      <div className="gt-tabs-row" style={{display:'flex',gap:0,marginTop:2,position:'relative'}}>
        {/* Group markers */}
        {[
          {label:'MARKET',start:0,end:3,color:GROUP_COLORS.market},
          {label:'ANALYSIS',start:3,end:6,color:GROUP_COLORS.fundamental},
          {label:'QUANT',start:6,end:8,color:GROUP_COLORS.quant},
        ].map(g=>(
          <div key={g.label} style={{
            position:'absolute',top:-16,fontFamily:GT.fontMono,fontSize:8,
            color:g.color,letterSpacing:1.5,opacity:0.7,
            left:`${(g.start/TABS.length)*100}%`,
          }}>// {g.label}</div>
        ))}
        {TABS.map((x)=>{
          const meta=TAB_META[x]||{group:'market'};
          const gc=GROUP_COLORS[meta.group]||palette.a;
          const active=tab===x;
          // Inactive tab text: brighter, AA-compliant on starfield bg
          const inactiveColor='rgba(226,232,240,.82)';
          const inactiveHover='#ffffff';
          return(
            <button key={x} onClick={()=>setTab(x)} style={{
              padding:'11px 18px 12px',display:'flex',alignItems:'center',
              background:active?`rgba(${gc==='#8b5cf6'?'139,92,246':gc==='#22d3ee'?'34,211,238':'244,114,182'},.14)`:'transparent',
              border:'none',
              fontFamily:GT.fontMono,fontSize:10.5,fontWeight:active?700:600,
              letterSpacing:1.4,textTransform:'uppercase',
              color:active?gc:inactiveColor,
              borderBottom:active?`2px solid ${gc}`:'2px solid transparent',
              marginBottom:-1,cursor:'pointer',
              transition:'all .18s ease',
              position:'relative',
              textShadow:active?`0 0 14px ${gc}, 0 0 26px ${gc}80`:'none',
              boxShadow:active?`inset 0 -2px 0 0 ${gc}, 0 0 22px -10px ${gc}`:'none',
            }}
            onMouseEnter={e=>{if(!active){e.currentTarget.style.color=inactiveHover;e.currentTarget.style.background='rgba(255,255,255,.05)';}}}
            onMouseLeave={e=>{if(!active){e.currentTarget.style.color=inactiveColor;e.currentTarget.style.background='transparent';}}}
            >
              {x}
              {active&&<span style={{position:'absolute',bottom:-1,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${gc},transparent)`,opacity:0.95,boxShadow:`0 0 10px ${gc}`}}/>}
              {active&&<span style={{position:'absolute',bottom:0,left:'50%',transform:'translateX(-50%)',width:'70%',height:10,background:gc,opacity:0.12,filter:'blur(7px)',borderRadius:'50%'}}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── KPI Strip ───────────────────────────────────────────────────
function KpiStrip({t}){
  const {palette,headline}=useTheme();
  const items=[
    {l:'Revenue FY26',v:t.fundamentals.revFy,sub:t.fundamentals.revYoY,c:GT.green,accent:palette.a},
    {l:'Gross Margin',v:t.fundamentals.gm,sub:t.fundamentals.gmSub,c:GT.green,accent:palette.b},
    {l:'EPS FY26',v:t.fundamentals.eps,sub:t.fundamentals.epsYoY,c:GT.green,accent:'#f472b6'},
    {l:'P/E Forward',v:t.fundamentals.pfwd,sub:'TTM '+t.fundamentals.petm,c:GT.amber,accent:palette.a},
  ];
  return(
    <div className="gt-stagger gt-kpi-grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
      {items.map((k,i)=>(
        <div key={i} style={{background:GT.glass,backdropFilter:'blur(20px)',border:`1px solid ${palette.edge}`,padding:'18px 16px',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',left:0,right:0,top:0,height:2,background:`linear-gradient(90deg,${k.accent},transparent 70%)`}}/>
          <div style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,letterSpacing:1.4,textTransform:'uppercase'}}>// {k.l}</div>
          <div style={{fontFamily:headline,fontSize:40,fontWeight:400,color:GT.text,letterSpacing:-1.5,lineHeight:1,marginTop:8}}>
            <NumberFlicker value={k.v} ms={520+i*60} scrambleChars="0123456789.$%xKMBT"/>
          </div>
          <div style={{fontFamily:GT.fontMono,fontSize:10,color:k.c,marginTop:6,fontWeight:600,letterSpacing:0.5}}>▲ {k.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Chart computation utilities (RSI, MACD, Volume Profile)
// ════════════════════════════════════════════════════════════════════
function computeEMA(vals, period){
  const k=2/(period+1);
  let e=vals[0];
  return vals.map((v,i)=>{ if(i===0)return e; e=v*k+e*(1-k); return e; });
}

function computeRSI(candles, period=14){
  const closes=candles.map(c=>c.c);
  if(closes.length<period+2) return Array(closes.length).fill(50);
  const changes=closes.slice(1).map((v,i)=>v-closes[i]);
  const gains=changes.map(c=>Math.max(0,c));
  const losses=changes.map(c=>Math.max(0,-c));
  let ag=gains.slice(0,period).reduce((a,b)=>a+b,0)/period;
  let al=losses.slice(0,period).reduce((a,b)=>a+b,0)/period;
  const rsi=Array(period+1).fill(50);
  for(let i=period;i<changes.length;i++){
    ag=(ag*(period-1)+gains[i])/period;
    al=(al*(period-1)+losses[i])/period;
    rsi.push(al===0?100:100-100/(1+ag/al));
  }
  return rsi;
}

function computeMACD(candles){
  const closes=candles.map(c=>c.c);
  const ema12=computeEMA(closes,12);
  const ema26=computeEMA(closes,26);
  const macdLine=closes.map((_,i)=>ema12[i]-ema26[i]);
  const signal=computeEMA(macdLine,9);
  const histogram=macdLine.map((v,i)=>v-signal[i]);
  return {macdLine,signal,histogram};
}

function computeVolumeProfile(candles,buckets=24){
  const lows=candles.map(c=>c.l), highs=candles.map(c=>c.h);
  const minP=Math.min(...lows), maxP=Math.max(...highs);
  const bSize=(maxP-minP)/buckets||1;
  const profile=Array(buckets).fill(0);
  candles.forEach(c=>{
    const mid=(c.h+c.l)/2;
    const b=Math.min(buckets-1,Math.floor((mid-minP)/bSize));
    profile[b]+=1+(c.h-c.l)/bSize;
  });
  const maxV=Math.max(...profile)||1;
  return profile.map((v,i)=>({pct:v/maxV,price:minP+(i+0.5)*bSize,high:i>buckets*0.6&&v/maxV>0.7}));
}

// ── RSI Panel ────────────────────────────────────────────────────
function RSIPanel({candles,height=90}){
  const {palette}=useTheme();
  const rsi=computeRSI(candles);
  const data=rsi.slice(-Math.min(60,rsi.length));
  const n=data.length; if(n<2) return null;
  const W=600, H=height;
  const sx=(i)=>(i/(n-1))*W;
  const sy=(v)=>H-(v/100)*(H-4)-2;
  const linePts=data.map((v,i)=>`${i===0?'M':'L'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  const last=data[data.length-1];
  const rsiColor=last>70?GT.red:last<30?GT.green:GT.amber;
  return(
    <div style={{borderTop:`1px dashed ${palette.edge}`,marginTop:8,paddingTop:6}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,marginBottom:3}}>
        <span>RSI (14)</span>
        <span style={{color:rsiColor,fontWeight:700}}>{last.toFixed(1)} {last>70?'· OVERBOUGHT':last<30?'· OVERSOLD':'· NEUTRAL'}</span>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <rect x={0} y={0} width={W} height={sy(70)} fill={`${GT.red}08`}/>
        <rect x={0} y={sy(30)} width={W} height={H-sy(30)} fill={`${GT.green}08`}/>
        {[30,50,70].map((v,i)=>(
          <line key={i} x1={0} x2={W} y1={sy(v)} y2={sy(v)}
            stroke={v===50?palette.edge:v===70?GT.red:GT.green}
            strokeDasharray="2,5" strokeOpacity={0.45}/>
        ))}
        {/* Filled area under RSI */}
        <path d={linePts+` L${W},${H} L0,${H} Z`} fill={`${palette.a}12`}/>
        <path d={linePts} fill="none" stroke={palette.a} strokeWidth={1.5}/>
        {/* Current dot */}
        <circle cx={W} cy={sy(last)} r={3} fill={rsiColor}/>
        {[30,70].map((v,i)=>(
          <text key={i} x={4} y={sy(v)-3} fontSize={8} fontFamily={GT.fontMono} fill={v===70?GT.red:GT.green} opacity={0.7}>{v}</text>
        ))}
      </svg>
    </div>
  );
}

// ── MACD Panel ───────────────────────────────────────────────────
function MACDPanel({candles,height=90}){
  const {palette}=useTheme();
  const {macdLine,signal,histogram}=computeMACD(candles);
  const n2=Math.min(60,histogram.length);
  const hist=histogram.slice(-n2), ml=macdLine.slice(-n2), sig=signal.slice(-n2);
  const n=hist.length; if(n<2) return null;
  const W=600, H=height;
  const allV=[...hist,...ml,...sig].map(Math.abs);
  const maxV=Math.max(...allV)*1.15||1;
  const sy=(v)=>(H/2)-(v/maxV)*(H/2-3);
  const sx=(i)=>(i/(n-1))*W;
  const macdPts=ml.map((v,i)=>`${i===0?'M':'L'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  const sigPts=sig.map((v,i)=>`${i===0?'M':'L'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
  const barW=Math.max(2,W/n-1.5);
  const lastMacd=ml[n-1], lastSig=sig[n-1];
  const bullish=lastMacd>lastSig;
  return(
    <div style={{borderTop:`1px dashed ${palette.edge}`,marginTop:6,paddingTop:6}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,marginBottom:3}}>
        <span>MACD (12,26,9)</span>
        <span style={{color:bullish?GT.green:GT.red,fontWeight:700}}>
          {bullish?'▲ BULLISH CROSS':'▼ BEARISH CROSS'} · {Math.abs(lastMacd-lastSig).toFixed(2)}
        </span>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line x1={0} x2={W} y1={H/2} y2={H/2} stroke={palette.edge} strokeDasharray="2,4" opacity={0.6}/>
        {hist.map((v,i)=>{
          const x=sx(i); const cy=sy(v); const zero=H/2;
          const bh=Math.abs(cy-zero);
          return(<rect key={i} x={x-barW/2} y={v>=0?cy:zero} width={barW} height={Math.max(1,bh)}
            fill={v>=0?GT.green:GT.red} opacity={0.55}/>);
        })}
        <path d={macdPts} fill="none" stroke={palette.a} strokeWidth={1.5}/>
        <path d={sigPts} fill="none" stroke={palette.b} strokeWidth={1.2} strokeDasharray="3,2"/>
        <circle cx={W} cy={sy(lastMacd)} r={3} fill={palette.a}/>
        <circle cx={W} cy={sy(lastSig)} r={2.5} fill={palette.b}/>
      </svg>
      <div style={{display:'flex',gap:12,fontFamily:GT.fontMono,fontSize:8,color:GT.textDim,marginTop:3}}>
        <span>─ <span style={{color:palette.a}}>MACD</span></span>
        <span>- - <span style={{color:palette.b}}>Signal</span></span>
        <span>▮ <span style={{color:GT.green}}>Hist+</span> / <span style={{color:GT.red}}>Hist−</span></span>
      </div>
    </div>
  );
}

// ── Volume Profile (right-side vertical) ─────────────────────────
function VolumeProfilePanel({candles,height,currentPx}){
  const {palette}=useTheme();
  const profile=computeVolumeProfile(candles,24);
  const rev=[...profile].reverse();
  // Find POC (point of control — highest volume)
  const maxIdx=profile.reduce((mi,v,i)=>v.pct>profile[mi].pct?i:mi,0);
  return(
    <div style={{width:72,flexShrink:0,display:'flex',flexDirection:'column',gap:1,paddingLeft:6}}>
      <div style={{fontFamily:GT.fontMono,fontSize:7,color:GT.textDim,letterSpacing:1,textTransform:'uppercase',marginBottom:4,textAlign:'center'}}>
        VOL<br/>PROF
      </div>
      {rev.map((b,i)=>{
        const bucket=profile.length-1-i;
        const isPOC=bucket===maxIdx;
        const barColor=isPOC?palette.a:b.pct>0.65?`${palette.a}cc`:b.pct>0.35?`${palette.a}66`:`${palette.a}22`;
        return(
          <div key={i} style={{flex:1,display:'flex',alignItems:'center',position:'relative',minHeight:3}}>
            <div style={{
              height:'70%',width:`${Math.max(4,b.pct*100)}%`,
              background:barColor,
              borderRight:isPOC?`1px solid ${palette.a}`:'none',
              transition:'width .3s',
            }}/>
            {isPOC&&<span style={{position:'absolute',right:2,fontFamily:GT.fontMono,fontSize:6,color:palette.a,fontWeight:700}}>POC</span>}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Tab: Overview — 4-stock comparison + sector heatmap
// ════════════════════════════════════════════════════════════════════
function MiniSpark({spark,up,width=80,height=32,label,responsive}){
  const {palette}=useTheme();
  const n=spark.length;
  const min=Math.min(...spark), max=Math.max(...spark);
  const range=max-min||0.01;
  const pts=spark.map((v,i)=>{
    const x=(i/(n-1))*width;
    const y=height-(((v-min)/range)*(height-4))-2;
    return`${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const color=up?GT.green:GT.red;
  // When `responsive` is true the SVG fills its container width; otherwise uses
  // the explicit pixel width. viewBox keeps coordinates internally consistent.
  const svgProps=responsive
    ? {width:'100%', height, viewBox:`0 0 ${width} ${height}`, preserveAspectRatio:'none'}
    : {width, height, viewBox:`0 0 ${width} ${height}`};
  return(
    <svg {...svgProps} style={{display:'block'}}>
      <path d={pts+` L${width},${height} L0,${height} Z`} fill={`${color}18`}/>
      <path d={pts} fill="none" stroke={color} strokeWidth={1.5}
        style={{filter:`drop-shadow(0 0 3px ${color}aa)`}}/>
      {label && <text x={width-3} y={9} textAnchor="end"
        fontFamily="JetBrains Mono, ui-monospace, monospace" fontSize="7"
        letterSpacing="1.2" fill="rgba(160,172,200,.75)">{label}</text>}
    </svg>
  );
}

function StockOverviewCard({sym,active,onClick}){
  const {palette,headline}=useTheme();
  const tk=TICKERS[sym];
  const spark=SPARKS[sym]||[];
  const up=tk.chg>=0;
  const c=up?GT.green:GT.red;
  const borderC=active?palette.a:palette.edge;
  return(
    <div onClick={onClick} className="gt-stk-card" style={{
      background:active?`linear-gradient(135deg,${palette.aSoft},${palette.bSoft})`:GT.glass,
      border:`1px solid ${borderC}`,
      backdropFilter:'blur(20px)',
      padding:'20px 20px 18px',cursor:'pointer',
      transition:'all .2s',position:'relative',overflow:'hidden',
      boxShadow:active?`0 12px 30px -14px ${palette.a}`:'none',
    }}
    onMouseEnter={e=>{if(!active){e.currentTarget.style.borderColor=palette.a;e.currentTarget.style.background=palette.aSoft;}}}
    onMouseLeave={e=>{if(!active){e.currentTarget.style.borderColor=palette.edge;e.currentTarget.style.background=GT.glass;}}}
    >
      {active&&<div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${palette.a},${palette.b})`}}/>}
      {/* Row 1: ticker + price (baseline-aligned) */}
      <div className="gt-stk-head">
        <div style={{minWidth:0}}>
          <div style={{fontFamily:GT.fontMono,fontSize:15,fontWeight:700,color:active?GT.text:GT.text,letterSpacing:1.4}}>{sym}</div>
          <div className="gt-stk-name" title={tk.name}>{tk.name.split(' ').slice(0,3).join(' ')}</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontFamily:GT.fontMono,fontSize:17,fontWeight:700,color:GT.text,letterSpacing:-0.3,fontVariantNumeric:'tabular-nums'}}>${tk.px.toFixed(2)}</div>
          <div style={{display:'inline-flex',alignItems:'center',gap:5,fontFamily:GT.fontMono,fontSize:10,color:c,fontWeight:700,marginTop:3,fontVariantNumeric:'tabular-nums'}}>
            <span className={up?'gt-dot gt-dot-bull':'gt-dot gt-dot-bear'} style={{width:7,height:7}}/>
            {up?'▲ +':'▼ '}{tk.chgPct.toFixed(2)}%
          </div>
        </div>
      </div>
      {/* Row 2: sparkline — responsive width so it never overflows the card */}
      <div className="gt-stk-spark">
        <MiniSpark spark={spark.slice(-30)} up={up} width={240} height={38} responsive/>
        <span className="gt-stk-spark-label">1M TREND</span>
      </div>
      {/* Row 3: metrics — equal 4 cells */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:4}}>
        {[
          ['MCap',fmtMcap(tk.mcap)],
          ['Rating',tk.rating],
          ['P/E Fwd',tk.fundamentals.pfwd],
          ['Upside',`+${tk.upside.toFixed(1)}%`],
        ].map(([l,v],i)=>(
          <div key={i} style={{borderTop:`1px dashed ${palette.edge}`,paddingTop:6}}>
            <div style={{fontFamily:GT.fontMono,fontSize:8.5,color:'rgba(163,172,209,.85)',letterSpacing:1.1,textTransform:'uppercase'}}>{l}</div>
            <div style={{fontFamily:GT.fontMono,fontSize:11,color:i===1?(tk.rating==='BUY'?GT.green:GT.amber):GT.text,fontWeight:i===1?700:600,marginTop:2,fontVariantNumeric:'tabular-nums'}}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabOverview({t,sym,setSym}){
  const {palette,headline,density}=useTheme();
  return(
    <div style={{display:'flex',flexDirection:'column',gap:density.gap}}>
      {/* 4-stock comparison */}
      <Panel kicker="Market overview · AI chip basket" title="All 4 positions at a glance" accent={palette.a}
        right={<span style={{display:'flex',alignItems:'center',gap:6,fontFamily:GT.fontMono,fontSize:9,color:GT.green}}><span style={{width:5,height:5,borderRadius:'50%',background:GT.green,display:'inline-block'}}/>LIVE</span>}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:18}}>
          {ORDER.map(s=>(
            <StockOverviewCard key={s} sym={s} active={sym===s} onClick={()=>setSym(s)}/>
          ))}
        </div>
      </Panel>

      {/* Current stock KPIs */}
      <KpiStrip t={t}/>

      {/* Thesis for current stock */}
      <div style={{
        background:`linear-gradient(135deg,${palette.aSoft},${palette.bSoft})`,
        border:`1px solid ${palette.edge}`,padding:'24px 28px',position:'relative',overflow:'hidden',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
          <span style={{fontFamily:GT.fontMono,fontSize:9,padding:'3px 9px',borderRadius:100,background:palette.a,color:'#fff',letterSpacing:1.5,fontWeight:700}}>THESIS</span>
          <span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.green,letterSpacing:1.2,fontWeight:700}}>● CONVICTION HIGH</span>
          <span style={{marginLeft:'auto',fontFamily:GT.fontMono,fontSize:9,color:GT.textDim}}>UPDATED 25.MAY.2026</span>
        </div>
        <div style={{fontFamily:headline,fontSize:26,fontWeight:400,lineHeight:1.3,letterSpacing:-0.3,color:GT.text,maxWidth:800}}>
          {t.one_liner}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:0,marginTop:18,borderTop:`1px dashed ${palette.edge}`,paddingTop:14}}>
          {[
            ['Sector',t.sector],
            ['Analysts',`${t.analysts} covering`],
            ['12M Target',`$${t.target} (${t.upside>0?'+':''}${t.upside.toFixed(1)}%)`],
          ].map(([l,v],i)=>(
            <div key={i} style={{paddingRight:i<2?16:0,borderRight:i<2?`1px dashed ${palette.edge}`:'none',paddingLeft:i>0?16:0}}>
              <div style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,letterSpacing:1}}>{l.toUpperCase()}</div>
              <div style={{fontFamily:GT.fontMono,fontSize:12,color:GT.text,marginTop:4}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Segments + financials */}
      <div className="gt-cols-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:density.gap}}>
        <Panel kicker="Segment mix" title={`${t.sym} · Q1 FY26 revenue`} accent={palette.b}>
          <div style={{display:'flex',alignItems:'center',gap:18}}>
            <Donut segments={t.segments} size={160}/>
            <div style={{flex:1,minWidth:0}}>
              {t.segments.map((s,i)=>(
                <div key={i} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,alignItems:'center',padding:'6px 0',borderBottom:i<t.segments.length-1?`1px dashed ${palette.edge}`:'none'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:7,height:7,background:[palette.a,palette.b,'#f472b6',palette.a+'aa'][i],flexShrink:0}}/>
                    <span style={{fontSize:12,color:GT.text}}>{s.name}</span>
                  </div>
                  <span style={{fontFamily:GT.fontMono,fontSize:11,color:GT.textDim}}>{s.pct.toFixed(1)}% · ${s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel kicker="Revenue trajectory" title={`${t.sym} · quarterly`} accent={palette.a}>
          <QuarterBars data={t.quarterly} height={150} accent={palette.a}/>
        </Panel>
      </div>

      {/* Sector Heatmap */}
      <Panel kicker="Sector heatmap · TradingView" title="Semiconductor & broad-market context" accent={palette.b} right={<span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.green}}>● LIVE</span>}>
        <TradingViewHeatmap/>
      </Panel>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Tab: Chart — enhanced with Volume Profile + RSI + MACD
// ════════════════════════════════════════════════════════════════════
function TradingViewChart({sym,studies}){
  const ref=dsUseRef(null);
  dsUseEffect(()=>{
    const el=ref.current; if(!el) return;
    el.innerHTML='';
    const tvSym=(window.LIVE&&window.LIVE.tradingViewSymbols&&window.LIVE.tradingViewSymbols[sym])||sym;
    const cid='tv-'+sym+'-'+Math.random().toString(36).slice(2,6);
    const inner=document.createElement('div');
    inner.id=cid; inner.style.cssText='width:100%;height:380px';
    el.appendChild(inner);
    const s=document.createElement('script');
    s.src='https://s3.tradingview.com/tv.js'; s.async=true;
    s.onload=()=>{
      if(window.TradingView){
        new window.TradingView.widget({
          autosize:true,symbol:tvSym,interval:'D',timezone:'Etc/UTC',
          theme:'dark',style:'1',locale:'en',
          toolbar_bg:'rgba(10,14,28,0)',enable_publishing:false,
          allow_symbol_change:false,container_id:cid,
          studies:studies||['MASimple@tv-basicstudies','RSI@tv-basicstudies','MACD@tv-basicstudies'],
          backgroundColor:'rgba(10,14,28,0)',
          gridColor:'rgba(139,92,246,0.10)',
        });
      }
    };
    el.appendChild(s);
    return()=>{el.innerHTML='';};
  },[sym]);
  return<div ref={ref} style={{width:'100%',height:380}}/>;
}

function TabChart({t}){
  const {palette,density}=useTheme();
  const [showVP,setShowVP]=dsUseState(true);
  const [showRSI,setShowRSI]=dsUseState(true);
  const [showMACD,setShowMACD]=dsUseState(true);
  // Fundamental overlay toggles
  const [funds,setFunds]=dsUseState({pe:false,fcf:false,eps:false,rev:false});
  // Scenario plot toggle
  const [showScenarios,setShowScenarios]=dsUseState(true);
  const candles=dsUseMemo(()=>{
    // Use real candle data from LiveFeed if available
    if(window.CANDLES&&window.CANDLES[t.sym]&&window.CANDLES[t.sym].length>=20){
      return window.CANDLES[t.sym].slice(-80);
    }
    return gtBars(t.sym.length*13+7,80);
  },[t.sym,t.px]);
  const [tf,setTf]=dsUseState('3M');

  const toggleBtn=(label,active,onClick,col)=>(
    <button onClick={onClick} style={{
      padding:'4px 10px',borderRadius:100,fontFamily:GT.fontMono,fontSize:9,fontWeight:700,
      letterSpacing:1,cursor:'pointer',border:`1px solid ${active?(col||palette.a):palette.edge}`,
      background:active?(col?`${col}22`:palette.aSoft):'transparent',color:active?(col||palette.a):GT.textDim,
      transition:'all .15s',
    }}>{label}</button>
  );

  // Derived chart bounds for scenario overlay
  const chartMin=Math.min(...candles.map(b=>b.l));
  const chartMax=Math.max(...candles.map(b=>b.h));
  const scenarios=t.scenarios||[];
  const sceneMin=Math.min(chartMin,...scenarios.map(s=>s.px));
  const sceneMax=Math.max(chartMax,...scenarios.map(s=>s.px));

  return(
    <div style={{display:'flex',flexDirection:'column',gap:density.gap}}>
      {/* Live TradingView chart */}
      <Panel kicker={`${t.sym} · Live Chart`} title="TradingView Advanced Chart" accent={palette.a}
        right={<span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.green}}>● LIVE · RSI · MACD · EMA</span>}>
        <TradingViewChart sym={t.sym} studies={['MASimple@tv-basicstudies','RSI@tv-basicstudies','MACD@tv-basicstudies','Volume@tv-basicstudies']}/>
      </Panel>

      {/* Indicator controls + Fundamental Overlay row */}
      <div style={{display:'flex',flexDirection:'column',gap:8,padding:'10px 14px',background:GT.glass,border:`1px solid ${palette.edge}`,backdropFilter:'blur(16px)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,letterSpacing:1,marginRight:4}}>TECHNICAL</span>
          {toggleBtn('Volume Profile',showVP,()=>setShowVP(v=>!v))}
          {toggleBtn('RSI(14)',showRSI,()=>setShowRSI(v=>!v))}
          {toggleBtn('MACD',showMACD,()=>setShowMACD(v=>!v))}
          <div style={{marginLeft:'auto',display:'flex',gap:4}}>
            {['1M','3M','6M','1Y'].map(x=>(
              <button key={x} onClick={()=>setTf(x)} style={{
                padding:'3px 8px',fontFamily:GT.fontMono,fontSize:9,fontWeight:700,
                background:tf===x?palette.a:'transparent',color:tf===x?'#0a0e1c':GT.textDim,
                border:`1px solid ${tf===x?palette.a:palette.edge}`,borderRadius:4,cursor:'pointer',
              }}>{x}</button>
            ))}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',borderTop:`1px dashed ${palette.edge}`,paddingTop:8}}>
          <span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,letterSpacing:1,marginRight:4}}>FUNDAMENTAL OVERLAYS</span>
          {toggleBtn('P/E Ratio',funds.pe,()=>setFunds(f=>({...f,pe:!f.pe})),'#22d3ee')}
          {toggleBtn('Free Cash Flow',funds.fcf,()=>setFunds(f=>({...f,fcf:!f.fcf})),'#34d399')}
          {toggleBtn('EPS',funds.eps,()=>setFunds(f=>({...f,eps:!f.eps})),'#f472b6')}
          {toggleBtn('Revenue',funds.rev,()=>setFunds(f=>({...f,rev:!f.rev})),'#fbbf24')}
          <span style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
            <span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,letterSpacing:1}}>SCENARIO PLOT</span>
            {toggleBtn(showScenarios?'ON':'OFF',showScenarios,()=>setShowScenarios(v=>!v),palette.a)}
          </span>
        </div>
      </div>

      {/* Candle chart + Volume Profile */}
      <Panel kicker={`${t.sym} · OHLC · ${tf} · ${window.CANDLES&&window.CANDLES[t.sym]?'LIVE':'Simulated'}`}
        title="Candlestick + Volume Profile" accent={palette.b}
        right={<span style={{fontFamily:GT.fontMono,fontSize:10}}>O {t.open} · H {t.high} · L {t.low} · C {t.px}</span>}>
        <div style={{display:'flex',gap:0,alignItems:'stretch'}}>
          <div style={{flex:1,minWidth:0,position:'relative'}}>
            <CandleChart data={candles} ma={SPARKS[t.sym]} height={280}/>
            {/* Scenario price target overlay (Bull / Base / Bear) */}
            {showScenarios&&scenarios.length>0&&(
              <svg style={{position:'absolute',inset:0,pointerEvents:'none'}}
                width="100%" height={280} viewBox="0 0 760 280" preserveAspectRatio="none">
                {scenarios.map((s,i)=>{
                  const y=280-((s.px-sceneMin)/(sceneMax-sceneMin||1))*(280-20)-10;
                  if(y<0||y>280) return null;
                  const c=s.label==='BULL'?GT.green:s.label==='BEAR'?GT.red:palette.a;
                  return(
                    <g key={i}>
                      <line x1={0} x2={760} y1={y} y2={y}
                        stroke={c} strokeWidth={1.2} strokeDasharray="6,4" opacity={0.85}/>
                      <rect x={4} y={y-10} width={120} height={18} fill="#0a0e1c" stroke={c} strokeWidth={1}/>
                      <text x={10} y={y+3} fontFamily={GT.fontMono} fontSize={10} fontWeight={700} fill={c}>
                        {s.label} ${s.px}
                      </text>
                      <text x={130} y={y+3} fontFamily={GT.fontMono} fontSize={9} fill={c} opacity={0.85}>
                        {s.chg}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
            {/* Fundamental overlay strip — narrative-style markers under chart */}
            {(funds.pe||funds.fcf||funds.eps||funds.rev)&&(
              <div style={{display:'flex',gap:8,flexWrap:'wrap',padding:'8px 10px',marginTop:6,
                background:'rgba(255,255,255,.02)',border:`1px dashed ${palette.edge}`}}>
                <span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,letterSpacing:1}}>OVERLAY ▸</span>
                {funds.pe&&<span style={{fontFamily:GT.fontMono,fontSize:10,color:'#22d3ee',fontWeight:700}}>P/E Fwd · {t.fundamentals.pfwd}</span>}
                {funds.fcf&&<span style={{fontFamily:GT.fontMono,fontSize:10,color:GT.green,fontWeight:700}}>FCF margin · {t.fundamentals.gm}</span>}
                {funds.eps&&<span style={{fontFamily:GT.fontMono,fontSize:10,color:'#f472b6',fontWeight:700}}>EPS · {t.fundamentals.eps}</span>}
                {funds.rev&&<span style={{fontFamily:GT.fontMono,fontSize:10,color:GT.amber,fontWeight:700}}>Rev · {t.fundamentals.revFy}</span>}
              </div>
            )}
            <div style={{display:'flex',justifyContent:'space-between',fontFamily:GT.fontMono,fontSize:9,color:'rgba(160,172,200,.7)',marginTop:4}}>
              {(()=>{
                // Generate real date labels from candle timestamps if available
                if(candles.length>0&&candles[0].t){
                  const step=Math.floor(candles.length/5);
                  return [0,step,step*2,step*3,step*4,candles.length-1].map(i=>{
                    const c=candles[Math.min(i,candles.length-1)];
                    if(!c||!c.t) return <span key={i}>—</span>;
                    const d=new Date(c.t);
                    return <span key={i}>{d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>;
                  });
                }
                return [<span key={0}>FEB 21</span>,<span key={1}>MAR 12</span>,<span key={2}>MAR 28</span>,
                  <span key={3}>APR 14</span>,<span key={4}>APR 30</span>,<span key={5}>MAY 20</span>];
              })()}
            </div>
          </div>
          {showVP&&<VolumeProfilePanel candles={candles} height={280} currentPx={t.px}/>}
        </div>

        {/* RSI + MACD oscillators */}
        {showRSI&&<RSIPanel candles={candles} height={88}/>}
        {showMACD&&<MACDPanel candles={candles} height={88}/>}
      </Panel>

      {/* Volume histogram (time-based) */}
      <div className="gt-cols-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:density.gap}}>
        <Panel kicker="Volume · time series" title="Daily volume bars" accent={palette.b}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(40,1fr)',gap:1.5,alignItems:'end',height:90}}>
            {Array.from({length:40}).map((_,i)=>{
              const h=20+((i*17)%80);
              const up=(i+t.sym.length)%3!==0;
              return<div key={i} style={{height:h+'%',background:up?GT.green:GT.red,opacity:0.55}}/>;
            })}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontFamily:GT.fontMono,fontSize:8,color:GT.textDim,marginTop:4}}>
            <span>4W AGO</span><span>2W AGO</span><span>NOW</span>
          </div>
        </Panel>
        <Panel kicker="Bollinger Bands · ATR" title="Volatility overlay" accent="#f472b6">
          <div style={{position:'relative',height:90}}>
            <svg width="100%" height={90} viewBox="0 0 600 90" preserveAspectRatio="none">
              {/* Upper band */}
              <path d={SPARKS[t.sym].slice(0,60).map((v,i)=>`${i===0?'M':'L'}${(i/59)*600},${90-(v*0.5+0.3)*80}`).join(' ')}
                fill="none" stroke={palette.b} strokeWidth={1} strokeDasharray="3,3" opacity={0.6}/>
              {/* Lower band */}
              <path d={SPARKS[t.sym].slice(0,60).map((v,i)=>`${i===0?'M':'L'}${(i/59)*600},${90-(v*0.3+0.05)*80}`).join(' ')}
                fill="none" stroke={palette.b} strokeWidth={1} strokeDasharray="3,3" opacity={0.6}/>
              {/* Price */}
              <path d={SPARKS[t.sym].slice(0,60).map((v,i)=>`${i===0?'M':'L'}${(i/59)*600},${90-(v*0.4+0.18)*80}`).join(' ')}
                fill="none" stroke={GT.text} strokeWidth={1.5}/>
            </svg>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Tab: Technical
// ════════════════════════════════════════════════════════════════════
// Gauge ring mini-component for deep technicals
function TechGauge({value,min,max,label,zones,size}){
  size=size||48;
  const {palette,headline}=useTheme();
  const r=(size-8)/2, circ=2*Math.PI*r;
  const pct=Math.max(0,Math.min(1,(value-min)/(max-min)));
  // zone color
  let gc=GT.amber;
  if(zones){for(const z of zones){if(value>=z[0]&&value<=z[1]){gc=z[2];break;}}}
  return(
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={3.5}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={gc} strokeWidth={3.5}
          strokeDasharray={`${pct*circ} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:'stroke-dasharray .6s'}}/>
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
          fontFamily={GT.fontMono} fontSize={size>44?10:8} fill={gc} fontWeight={700}>
          {typeof value==='number'?value.toFixed(value<10?2:1):'—'}
        </text>
      </svg>
      <div>
        <div style={{fontFamily:GT.fontMono,fontSize:9,color:'rgba(160,172,200,.75)',letterSpacing:1}}>{label}</div>
      </div>
    </div>
  );
}

// ── Horizontal gradient gauge bar for fast-scan indicators ─────────
// Maps the indicator value to 0..1 across a green→yellow→red track and
// drops a marker at the current position with the state label.
function IndicatorGaugeBar({name,value,state,tone}){
  // Pull the first number out of the value string (e.g. "74.9" from "RSI 74.9")
  const num=typeof value==='string'?parseFloat(value.replace(/[^\-\d.]/g,'')):value;
  // Range/zone logic by indicator name
  const nm=(name||'').toUpperCase();
  let min=0,max=100,pos=0.5,inverted=false;
  if(nm.includes('RSI')||nm.includes('MFI')||nm.includes('STOCH')){
    min=0; max=100; pos=isFinite(num)?Math.max(0,Math.min(1,num/100)):0.5;
  } else if(nm.includes('WILLIAMS')){
    min=-100; max=0; pos=isFinite(num)?Math.max(0,Math.min(1,(num+100)/100)):0.5;
    inverted=true; // -100=oversold(green-left), 0=overbought(red-right)
  } else if(nm.includes('CCI')){
    min=-200; max=200; pos=isFinite(num)?Math.max(0,Math.min(1,(num+200)/400)):0.5;
  } else if(nm.includes('MACD')){
    pos=tone==='green'?0.78:tone==='red'?0.22:0.5;
  } else {
    pos=tone==='green'?0.78:tone==='red'?0.22:0.5;
  }
  const stateColor=tone==='green'?GT.green:tone==='red'?GT.red:GT.amber;
  return(
    <div style={{padding:'14px 16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
        <span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,letterSpacing:1.2,fontWeight:700,textTransform:'uppercase'}}>{name}</span>
        <span style={{fontFamily:GT.fontMono,fontSize:13,color:GT.text,fontWeight:700,letterSpacing:-0.2}}>{value}</span>
      </div>
      {/* Gradient track */}
      <div style={{position:'relative',height:8,borderRadius:100,overflow:'visible',
        background:`linear-gradient(90deg, ${inverted?GT.green:GT.green} 0%, ${GT.amber} 50%, ${inverted?GT.red:GT.red} 100%)`,
        boxShadow:'inset 0 0 0 1px rgba(255,255,255,.05)'}}>
        {/* Marker */}
        <div style={{position:'absolute',top:-3,left:`calc(${(pos*100).toFixed(1)}% - 7px)`,
          width:14,height:14,borderRadius:'50%',
          background:'#0a0e1c',border:`2px solid ${stateColor}`,
          boxShadow:`0 0 10px ${stateColor}99`,transition:'left .5s cubic-bezier(.2,.7,.3,1)'}}/>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:6}}>
        <span style={{fontFamily:GT.fontMono,fontSize:8,color:GT.textVeryDim,letterSpacing:0.6}}>
          {nm.includes('WILLIAMS')?'OVERSOLD':'BUY ZONE'}
        </span>
        <span style={{fontFamily:GT.fontMono,fontSize:9,color:stateColor,fontWeight:700,letterSpacing:1}}>● {state}</span>
        <span style={{fontFamily:GT.fontMono,fontSize:8,color:GT.textVeryDim,letterSpacing:0.6}}>
          {nm.includes('WILLIAMS')?'OVERBOUGHT':'SELL ZONE'}
        </span>
      </div>
    </div>
  );
}

function TabTechnical({t}){
  const {palette,headline,density}=useTheme();
  const deep=t._deep||{};
  const isLive=!!deep.rsi;
  const bb=deep.bb;
  const fib=deep.fibonacci;
  const pivots=deep.pivots;
  const adx=deep.adx;

  return(
    <div style={{display:'flex',flexDirection:'column',gap:density.gap}}>
      {/* Live indicator badge */}
      {isLive&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',background:'rgba(52,211,153,.08)',border:'1px solid rgba(52,211,153,.25)',backdropFilter:'blur(12px)'}}>
        <span style={{width:6,height:6,borderRadius:'50%',background:GT.green,boxShadow:`0 0 8px ${GT.green}`}}/>
        <span style={{fontFamily:GT.fontMono,fontSize:10,color:GT.green,letterSpacing:1,fontWeight:700}}>LIVE TECHNICALS</span>
        <span style={{fontFamily:GT.fontMono,fontSize:9,color:'rgba(160,172,200,.7)',marginLeft:'auto'}}>
          Computed from 6-month daily OHLCV · Yahoo Finance
        </span>
      </div>}

      {/* Row 1: Core Indicators Grid — visual gauges */}
      <Panel kicker={`Signals · ${t.sym}`} title="Indicators dashboard" accent={palette.a}
        right={<span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,letterSpacing:1}}>● fast-scan gauges</span>}>
        <div className="gt-signals-grid" style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:0}}>
          {t.technicals.map((s,i)=>(
            <div key={i} style={{
              borderRight:(i+1)%2!==0?`1px dashed ${palette.edge}`:'none',
              borderBottom:i<t.technicals.length-2?`1px dashed ${palette.edge}`:'none'
            }}>
              <IndicatorGaugeBar name={s.name} value={s.v} state={s.state} tone={s.tone}/>
            </div>
          ))}
        </div>
      </Panel>

      {/* Row 2: Deep Oscillators — BB, Williams %R, CCI, MFI, ADX */}
      <div className="gt-cols-2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:density.gap}}>
        <Panel kicker={`Bollinger Bands · ${t.sym}`} title="BB (20,2)" accent="#22d3ee">
          {bb?(<>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:0,marginBottom:10}}>
              {[['UPPER',bb.upper,'rgba(251,113,133,.8)'],['MIDDLE',bb.middle,GT.text],['LOWER',bb.lower,'rgba(52,211,153,.8)']].map(([l,v,c])=>(
                <div key={l} style={{padding:'10px 12px',borderRight:l!=='LOWER'?`1px dashed ${palette.edge}`:'none'}}>
                  <div style={{fontFamily:GT.fontMono,fontSize:9,color:'rgba(160,172,200,.7)',letterSpacing:1}}>{l}</div>
                  <div style={{fontFamily:headline,fontSize:22,color:c,letterSpacing:-0.4,marginTop:4}}>${v}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{flex:1}}>
                <div style={{fontFamily:GT.fontMono,fontSize:9,color:'rgba(160,172,200,.7)',letterSpacing:1}}>BANDWIDTH</div>
                <div style={{fontFamily:headline,fontSize:20,color:GT.text,marginTop:2}}>{bb.bandwidth}%</div>
              </div>
              <div>
                <div style={{fontFamily:GT.fontMono,fontSize:9,color:'rgba(160,172,200,.7)',letterSpacing:1}}>%B POSITION</div>
                <div style={{fontFamily:headline,fontSize:20,color:bb.pctB>80?GT.red:bb.pctB<20?GT.green:GT.amber,marginTop:2}}>{bb.pctB}%</div>
              </div>
              <div style={{width:80,height:8,background:'rgba(255,255,255,.06)',borderRadius:100,position:'relative',overflow:'hidden'}}>
                <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${Math.min(100,Math.max(0,bb.pctB))}%`,background:'linear-gradient(90deg,#34d399,#fbbf24,#fb7185)',borderRadius:100,transition:'width .4s'}}/>
              </div>
            </div>
          </>):(<div style={{fontFamily:GT.fontMono,fontSize:11,color:GT.textDim,padding:10}}>Loading live data…</div>)}
        </Panel>

        <Panel kicker={`Deep Oscillators · ${t.sym}`} title="Extended signals" accent="#f472b6">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,padding:'6px 0'}}>
            <TechGauge value={deep.williamsR||0} min={-100} max={0} label="WILLIAMS %R"
              zones={[[-100,-80,'green'],[-80,-20,'amber'],[-20,0,'red']]} size={50}/>
            <TechGauge value={deep.cci||0} min={-200} max={200} label="CCI (20)"
              zones={[[-200,-100,'green'],[-100,100,'amber'],[100,200,'red']]} size={50}/>
            <TechGauge value={deep.mfi||50} min={0} max={100} label="MFI (14)"
              zones={[[0,20,'green'],[20,80,'amber'],[80,100,'red']]} size={50}/>
            {adx?(<div style={{display:'flex',alignItems:'center',gap:10}}>
              <div>
                <div style={{fontFamily:GT.fontMono,fontSize:9,color:'rgba(160,172,200,.75)',letterSpacing:1}}>ADX</div>
                <div style={{fontFamily:headline,fontSize:24,color:adx.adx>25?GT.green:GT.amber,letterSpacing:-0.5,marginTop:2}}>{adx.adx}</div>
              </div>
              <div style={{fontFamily:GT.fontMono,fontSize:9,lineHeight:1.8}}>
                <div><span style={{color:GT.green}}>DI+ {adx.diPlus}</span></div>
                <div><span style={{color:GT.red}}>DI− {adx.diMinus}</span></div>
              </div>
            </div>):(
              <TechGauge value={50} min={0} max={100} label="ADX" zones={[[0,25,'amber'],[25,100,'green']]} size={50}/>
            )}
          </div>
          {deep.vwap&&<div style={{marginTop:10,padding:'10px 12px',borderTop:`1px dashed ${palette.edge}`,display:'flex',justifyContent:'space-between'}}>
            <span style={{fontFamily:GT.fontMono,fontSize:9,color:'rgba(160,172,200,.7)',letterSpacing:1}}>VWAP (20D)</span>
            <span style={{fontFamily:headline,fontSize:18,color:t.px>deep.vwap?GT.green:GT.red}}>${deep.vwap}</span>
          </div>}
        </Panel>
      </div>

      {/* Row 3: Fibonacci Retracement */}
      {fib&&<Panel kicker={`Fibonacci Retracement · ${t.sym}`} title={`${fib.levels[0].px} — ${fib.levels[6].px} range`} accent="#fbbf24">
        <div style={{display:'flex',gap:0,flexWrap:'wrap'}}>
          {fib.levels.map((lv,i)=>{
            const dist=((lv.px/t.px-1)*100);
            const isNear=Math.abs(dist)<2;
            return(
              <div key={i} style={{flex:'1 1 auto',minWidth:80,padding:'10px 12px',borderRight:i<6?`1px dashed ${palette.edge}`:'none',background:isNear?'rgba(251,191,36,.06)':'transparent'}}>
                <div style={{fontFamily:GT.fontMono,fontSize:9,color:GT.amber,letterSpacing:1,fontWeight:700}}>{lv.pct}%</div>
                <div style={{fontFamily:headline,fontSize:18,color:isNear?GT.amber:GT.text,marginTop:3,letterSpacing:-0.3}}>${lv.px}</div>
                <div style={{fontFamily:GT.fontMono,fontSize:9,color:dist>0?'rgba(52,211,153,.8)':'rgba(251,113,133,.8)',marginTop:2}}>
                  {dist>=0?'+':''}{dist.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      </Panel>}

      {/* Row 4: Support & Resistance (Pivot Points) */}
      <Panel kicker={`Support & Resistance · ${t.sym}${pivots?' · Pivot Points':''}`} title="Price-level ladder" accent={palette.b}>
        {/* Nearest key levels callout */}
        {(()=>{
          const px=t.px;
          const sups=t.levels.filter(l=>typeof l.px==='number'&&l.px<px&&l.kind!=='CURR').sort((a,b)=>b.px-a.px);
          const ress=t.levels.filter(l=>typeof l.px==='number'&&l.px>px&&l.kind!=='CURR').sort((a,b)=>a.px-b.px);
          const keyS=sups[0], keyR=ress[0];
          const sDist=keyS?((keyS.px/px-1)*100):null;
          const rDist=keyR?((keyR.px/px-1)*100):null;
          return(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              <div style={{padding:'12px 14px',background:'rgba(52,211,153,.06)',border:`1px solid rgba(52,211,153,.25)`,borderLeft:`3px solid ${GT.green}`}}>
                <div style={{fontFamily:GT.fontMono,fontSize:9,color:GT.green,letterSpacing:1.4,fontWeight:700,marginBottom:5}}>▼ KEY SUPPORT</div>
                {keyS?(
                  <div style={{display:'flex',alignItems:'baseline',gap:10,flexWrap:'wrap'}}>
                    <span style={{fontFamily:headline,fontSize:28,color:GT.text,letterSpacing:-0.6,lineHeight:1}}>${keyS.px.toFixed(2)}</span>
                    <span style={{fontFamily:GT.fontMono,fontSize:11,color:GT.green,fontWeight:700}}>{sDist.toFixed(2)}%</span>
                    <span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,letterSpacing:1}}>· {keyS.kind}</span>
                  </div>
                ):<div style={{color:GT.textDim,fontSize:11}}>No support below current price.</div>}
              </div>
              <div style={{padding:'12px 14px',background:'rgba(251,113,133,.06)',border:`1px solid rgba(251,113,133,.25)`,borderLeft:`3px solid ${GT.red}`}}>
                <div style={{fontFamily:GT.fontMono,fontSize:9,color:GT.red,letterSpacing:1.4,fontWeight:700,marginBottom:5}}>▲ KEY RESISTANCE</div>
                {keyR?(
                  <div style={{display:'flex',alignItems:'baseline',gap:10,flexWrap:'wrap'}}>
                    <span style={{fontFamily:headline,fontSize:28,color:GT.text,letterSpacing:-0.6,lineHeight:1}}>${keyR.px.toFixed(2)}</span>
                    <span style={{fontFamily:GT.fontMono,fontSize:11,color:GT.red,fontWeight:700}}>+{rDist.toFixed(2)}%</span>
                    <span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,letterSpacing:1}}>· {keyR.kind}</span>
                  </div>
                ):<div style={{color:GT.textDim,fontSize:11}}>No resistance above current price.</div>}
              </div>
            </div>
          );
        })()}
        {t.levels.map((l,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'60px 1fr 100px 80px',gap:12,alignItems:'center',padding:'11px 0',borderBottom:i<t.levels.length-1?`1px dashed ${palette.edge}`:'none',background:l.active?palette.aSoft:'transparent',paddingLeft:l.active?12:0,marginLeft:l.active?-12:0,marginRight:l.active?-12:0,paddingRight:l.active?12:0}}>
            <span style={{fontFamily:GT.fontMono,fontSize:11,fontWeight:700,letterSpacing:1.2,color:l.kind.startsWith('R')?GT.red:l.kind.startsWith('S')?GT.green:palette.a}}>{l.kind}</span>
            <div style={{height:5,background:'rgba(255,255,255,.05)',position:'relative',borderRadius:100}}>
              <div style={{position:'absolute',top:0,bottom:0,left:l.kind.startsWith('S')?`${50-8*(Number(l.kind[1])||0)}%`:'50%',right:l.kind.startsWith('R')?`${50-8*(Number(l.kind[1])||0)}%`:'50%',background:l.kind.startsWith('R')?GT.red:l.kind.startsWith('S')?GT.green:palette.a,borderRadius:100,opacity:l.active?1:0.6}}/>
            </div>
            <span style={{fontFamily:headline,fontSize:20,color:GT.text,textAlign:'right',letterSpacing:-0.4}}>${l.px.toFixed(2)}</span>
            <span style={{fontFamily:GT.fontMono,fontSize:11,color:l.dist&&l.dist.startsWith('-')?'rgba(251,113,133,.9)':l.dist==='CURR'?palette.a:'rgba(52,211,153,.85)',textAlign:'right',fontWeight:600}}>{l.dist}</span>
          </div>
        ))}
      </Panel>

      {/* Row 5: Technical Summary Score */}
      <Panel kicker={`Technical Score · ${t.sym}`} title="Composite signal strength" accent={palette.a}>
        {(()=>{
          const signals=t.technicals||[];
          const bullish=signals.filter(s=>s.tone==='green').length;
          const bearish=signals.filter(s=>s.tone==='red').length;
          const neutral=signals.filter(s=>s.tone==='amber').length;
          const total=signals.length||1;
          const score=((bullish-bearish)/total*50+50);
          const verdict=score>=65?'BULLISH':score<=35?'BEARISH':'NEUTRAL';
          const vc=score>=65?GT.green:score<=35?GT.red:GT.amber;
          return(
            <div style={{display:'grid',gridTemplateColumns:'auto 1fr auto',gap:22,alignItems:'center'}}>
              <div style={{textAlign:'center'}}>
                <div style={{fontFamily:headline,fontSize:56,color:vc,lineHeight:1,letterSpacing:-2}}>{score.toFixed(0)}</div>
                <div style={{fontFamily:GT.fontMono,fontSize:10,color:vc,fontWeight:700,letterSpacing:1.5,marginTop:4}}>{verdict}</div>
              </div>
              <div>
                {/* Signal bar */}
                <div style={{display:'flex',height:10,borderRadius:100,overflow:'hidden',marginBottom:10}}>
                  <div style={{width:`${bullish/total*100}%`,background:GT.green,transition:'width .4s'}}/>
                  <div style={{width:`${neutral/total*100}%`,background:GT.amber,transition:'width .4s'}}/>
                  <div style={{width:`${bearish/total*100}%`,background:GT.red,transition:'width .4s'}}/>
                </div>
                <div style={{display:'flex',gap:18,fontFamily:GT.fontMono,fontSize:10}}>
                  <span style={{color:GT.green}}>● {bullish} BULLISH</span>
                  <span style={{color:GT.amber}}>● {neutral} NEUTRAL</span>
                  <span style={{color:GT.red}}>● {bearish} BEARISH</span>
                </div>
              </div>
              <div style={{fontFamily:GT.fontMono,fontSize:9,color:'rgba(160,172,200,.6)',textAlign:'right',lineHeight:1.8}}>
                {deep.ema20&&<div>EMA20 {t.px>deep.ema20?'▲':'▼'} ${deep.ema20}</div>}
                {deep.ema50&&<div>EMA50 {t.px>deep.ema50?'▲':'▼'} ${deep.ema50}</div>}
                {deep.ema200&&<div>EMA200 {t.px>deep.ema200?'▲':'▼'} ${deep.ema200}</div>}
              </div>
            </div>
          );
        })()}
      </Panel>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Tab: Financials — comprehensive interactive hub
// ════════════════════════════════════════════════════════════════════
const FIN_SECTIONS=[
  {key:'overview', label:'Overview', icon:'◈'},
  {key:'valuation',label:'Valuation',icon:'◇'},
  {key:'income',   label:'Income Stmt',icon:'▦'},
  {key:'balance',  label:'Balance Sheet',icon:'▤'},
  {key:'cashflow', label:'Cash Flow',icon:'◎'},
  {key:'segments', label:'Segments',icon:'◉'},
];

function ValGaugeCard({label,value,percentile,pctLabel,color,active,onClick}){
  const {palette,headline}=useTheme();
  const r=22; const circ=2*Math.PI*r;
  const pct=typeof percentile==='number'?Math.min(1,Math.max(0,percentile/100)):0.5;
  const gc=color||palette.a;
  return(
    <div onClick={onClick} style={{
      padding:'14px 12px',cursor:'pointer',
      background:active?palette.aSoft:'rgba(255,255,255,.02)',
      border:`1px solid ${active?gc:palette.edge}`,
      transition:'all .2s',position:'relative',overflow:'hidden',
    }}
    onMouseEnter={e=>{if(!active){e.currentTarget.style.borderColor=gc;e.currentTarget.style.background=`${gc}10`;}}}
    onMouseLeave={e=>{if(!active){e.currentTarget.style.borderColor=palette.edge;e.currentTarget.style.background='rgba(255,255,255,.02)';}}}
    >
      {active&&<div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${gc},transparent)`}}/>}
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <svg width={54} height={54} viewBox="0 0 54 54">
          <circle cx={27} cy={27} r={r} fill="none" stroke={`${gc}22`} strokeWidth={4}/>
          <circle cx={27} cy={27} r={r} fill="none" stroke={gc} strokeWidth={4}
            strokeDasharray={`${pct*circ} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 27 27)" style={{transition:'stroke-dasharray .6s'}}/>
          <text x={27} y={27} textAnchor="middle" dominantBaseline="middle"
            fontFamily={GT.fontMono} fontSize={9} fill={gc} fontWeight={700}>{value}</text>
        </svg>
        <div>
          <div style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,letterSpacing:1.2,marginBottom:3}}>{label}</div>
          <div style={{fontFamily:GT.fontMono,fontSize:8,color:active?gc:GT.textVeryDim}}>{pctLabel}</div>
        </div>
      </div>
    </div>
  );
}

// ── Aggregate quarterly into yearly buckets by FY label suffix (e.g. ·25 / ·26)
function aggregateToYearly(quarterly){
  if(!quarterly||!quarterly.length) return [];
  const groups={};
  quarterly.forEach(q=>{
    // Quarter labels like "Q1·25" — extract FY suffix
    const m=String(q.q).match(/[·\s·]?(\d{2})$/) || String(q.q).match(/(\d{2})$/);
    const fy=m?('FY'+m[1]):'FY?';
    if(!groups[fy]) groups[fy]={q:fy, rev:0, ni:0, count:0};
    groups[fy].rev += q.rev||0;
    groups[fy].ni  += q.ni||0;
    groups[fy].count++;
  });
  const arr=Object.values(groups);
  // Mark partial years (less than 4 quarters reported)
  arr.forEach(g=>{ if(g.count<4){ g.partial=true; g.q=g.q+' YTD'; } });
  return arr;
}

function RevenueGrowthChart({data,accent,mode}){
  const {palette}=useTheme();
  const ac=accent||palette.a;
  // Pick dataset based on mode
  const series = (mode==='yearly') ? aggregateToYearly(data) : data;
  if(!series.length) return null;
  const maxR=Math.max(...series.map(d=>d.rev));
  // padT bumped from 30 → 18 (legend moved out of SVG to an HTML strip);
  // the chart now has ALL vertical headroom for value+growth labels.
  const W=820, H=210, padL=40, padR=12, padB=44, padT=18;
  const innerW=W-padL-padR, innerH=H-padT-padB;
  const n=series.length;
  // Side-by-side Revenue + Net Income bars within each group.
  const groupW=innerW/n;
  const pairW=Math.min(groupW*0.78, 92);
  const revW=pairW*0.58;
  const niW=pairW*0.32;
  const gap=pairW*0.10;
  const yGrids=[0,0.25,0.5,0.75,1];
  const uniq=Math.random().toString(36).slice(2,7);
  const revGradId='revGrad-'+uniq, niGradId='niGrad-'+uniq, glowId='glow-'+uniq;

  return(
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{display:'block'}}>
      <defs>
        <linearGradient id={revGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={ac} stopOpacity="1"/>
          <stop offset="65%"  stopColor={ac} stopOpacity="0.7"/>
          <stop offset="100%" stopColor={ac} stopOpacity="0.18"/>
        </linearGradient>
        <linearGradient id={niGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#34d399" stopOpacity="1"/>
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.35"/>
        </linearGradient>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Y-axis gridlines + labels */}
      {yGrids.map((p,i)=>{
        const y=padT+(1-p)*innerH;
        const v=maxR*p;
        return(
          <g key={i}>
            <line x1={padL} x2={W-padR} y1={y} y2={y}
              stroke="rgba(255,255,255,0.05)" strokeDasharray="2,4"/>
            <text x={padL-8} y={y+3} textAnchor="end" fontSize={8.5}
              fontFamily={GT.fontMono} fill="rgba(163,172,209,.7)" letterSpacing="0.6">
              {v>=1000?(v/1000).toFixed(1)+'k':v>=10?v.toFixed(0):v.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {series.map((d,i)=>{
        const cx=padL+i*groupW+groupW/2;
        const rh=(d.rev/maxR)*innerH;
        const nih=d.ni?(d.ni/maxR)*innerH:0;
        const isLast=i===n-1;
        const baseY=padT+innerH;
        // Side-by-side layout: rev bar left-of-center, ni bar right-of-center
        const revX=cx-pairW/2;
        const niX=cx+pairW/2-niW;
        const revCx=revX+revW/2;
        const niCx=niX+niW/2;
        // YoY/QoQ growth vs previous bar
        const prev=i>0?series[i-1]:null;
        const grow=prev&&prev.rev?((d.rev/prev.rev-1)*100):null;
        const growColor=grow==null?'#a3acd1':(grow>=0?'#34d399':'#fb7185');
        // Net margin
        const margin=d.ni&&d.rev?((d.ni/d.rev)*100):null;
        return(
          <g key={i}>
            {/* Revenue bar — main, with rounded top, glow on last */}
            <rect x={revX} y={baseY-rh} width={revW} height={rh}
              rx={3} ry={3}
              fill={`url(#${revGradId})`}
              filter={isLast?`url(#${glowId})`:undefined}
              stroke={isLast?ac:'rgba(255,255,255,0.04)'} strokeWidth={isLast?1.5:1}
              opacity={d.partial?0.72:1}/>
            {/* Net Income — side-by-side bar (not inset) */}
            {d.ni>0&&<rect
              x={niX}
              y={baseY-nih}
              width={niW}
              height={nih}
              rx={2} ry={2}
              fill={`url(#${niGradId})`}
              stroke="rgba(52,211,153,.55)" strokeWidth={0.6}
              opacity={d.partial?0.72:1}/>}

            {/* Rev value label */}
            <text x={revCx} y={baseY-rh-22} textAnchor="middle"
              fontSize={11} fontFamily={GT.fontMono}
              fill={isLast?ac:'#eef0ff'} fontWeight={700} letterSpacing="0.3"
              style={{filter:isLast?`drop-shadow(0 0 6px ${ac})`:'none'}}>
              {d.rev>=1000?(d.rev/1000).toFixed(1)+'B':d.rev.toFixed(1)}
            </text>
            {/* Growth badge */}
            {grow!=null&&<text x={revCx} y={baseY-rh-8} textAnchor="middle"
              fontSize={8.5} fontFamily={GT.fontMono} fill={growColor}
              fontWeight={700} letterSpacing="0.5"
              style={{filter:`drop-shadow(0 0 4px ${growColor}88)`}}>
              {grow>=0?'▲ +':'▼ '}{Math.abs(grow).toFixed(0)}%
            </text>}
            {/* NI value label — only when bar tall enough to show */}
            {d.ni>0&&nih>14&&<text x={niCx} y={baseY-nih-6} textAnchor="middle"
              fontSize={8.5} fontFamily={GT.fontMono} fill="#34d399"
              fontWeight={700} letterSpacing="0.3">
              {d.ni>=1000?(d.ni/1000).toFixed(1)+'B':d.ni.toFixed(1)}
            </text>}

            {/* Period label — centered under the pair */}
            <text x={cx} y={baseY+18} textAnchor="middle"
              fontSize={9.5} fontFamily={GT.fontMono}
              fill={isLast?'#eef0ff':'rgba(163,172,209,.85)'}
              fontWeight={isLast?700:500} letterSpacing="0.8">{d.q}</text>
            {/* Margin tag */}
            {margin!=null&&<text x={cx} y={baseY+30} textAnchor="middle"
              fontSize={7.5} fontFamily={GT.fontMono} fill="rgba(199,186,255,.65)"
              letterSpacing="1">NM {margin.toFixed(0)}%</text>}

            {/* Partial year indicator dot */}
            {d.partial&&<circle cx={revX+revW-3} cy={baseY-rh+5} r="2.5"
              fill="#fbbf24" stroke="#0a0e1c" strokeWidth="1"/>}
          </g>
        );
      })}

    </svg>
  );
}

// Standalone HTML legend strip — lives ABOVE the chart so it can't overlap
// any bar label, and uses bigger swatches for instant scanning.
function RevenueGrowthLegend({accent}){
  const ac=accent||'#8b5cf6';
  return(
    <div style={{
      display:'flex',alignItems:'center',gap:18,
      padding:'6px 4px 12px',
      fontFamily:GT.fontMono,fontSize:10.5,
      color:'rgba(226,232,240,.92)',letterSpacing:1.2,fontWeight:600,
    }}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span style={{
          width:18,height:10,borderRadius:3,
          background:`linear-gradient(180deg, ${ac}, ${ac}99)`,
          boxShadow:`0 0 8px ${ac}66`,
        }}/>
        <span>REVENUE&nbsp;($B)</span>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span style={{
          width:18,height:10,borderRadius:3,
          background:'linear-gradient(180deg, #34d399, #34d39999)',
          boxShadow:'0 0 8px rgba(52,211,153,.45)',
        }}/>
        <span>NET&nbsp;INCOME</span>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:'auto',color:'rgba(199,186,255,.7)',fontSize:9.5,fontWeight:500}}>
        <span style={{color:'#34d399',fontWeight:700}}>▲</span> growth vs prior period · <span style={{color:'rgba(199,186,255,.85)'}}>NM</span> = net margin
      </div>
    </div>
  );
}

// Wrapper with Quarterly / Yearly toggle UI
function RevenueGrowthChartToggle({quarterly,accent}){
  const {palette}=useTheme();
  const [mode,setMode]=dsUseState('quarterly');
  const ac=accent||palette.a;
  const btn=(label,m)=>(
    <button key={m} onClick={()=>setMode(m)} style={{
      padding:'6px 14px',
      fontFamily:GT.fontMono,fontSize:10,fontWeight:700,letterSpacing:1.4,
      textTransform:'uppercase',
      color:mode===m?ac:'rgba(199,186,255,.65)',
      background:mode===m?`rgba(${ac==='#8b5cf6'?'139,92,246':'139,92,246'},.12)`:'transparent',
      border:`1px solid ${mode===m?ac:'rgba(255,255,255,0.07)'}`,
      borderRadius:6,cursor:'pointer',
      textShadow:mode===m?`0 0 10px ${ac}`:'none',
      boxShadow:mode===m?`0 0 14px -4px ${ac}`:'none',
      transition:'all .18s',
    }}>{label}</button>
  );
  return(
    <div>
      <div style={{display:'flex',gap:8,marginBottom:8,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}}>
        <RevenueGrowthLegend accent={ac}/>
        <div style={{display:'flex',gap:6}}>
          {btn('Quarterly','quarterly')}
          {btn('Yearly','yearly')}
        </div>
      </div>
      <RevenueGrowthChart data={quarterly} accent={ac} mode={mode}/>
      {mode==='yearly'&&<div style={{
        marginTop:8,fontFamily:GT.fontMono,fontSize:9.5,
        color:'rgba(163,172,209,.7)',letterSpacing:0.6,
        display:'flex',alignItems:'center',gap:7,
      }}>
        <span style={{width:7,height:7,borderRadius:'50%',background:'#fbbf24',boxShadow:'0 0 6px rgba(251,191,36,.7)'}}/>
        Bars marked with an amber dot have fewer than 4 quarters reported (partial FY).
      </div>}
    </div>
  );
}

// ── Beautiful financial statement bar chart ───────────────────────
function FinBarChart({rows,periods,accent,height=160}){
  const {palette}=useTheme();
  const ac=accent||palette.a;
  // Pick the top 4 bold/highlight rows to chart
  const chartRows=rows.filter(r=>r.bold||r.highlight).slice(0,4);
  if(!chartRows.length||!periods.length) return null;
  const colors=[ac,GT.green,palette.b,'#f472b6'];
  const W=800; const H=height;
  const groupW=W/periods.length;
  const barW=groupW/(chartRows.length+1);
  const allVals=chartRows.flatMap(r=>r.v.filter(v=>typeof v==='number'&&v>0));
  const maxV=Math.max(...allVals,1);
  return(
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{marginBottom:8}}>
      <defs>
        {chartRows.map((_,ri)=>(
          <linearGradient key={ri} id={`fg${ri}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors[ri]} stopOpacity="0.95"/>
            <stop offset="100%" stopColor={colors[ri]} stopOpacity="0.45"/>
          </linearGradient>
        ))}
      </defs>
      {/* Horizontal grid */}
      {[0,0.33,0.66,1].map((p,i)=>(
        <line key={i} x1={0} x2={W} y1={(1-p)*(H-32)+4} y2={(1-p)*(H-32)+4}
          stroke={palette.edge} strokeDasharray="3,6" opacity={0.4}/>
      ))}
      {/* Period labels — brightened for readability */}
      {periods.map((p,pi)=>(
        <text key={pi} x={(pi+0.5)*groupW} y={H-6} textAnchor="middle"
          fontSize={10} fontFamily={GT.fontMono} fontWeight={700}
          fill="#dbe3ff" letterSpacing={0.6}>{p}</text>
      ))}
      {/* Bars */}
      {periods.map((p,pi)=>(
        <g key={pi}>
          {chartRows.map((r,ri)=>{
            const v=r.v[pi];
            if(typeof v!=='number'||v<=0) return null;
            const bh=(v/maxV)*(H-40);
            const x=(pi*groupW)+((ri+0.5)*barW)+barW*0.1;
            const y=H-32-bh;
            return(
              <g key={ri}>
                <rect x={x} y={y} width={barW*0.8} height={bh}
                  fill={`url(#fg${ri})`} rx={2}/>
                {bh>18&&<text x={x+barW*0.4} y={y+10} textAnchor="middle"
                  fontSize={7} fontFamily={GT.fontMono} fill="rgba(255,255,255,.7)" fontWeight={700}>
                  {v>=1000?(v/1000).toFixed(1)+'B':v.toFixed(0)}
                </text>}
              </g>
            );
          })}
        </g>
      ))}
      {/* Legend */}
      {chartRows.map((r,ri)=>(
        <g key={ri}>
          <rect x={8+ri*120} y={4} width={10} height={7} fill={colors[ri]} rx={1} opacity={0.85}/>
          <text x={22+ri*120} y={11} fontSize={7.5} fontFamily={GT.fontMono} fill={GT.textDim}>{r.label.trim()}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Cash flow waterfall / grouped bar ────────────────────────────
function CashFlowChart({rows,periods,accent,height=140}){
  const {palette}=useTheme();
  const ac=accent||'#f472b6';
  // Operating, Investing, Financing CF rows
  const cfKeys=['Operating','Investing','Financing','Free Cash'];
  const cfRows=rows.filter(r=>cfKeys.some(k=>r.label.trim().toLowerCase().includes(k.toLowerCase()))&&r.bold).slice(0,4);
  if(!cfRows.length||!periods.length) return null;
  const H=height; const W=800;
  const cfColors=[GT.green,GT.red,GT.amber,palette.a];
  const groupW=W/periods.length;
  const barW=groupW/(cfRows.length+1);
  const allVals=cfRows.flatMap(r=>r.v.map(v=>Math.abs(typeof v==='number'?v:0)));
  const maxV=Math.max(...allVals,1);
  return(
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{marginBottom:8}}>
      {/* Zero line */}
      <line x1={0} x2={W} y1={(H-28)/2+4} y2={(H-28)/2+4} stroke={palette.edge} strokeDasharray="2,4" opacity={0.6}/>
      {/* Period labels — brightened for readability */}
      {periods.map((p,pi)=>(
        <text key={pi} x={(pi+0.5)*groupW} y={H-6} textAnchor="middle"
          fontSize={10} fontFamily={GT.fontMono} fontWeight={700}
          fill="#dbe3ff" letterSpacing={0.6}>{p}</text>
      ))}
      {periods.map((p,pi)=>(
        <g key={pi}>
          {cfRows.map((r,ri)=>{
            const v=typeof r.v[pi]==='number'?r.v[pi]:0;
            const half=(H-32)/2;
            const bh=Math.min((Math.abs(v)/maxV)*half,half-2);
            const isPos=v>=0;
            const x=(pi*groupW)+((ri+0.5)*barW)+barW*0.1;
            const y=isPos?half+4-bh:half+4;
            return(
              <g key={ri}>
                <rect x={x} y={y} width={barW*0.8} height={bh}
                  fill={cfColors[ri]} rx={2} opacity={0.8}/>
                {bh>14&&<text x={x+barW*0.4} y={isPos?y+10:y+bh-4} textAnchor="middle"
                  fontSize={7} fontFamily={GT.fontMono} fill="rgba(255,255,255,.75)" fontWeight={700}>
                  {v>=1000?(v/1000).toFixed(1)+'B':v<-1000?'('+(Math.abs(v)/1000).toFixed(1)+'B)':v.toFixed(0)}
                </text>}
              </g>
            );
          })}
        </g>
      ))}
      {/* Legend */}
      {cfRows.map((r,ri)=>(
        <g key={ri}>
          <rect x={8+ri*130} y={4} width={10} height={7} fill={cfColors[ri]} rx={1} opacity={0.85}/>
          <text x={22+ri*130} y={11} fontSize={7.5} fontFamily={GT.fontMono} fill={GT.textDim}>{r.label.trim()}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Inline sparkline for the line-item trend column ──────────────
function RowSpark({values,width=72,height=22}){
  const nums=values.filter(v=>typeof v==='number');
  if(nums.length<2) return <span style={{color:GT.textVeryDim,fontSize:9}}>—</span>;
  const min=Math.min(...nums), max=Math.max(...nums);
  const range=max-min||Math.abs(max)||1;
  const last=nums[nums.length-1], first=nums[0];
  const up=last>=first;
  const c=up?GT.green:GT.red;
  const pts=nums.map((v,i)=>{
    const x=(i/(nums.length-1))*(width-2)+1;
    const y=height-(((v-min)/range)*(height-4))-2;
    return `${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return(
    <svg width={width} height={height} style={{display:'block'}}>
      <path d={pts+` L${width-1},${height} L1,${height} Z`} fill={`${c}18`}/>
      <path d={pts} fill="none" stroke={c} strokeWidth={1.4}/>
      <circle cx={(width-2)+1} cy={height-(((last-min)/range)*(height-4))-2} r={2} fill={c}/>
    </svg>
  );
}

// ── Compute YoY % between last two numeric periods ────────────────
function yoyDelta(values){
  if(!values||values.length<2) return null;
  const cur=values[values.length-1], prev=values[values.length-2];
  if(typeof cur!=='number'||typeof prev!=='number'||prev===0) return null;
  return ((cur-prev)/Math.abs(prev))*100;
}

function StatementTableFin({rows,periods,palette,headline}){
  if(!rows||!rows.length) return<div style={{padding:18,color:GT.textDim,fontSize:12}}>No data for this period.</div>;
  return(
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontFamily:GT.fontMono,fontSize:11}}>
        <thead>
          <tr>
            <th style={{textAlign:'left',padding:'10px 8px',borderBottom:`1px solid ${palette.edge}`,color:GT.textDim,fontSize:9,letterSpacing:1.2,fontWeight:700,textTransform:'uppercase'}}>// Line item</th>
            {periods.map((p,i)=>(
              <th key={i} style={{textAlign:'right',padding:'10px 12px',borderBottom:`1px solid ${palette.edge}`,color:'#dbe3ff',fontSize:10,letterSpacing:0.5,fontWeight:700}}>{p}</th>
            ))}
            <th style={{textAlign:'right',padding:'10px 12px',borderBottom:`1px solid ${palette.edge}`,color:GT.textDim,fontSize:9,letterSpacing:1.2,fontWeight:700,textTransform:'uppercase',whiteSpace:'nowrap'}}>YoY %</th>
            <th style={{textAlign:'center',padding:'10px 8px',borderBottom:`1px solid ${palette.edge}`,color:GT.textDim,fontSize:9,letterSpacing:1.2,fontWeight:700,textTransform:'uppercase'}}>Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>{
            const indent=r.label.startsWith('  ');
            const label=r.label.trim();
            const yoy=r.pct?null:yoyDelta(r.v);
            const yoyColor=yoy==null?GT.textVeryDim:(yoy>=0?GT.green:GT.red);
            const yoyArrow=yoy==null?'':(yoy>=0?'▲':'▼');
            return(
              <tr key={i} style={{background:r.highlight?palette.aSoft:'transparent',borderBottom:`1px dashed ${palette.edge}`}}>
                <td style={{padding:indent?'7px 8px 7px 24px':'7px 8px',color:indent?GT.textDim:GT.text,fontSize:indent?10:11,fontWeight:r.bold?700:400}}>{label}</td>
                {r.v.map((cell,j)=>(
                  <td key={j} style={{padding:'7px 12px',textAlign:'right',color:r.pct?GT.textDim:(cell==null?GT.textDim:GT.text),fontWeight:r.bold?700:400}}>
                    {r.pct?cell:fmtNum(cell)}
                  </td>
                ))}
                <td style={{padding:'7px 12px',textAlign:'right',color:yoyColor,fontWeight:700,fontSize:10.5,whiteSpace:'nowrap',
                  textShadow:yoy==null?'none':(yoy>=0?'0 0 10px rgba(52,211,153,.55)':'0 0 10px rgba(251,113,133,.55)'),
                  letterSpacing:0.3}}>
                  {yoy==null?'—':`${yoyArrow} ${yoy>=0?'+':''}${yoy.toFixed(1)}%`}
                </td>
                <td style={{padding:'4px 8px',width:80}}>
                  {r.pct?<span style={{color:GT.textVeryDim,fontSize:9}}>—</span>:<RowSpark values={r.v} width={72} height={22}/>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function fmtNum(v){
  if(v==null) return'—';
  if(typeof v==='string') return v;
  const abs=Math.abs(v);
  const neg=v<0;
  let out;
  if(abs>=1000) out=(abs/1000).toFixed(2)+'B';
  else if(abs>=100) out=abs.toFixed(0);
  else if(abs>=1) out=abs.toFixed(2);
  else out=abs.toFixed(2);
  return neg?`(${out})`:out;
}

function TabFinancials({t}){
  const {palette,headline,density}=useTheme();
  const [section,setSection]=dsUseState('overview');
  const [mode,setMode]=dsUseState('annual');
  const [activeVal,setActiveVal]=dsUseState('pfwd');
  const dd=(typeof DEEP_DIVE!=='undefined'&&DEEP_DIVE[t.sym])||null;
  const view=dd&&dd[mode]||{};
  const periods=view.periods||(dd&&dd.annual.periods)||[];

  const valCards=[
    {key:'pfwd', label:'Fwd P/E',   value:t.fundamentals.pfwd,   percentile:50, pctLabel:'50th pct · fair',  color:palette.a},
    {key:'petm', label:'P/E TTM',   value:t.fundamentals.petm,   percentile:85, pctLabel:'85th pct · rich',   color:GT.amber},
    {key:'ps',   label:'P/S',       value:t.fundamentals.ps,     percentile:70, pctLabel:'70th pct · stretched',color:GT.amber},
    {key:'pb',   label:'P/B',       value:t.fundamentals.pb,     percentile:95, pctLabel:'95th pct · very rich',color:GT.red},
    {key:'ev',   label:'EV/EBITDA', value:t.fundamentals.evEbitda,percentile:60,pctLabel:'60th pct · moderate',color:GT.amber},
    {key:'peg',  label:'PEG',       value:t.fundamentals.peg,    percentile:35, pctLabel:'Fair · <1x ideal',   color:GT.green},
  ];

  const activeCard=valCards.find(v=>v.key===activeVal)||valCards[0];

  return(
    <div style={{display:'flex',flexDirection:'column',gap:density.gap}}>
      {/* Section nav */}
      <div style={{display:'flex',gap:0,background:GT.glass,backdropFilter:'blur(20px)',border:`1px solid ${palette.edge}`}}>
        {FIN_SECTIONS.map(s=>{
          const active=section===s.key;
          return(
            <button key={s.key} onClick={()=>setSection(s.key)} style={{
              flex:1,padding:'10px 8px',display:'flex',alignItems:'center',justifyContent:'center',gap:4,
              background:active?palette.aSoft:'transparent',border:'none',
              fontFamily:GT.fontMono,fontSize:9,fontWeight:600,letterSpacing:1,
              color:active?palette.a:GT.textDim,cursor:'pointer',
              borderBottom:active?`2px solid ${palette.a}`:'2px solid transparent',
              transition:'all .15s',
            }}>
              <span style={{fontSize:10}}>{s.icon}</span>
              <span style={{display:'none'}}>{s.label}</span>
              <span style={{fontSize:9}}>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Annual/Quarterly toggle — visible for all statement sections */}
      {(section==='income'||section==='balance'||section==='cashflow')&&(
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {[['annual','Annual'],['quarterly','Quarterly']].map(([k,l])=>(
            <button key={k} onClick={()=>setMode(k)} style={{
              padding:'5px 12px',borderRadius:100,fontFamily:GT.fontMono,fontSize:9,fontWeight:700,letterSpacing:1,
              background:mode===k?palette.a:'transparent',color:mode===k?'#0a0e1c':GT.text,
              border:`1px solid ${mode===k?palette.a:palette.edge}`,cursor:'pointer',
            }}>{l}</button>
          ))}
          {dd&&<span style={{marginLeft:'auto',fontFamily:GT.fontMono,fontSize:9,color:GT.textDim}}>{dd.sourceNote}</span>}
        </div>
      )}

      {/* Overview section */}
      {section==='overview'&&(
        <>
          <KpiStrip t={t}/>
          <Panel kicker="Revenue & earnings trajectory" title={`${t.sym} · revenue`} accent={palette.a}>
            <RevenueGrowthChartToggle quarterly={t.quarterly} accent={palette.a}/>
          </Panel>
          <Panel kicker="Competitive moat" title="What we underwrite" accent="#f472b6">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0}}>
              {t.moat.map(([h,body],i)=>(
                <div key={i} style={{padding:'18px 22px',borderRight:i%2===0?`1px dashed ${palette.edge}`:'none',borderBottom:i<2?`1px dashed ${palette.edge}`:'none'}}>
                  <div style={{fontFamily:headline,fontSize:16,color:GT.text,letterSpacing:-0.2,marginBottom:6}}>{h}</div>
                  {/* Body text brightened from #8b95b8 → #c4cce4 for AA on dark navy bg */}
                  <div style={{fontSize:12.5,color:'#c4cce4',lineHeight:1.55,letterSpacing:0.1}}>{body}</div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}

      {/* Valuation section */}
      {section==='valuation'&&(
        <>
          <Panel kicker={`Valuation multiples · ${t.sym}`} title="5Y historical percentiles" accent={palette.a}
            right="Click a metric to inspect">
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:1,marginBottom:1}}>
              {valCards.map(vc=>(
                <ValGaugeCard key={vc.key} {...vc} active={activeVal===vc.key} onClick={()=>setActiveVal(vc.key)}/>
              ))}
            </div>
            {/* Detail for active multiple */}
            <div style={{marginTop:10,padding:'18px 20px',background:`${activeCard.color}0d`,border:`1px solid ${activeCard.color}33`,position:'relative'}}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${activeCard.color},transparent)`}}/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:20}}>
                <div>
                  <div style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,letterSpacing:1,marginBottom:6}}>{activeCard.label} CURRENT</div>
                  <div style={{fontFamily:headline,fontSize:48,color:activeCard.color,letterSpacing:-2,lineHeight:1}}>{activeCard.value}</div>
                </div>
                <div>
                  <div style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,letterSpacing:1,marginBottom:6}}>5Y PERCENTILE</div>
                  <div style={{marginTop:8}}>
                    <div style={{height:6,background:palette.edge,borderRadius:100,position:'relative'}}>
                      <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${activeCard.percentile}%`,background:activeCard.color,borderRadius:100,transition:'width .5s'}}/>
                      <div style={{position:'absolute',left:`${activeCard.percentile}%`,top:-4,transform:'translateX(-50%)',fontFamily:GT.fontMono,fontSize:9,color:activeCard.color,fontWeight:700,marginTop:-16}}>{activeCard.percentile}th</div>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',fontFamily:GT.fontMono,fontSize:8,color:GT.textVeryDim,marginTop:4}}>
                      <span>Cheap</span><span>Fair</span><span>Rich</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,letterSpacing:1,marginBottom:6}}>CONTEXT</div>
                  <div style={{fontSize:12,color:GT.text,lineHeight:1.5}}>{activeCard.pctLabel}</div>
                  <div style={{marginTop:8,fontFamily:GT.fontMono,fontSize:10,color:activeCard.color,fontWeight:700}}>
                    {activeCard.percentile>80?'⚠ EXPENSIVE vs history':activeCard.percentile<40?'✓ ATTRACTIVE vs history':'◈ FAIR VALUE range'}
                  </div>
                </div>
              </div>
            </div>
          </Panel>
          {/* Peer comp */}
          {t.quant&&t.quant.peers&&(
            <Panel kicker="Peer comparison" title={t.quant.peers[0]?.label||'P/E comparison'} accent={palette.b}>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {t.quant.peers.map((p,i)=>{
                  const max=Math.max(...t.quant.peers.map(x=>x.val));
                  return(
                    <div key={i} style={{display:'grid',gridTemplateColumns:'80px 1fr 50px',alignItems:'center',gap:10}}>
                      <span style={{fontFamily:GT.fontMono,fontSize:11,fontWeight:p.active?700:500,color:p.active?palette.a:GT.textDim,letterSpacing:0.5}}>{p.sym}</span>
                      <div style={{height:16,background:'rgba(255,255,255,.04)',position:'relative'}}>
                        <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${(p.val/max)*100}%`,background:p.active?palette.a:palette.aSoft,border:p.active?`1px solid ${palette.a}`:'none',transition:'width .5s'}}/>
                      </div>
                      <span style={{fontFamily:GT.fontMono,fontSize:11,color:GT.text,textAlign:'right'}}>{p.val.toFixed(1)}×</span>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </>
      )}

      {/* Statement sections — visual chart + table */}
      {section==='income'&&dd&&(
        <Panel kicker={`Income Statement · ${t.sym}`} title={mode==='annual'?'Annual':'Quarterly'}
          accent={palette.a} right={dd.unit+' '+dd.currency}>
          <FinBarChart rows={mode==='quarterly'?view.income||[]:dd.annual.income} periods={periods} accent={palette.a}/>
          <StatementTableFin rows={mode==='quarterly'?view.income||[]:dd.annual.income} periods={periods} palette={palette} headline={headline}/>
        </Panel>
      )}
      {section==='balance'&&dd&&(()=>{
        const bRows=(mode==='quarterly'&&view.balance?.length)?view.balance:dd.annual.balance;
        const bPeriods=(mode==='quarterly'&&view.balance?.length)?(view.periods||dd.annual.periods):dd.annual.periods;
        const bMode=(mode==='quarterly'&&view.balance?.length)?'Quarterly':'Annual';
        return(
          <Panel kicker={`Balance Sheet · ${t.sym}`} title={bMode}
            accent={palette.b} right={dd.unit+' '+dd.currency}>
            <FinBarChart rows={bRows} periods={bPeriods} accent={palette.b} height={140}/>
            <StatementTableFin rows={bRows} periods={bPeriods} palette={palette} headline={headline}/>
          </Panel>
        );
      })()}
      {section==='cashflow'&&dd&&(()=>{
        const cfRows=(mode==='quarterly'&&view.cashflow?.length)?view.cashflow:dd.annual.cashflow;
        const cfPeriods=(mode==='quarterly'&&view.cashflow?.length)?(view.periods||dd.annual.periods):dd.annual.periods;
        const cfMode=(mode==='quarterly'&&view.cashflow?.length)?'Quarterly':'Annual';
        return(
          <Panel kicker={`Cash Flow · ${t.sym}`} title={cfMode}
            accent="#f472b6" right={dd.unit+' '+dd.currency}>
            <CashFlowChart rows={cfRows} periods={cfPeriods} accent="#f472b6"/>
            <StatementTableFin rows={cfRows} periods={cfPeriods} palette={palette} headline={headline}/>
          </Panel>
        );
      })()}
      {section==='segments'&&(
        <Panel kicker={`Segments · ${t.sym}`} title="Revenue mix" accent={palette.b}>
          <div style={{display:'flex',alignItems:'center',gap:24}}>
            <Donut segments={t.segments} size={180}/>
            <div style={{flex:1}}>
              {t.segments.map((s,i)=>(
                <div key={i} style={{padding:'10px 0',borderBottom:i<t.segments.length-1?`1px dashed ${palette.edge}`:'none'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                    <span style={{width:10,height:10,background:[palette.a,palette.b,'#f472b6',palette.a+'aa'][i],flexShrink:0}}/>
                    <span style={{fontSize:13,color:GT.text,flex:1}}>{s.name}</span>
                    <span style={{fontFamily:GT.fontMono,fontSize:12,color:GT.textDim}}>${s.val}</span>
                    <span style={{fontFamily:GT.fontMono,fontSize:12,color:GT.text,fontWeight:700,width:44,textAlign:'right'}}>{s.pct.toFixed(1)}%</span>
                  </div>
                  <div style={{height:4,background:palette.edge,borderRadius:100,position:'relative'}}>
                    <div style={{position:'absolute',left:0,top:0,bottom:0,width:s.pct+'%',background:[palette.a,palette.b,'#f472b6',palette.a+'aa'][i],borderRadius:100,transition:'width .6s'}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Tab: Deep Dive — narrative only, visual storytelling
// ════════════════════════════════════════════════════════════════════
const DD_NAV=[
  {key:'thesis',     label:'Thesis',      icon:'◆', desc:'Investment case'},
  {key:'business',   label:'Business',    icon:'▦', desc:'Model & revenue mix'},
  {key:'drivers',    label:'Drivers',     icon:'▲', desc:'Growth catalysts'},
  {key:'competitive',label:'Competitive', icon:'◉', desc:'Moat & positioning'},
  {key:'bear',       label:'Bear Case',   icon:'▼', desc:'Risks & downsides'},
  {key:'catalysts',  label:'Catalysts',   icon:'◌', desc:'Near-term events'},
];

function DDNavItem({sec,active,onClick}){
  const {palette}=useTheme();
  return(
    <button onClick={onClick} style={{
      display:'flex',alignItems:'center',gap:10,padding:'12px 14px',
      background:active?palette.aSoft:'transparent',
      border:'none',borderLeft:active?`3px solid ${palette.a}`:'3px solid transparent',
      cursor:'pointer',textAlign:'left',width:'100%',transition:'all .15s',
    }}
    onMouseEnter={e=>{if(!active)e.currentTarget.style.background='rgba(255,255,255,.04)';}}
    onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent';}}
    >
      <span style={{fontSize:12,color:active?palette.a:GT.textVeryDim,width:16,flexShrink:0}}>{sec.icon}</span>
      <div>
        <div style={{fontFamily:GT.fontMono,fontSize:10,fontWeight:700,letterSpacing:1,color:active?GT.text:GT.textDim}}>{sec.label}</div>
        <div style={{fontFamily:GT.fontMono,fontSize:8,color:GT.textVeryDim,marginTop:1}}>{sec.desc}</div>
      </div>
    </button>
  );
}

// ── Deep Dive helpers ────────────────────────────────────────────
// Key Takeaways block — sits at the top of each section.
function DDTakeaways({items}){
  if(!items||!items.length) return null;
  return(
    <div className="gt-dd-takeaways">
      <div className="gt-dd-takeaways-title">◆ Key Takeaways</div>
      {items.map((it,i)=>(
        <div key={i} className="gt-dd-bullet">
          <span className="gt-dd-bullet-marker">▸</span>
          <span className="gt-dd-bullet-body"><DDRichText text={it}/></span>
        </div>
      ))}
    </div>
  );
}

// Auto-highlight tickers (4-letter caps), $-numbers, %-numbers, and
// CamelCase keywords wrapped in **bold** or `code` style markers.
function DDRichText({text}){
  if(typeof text!=='string') return text||null;
  // tokenize on tickers, dollar/percent figures, and **emphasis** spans.
  const re=/(\*\*[^*]+\*\*)|(\$\d[\d,.]*[BMKbmk]?)|((?:^|\s)[A-Z]{2,5}(?=[\s.,):]|$))|(\b\d{1,3}(?:\.\d+)?%)/g;
  const out=[]; let last=0, m, k=0;
  while((m=re.exec(text))!==null){
    if(m.index>last) out.push(text.slice(last,m.index));
    const tok=m[0];
    if(tok.startsWith('**')){
      out.push(<span key={k++} className="gt-key">{tok.slice(2,-2)}</span>);
    } else if(tok.trim().startsWith('$')){
      out.push(<span key={k++} className="gt-metric">{tok}</span>);
    } else if(tok.endsWith('%')){
      const isDown=tok.startsWith('-');
      out.push(<span key={k++} className={isDown?'gt-metric-down':'gt-metric'}>{tok}</span>);
    } else {
      // ticker — preserve leading whitespace
      const lead=tok.match(/^\s*/)[0];
      out.push(lead, <span key={k++} className="gt-tkr">{tok.trim()}</span>);
    }
    last=re.lastIndex;
  }
  if(last<text.length) out.push(text.slice(last));
  return <>{out}</>;
}

// Auto-extract takeaways from a narrative chunk: the first sentence of each
// paragraph, or fall back to a generic summary line. Lets us add takeaways
// without requiring data-model changes to NARRATIVE.
function deriveTakeaways(source){
  if(!source) return [];
  if(Array.isArray(source.takeaways)&&source.takeaways.length) return source.takeaways;
  if(Array.isArray(source.paragraphs)){
    return source.paragraphs.slice(0,3).map(p=>{
      const m=p.match(/^[^.!?]+[.!?]/);
      return (m?m[0]:p).trim();
    });
  }
  if(Array.isArray(source.points)) return source.points.slice(0,3);
  if(Array.isArray(source)) return source.slice(0,3).map(d=>typeof d==='string'?d:(d.label||d.body||''));
  return [];
}

function TabDeepDive({t}){
  const {palette,headline,density}=useTheme();
  const narr=(typeof NARRATIVE!=='undefined'&&NARRATIVE[t.sym])||null;
  const [section,setSection]=dsUseState('thesis');
  if(!narr) return<div style={{padding:32,color:GT.textDim}}>Narrative not loaded.</div>;

  return(
    <div style={{display:'flex',flexDirection:'column',gap:density.gap}}>
      {/* Hero banner */}
      <div style={{
        background:`linear-gradient(135deg,${palette.aSoft},${palette.bSoft})`,
        border:`1px solid ${palette.edge}`,padding:'22px 26px',position:'relative',overflow:'hidden',
      }}>
        <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:10,flexWrap:'wrap'}}>
          <span style={{fontFamily:GT.fontMono,fontSize:9,padding:'3px 9px',borderRadius:100,background:palette.a,color:'#fff',letterSpacing:1.5,fontWeight:700}}>{narr.rating}</span>
          <span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,letterSpacing:1.2}}>⏱ {narr.timeHorizon}</span>
          <span style={{marginLeft:'auto',fontFamily:GT.fontMono,fontSize:9,color:GT.textDim}}>UPDATED 25.MAY.2026</span>
        </div>
        <div className="gt-deep-headline" style={{fontFamily:headline,fontSize:28,fontWeight:400,lineHeight:1.25,letterSpacing:-0.5,color:GT.text,maxWidth:780}}>
          {narr.headline}
        </div>
        {/* Conviction bars */}
        <div style={{display:'flex',gap:14,marginTop:14,flexWrap:'wrap'}}>
          {[['Thesis strength','92%',palette.a],['Mgmt quality','88%',GT.green],['Moat width','85%',palette.b],['Timing','70%',GT.amber]].map(([l,v,c],i)=>(
            <div key={i} style={{minWidth:120}}>
              <div style={{display:'flex',justifyContent:'space-between',fontFamily:GT.fontMono,fontSize:8,marginBottom:3}}>
                <span style={{color:GT.textDim}}>{l}</span><span style={{color:c,fontWeight:700}}>{v}</span>
              </div>
              <div style={{height:3,background:palette.edge,borderRadius:100}}>
                <div style={{width:v,height:'100%',background:c,borderRadius:100}}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column: nav + content */}
      <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:0,border:`1px solid ${palette.edge}`,background:GT.glass,backdropFilter:'blur(20px)'}}>
        {/* Left nav */}
        <div style={{borderRight:`1px solid ${palette.edge}`,paddingTop:6,paddingBottom:6}}>
          <div style={{fontFamily:GT.fontMono,fontSize:8,color:GT.textVeryDim,letterSpacing:1.5,padding:'8px 14px 6px'}}>// SECTIONS</div>
          {DD_NAV.map(s=><DDNavItem key={s.key} sec={s} active={section===s.key} onClick={()=>setSection(s.key)}/>)}
        </div>
        {/* Right content */}
        <div style={{padding:'20px 24px',minHeight:400}}>
          {section==='thesis'&&narr.thesis&&(
            <div>
              <DDTakeaways items={deriveTakeaways(narr.thesis)}/>
              <div className="gt-mixed-grid">
                <div>
                  <div style={{fontFamily:headline,fontSize:20,color:GT.text,lineHeight:1.35,letterSpacing:-0.3,fontStyle:'italic',marginBottom:16,paddingLeft:16,borderLeft:`3px solid ${palette.a}`}}>
                    "<DDRichText text={narr.thesis.oneLiner}/>"
                  </div>
                  <div className="gt-dd-body">
                    {narr.thesis.paragraphs.map((p,i)=>(
                      <p key={i}><DDRichText text={p}/></p>
                    ))}
                  </div>
                </div>
                {/* Inline mixed-media sidebar: price snapshot + sparkline + scenario chips */}
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <div className="gt-mixed-card">
                    <div className="gt-mixed-card-label">Snapshot · {t.sym}</div>
                    <div style={{fontFamily:headline,fontSize:28,color:GT.text,letterSpacing:-0.6,lineHeight:1}}>${t.px.toFixed(2)}</div>
                    <div style={{fontFamily:GT.fontMono,fontSize:11,color:t.chg>=0?GT.green:GT.red,fontWeight:700,marginTop:4}}>
                      {t.chg>=0?'▲ +':'▼ '}{t.chg.toFixed(2)} ({t.chg>=0?'+':''}{t.chgPct.toFixed(2)}%)
                    </div>
                    <div style={{marginTop:10}}>
                      <MiniSpark spark={(SPARKS[t.sym]||[]).slice(-30)} up={t.chg>=0} width={220} height={40}/>
                    </div>
                  </div>
                  {t.scenarios&&(
                    <div className="gt-mixed-card" style={{borderLeftColor:palette.a}}>
                      <div className="gt-mixed-card-label">Scenarios · 12M</div>
                      <table style={{width:'100%',borderCollapse:'collapse',fontFamily:GT.fontMono,fontSize:10}}>
                        <tbody>
                          {t.scenarios.map((s,i)=>{
                            const c=s.label==='BULL'?GT.green:s.label==='BEAR'?GT.red:palette.a;
                            return(
                              <tr key={i} style={{borderBottom:i<t.scenarios.length-1?`1px dashed ${palette.edge}`:'none'}}>
                                <td style={{padding:'5px 0',color:c,fontWeight:700,letterSpacing:1}}>{s.label}</td>
                                <td style={{padding:'5px 0',color:GT.text,textAlign:'right',fontWeight:700}}>${s.px}</td>
                                <td style={{padding:'5px 0',color:c,textAlign:'right',fontWeight:700,paddingLeft:8}}>{s.chg}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {section==='business'&&narr.business&&(
            <div>
              <DDTakeaways items={[narr.business.whatItDoes,narr.business.pricingPower].filter(Boolean).map(s=>(typeof s==='string'?s.split('.')[0]+'.':''))}/>
              <div className="gt-stagger" style={{display:'flex',flexDirection:'column',gap:0}}>
                {[['What it does',narr.business.whatItDoes],['Revenue mix',narr.business.revenueMix],['Who buys',narr.business.whoBuys],['Pricing power',narr.business.pricingPower]].map(([k,v],i)=>(
                  <div key={i} className="gt-narr-row" style={{display:'grid',gridTemplateColumns:'120px 1fr',gap:16,padding:'13px 0',borderBottom:i<3?`1px dashed ${palette.edge}`:'none'}}>
                    <Kicker color={palette.a}>{k}</Kicker>
                    <div style={{fontSize:13,color:GT.text,lineHeight:1.6}}><DDRichText text={v}/></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {section==='drivers'&&narr.drivers&&(
            <div>
              <DDTakeaways items={narr.drivers.slice(0,3).map(d=>d.label+' — '+(typeof d.body==='string'?d.body.split('.')[0]+'.':'') )}/>
              <div style={{display:'flex',flexDirection:'column',gap:0}}>
                {narr.drivers.map((d,i)=>{
                  const c=d.tone==='g'?GT.green:d.tone==='r'?GT.red:GT.amber;
                  return(
                    <div key={i} style={{display:'grid',gridTemplateColumns:'10px 1fr',gap:14,padding:'13px 0',alignItems:'flex-start',borderBottom:i<narr.drivers.length-1?`1px dashed ${palette.edge}`:'none'}}>
                      <span style={{width:10,height:10,borderRadius:'50%',background:c,marginTop:5,flexShrink:0,boxShadow:`0 0 8px ${c}`}}/>
                      <div>
                        <div style={{fontFamily:headline,fontSize:16,color:GT.text,letterSpacing:-0.2,marginBottom:3}}>{d.label}</div>
                        <div style={{fontSize:12,color:GT.textDim,lineHeight:1.55}}><DDRichText text={d.body}/></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {section==='competitive'&&narr.competitive&&(
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr>
                    {['// Area','Status','Notes'].map((h,i)=>(
                      <th key={i} style={{textAlign:i===1?'center':'left',padding:'8px 10px',borderBottom:`1px solid ${palette.edge}`,color:GT.textDim,fontSize:9,letterSpacing:1.2,fontWeight:700,textTransform:'uppercase'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {narr.competitive.map(([area,status,note],i)=>{
                    const c=status==='WIN'||status==='AHEAD'?GT.green:status==='BEHIND'||status==='RISK'?GT.red:GT.amber;
                    return(
                      <tr key={i} style={{borderBottom:`1px dashed ${palette.edge}`}}>
                        <td style={{padding:'11px 10px',color:GT.text,fontFamily:headline,fontSize:14,letterSpacing:-0.1}}>{area}</td>
                        <td style={{padding:'11px 10px',textAlign:'center'}}>
                          <span style={{fontFamily:GT.fontMono,fontSize:9,padding:'2px 8px',borderRadius:100,color:c,border:`1px solid ${c}`,fontWeight:700,letterSpacing:1.2}}>{status}</span>
                        </td>
                        <td style={{padding:'11px 10px',color:GT.textDim,fontSize:12,lineHeight:1.5}}>{note}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {section==='bear'&&narr.bear&&(
            <div>
              <DDTakeaways items={(narr.bear.points||[]).slice(0,3).map(p=>(typeof p==='string'?p.split('.')[0]+'.':''))}/>
              <div style={{fontFamily:headline,fontSize:18,color:GT.text,marginBottom:12,letterSpacing:-0.2}}>{narr.bear.title}</div>
              <ol style={{paddingLeft:0,listStyle:'none',display:'flex',flexDirection:'column',gap:10}}>
                {narr.bear.points.map((p,i)=>(
                  <li key={i} style={{display:'grid',gridTemplateColumns:'28px 1fr',gap:12,padding:'11px 13px',background:'rgba(239,68,68,.04)',border:`1px solid rgba(239,68,68,.15)`,borderLeft:`3px solid ${GT.red}`}}>
                    <span style={{fontFamily:GT.fontMono,fontSize:16,color:GT.red,fontWeight:700}}>{i+1}</span>
                    <div style={{fontSize:13,color:GT.text,lineHeight:1.6}}><DDRichText text={p}/></div>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {section==='catalysts'&&narr.catalysts&&(
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:10}}>
              {narr.catalysts.map((c,i)=>(
                <div key={i} style={{padding:'14px 16px',background:'rgba(255,255,255,.02)',border:`1px solid ${palette.edge}`,borderLeft:`3px solid ${palette.a}`}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
                    <span style={{fontFamily:GT.fontMono,fontSize:10,color:palette.a,fontWeight:700,letterSpacing:1.2}}>{c.date}</span>
                    <span style={{padding:'1px 7px',fontFamily:GT.fontMono,fontSize:8,fontWeight:700,background:palette.aSoft,color:palette.a,letterSpacing:1,borderRadius:4}}>{c.tag}</span>
                  </div>
                  <div style={{fontSize:12,color:GT.text,lineHeight:1.55}}>{c.note}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Tab: News — full hub with live feed + curated + filters
// ════════════════════════════════════════════════════════════════════
function TradingViewHeatmap(){
  const ref=dsUseRef(null);
  dsUseEffect(()=>{
    const el=ref.current; if(!el) return;
    el.innerHTML='';
    const inner=document.createElement('div');
    inner.className='tradingview-widget-container__widget';
    inner.style.cssText='width:100%;height:500px';
    el.appendChild(inner);
    const s=document.createElement('script');
    s.src='https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
    s.async=true; s.type='text/javascript';
    s.innerHTML=JSON.stringify({
      exchanges:[],dataSource:'SPX500',grouping:'sector',
      blockSize:'market_cap_basic',blockColor:'change',
      locale:'en',colorTheme:'dark',hasTopBar:false,
      isDataSetEnabled:false,isZoomEnabled:true,
      hasSymbolTooltip:true,isMonoSize:false,
      width:'100%',height:500,
    });
    el.appendChild(s);
    return()=>{el.innerHTML='';};
  },[]);
  return<div ref={ref} className="tradingview-widget-container" style={{width:'100%',height:500}}/>;
}

function YahooNewsHub({sym}){
  const {palette,headline}=useTheme();
  const [items,setItems]=dsUseState([]);
  const [status,setStatus]=dsUseState('loading');
  const [lastFetch,setLastFetch]=dsUseState(null);

  const load=React.useCallback(()=>{
    let cancelled=false;
    setStatus('loading');
    async function fetch_(){
      const url=(window.LIVE&&window.LIVE.yahooNewsURL)?window.LIVE.yahooNewsURL(sym):`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${sym}&region=US&lang=en-US`;
      const proxies=(window.LIVE&&window.LIVE.corsProxies)||['https://api.allorigins.win/raw?url='];
      for(const p of proxies){
        try{
          const r=await fetch(p+encodeURIComponent(url),{mode:'cors'});
          if(!r.ok) continue;
          const text=await r.text();
          const doc=new DOMParser().parseFromString(text,'text/xml');
          const nodes=Array.from(doc.querySelectorAll('item')).slice(0,10);
          const list=nodes.map(n=>({
            title:n.querySelector('title')?.textContent||'',
            link:n.querySelector('link')?.textContent||'#',
            date:n.querySelector('pubDate')?.textContent||'',
            desc:(n.querySelector('description')?.textContent||'').replace(/<[^>]+>/g,'').slice(0,240),
          })).filter(x=>x.title);
          if(cancelled) return;
          if(list.length){setItems(list);setStatus('ok');setLastFetch(new Date());return;}
        }catch(e){}
      }
      if(!cancelled) setStatus('error');
    }
    fetch_();
    return()=>{cancelled=true;};
  },[sym]);

  dsUseEffect(()=>{
    const cleanup=load();
    return cleanup;
  },[sym,load]);

  // Auto-refresh every 5 minutes
  dsUseEffect(()=>{
    const id=setInterval(()=>load(),300000);
    return()=>clearInterval(id);
  },[load]);

  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{width:5,height:5,borderRadius:'50%',background:status==='ok'?GT.green:status==='loading'?GT.amber:GT.red,display:'inline-block',boxShadow:status==='ok'?`0 0 6px ${GT.green}`:'none'}}/>
          <span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim}}>
            {status==='loading'?'FETCHING LIVE FEED…':status==='ok'?`LIVE · ${items.length} stories`:' FEED UNAVAILABLE'}
          </span>
          {lastFetch&&<span style={{fontFamily:GT.fontMono,fontSize:8,color:GT.textVeryDim}}>· refreshed {lastFetch.toLocaleTimeString()}</span>}
        </div>
        <button onClick={()=>load()} style={{padding:'4px 10px',background:'transparent',border:`1px solid ${palette.edge}`,color:GT.textDim,fontFamily:GT.fontMono,fontSize:9,cursor:'pointer',borderRadius:4,letterSpacing:1}}>
          ↺ REFRESH
        </button>
      </div>
      {status==='loading'&&(
        <div style={{padding:24,color:GT.textDim,fontFamily:GT.fontMono,fontSize:12,textAlign:'center'}}>Fetching {sym} headlines…</div>
      )}
      {status==='error'&&(
        <div style={{padding:14,background:'rgba(251,191,36,.05)',border:`1px solid rgba(251,191,36,.2)`,color:GT.amber,fontFamily:GT.fontMono,fontSize:11}}>
          Live feed blocked by CORS. Curated headlines available below.
        </div>
      )}
      {status==='ok'&&(
        <div style={{display:'grid',gap:10}}>
          {items.map((n,i)=>(
            <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" style={{
              padding:'14px 16px',display:'block',
              background:'rgba(255,255,255,.02)',
              border:`1px solid ${palette.edge}`,
              borderLeft:`3px solid ${palette.a}`,
              textDecoration:'none',transition:'all .15s',
            }}
            onMouseEnter={e=>{e.currentTarget.style.background=palette.aSoft;e.currentTarget.style.borderLeftColor=palette.b;}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.02)';e.currentTarget.style.borderLeftColor=palette.a;}}
            >
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                <div style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim}}>{n.date}</div>
                <span style={{fontFamily:GT.fontMono,fontSize:8,color:palette.a,letterSpacing:1}}>OPEN ↗</span>
              </div>
              <div style={{fontFamily:headline,fontSize:15,color:GT.text,lineHeight:1.35,letterSpacing:-0.1,marginBottom:5}}>{n.title}</div>
              {n.desc&&<div style={{fontSize:11,color:GT.textDim,lineHeight:1.5}}>{n.desc}</div>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function CuratedNewsCard({n,compact}){
  const {palette,headline}=useTheme();
  const sentColor=n.sent==='BUL'?GT.green:n.sent==='BER'?GT.red:GT.amber;
  const searchUrl=`https://www.google.com/search?q=${encodeURIComponent(n.title+' '+n.src)}`;
  return(
    <a href={searchUrl} target="_blank" rel="noopener noreferrer" style={{
      padding:compact?'12px 14px':'14px 16px',display:'block',
      background:'rgba(255,255,255,.02)',border:`1px solid ${palette.edge}`,
      borderLeft:`3px solid ${sentColor}`,textDecoration:'none',
      transition:'all .15s',
    }}
    onMouseEnter={e=>{e.currentTarget.style.background=`${sentColor}0a`;e.currentTarget.style.borderColor=sentColor;}}
    onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.02)';e.currentTarget.style.borderColor=palette.edge;e.currentTarget.style.borderLeftColor=sentColor;}}
    >
      <div style={{display:'flex',gap:7,fontFamily:GT.fontMono,fontSize:9,marginBottom:5,flexWrap:'wrap',alignItems:'center'}}>
        <span style={{color:palette.a,fontWeight:700,letterSpacing:1}}>{n.tkr}</span>
        <span style={{padding:'1px 5px',background:palette.aSoft,color:palette.a,letterSpacing:0.6,fontWeight:600}}>{n.tag}</span>
        <span style={{color:GT.textDim}}>{n.date}</span>
        <span style={{color:GT.textDim}}>· {n.src}</span>
        <span style={{marginLeft:'auto',color:sentColor,fontWeight:700,letterSpacing:0.6}}>
          {n.sent==='BUL'?'▲':n.sent==='BER'?'▼':'◆'} {n.sent}
        </span>
        <span style={{fontFamily:GT.fontMono,fontSize:8,color:palette.b}}>↗</span>
      </div>
      <div style={{fontFamily:headline,fontSize:compact?14:16,color:GT.text,lineHeight:1.35,letterSpacing:-0.1}}>{n.title}</div>
      {!compact&&n.blurb&&<div style={{fontSize:11,color:GT.textDim,marginTop:5,lineHeight:1.5}}>{n.blurb}</div>}
    </a>
  );
}

function TabNews({t}){
  const {palette,density}=useTheme();
  const [tickerF,setTickerF]=dsUseState('ALL');
  const [sentF,setSentF]=dsUseState('ALL');
  const filtered=NEWS.filter(n=>(tickerF==='ALL'||n.tkr===tickerF)&&(sentF==='ALL'||n.sent===sentF));
  const sentCounts={BUL:NEWS.filter(n=>n.sent==='BUL').length,BER:NEWS.filter(n=>n.sent==='BER').length,NEU:NEWS.filter(n=>n.sent==='NEU').length};

  const chipBtn=(label,active,onClick,color)=>(
    <button onClick={onClick} style={{
      padding:'4px 10px',borderRadius:100,fontFamily:GT.fontMono,fontSize:9,fontWeight:700,
      letterSpacing:1,cursor:'pointer',border:`1px solid ${active?(color||palette.a):palette.edge}`,
      background:active?((color||palette.a)+'20'):'transparent',
      color:active?(color||palette.a):GT.textDim,transition:'all .15s',
    }}>{label}</button>
  );

  return(
    <div style={{display:'flex',flexDirection:'column',gap:density.gap}}>
      {/* Live feed */}
      <Panel kicker={`Yahoo Finance · ${t.sym}`} title="Live news feed" accent={GT.amber}
        right={<span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.green}}>● LIVE · auto-refreshes 5min</span>}>
        <YahooNewsHub sym={t.sym}/>
      </Panel>

      {/* Sentiment summary */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:0,background:GT.glass,backdropFilter:'blur(20px)',border:`1px solid ${palette.edge}`}}>
        {[['▲ BULLISH',sentCounts.BUL,GT.green,'BUL'],['◆ NEUTRAL',sentCounts.NEU,GT.amber,'NEU'],['▼ BEARISH',sentCounts.BER,GT.red,'BER']].map(([l,n,c,k],i)=>(
          <div key={i} onClick={()=>setSentF(sentF===k?'ALL':k)} style={{
            padding:'14px 16px',borderRight:i<2?`1px dashed ${palette.edge}`:'none',
            cursor:'pointer',background:sentF===k?`${c}0d`:'transparent',transition:'background .15s',
          }}>
            <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:9,color:GT.textDim,letterSpacing:1,marginBottom:4}}>{l}</div>
            <div style={{fontFamily:'Instrument Serif,serif',fontSize:36,color:c,lineHeight:1}}>{n}</div>
            <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:8,color:GT.textVeryDim,marginTop:3}}>stories in feed</div>
          </div>
        ))}
      </div>

      {/* Curated news with filters */}
      <Panel kicker="Curated intelligence" title="Analyst & media coverage" accent={palette.a}>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
          <span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,alignSelf:'center',marginRight:4}}>TICKER</span>
          {['ALL',...ORDER].map(s=>chipBtn(s,tickerF===s,()=>setTickerF(s),s==='ALL'?undefined:palette.b))}
          <div style={{width:1,background:palette.edge,margin:'0 4px'}}/>
          <span style={{fontFamily:GT.fontMono,fontSize:9,color:GT.textDim,alignSelf:'center',marginRight:4}}>SENT</span>
          {[['ALL',undefined],['BUL',GT.green],['NEU',GT.amber],['BER',GT.red]].map(([s,c])=>chipBtn(s,sentF===s,()=>setSentF(s),c))}
        </div>
        {filtered.length===0&&(
          <div style={{padding:20,textAlign:'center',color:GT.textDim,fontFamily:GT.fontMono,fontSize:12}}>No stories match this filter.</div>
        )}
        <div style={{display:'grid',gap:10}}>
          {filtered.map((n,i)=><CuratedNewsCard key={i} n={n}/>)}
        </div>
      </Panel>
    </div>
  );
}

// ── Risk tab ─────────────────────────────────────────────────────
function TabRisk({t}){
  const {palette,headline,density}=useTheme();
  return(
    <div style={{display:'flex',flexDirection:'column',gap:density.gap}}>
      <Panel kicker="12-month scenarios" title={`${t.sym} · probability-weighted`} accent={palette.a}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:0}}>
          {t.scenarios.map((s,i)=>{
            const c=s.label==='BULL'?GT.green:s.label==='BEAR'?GT.red:palette.a;
            return(
              <div key={i} style={{padding:'22px 24px',borderRight:i<2?`1px dashed ${palette.edge}`:'none'}}>
                <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:12}}>
                  <span style={{fontFamily:GT.fontMono,fontSize:11,fontWeight:700,color:c,letterSpacing:1.4,padding:'3px 9px',border:`1px solid ${c}`,borderRadius:100}}>{s.label}</span>
                  <span style={{fontFamily:GT.fontMono,fontSize:10,color:GT.textDim}}>P = {s.prob}%</span>
                </div>
                <div style={{fontFamily:headline,fontSize:52,color:GT.text,lineHeight:1,letterSpacing:-2,marginBottom:6}}>${s.px}</div>
                <div style={{fontFamily:GT.fontMono,fontSize:13,color:c,fontWeight:700,marginBottom:12}}>{s.chg}</div>
                <div style={{fontSize:12,color:GT.textDim,lineHeight:1.5}}>{s.drivers}</div>
                <div style={{marginTop:12,height:3,background:palette.edge,borderRadius:100}}>
                  <div style={{width:s.prob+'%',height:'100%',background:c,borderRadius:100}}/>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{marginTop:16,height:8,display:'flex',borderRadius:100,overflow:'hidden'}}>
          {t.scenarios.map((s,i)=>{
            const c=s.label==='BULL'?GT.green:s.label==='BEAR'?GT.red:palette.a;
            return<div key={i} style={{width:s.prob+'%',background:c,opacity:0.8}}/>;
          })}
        </div>
      </Panel>
      <Panel kicker="Risk matrix" title="What could break the thesis" accent="#f472b6">
        {t.risks.map((r,i)=>{
          const c=r.lvl==='HIGH'?GT.red:r.lvl==='MED'?GT.amber:GT.green;
          return(
            <div key={i} style={{display:'grid',gridTemplateColumns:'65px 1fr',gap:16,padding:'12px 0',alignItems:'flex-start',borderBottom:i<t.risks.length-1?`1px dashed ${palette.edge}`:'none'}}>
              <span style={{fontFamily:GT.fontMono,fontSize:10,fontWeight:700,color:c,letterSpacing:1.4,padding:'3px 7px',border:`1px solid ${c}`,borderRadius:100,textAlign:'center'}}>{r.lvl}</span>
              <div>
                <div style={{fontFamily:headline,fontSize:16,color:GT.text,letterSpacing:-0.2,marginBottom:3}}>{r.name}</div>
                <div style={{fontSize:12,color:GT.textDim,lineHeight:1.5}}>{r.note}</div>
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

// ── Right rail ───────────────────────────────────────────────────
function DashRightRail({t}){
  const {palette,headline}=useTheme();
  return(
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <Panel kicker={`Analyst consensus · ${t.analysts}`} title="" accent={palette.b}>
        {(()=>{
          // Always compute upside vs LIVE price (t.px) — handles the case
          // where the live feed has pushed price past the static target.
          const liveUp=((t.target/t.px)-1)*100;
          const upColor=liveUp<0?GT.red:GT.green;
          return(
            <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between'}}>
              <span style={{fontFamily:headline,fontSize:32,color:GT.text,letterSpacing:-1.2,lineHeight:1}}>${t.target.toFixed(0)}</span>
              <span style={{fontFamily:GT.fontMono,fontSize:12,color:upColor,fontWeight:700,textShadow:`0 0 8px ${upColor}55`}}>
                {liveUp>=0?'+':''}{liveUp.toFixed(2)}%
              </span>
            </div>
          );
        })()}
        <Kicker color={GT.textDim} style={{marginTop:2}}>AVG 12M TARGET</Kicker>
        <div style={{marginTop:12,height:6,background:palette.edge,position:'relative',borderRadius:100}}>
          <div style={{position:'absolute',left:'10%',top:0,bottom:0,right:0,background:`linear-gradient(90deg,${palette.b},${palette.a},#f472b6)`,borderRadius:100}}/>
          <div style={{position:'absolute',left:'60%',top:-3,bottom:-3,width:2,background:GT.text}}/>
        </div>
        <div style={{marginTop:12,display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5}}>
          {[['BUY',Math.round(t.analysts*0.7),GT.green],['OW',Math.round(t.analysts*0.15),GT.green],['HOLD',Math.round(t.analysts*0.10),GT.amber],['UW',Math.round(t.analysts*0.03),GT.red],['SELL',Math.max(0,t.analysts-Math.round(t.analysts*0.98)),GT.red]].map(([l,n,c],i)=>(
            <div key={i} style={{border:`1px solid ${palette.edge}`,padding:'7px 0',textAlign:'center'}}>
              <div style={{fontFamily:headline,fontSize:18,color:c,lineHeight:1}}>{n}</div>
              <div style={{fontFamily:GT.fontMono,fontSize:7,color:GT.textDim,marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel kicker="Scenarios · 12M" title="" accent="#f472b6">
        {t.scenarios.map((s,i)=>{
          const c=s.label==='BULL'?GT.green:s.label==='BEAR'?GT.red:palette.a;
          const fillCls=s.label==='BULL'?'gt-scn-bar-fill bull':s.label==='BEAR'?'gt-scn-bar-fill bear':'gt-scn-bar-fill base';
          // Compute chg vs LIVE price (preferred) — fall back to legacy s.chg
          // string only when live px is unavailable.
          const dynChgPct=(t.px&&s.px)?((s.px/t.px-1)*100):null;
          const chgText=dynChgPct!=null
            ? (dynChgPct>=0?'+':'')+dynChgPct.toFixed(0)+'%'
            : (s.chg||'');
          const chgColor=dynChgPct!=null
            ? (dynChgPct>=0?GT.green:GT.red)
            : c;
          return(
            <div key={i} style={{display:'grid',gridTemplateColumns:'78px 1fr 60px 50px',gap:10,alignItems:'center',padding:'10px 0',borderBottom:i<t.scenarios.length-1?`1px dashed ${palette.edge}`:'none'}}>
              <span style={{display:'inline-flex',alignItems:'center',gap:6,fontFamily:GT.fontMono,fontWeight:700,color:c,letterSpacing:1,fontSize:10}}>
                <span className={s.label==='BULL'?'gt-dot gt-dot-bull':s.label==='BEAR'?'gt-dot gt-dot-bear':'gt-dot gt-dot-neut'} style={{width:7,height:7}}/>
                {s.label} {s.prob}%
              </span>
              <span className="gt-scn-bar">
                <span className={fillCls} style={{width:s.prob+'%'}}/>
              </span>
              <span style={{fontFamily:headline,fontSize:16,color:GT.text,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>${s.px}</span>
              <span style={{fontFamily:GT.fontMono,color:chgColor,textAlign:'right',fontSize:10,fontWeight:700,textShadow:`0 0 8px ${chgColor}55`}}>{chgText}</span>
            </div>
          );
        })}
      </Panel>
      <Panel kicker="Headlines" title="" accent={GT.amber}>
        {NEWS.filter(n=>n.tkr===t.sym).slice(0,3).map((n,i)=>{
          const searchUrl=`https://www.google.com/search?q=${encodeURIComponent(n.title)}`;
          return(
            <a key={i} href={searchUrl} target="_blank" rel="noopener noreferrer" style={{
              display:'block',paddingBottom:10,marginBottom:10,
              borderBottom:i<2?`1px dashed ${palette.edge}`:'none',textDecoration:'none',
            }}
            onMouseEnter={e=>e.currentTarget.style.opacity='0.8'}
            onMouseLeave={e=>e.currentTarget.style.opacity='1'}
            >
              <div style={{display:'flex',gap:7,fontFamily:GT.fontMono,fontSize:8,marginBottom:4}}>
                <span style={{color:palette.a,fontWeight:700}}>{n.tag}</span>
                <span style={{color:GT.textDim}}>· {n.date}</span>
                <span style={{marginLeft:'auto',color:n.sent==='BUL'?GT.green:n.sent==='BER'?GT.red:GT.amber,fontWeight:700}}>
                  {n.sent==='BUL'?'▲':n.sent==='BER'?'▼':'◆'}
                </span>
              </div>
              <div style={{fontSize:11,color:GT.text,lineHeight:1.4}}>{n.title}</div>
            </a>
          );
        })}
      </Panel>
      {/* Quick technicals — with neon status dots */}
      <Panel kicker="Technicals · quick" title="" accent={palette.a}>
        {t.technicals.slice(0,4).map((s,i)=>{
          const dotCls=s.tone==='green'?'gt-dot gt-dot-bull':s.tone==='red'?'gt-dot gt-dot-bear':'gt-dot gt-dot-neut';
          const stateColor=toneColor(s.tone);
          return(
          <div key={i} style={{display:'grid',gridTemplateColumns:'auto 1fr auto',gap:10,padding:'9px 0',borderBottom:i<3?`1px dashed ${palette.edge}`:'none',alignItems:'center'}}>
            <span className={dotCls} title={s.state}/>
            <span style={{fontFamily:GT.fontMono,fontSize:10,color:'rgba(199,186,255,.78)',letterSpacing:0.5}}>{s.name}</span>
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:GT.fontMono,fontSize:11,color:GT.text,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{s.v}</div>
              <div style={{fontFamily:GT.fontMono,fontSize:8.5,color:stateColor,letterSpacing:1,fontWeight:700,textShadow:`0 0 6px ${stateColor}55`}}>{s.state}</div>
            </div>
          </div>
        );})}
      </Panel>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Main Dashboard
// ════════════════════════════════════════════════════════════════════
function Dashboard(){
  const [sym,setSym]=dsUseState('NVDA');
  const [tab,setTab]=dsUseState('Overview');
  const [liveVer,setLiveVer]=dsUseState(0);
  const t=TICKERS[sym];
  const {palette}=useTheme();
  const [scanKey,setScanKey]=dsUseState(0);
  dsUseEffect(()=>{setScanKey(k=>k+1);},[sym]);

  // Listen for live-tick events from LiveFeed and force re-render
  dsUseEffect(()=>{
    const onTick=()=>setLiveVer(v=>v+1);
    window.addEventListener('live-tick',onTick);
    return()=>window.removeEventListener('live-tick',onTick);
  },[]);

  let tabContent;
  if(tab==='Overview')         tabContent=<TabOverview t={t} sym={sym} setSym={setSym}/>;
  else if(tab==='Chart')       tabContent=<TabChart t={t}/>;
  else if(tab==='Technical')   tabContent=<TabTechnical t={t}/>;
  else if(tab==='Financials')  tabContent=<TabFinancials t={t}/>;
  else if(tab==='Deep Dive')   tabContent=<TabDeepDive t={t}/>;
  else if(tab==='News')        tabContent=<TabNews t={t}/>;
  else if(tab==='Risk & Scenario') tabContent=<TabRisk t={t}/>;
  else if(tab==='Quant Model') tabContent=<TabQuant t={t}/>;
  else                         tabContent=<TabOverview t={t} sym={sym} setSym={setSym}/>;

  return(
    <section id="dashboard" data-screen-label="Dashboard"
      style={{position:'relative',paddingTop:90,paddingBottom:80}}>
      <div style={{maxWidth:1440,margin:'0 auto',padding:'0 24px'}}>
        <Reveal style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:14}}>
          <div>
            <Kicker>{(()=>{
              const st=window.LIVE&&window.LIVE.feedStatus;
              const isLive=st==='LIVE';
              const ts=window.LIVE&&window.LIVE.lastUpdate;
              const ago=ts?Math.round((Date.now()-ts)/1000):0;
              return <>Deep-dive dashboard · {isLive?<span style={{color:GT.green}}>● LIVE</span>:<span style={{color:GT.amber}}>◌ {st||'STATIC'}</span>}
                {isLive&&ago>0&&<span style={{marginLeft:8,color:'rgba(160,172,200,.6)'}}>updated {ago<60?ago+'s':Math.floor(ago/60)+'m'} ago</span>}</>;
            })()}</Kicker>
            <h2 style={{margin:'5px 0 0',fontFamily:useTheme().headline,fontSize:52,fontWeight:400,lineHeight:1,letterSpacing:-2,color:GT.text}}>
              AI chip stocks<span style={{color:palette.b}}>.</span>
            </h2>
            <div style={{marginTop:7,fontSize:13,color:'rgba(160,172,200,.85)',maxWidth:580,lineHeight:1.5}}>
              Live charts · deep fundamentals · quant models · real-time news.
            </div>
          </div>
          {/* Ticker switcher — uniform 4-column grid, aligned baselines */}
          <div className="gt-ticker-row">
            {ORDER.map(s=>{
              const tk=TICKERS[s];
              const active=sym===s;
              const c=tk.chg>=0?GT.green:GT.red;
              const dotCls=tk.chg>=0?'gt-dot gt-dot-bull gt-dot-live':'gt-dot gt-dot-bear gt-dot-live';
              return(
                <button key={s} onClick={()=>setSym(s)} style={{
                  background:active?palette.aSoft:GT.glass,
                  border:active?`1px solid ${palette.a}`:`1px solid ${palette.edge}`,
                  backdropFilter:'blur(20px)',borderRadius:6,cursor:'pointer',textAlign:'left',
                  transition:'all .15s',
                  boxShadow:active?`0 0 18px -6px ${palette.a}`:'none',
                }}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                    <span style={{fontFamily:GT.fontMono,fontSize:13,fontWeight:700,letterSpacing:1.2,color:active?GT.text:GT.textDim}}>{tk.sym}</span>
                    <span className={dotCls} title={tk.chg>=0?'Up':'Down'}/>
                  </div>
                  <div className="gt-tk-line2">
                    <span style={{fontFamily:GT.fontMono,fontSize:12,color:GT.text,fontVariantNumeric:'tabular-nums'}}>${tk.px.toFixed(2)}</span>
                    <span style={{fontFamily:GT.fontMono,fontSize:9.5,color:c,fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{tk.chg>=0?'▲':'▼'} {tk.chg>=0?'+':''}{tk.chgPct.toFixed(2)}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="gt-scan-host gt-dash-frame" data-scan={scanKey?'1':'0'} key={'scan-'+scanKey} style={{
            background:GT.glassFlat,backdropFilter:'blur(20px) saturate(1.3)',
            WebkitBackdropFilter:'blur(20px) saturate(1.3)',
            border:`1px solid ${palette.edge}`,overflow:'hidden',
            '--gt-scan-c':palette.aSoft,
          }}>
            <QuoteHead t={t} tab={tab} setTab={setTab}/>
            {/* 70/30 split — left tighter, right (Analyst Consensus & Scenarios) gets breathing room */}
            <div className="gt-dash-grid" style={{display:'grid',gridTemplateColumns:'minmax(0,7fr) minmax(360px, 3fr)',gap:0}}>
              <div className="gt-dash-main" style={{padding:'22px 26px',borderRight:`1px dashed ${palette.edge}`,minWidth:0}}>
                <div key={tab+'-'+sym} className="gt-fade-up">{tabContent}</div>
              </div>
              <div className="gt-dash-rail" style={{padding:'22px 22px',borderColor:palette.edge,minWidth:0}}>
                <div key={'rail-'+sym} className="gt-fade-up"><DashRightRail t={t}/></div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

Object.assign(window,{Dashboard});
