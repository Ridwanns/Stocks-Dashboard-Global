// ════════════════════════════════════════════════════════════════════
// Live Market Data Feed — Yahoo Finance integration
// Fetches real-time prices + 6-month OHLCV, computes deep technicals,
// updates TICKERS/SPARKS/CANDLES globals, dispatches 'live-tick' events.
// ════════════════════════════════════════════════════════════════════

(function initLiveFeed(){
  'use strict';
  const SYMBOLS = window.ORDER || ['NVDA','AMD','MU','TSM'];
  // Yahoo Finance symbols (ADR tickers)
  const YF_MAP = { NVDA:'NVDA', AMD:'AMD', MU:'MU', TSM:'TSM' };
  // TradingView symbols for the embedded chart widget
  window.LIVE = Object.assign(window.LIVE||{},{
    active:false, lastUpdate:null, errors:[], feedStatus:'INIT',
    tradingViewSymbols:{ NVDA:'NASDAQ:NVDA', AMD:'NASDAQ:AMD', MU:'NASDAQ:MU', TSM:'NYSE:TSM' },
  });
  window.CANDLES = window.CANDLES || {};

  // ── Global market indices (for the Overview 3D globe) ──────────────
  // Yahoo symbols + lat/lon so markers can be placed on the rotating Earth.
  const INDICES = [
    { id:'N225',  name:'Nikkei 225',     sym:'^N225',     city:'Tokyo',     cc:'JP', flag:'🇯🇵', lat:35.68,  lon:139.69 },
    { id:'KS11',  name:'KOSPI',          sym:'^KS11',     city:'Seoul',     cc:'KR', flag:'🇰🇷', lat:37.57,  lon:126.98 },
    { id:'SSEC',  name:'SSE Composite',  sym:'000001.SS', city:'Shanghai',  cc:'CN', flag:'🇨🇳', lat:31.23,  lon:121.47 },
    { id:'HSI',   name:'Hang Seng',      sym:'^HSI',      city:'Hong Kong', cc:'HK', flag:'🇭🇰', lat:22.32,  lon:114.17 },
    { id:'JKSE',  name:'IDX Composite',  sym:'^JKSE',     city:'Jakarta',   cc:'ID', flag:'🇮🇩', lat:-6.21,  lon:106.85 },
    { id:'FTSE',  name:'FTSE 100',       sym:'^FTSE',     city:'London',    cc:'GB', flag:'🇬🇧', lat:51.51,  lon:-0.13 },
    { id:'GDAXI', name:'DAX',            sym:'^GDAXI',    city:'Frankfurt', cc:'DE', flag:'🇩🇪', lat:50.11,  lon:8.68 },
    { id:'GSPC',  name:'S&P 500',        sym:'^GSPC',     city:'New York',  cc:'US', flag:'🇺🇸', lat:40.71,  lon:-74.01 },
    { id:'IXIC',  name:'NASDAQ Comp.',   sym:'^IXIC',     city:'New York',  cc:'US', flag:'🇺🇸', lat:41.40,  lon:-73.30 },
    { id:'DJI',   name:'Dow Jones',      sym:'^DJI',      city:'New York',  cc:'US', flag:'🇺🇸', lat:39.90,  lon:-75.00 },
  ];
  window.MARKET_INDICES = INDICES;
  window.LIVE.indices = window.LIVE.indices || {};

  // ── CORS proxy rotation ───────────────────────────────────────────
  const PROXIES = [
    url => 'https://corsproxy.io/?url=' + encodeURIComponent(url),
    url => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
    url => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url),
  ];
  let proxyIdx = 0;

  async function fetchWithProxy(url, timeout) {
    timeout = timeout || 6500;   // tighter timeout → fail over to next proxy faster
    for (let i = 0; i < PROXIES.length; i++) {
      const pi = (proxyIdx + i) % PROXIES.length;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeout);
        const res = await fetch(PROXIES[pi](url), { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) continue;
        proxyIdx = pi;
        return await res.json();
      } catch(e) { continue; }
    }
    return null;
  }

  // ── Yahoo Finance chart endpoint ──────────────────────────────────
  async function fetchChart(sym, range, interval) {
    range = range || '6mo'; interval = interval || '1d';
    const yfSym = YF_MAP[sym] || sym;
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + yfSym +
      '?range=' + range + '&interval=' + interval + '&includePrePost=false';
    return fetchWithProxy(url);
  }

  function parseChart(json) {
    var result = json && json.chart && json.chart.result && json.chart.result[0];
    if (!result) return null;
    var meta = result.meta || {};
    var ts = result.timestamp || [];
    var q = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
    var candles = [];
    for (var i = 0; i < ts.length; i++) {
      var o = q.open && q.open[i], h = q.high && q.high[i];
      var l = q.low && q.low[i], c = q.close && q.close[i];
      var v = q.volume && q.volume[i];
      if (o && c && o > 0 && c > 0) {
        candles.push({ t: ts[i]*1000, o:o, h:h||o, l:l||o, c:c, v:v||0, up:c>=o });
      }
    }
    // Use meta.previousClose if available; else the second-to-last candle close
    // (the prior trading day). NEVER use chartPreviousClose — that's the close
    // from the START of the chart range (6 months ago).
    var prevClose = meta.previousClose;
    if (!prevClose && candles.length >= 2) {
      prevClose = candles[candles.length - 2].c;
    }
    if (!prevClose) prevClose = meta.chartPreviousClose; // last resort
    return {
      price: meta.regularMarketPrice,
      prevClose: prevClose,
      dayOpen: meta.regularMarketOpen || (candles.length ? candles[candles.length-1].o : 0),
      dayHigh: meta.regularMarketDayHigh || 0,
      dayLow: meta.regularMarketDayLow || 0,
      volume: meta.regularMarketVolume || 0,
      candles: candles,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // TECHNICAL INDICATOR COMPUTATIONS (all from raw candle data)
  // ════════════════════════════════════════════════════════════════════

  function _ema(data, period) {
    var k = 2/(period+1), e = data[0], out = [e];
    for (var i=1; i<data.length; i++) { e = data[i]*k + e*(1-k); out.push(e); }
    return out;
  }

  function _sma(data, period) {
    var out = [];
    for (var i=0; i<data.length; i++) {
      if (i < period-1) { out.push(null); continue; }
      var s = 0;
      for (var j = i-period+1; j<=i; j++) s += data[j];
      out.push(s/period);
    }
    return out;
  }

  function computeRSI(closes, period) {
    period = period || 14;
    if (closes.length < period+1) return null;
    var gains=[], losses=[];
    for (var i=1; i<closes.length; i++) {
      var d = closes[i]-closes[i-1];
      gains.push(d>0?d:0); losses.push(d<0?-d:0);
    }
    var ag = 0, al = 0;
    for (var i=0; i<period; i++) { ag+=gains[i]; al+=losses[i]; }
    ag /= period; al /= period;
    for (var i=period; i<gains.length; i++) {
      ag = (ag*(period-1)+gains[i])/period;
      al = (al*(period-1)+losses[i])/period;
    }
    return al===0 ? 100 : +(100 - 100/(1+ag/al)).toFixed(1);
  }

  function computeMACD(closes) {
    if (closes.length < 26) return null;
    var fast = _ema(closes,12), slow = _ema(closes,26);
    var line = fast.map(function(f,i){return f-slow[i];});
    var sig = _ema(line,9);
    var n = closes.length-1;
    return {
      value: +line[n].toFixed(2),
      signal: +sig[n].toFixed(2),
      histogram: +(line[n]-sig[n]).toFixed(2),
    };
  }

  function computeBollinger(closes, period, mult) {
    period = period||20; mult = mult||2;
    if (closes.length < period) return null;
    var n = closes.length;
    var slice = closes.slice(n-period);
    var mean = slice.reduce(function(a,b){return a+b;},0)/period;
    var variance = slice.reduce(function(a,v){return a+(v-mean)*(v-mean);},0)/period;
    var std = Math.sqrt(variance);
    return {
      upper: +(mean + mult*std).toFixed(2),
      middle: +mean.toFixed(2),
      lower: +(mean - mult*std).toFixed(2),
      bandwidth: +((2*mult*std/mean)*100).toFixed(2),
      pctB: +((closes[n-1] - (mean-mult*std))/(2*mult*std)*100).toFixed(1),
    };
  }

  function computeStochastic(candles, kPeriod) {
    kPeriod = kPeriod||14;
    if (candles.length < kPeriod) return null;
    var n = candles.length;
    var hh = -Infinity, ll = Infinity;
    for (var j=n-kPeriod; j<n; j++) {
      hh = Math.max(hh, candles[j].h);
      ll = Math.min(ll, candles[j].l);
    }
    return hh===ll ? 50 : +((candles[n-1].c - ll)/(hh - ll)*100).toFixed(1);
  }

  function computeATR(candles, period) {
    period = period||14;
    if (candles.length < period+1) return null;
    var trs = [candles[0].h-candles[0].l];
    for (var i=1; i<candles.length; i++) {
      trs.push(Math.max(
        candles[i].h-candles[i].l,
        Math.abs(candles[i].h-candles[i-1].c),
        Math.abs(candles[i].l-candles[i-1].c)
      ));
    }
    var atr = _ema(trs, period);
    return +atr[atr.length-1].toFixed(2);
  }

  function computeOBV(candles) {
    var vol = 0, prev = 0;
    for (var i=0; i<candles.length; i++) {
      if (i>0) {
        if (candles[i].c > candles[i-1].c) vol += candles[i].v;
        else if (candles[i].c < candles[i-1].c) vol -= candles[i].v;
      }
      prev = vol;
    }
    // return trend direction
    var n = candles.length;
    var vol20 = 0;
    if (n > 20) {
      var v2 = 0;
      for (var i=n-20; i<n; i++) {
        if (candles[i].c > candles[i-1].c) v2 += candles[i].v;
        else if (candles[i].c < candles[i-1].c) v2 -= candles[i].v;
      }
      vol20 = v2;
    }
    return { value: vol, trend: vol20 > 0 ? 'ACCUM' : 'DISTRIB', direction: vol20 > 0 ? '+' : '−' };
  }

  function computeWilliamsR(candles, period) {
    period = period||14;
    if (candles.length < period) return null;
    var n = candles.length;
    var hh = -Infinity, ll = Infinity;
    for (var j=n-period; j<n; j++) {
      hh = Math.max(hh, candles[j].h);
      ll = Math.min(ll, candles[j].l);
    }
    return hh===ll ? -50 : +((hh-candles[n-1].c)/(hh-ll)*-100).toFixed(1);
  }

  function computeCCI(candles, period) {
    period = period||20;
    if (candles.length < period) return null;
    var n = candles.length;
    var tps = candles.map(function(c){return (c.h+c.l+c.c)/3;});
    var slice = tps.slice(n-period);
    var mean = slice.reduce(function(a,b){return a+b;},0)/period;
    var md = slice.reduce(function(a,v){return a+Math.abs(v-mean);},0)/period;
    return md===0 ? 0 : +((tps[n-1]-mean)/(0.015*md)).toFixed(1);
  }

  function computeMFI(candles, period) {
    period = period||14;
    if (candles.length < period+1) return null;
    var n = candles.length;
    var pos=0, neg=0;
    for (var j=n-period; j<n; j++) {
      var tp = (candles[j].h+candles[j].l+candles[j].c)/3;
      var prevTp = (candles[j-1].h+candles[j-1].l+candles[j-1].c)/3;
      var mf = tp * candles[j].v;
      if (tp > prevTp) pos += mf; else neg += mf;
    }
    return neg===0 ? 100 : +(100 - 100/(1+pos/neg)).toFixed(1);
  }

  function computeADX(candles, period) {
    period = period||14;
    if (candles.length < period*2+1) return null;
    var pdm=[], ndm=[], tr=[];
    for (var i=1; i<candles.length; i++) {
      var upMove = candles[i].h - candles[i-1].h;
      var downMove = candles[i-1].l - candles[i].l;
      pdm.push(upMove>downMove && upMove>0 ? upMove : 0);
      ndm.push(downMove>upMove && downMove>0 ? downMove : 0);
      tr.push(Math.max(
        candles[i].h-candles[i].l,
        Math.abs(candles[i].h-candles[i-1].c),
        Math.abs(candles[i].l-candles[i-1].c)
      ));
    }
    var atr14 = _ema(tr, period);
    var sPdm = _ema(pdm, period);
    var sNdm = _ema(ndm, period);
    var diPlus = sPdm.map(function(v,i){return atr14[i]?v/atr14[i]*100:0;});
    var diMinus = sNdm.map(function(v,i){return atr14[i]?v/atr14[i]*100:0;});
    var dx = diPlus.map(function(dp,i){
      var dm = diMinus[i]; var sum = dp+dm;
      return sum===0?0:Math.abs(dp-dm)/sum*100;
    });
    var adxLine = _ema(dx, period);
    var n = adxLine.length-1;
    return {
      adx: +adxLine[n].toFixed(1),
      diPlus: +diPlus[n].toFixed(1),
      diMinus: +diMinus[n].toFixed(1),
    };
  }

  function computeVWAP(candles) {
    // Approximate VWAP from daily data (last 20 bars)
    var n = candles.length;
    var start = Math.max(0, n-20);
    var cumTPV = 0, cumVol = 0;
    for (var i=start; i<n; i++) {
      var tp = (candles[i].h+candles[i].l+candles[i].c)/3;
      cumTPV += tp*candles[i].v;
      cumVol += candles[i].v;
    }
    return cumVol ? +(cumTPV/cumVol).toFixed(2) : null;
  }

  function computeFibonacci(candles, lookback) {
    lookback = lookback||60;
    var slice = candles.slice(-lookback);
    var hh = -Infinity, ll = Infinity;
    slice.forEach(function(c){ hh=Math.max(hh,c.h); ll=Math.min(ll,c.l); });
    var diff = hh - ll;
    return {
      high:hh, low:ll,
      levels: [
        {pct:0,    px:+hh.toFixed(2)},
        {pct:23.6, px:+(hh-diff*0.236).toFixed(2)},
        {pct:38.2, px:+(hh-diff*0.382).toFixed(2)},
        {pct:50,   px:+(hh-diff*0.500).toFixed(2)},
        {pct:61.8, px:+(hh-diff*0.618).toFixed(2)},
        {pct:78.6, px:+(hh-diff*0.786).toFixed(2)},
        {pct:100,  px:+ll.toFixed(2)},
      ],
    };
  }

  function computePivots(candles) {
    if (candles.length < 2) return null;
    var prev = candles[candles.length-2];
    var pp = (prev.h+prev.l+prev.c)/3;
    return {
      R3: +(prev.h+2*(pp-prev.l)).toFixed(2),
      R2: +(pp+(prev.h-prev.l)).toFixed(2),
      R1: +(2*pp-prev.l).toFixed(2),
      PP: +pp.toFixed(2),
      S1: +(2*pp-prev.h).toFixed(2),
      S2: +(pp-(prev.h-prev.l)).toFixed(2),
      S3: +(prev.l-2*(prev.h-pp)).toFixed(2),
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // BUILD ALL TECHNICALS → update TICKERS[sym]
  // ════════════════════════════════════════════════════════════════════
  function computeAllTechnicals(candles, px) {
    if (!candles || candles.length < 30) return null;
    var closes = candles.map(function(c){return c.c;});
    var n = closes.length;
    var last = closes[n-1];

    var rsiVal = computeRSI(closes, 14);
    var macdData = computeMACD(closes);
    var ema20 = _ema(closes,20); var ema20v = +ema20[n-1].toFixed(2);
    var ema50 = _ema(closes,50); var ema50v = +ema50[n-1].toFixed(2);
    var ema200v = n>=200 ? +(_ema(closes,200)[n-1]).toFixed(2) : null;
    var bb = computeBollinger(closes);
    var stochK = computeStochastic(candles);
    var atrVal = computeATR(candles);
    var obvData = computeOBV(candles);
    var wR = computeWilliamsR(candles);
    var cciVal = computeCCI(candles);
    var mfiVal = computeMFI(candles);
    var adxData = computeADX(candles);
    var vwap = computeVWAP(candles);
    var fib = computeFibonacci(candles);
    var pivots = computePivots(candles);

    // Tone helpers
    function rsiTone(v) { return v>70?'red':v<30?'green':'amber'; }
    function rsiState(v) { return v>70?'OVERBOUGHT':v<30?'OVERSOLD':'NEUTRAL'; }

    // Build the standard technicals array (first 8 shown in grid)
    var technicals = [
      { name:'RSI (14)',  v:rsiVal!=null?''+rsiVal:'—', state:rsiState(rsiVal), tone:rsiTone(rsiVal) },
      { name:'MACD',      v:macdData?(macdData.value>=0?'+':'')+macdData.value:'—',
        state:macdData?(macdData.histogram>0?'BULL X':'BEAR X'):'—',
        tone:macdData?(macdData.histogram>0?'green':'red'):'amber' },
      { name:'EMA 20',    v:''+ema20v, state:last>ema20v?'PRICE > EMA':'PRICE < EMA', tone:last>ema20v?'green':'red' },
      { name:'EMA 50',    v:''+ema50v, state:last>ema50v?'PRICE > EMA':'PRICE < EMA', tone:last>ema50v?'green':'red' },
      { name:'EMA 200',   v:ema200v?''+ema200v:'—', state:ema200v?(ema50v>ema200v?'GOLDEN':'DEATH X'):'INSUFF DATA', tone:ema200v?(ema50v>ema200v?'green':'red'):'amber' },
      { name:'ATR (14)',   v:atrVal!=null?''+atrVal:'—', state:atrVal>(last*0.03)?'EXPANDING':'NORMAL', tone:atrVal>(last*0.03)?'amber':'green' },
      { name:'OBV',        v:obvData.direction, state:obvData.trend, tone:obvData.trend==='ACCUM'?'green':'red' },
      { name:'Stoch %K',   v:stochK!=null?''+stochK:'—', state:stochK>80?'OVERBOUGHT':stochK<20?'OVERSOLD':'NEUTRAL', tone:stochK>80?'red':stochK<20?'green':'amber' },
    ];

    // Extended deep indicators object
    var deep = {
      bb: bb,
      williamsR: wR,
      cci: cciVal,
      mfi: mfiVal,
      adx: adxData,
      vwap: vwap,
      fibonacci: fib,
      pivots: pivots,
      ema20: ema20v,
      ema50: ema50v,
      ema200: ema200v,
      rsi: rsiVal,
      macd: macdData,
      stochK: stochK,
      atr: atrVal,
    };

    // Compute live support/resistance from pivot points
    var levels;
    if (pivots) {
      levels = [
        { kind:'R3', px:pivots.R3, dist:'+'+((pivots.R3/px-1)*100).toFixed(1)+'%' },
        { kind:'R2', px:pivots.R2, dist:'+'+((pivots.R2/px-1)*100).toFixed(1)+'%' },
        { kind:'R1', px:pivots.R1, dist:'+'+((pivots.R1/px-1)*100).toFixed(1)+'%' },
        { kind:'PX', px:px, dist:'CURR', active:true },
        { kind:'S1', px:pivots.S1, dist:((pivots.S1/px-1)*100).toFixed(1)+'%' },
        { kind:'S2', px:pivots.S2, dist:((pivots.S2/px-1)*100).toFixed(1)+'%' },
        { kind:'S3', px:pivots.S3, dist:((pivots.S3/px-1)*100).toFixed(1)+'%' },
      ];
    }

    return { technicals:technicals, deep:deep, levels:levels };
  }

  // ════════════════════════════════════════════════════════════════════
  // UPDATE GLOBALS
  // ════════════════════════════════════════════════════════════════════
  function fmtVol(v) {
    if (!v) return '—';
    if (v>=1e9) return (v/1e9).toFixed(1)+'B';
    if (v>=1e6) return (v/1e6).toFixed(1)+'M';
    if (v>=1e3) return (v/1e3).toFixed(1)+'K';
    return ''+v;
  }

  function updateTicker(sym, data) {
    if (!window.TICKERS || !window.TICKERS[sym] || !data || !data.price) return false;
    var t = window.TICKERS[sym];

    // Price update
    t.px = +data.price.toFixed(2);
    t.chg = +(data.price - data.prevClose).toFixed(2);
    t.chgPct = +((data.price/data.prevClose - 1)*100).toFixed(2);
    t.live = true; // mark as live data
    if (data.dayOpen) t.open = +data.dayOpen.toFixed(2);
    if (data.dayHigh) t.high = +data.dayHigh.toFixed(2);
    if (data.dayLow)  t.low  = +data.dayLow.toFixed(2);
    if (data.volume)  t.vol  = fmtVol(data.volume);

    // Sparkline from last 60 candles
    if (data.candles.length >= 10) {
      var last60 = data.candles.slice(-60);
      var min=Infinity, max=-Infinity;
      last60.forEach(function(c){ min=Math.min(min,c.c); max=Math.max(max,c.c); });
      var rng = max-min || 1;
      window.SPARKS[sym] = last60.map(function(c){ return (c.c-min)/rng; });
    }

    // Store real candle data
    window.CANDLES[sym] = data.candles;

    // Compute real technicals
    var tech = computeAllTechnicals(data.candles, data.price);
    if (tech) {
      t.technicals = tech.technicals;
      if (tech.levels) t.levels = tech.levels;
      t._deep = tech.deep;
    }

    return true;
  }

  // ════════════════════════════════════════════════════════════════════
  // FETCH LOOP
  // ════════════════════════════════════════════════════════════════════
  var _intervalId = null;
  var _idxIntervalId = null;

  async function fetchAll() {
    var updated = 0;
    for (var i=0; i<SYMBOLS.length; i++) {
      var sym = SYMBOLS[i];
      try {
        var raw = await fetchChart(sym, '6mo', '1d');
        var data = parseChart(raw);
        if (data && updateTicker(sym, data)) updated++;
      } catch(e) {
        window.LIVE.errors.push({sym:sym, time:Date.now(), msg:e.message});
      }
    }

    if (updated > 0) {
      window.LIVE.active = true;
      window.LIVE.lastUpdate = Date.now();
      window.LIVE.feedStatus = 'LIVE';
      window.dispatchEvent(new CustomEvent('live-tick', {detail:{updated:updated, time:Date.now()}}));
    }
    return updated;
  }

  // ── Global market indices fetch (for the Overview globe) ──────────
  async function fetchIndices() {
    var updated = 0;
    await Promise.all(INDICES.map(async function(ix){
      try {
        var json = await fetchChart(ix.sym, '5d', '1d');
        var p = parseChart(json);
        if (p && p.price) {
          var prev = p.prevClose || p.price;
          window.LIVE.indices[ix.id] = {
            price: p.price, prevClose: prev,
            chg: p.price - prev,
            chgPct: prev ? ((p.price / prev) - 1) * 100 : 0,
            t: Date.now(),
          };
          updated++;
        }
      } catch(e) {}
    }));
    if (updated > 0) {
      window.LIVE.indicesUpdated = Date.now();
      window.dispatchEvent(new CustomEvent('idx-tick', { detail:{ updated: updated, time: Date.now() } }));
    }
    return updated;
  }

  async function startFeed() {
    console.log('[LiveFeed] Starting real-time data feed...');
    window.LIVE.feedStatus = 'CONNECTING';
    window.dispatchEvent(new CustomEvent('live-tick', {detail:{status:'connecting'}}));

    // Fetch stocks AND global indices concurrently so the globe lights up as
    // fast as the tickers (previously indices waited for the stock fetch).
    var idxPromise = fetchIndices().then(function(m){ console.log('[LiveFeed] Indices: ' + m + '/' + INDICES.length + ' updated'); });
    var n = await fetchAll();
    console.log('[LiveFeed] Initial: ' + n + '/' + SYMBOLS.length + ' tickers updated');

    if (n === 0) {
      window.LIVE.feedStatus = 'FALLBACK';
      console.warn('[LiveFeed] All proxies failed — using static data as fallback');
    }

    // Poll every 30 seconds
    _intervalId = setInterval(function(){ fetchAll(); }, 30000);
    _idxIntervalId = setInterval(function(){ fetchIndices(); }, 45000);
  }

  function stopFeed() {
    if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
    if (_idxIntervalId) { clearInterval(_idxIntervalId); _idxIntervalId = null; }
    window.LIVE.feedStatus = 'STOPPED';
  }

  // Auto-start on every page load/refresh — kick off quickly so the loading
  // screen can hand off to fresh data, then poll on interval.
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(startFeed, 400);
  } else {
    window.addEventListener('DOMContentLoaded', function(){ setTimeout(startFeed, 400); });
  }

  // Re-fetch only when the user RETURNS to the tab after being away, throttled
  // to once per 20s. Seed _lastVis to "now" so the initial visibility event on
  // first load does NOT fire a second fetch on top of startFeed (that stacked
  // double-fetch was the "auto-refresh twice" glitch on entry).
  var _lastVis = Date.now();
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible' && Date.now() - _lastVis > 20000) {
      _lastVis = Date.now();
      fetchAll();
      fetchIndices();
    }
  });

  // Expose API
  window.LiveFeed = { start:startFeed, stop:stopFeed, fetchAll:fetchAll, fetchIndices:fetchIndices, fetchChart:fetchChart, parseChart:parseChart, computeAllTechnicals:computeAllTechnicals };
})();
