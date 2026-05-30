// ════════════════════════════════════════════════════════════════════
// Quant Model tab — DCF / Multiples / Monte Carlo / Regression /
// Factor Model / Volatility / Kelly Criterion / Composite Fair Value
// ════════════════════════════════════════════════════════════════════

const { useMemo: qmUseMemo, useState: qmUseState } = React;

function qTone(t) {
  if (t === 'g' || t === 'green')  return GT.green;
  if (t === 'r' || t === 'red')    return GT.red;
  if (t === 'y' || t === 'amber')  return GT.amber;
  if (t === 'a' || t === 'accent') return null;
  if (t === 't')                   return GT.text;
  return '';
}

function QTable({ rows }) {
  const { palette } = useTheme();
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <tbody>
        {rows.map((r, i) => {
          const [label, value, tone, bold] = r;
          const color = qTone(tone) || (tone === 'a' ? palette.a : GT.text);
          return (
            <tr key={i} style={{ borderBottom: `1px dashed ${palette.edge}` }}>
              <td style={{ padding: '6px 0', fontWeight: bold ? 700 : 400, color: bold ? GT.text : GT.textDim }}>{label}</td>
              <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: GT.fontMono, color, fontWeight: bold ? 700 : 500, fontSize: bold ? 13 : 12 }}>{value}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function QSection({ title, children, last }) {
  const { palette } = useTheme();
  return (
    <div style={{ paddingBottom: last ? 0 : 12, marginBottom: last ? 0 : 12, borderBottom: last ? 'none' : `1px dashed ${palette.edge}` }}>
      <Kicker color={GT.textDim} style={{ display: 'block', marginBottom: 6 }}>{title}</Kicker>
      {children}
    </div>
  );
}

// ── Peer multiples bar chart ───────────────────────────────────────
function PeersBar({ peers, accent }) {
  const { palette } = useTheme();
  const ac = accent || palette.a;
  const max = Math.max(...peers.map(p => p.val));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {peers.map((p, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 46px', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: GT.fontMono, fontSize: 10, fontWeight: p.active ? 700 : 500, color: p.active ? ac : GT.textDim, letterSpacing: 0.5 }}>{p.sym}</span>
          <div style={{ height: 12, background: 'rgba(255,255,255,.04)', position: 'relative', borderRadius: 2 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(p.val / max) * 100}%`, background: p.active ? ac : palette.aSoft, border: p.active ? `1px solid ${ac}` : 'none', borderRadius: 2 }} />
          </div>
          <span style={{ fontFamily: GT.fontMono, fontSize: 10, color: GT.text, textAlign: 'right' }}>{p.val.toFixed(1)}×</span>
        </div>
      ))}
    </div>
  );
}

// ── Monte Carlo fan chart ─────────────────────────────────────────
function MCFanChart({ results, params, height = 160 }) {
  const { palette } = useTheme();
  const current = parseFloat(String(params[0][1]).replace(/[$,]/g, ''));
  const sorted = [...results].sort((a, b) => a.px - b.px);
  const max = Math.max(...sorted.map(r => r.px), current * 1.05);
  const w = 760;
  const scale = v => height - ((v - 0) / (max - 0)) * (height - 10) - 5;
  const pct = (n) => sorted.find(s => s.label.startsWith(`${n}th`)) || sorted[Math.floor(sorted.length / 2)];
  const p5 = pct(5).px, p95 = pct(95).px, p25 = pct(25).px, p75 = pct(75).px, p50 = pct(50).px;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => <line key={i} x1={0} x2={w} y1={p * height} y2={p * height} stroke={palette.edge} strokeDasharray="2,4" />)}
      <polygon fill={palette.aSoft} points={`0,${scale(current)} ${w},${scale(p95)} ${w},${scale(p5)} 0,${scale(current)}`} />
      <polygon fill={palette.aSoft} opacity={0.6} points={`0,${scale(current)} ${w},${scale(p75)} ${w},${scale(p25)} 0,${scale(current)}`} />
      <line x1={0} y1={scale(current)} x2={w} y2={scale(p50)} stroke={palette.a} strokeWidth={1.6} />
      <line x1={0} x2={w} y1={scale(current)} y2={scale(current)} stroke={GT.textDim} strokeDasharray="3,3" opacity={0.7} />
      {[[p95, GT.green], [p75, GT.green], [p50, palette.a], [p25, GT.amber], [p5, GT.red]].map(([v, c], i) => (
        <g key={i}>
          <circle cx={w - 6} cy={scale(v)} r={3} fill={c} />
          <text x={w - 12} y={scale(v) + 4} textAnchor="end" fontSize={9} fontFamily={GT.fontMono} fill={c}>${v}</text>
        </g>
      ))}
      <text x={6} y={scale(current) - 6} fontSize={9} fontFamily={GT.fontMono} fill={GT.textDim}>NOW ${current.toFixed(0)}</text>
    </svg>
  );
}

// ── MC histogram ──────────────────────────────────────────────────
function MCHistogram({ results, height = 90 }) {
  const { palette } = useTheme();
  const ordered = results.map(r => r.px);
  const heights = [22, 52, 90, 60, 30];
  return (
    <div style={{ display: 'flex', alignItems: 'end', gap: 5, height }}>
      {ordered.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <span style={{ fontFamily: GT.fontMono, fontSize: 8, color: GT.textDim, textAlign: 'center', marginBottom: 2 }}>${v}</span>
          <div style={{ width: '100%', height: heights[i] + '%', background: i === 2 ? palette.a : palette.aSoft, border: `1px solid ${i === 2 ? palette.a : palette.edge}` }} />
        </div>
      ))}
    </div>
  );
}

// ── Revenue regression chart ─────────────────────────────────────
function RegressionChart({ history, accent, height = 150 }) {
  const { palette } = useTheme();
  const ac = accent || palette.a;
  const w = 760;
  const max = Math.max(...history.map(h => h.v));
  const scale = v => height - ((v - 0) / (max - 0)) * (height - 30) - 16;
  const bw = w / history.length;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      {[0, 0.5, 1].map((p, i) => <line key={i} x1={0} x2={w} y1={p * height} y2={p * height} stroke={palette.edge} strokeDasharray="2,4" />)}
      <path d={history.map((h, i) => `${i === 0 ? 'M' : 'L'}${(i + 0.5) * bw},${scale(h.v)}`).join(' ')} fill="none" stroke={ac} strokeWidth={1.5} />
      {history.map((h, i) => (
        <g key={i}>
          <rect x={(i + 0.15) * bw} y={scale(h.v)} width={bw * 0.7} height={height - scale(h.v) - 16}
            fill={h.tone === 'r' ? GT.red : h.tone === 'g' ? GT.green : h.tone === 'a' ? palette.b : palette.aSoft} opacity={0.85} />
          <text x={(i + 0.5) * bw} y={scale(h.v) - 4} textAnchor="middle" fontSize={9} fontFamily={GT.fontMono} fill={GT.text} fontWeight={700}>${h.v.toFixed(1)}B</text>
          <text x={(i + 0.5) * bw} y={height - 4} textAnchor="middle" fontSize={8} fontFamily={GT.fontMono} fill={GT.textDim}>{h.y}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Composite fair value rail ─────────────────────────────────────
function CompositeViz({ composite, current }) {
  const { palette } = useTheme();
  const { components, fair } = composite;
  const vals = components.map(c => c.val).concat([current]);
  const lo = Math.min(...vals) * 0.92;
  const hi = Math.max(...vals) * 1.08;
  const x = v => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div style={{ position: 'relative', height: 80, marginTop: 8 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 38, height: 3, background: `linear-gradient(90deg, ${palette.aSoft}, ${palette.a}, ${palette.b})`, borderRadius: 100 }} />
      <div style={{ position: 'absolute', left: x(current), top: 28, transform: 'translateX(-50%)', textAlign: 'center' }}>
        <div style={{ width: 2, height: 22, background: GT.textDim, margin: '0 auto' }} />
        <div style={{ fontFamily: GT.fontMono, fontSize: 9, color: GT.textDim, marginTop: 2, whiteSpace: 'nowrap' }}>PX ${current.toFixed(0)}</div>
      </div>
      <div style={{ position: 'absolute', left: x(fair), top: 0, transform: 'translateX(-50%)', textAlign: 'center' }}>
        <div style={{ fontFamily: GT.fontMono, fontSize: 10, color: palette.a, fontWeight: 700, letterSpacing: 1, padding: '2px 8px', border: `1px solid ${palette.a}`, background: 'rgba(20,26,52,.85)', borderRadius: 100, whiteSpace: 'nowrap' }}>FAIR ${fair}</div>
        <div style={{ width: 2, height: 38, background: palette.a, margin: '6px auto 0' }} />
      </div>
      {components.map((c, i) => (
        <div key={i} style={{ position: 'absolute', left: x(c.val), top: 34, transform: 'translateX(-50%)' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.tone === 'g' ? GT.green : c.tone === 'a' ? palette.a : c.tone === 't' ? GT.text : palette.b, border: `2px solid ${GT.bg}` }} />
        </div>
      ))}
    </div>
  );
}

// ── Factor score bar ─────────────────────────────────────────────
function FactorBar({ label, score, z, color, accent }) {
  const { palette } = useTheme();
  const c = color === 'g' ? GT.green : color === 'r' ? GT.red : color === 'y' ? GT.amber : accent || palette.a;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 58px 48px', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: `1px dashed ${palette.edge}` }}>
      <span style={{ fontSize: 11, color: GT.textDim }}>{label}</span>
      <div style={{ height: 8, background: 'rgba(255,255,255,.04)', borderRadius: 100, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: score + '%', background: c, borderRadius: 100, opacity: 0.85 }} />
      </div>
      <span style={{ fontFamily: GT.fontMono, fontSize: 10, color: c, textAlign: 'right', fontWeight: 700 }}>{score}</span>
      <span style={{ fontFamily: GT.fontMono, fontSize: 9, color: GT.textDim, textAlign: 'right' }}>z={z}</span>
    </div>
  );
}

// ── Volatility term structure mini-chart ──────────────────────────
function VolTermChart({ points, height = 70 }) {
  const { palette } = useTheme();
  const vals = points.map(p => p.vol);
  const min = Math.min(...vals) * 0.92;
  const max = Math.max(...vals) * 1.08;
  const w = 400;
  const x = i => (i / (points.length - 1)) * w;
  const y = v => height - ((v - min) / (max - min)) * (height - 12) - 6;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.vol)}`).join(' ');
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <path d={path + ` L${w},${height} L0,${height} Z`} fill={palette.aSoft} opacity={0.5} />
      <path d={path} fill="none" stroke={palette.a} strokeWidth={1.5} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.vol)} r={2.5} fill={palette.a} />
          <text x={x(i)} y={height - 1} textAnchor="middle" fontSize={8} fontFamily={GT.fontMono} fill={GT.textDim}>{p.exp}</text>
          <text x={x(i)} y={y(p.vol) - 5} textAnchor="middle" fontSize={8} fontFamily={GT.fontMono} fill={GT.text}>{p.vol}%</text>
        </g>
      ))}
    </svg>
  );
}

// ── Correlation matrix ────────────────────────────────────────────
function CorrelationMatrix({ corrs, sym, accent }) {
  const { palette } = useTheme();
  const ac = accent || palette.a;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {corrs.map((c, i) => {
        const abs = Math.abs(c.r);
        const col = abs > 0.85 ? GT.green : abs > 0.65 ? GT.amber : GT.textDim;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 40px 40px', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: GT.fontMono, fontSize: 10, color: GT.textDim }}>{sym} / {c.sym}</span>
            <div style={{ height: 8, background: 'rgba(255,255,255,.04)', borderRadius: 100, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${abs * 100}%`, background: col, borderRadius: 100, opacity: 0.8 }} />
            </div>
            <span style={{ fontFamily: GT.fontMono, fontSize: 10, color: col, textAlign: 'right' }}>{c.r.toFixed(2)}</span>
            <span style={{ fontFamily: GT.fontMono, fontSize: 9, color: GT.textDim, textAlign: 'right' }}>R²={c.r2.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Kelly gauge ───────────────────────────────────────────────────
function KellyGauge({ pct, label, color }) {
  const { palette } = useTheme();
  const r = 34, cx = 44, cy = 44;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={88} height={88} viewBox="0 0 88 88">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={palette.edge} strokeWidth={7} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={14} fontFamily={GT.fontMono} fill={color} fontWeight={700}>{pct.toFixed(1)}%</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize={8} fontFamily={GT.fontMono} fill={GT.textDim}>Kelly</text>
      </svg>
      <div style={{ fontSize: 10, color: GT.textDim, marginTop: -4 }}>{label}</div>
    </div>
  );
}

// ── Extra quant data per ticker (inline — no data-file change needed) ──
const QUANT_EXTRA = {
  NVDA: {
    factors: [
      { name: 'Momentum (12-1M)',  score: 87, z: '+2.3', color: 'g' },
      { name: 'Quality (ROE/ROA)', score: 96, z: '+2.8', color: 'g' },
      { name: 'Growth (Rev CAGR)', score: 99, z: '+3.2', color: 'g' },
      { name: 'Value (P/E rel)',   score: 18, z: '-1.8', color: 'r' },
      { name: 'Low Volatility',    score: 12, z: '-2.1', color: 'r' },
      { name: 'Size (log MCap)',   score: 8,  z: '-2.4', color: 'r' },
    ],
    compositeScore: 78,
    factorNote: 'Dominant momentum + quality + growth. Poor value/size/vol factor exposure — typical of high-multiple platform companies. Factor tilt: long Growth/Quality, short Value.',
    volTerm: [
      { exp: '1W',  vol: 62.4 }, { exp: '1M',  vol: 58.3 },
      { exp: '3M',  vol: 54.1 }, { exp: '6M',  vol: 51.8 },
      { exp: '1Y',  vol: 49.2 },
    ],
    volRows: [
      ['30d Realized Vol', '54.2%', 'y'], ['90d Realized Vol', '52.8%', ''],
      ['ATM IV (30d)',      '58.3%', 'y'], ['IV Rank (52W)',     '68/100', 'y'],
      ['IV Percentile',    '72%',   ''], ['Put/Call Skew',     '+3.1 pts', ''],
      ['Term Structure',   'Contango', ''], ['Vol Regime',       'ELEVATED', 'y'],
      ['Put/Call Ratio',   '0.72',  ''], ['Expected Move ±1σ','±$29.7', ''],
    ],
    greeks: [
      ['Delta (ATM 30d)', '0.52', ''], ['Gamma (1% move)', '$1.24/sh', ''],
      ['Theta (per day)', '-$0.38/sh', 'r'], ['Vega (1 vol pt)', '+$0.62/sh', 'g'],
    ],
    kelly: { full: 38.1, half: 19.1, quarter: 9.5,
      rows: [
        ['Win Rate (backtest)', '62%',   'g'], ['Avg Win',             '+35.2%', 'g'],
        ['Avg Loss',            '-22.0%','r'], ['Win/Loss Ratio (R)',  '1.60×',  'a'],
        ['Kelly Edge',          '38.1%', 'a'], ['Recommended (¼K)',    '9.5%',   'g'],
      ],
      note: 'Full Kelly 38% — theoretical max. Practice: ¼ Kelly = 9.5% to account for μ/σ estimation error and fat-tail risk.',
    },
    corr: [
      { sym: 'AMD',  r: 0.82, r2: 0.67 }, { sym: 'MU',   r: 0.74, r2: 0.55 },
      { sym: 'TSM',  r: 0.78, r2: 0.61 }, { sym: 'SOX',  r: 0.91, r2: 0.83 },
      { sym: 'SPX',  r: 0.68, r2: 0.46 }, { sym: 'QQQ',  r: 0.72, r2: 0.52 },
    ],
    earnQuality: [
      ['Revenue Recognition',  'Conservative — deferred delivery', 'g'],
      ['Accruals Ratio',       '-3.8% (cash-generative)',          'g'],
      ['FCF / Net Income',     '1.14× (cash >  earnings)',         'g'],
      ['EBITDA–CapEx Spread',  '$139B (fabless model)',            'g'],
      ['Audit Opinion',        'Clean — Big 4',                   'g'],
      ['Restatement History',  'None (5Y)',                        'g'],
    ],
  },
  AMD: {
    factors: [
      { name: 'Momentum (12-1M)',  score: 62, z: '+0.7', color: 'y' },
      { name: 'Quality (ROE/ROA)', score: 58, z: '+0.4', color: 'y' },
      { name: 'Growth (Rev CAGR)', score: 82, z: '+1.7', color: 'g' },
      { name: 'Value (P/E rel)',   score: 24, z: '-1.4', color: 'r' },
      { name: 'Low Volatility',    score: 20, z: '-1.6', color: 'r' },
      { name: 'Size (log MCap)',   score: 35, z: '-0.8', color: 'y' },
    ],
    compositeScore: 55,
    factorNote: 'Strong growth factor, moderate quality. Momentum stalled on MI400 cycle uncertainty. Value still stretched vs sector median. Turnaround story — factor score should improve as MI400 ships.',
    volTerm: [
      { exp: '1W',  vol: 58.1 }, { exp: '1M',  vol: 54.6 },
      { exp: '3M',  vol: 51.2 }, { exp: '6M',  vol: 48.9 },
      { exp: '1Y',  vol: 46.3 },
    ],
    volRows: [
      ['30d Realized Vol', '56.8%', 'y'], ['90d Realized Vol', '54.2%', ''],
      ['ATM IV (30d)',      '54.6%', 'y'], ['IV Rank (52W)',     '52/100', ''],
      ['IV Percentile',    '58%',   ''], ['Put/Call Skew',     '+4.2 pts', 'y'],
      ['Term Structure',   'Flat',  ''], ['Vol Regime',       'ELEVATED', 'y'],
      ['Put/Call Ratio',   '0.88',  'y'], ['Expected Move ±1σ','±$54.3', ''],
    ],
    greeks: [
      ['Delta (ATM 30d)', '0.51', ''], ['Gamma (1% move)', '$2.16/sh', ''],
      ['Theta (per day)', '-$0.74/sh', 'r'], ['Vega (1 vol pt)', '+$1.10/sh', 'g'],
    ],
    kelly: { full: 24.6, half: 12.3, quarter: 6.2,
      rows: [
        ['Win Rate (backtest)', '56%',   'y'], ['Avg Win',             '+28.4%', 'g'],
        ['Avg Loss',            '-23.5%','r'], ['Win/Loss Ratio (R)',  '1.21×',  'y'],
        ['Kelly Edge',          '24.6%', 'y'], ['Recommended (¼K)',    '6.2%',   'g'],
      ],
      note: 'Lower Kelly vs NVDA reflects higher binary risk around MI400 launch. Reduce to ¼ Kelly = 6.2% until MI400 production volume confirmed.',
    },
    corr: [
      { sym: 'NVDA', r: 0.82, r2: 0.67 }, { sym: 'MU',   r: 0.71, r2: 0.50 },
      { sym: 'TSM',  r: 0.69, r2: 0.48 }, { sym: 'SOX',  r: 0.88, r2: 0.77 },
      { sym: 'SPX',  r: 0.65, r2: 0.42 }, { sym: 'INTC', r: 0.58, r2: 0.34 },
    ],
    earnQuality: [
      ['Revenue Recognition',  'Ratable — product delivery',       'g'],
      ['Accruals Ratio',       '-1.2% (mild cash-generative)',     'y'],
      ['FCF / Net Income',     '1.27× (cash > earnings)',          'g'],
      ['EBITDA–CapEx Spread',  '$8.2B (improving)',                'y'],
      ['Audit Opinion',        'Clean — Big 4',                    'g'],
      ['Restatement History',  'None (5Y)',                        'g'],
    ],
  },
  MU: {
    factors: [
      { name: 'Momentum (12-1M)',  score: 74, z: '+1.2', color: 'g' },
      { name: 'Quality (ROE/ROA)', score: 71, z: '+1.0', color: 'g' },
      { name: 'Growth (Rev CAGR)', score: 88, z: '+2.0', color: 'g' },
      { name: 'Value (P/E rel)',   score: 55, z: '+0.2', color: 'y' },
      { name: 'Low Volatility',    score: 38, z: '-0.5', color: 'y' },
      { name: 'Size (log MCap)',   score: 42, z: '-0.4', color: 'y' },
    ],
    compositeScore: 68,
    factorNote: 'Best-balanced factor profile in the basket. Value factor improving as DRAM cycle recovers. HBM3E supply tightness drives growth re-rating. Cyclicality remains the key overhang.',
    volTerm: [
      { exp: '1W',  vol: 48.2 }, { exp: '1M',  vol: 45.7 },
      { exp: '3M',  vol: 43.1 }, { exp: '6M',  vol: 41.8 },
      { exp: '1Y',  vol: 40.2 },
    ],
    volRows: [
      ['30d Realized Vol', '46.3%', ''], ['90d Realized Vol', '44.8%', ''],
      ['ATM IV (30d)',      '45.7%', ''], ['IV Rank (52W)',     '44/100', ''],
      ['IV Percentile',    '48%',   ''], ['Put/Call Skew',     '+2.6 pts', ''],
      ['Term Structure',   'Backwardation', 'y'], ['Vol Regime',  'NORMAL', 'g'],
      ['Put/Call Ratio',   '0.64',  'g'], ['Expected Move ±1σ','±$68.3', ''],
    ],
    greeks: [
      ['Delta (ATM 30d)', '0.50', ''], ['Gamma (1% move)', '$3.22/sh', ''],
      ['Theta (per day)', '-$1.04/sh', 'r'], ['Vega (1 vol pt)', '+$1.74/sh', 'g'],
    ],
    kelly: { full: 31.4, half: 15.7, quarter: 7.9,
      rows: [
        ['Win Rate (backtest)', '59%',   'g'], ['Avg Win',             '+31.8%', 'g'],
        ['Avg Loss',            '-21.2%','r'], ['Win/Loss Ratio (R)',  '1.50×',  'a'],
        ['Kelly Edge',          '31.4%', 'a'], ['Recommended (¼K)',    '7.9%',   'g'],
      ],
      note: 'Cyclical DRAM dynamics add tail risk. Use ¼ Kelly = 7.9%. Monitor DRAM ASP monthly — rising ASP = increase position toward ½ Kelly.',
    },
    corr: [
      { sym: 'NVDA', r: 0.74, r2: 0.55 }, { sym: 'AMD',  r: 0.71, r2: 0.50 },
      { sym: 'TSM',  r: 0.68, r2: 0.46 }, { sym: 'SOX',  r: 0.84, r2: 0.71 },
      { sym: 'SPX',  r: 0.60, r2: 0.36 }, { sym: 'DRAM', r: 0.77, r2: 0.59 },
    ],
    earnQuality: [
      ['Revenue Recognition',  'Point-in-time — ship & bill',      'g'],
      ['Accruals Ratio',       '+2.1% (inventory build cycle)',    'y'],
      ['FCF / Net Income',     '0.82× (capex-heavy)',              'y'],
      ['EBITDA–CapEx Spread',  '$14.6B (normalizing)',             'y'],
      ['Audit Opinion',        'Clean — Big 4',                    'g'],
      ['Restatement History',  'None (5Y)',                        'g'],
    ],
  },
  TSM: {
    factors: [
      { name: 'Momentum (12-1M)',  score: 72, z: '+1.1', color: 'g' },
      { name: 'Quality (ROE/ROA)', score: 82, z: '+1.7', color: 'g' },
      { name: 'Growth (Rev CAGR)', score: 76, z: '+1.3', color: 'g' },
      { name: 'Value (P/E rel)',   score: 48, z: '-0.1', color: 'y' },
      { name: 'Low Volatility',    score: 52, z: '+0.2', color: 'y' },
      { name: 'Size (log MCap)',   score: 22, z: '-1.5', color: 'r' },
    ],
    compositeScore: 64,
    factorNote: 'Balanced quality + growth with moderate value. Geopolitical risk creates a persistent discount vs intrinsic value — this is the key contrarian opportunity. Low-vol factor decent for a foundry.',
    volTerm: [
      { exp: '1W',  vol: 38.4 }, { exp: '1M',  vol: 36.2 },
      { exp: '3M',  vol: 34.8 }, { exp: '6M',  vol: 33.6 },
      { exp: '1Y',  vol: 32.4 },
    ],
    volRows: [
      ['30d Realized Vol', '35.8%', ''], ['90d Realized Vol', '34.2%', ''],
      ['ATM IV (30d)',      '36.2%', ''], ['IV Rank (52W)',     '38/100', ''],
      ['IV Percentile',    '42%',   ''], ['Put/Call Skew',     '+5.8 pts', 'y'],
      ['Term Structure',   'Contango', ''], ['Vol Regime',      'NORMAL', 'g'],
      ['Put/Call Ratio',   '0.91',  'y'], ['Expected Move ±1σ','±$33.1', ''],
    ],
    greeks: [
      ['Delta (ATM 30d)', '0.50', ''], ['Gamma (1% move)', '$1.98/sh', ''],
      ['Theta (per day)', '-$0.62/sh', 'r'], ['Vega (1 vol pt)', '+$1.04/sh', 'g'],
    ],
    kelly: { full: 28.2, half: 14.1, quarter: 7.1,
      rows: [
        ['Win Rate (backtest)', '57%',   'y'], ['Avg Win',             '+26.4%', 'g'],
        ['Avg Loss',            '-20.8%','r'], ['Win/Loss Ratio (R)',  '1.27×',  'y'],
        ['Kelly Edge',          '28.2%', 'y'], ['Recommended (¼K)',    '7.1%',   'g'],
      ],
      note: 'Geopolitical tail risk justifies conservative sizing. Use ¼ Kelly = 7.1%. Geo-risk premium creates asymmetric upside if Taiwan risk recedes.',
    },
    corr: [
      { sym: 'NVDA', r: 0.78, r2: 0.61 }, { sym: 'AMD',  r: 0.69, r2: 0.48 },
      { sym: 'MU',   r: 0.68, r2: 0.46 }, { sym: 'SOX',  r: 0.82, r2: 0.67 },
      { sym: 'SPX',  r: 0.55, r2: 0.30 }, { sym: 'TWD',  r: 0.44, r2: 0.19 },
    ],
    earnQuality: [
      ['Revenue Recognition',  'NT$ revenue — FX exposure USD',    'y'],
      ['Accruals Ratio',       '-2.8% (cash-generative)',          'g'],
      ['FCF / Net Income',     '0.71× (capex 42% of rev)',         'y'],
      ['EBITDA–CapEx Spread',  '$31.2B (disciplined)',             'g'],
      ['Audit Opinion',        'Clean — PwC TW + Big 4',           'g'],
      ['Restatement History',  'None (5Y)',                        'g'],
    ],
  },
};

// ════════════════════════════════════════════════════════════════════
// Main TabQuant component
// ════════════════════════════════════════════════════════════════════
function TabQuant({ t }) {
  const { palette, headline, density } = useTheme();
  const q = t.quant;
  const ex = QUANT_EXTRA[t.sym] || QUANT_EXTRA.NVDA;
  if (!q) return <div style={{ color: GT.textDim }}>Quant model not yet wired for {t.sym}.</div>;
  const upside = ((q.composite.fair / t.px) - 1) * 100;
  const gap = density.gap;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>

      {/* ── Row 1: DCF + Multiples ────────────────────────────── */}
      <div className="gt-cols-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>

        <Panel kicker={`DCF model · ${t.sym}`} title="2-Stage FCFF valuation" right="10Y horizon" accent={palette.a}>
          <QSection title="Key assumptions">
            <QTable rows={q.dcfAssumptions.slice(0, 6)} />
          </QSection>
          <QSection title="WACC">
            <QTable rows={q.wacc.filter((_, i) => [0,1,2,3,7].includes(i))} />
          </QSection>
          <QSection title="DCF output" last>
            <QTable rows={q.dcfOutput.filter((_, i) => [4,5,6,8].includes(i))} />
            <div style={{ marginTop: 8, padding: '8px 10px', background: palette.aSoft, border: `1px solid ${palette.edge}`, fontSize: 11, color: GT.textDim, lineHeight: 1.5 }}>
              <span style={{ color: palette.a, fontWeight: 700, fontFamily: GT.fontMono, fontSize: 9, letterSpacing: 1 }}>SENSITIVITY · </span>
              {q.dcfNote}
            </div>
          </QSection>
        </Panel>

        <Panel kicker={`Comparable multiples · ${t.sym}`} title="Peer-relative valuation" accent={palette.b}>
          <QSection title="Peer P/E comparison">
            <PeersBar peers={q.peers} accent={t.accent} />
          </QSection>
          <QSection title="Multiples fair value">
            <QTable rows={q.multiplesVal} />
          </QSection>
          <QSection title="Risk metrics" last>
            <QTable rows={q.risk} />
          </QSection>
        </Panel>
      </div>

      {/* ── Row 2: Monte Carlo + Regression ──────────────────── */}
      <div className="gt-cols-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>

        <Panel kicker="Monte Carlo simulation" title="GBM · 10,000 paths · 12M forward" accent="#f472b6">
          <QSection title="Parameters">
            <QTable rows={q.mcParams} />
          </QSection>
          <QSection title="Distribution">
            <MCHistogram results={q.mcResults} />
            <div style={{ marginTop: 12 }}>
              <Kicker color={GT.textDim} style={{ display: 'block', marginBottom: 6 }}>Price fan (5th–95th)</Kicker>
              <MCFanChart results={q.mcResults} params={q.mcParams} />
            </div>
          </QSection>
          <QSection title="Percentiles" last>
            <QTable rows={q.mcResults.map(r => [r.label, '$' + r.px, r.tone])} />
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${palette.edge}` }}>
              <QTable rows={q.mcSummary} />
            </div>
          </QSection>
        </Panel>

        <Panel kicker="Revenue regression" title={`${q.regression.stats[0][1]} · R²=${q.regression.stats[1][1]}`} accent={palette.a}>
          <QSection title="Historical + forecast ($B)">
            <RegressionChart history={q.regression.history} accent={t.accent} />
          </QSection>
          <QSection title="Revenue table">
            <QTable rows={q.regression.history.map(h => [h.y, '$' + h.v.toFixed(1) + 'B', h.tone])} />
          </QSection>
          <QSection title="Regression stats" last>
            <QTable rows={q.regression.stats} />
          </QSection>
        </Panel>
      </div>

      {/* ── Row 3: Factor Model + Volatility ─────────────────── */}
      <div className="gt-cols-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>

        <Panel kicker={`Factor model · ${t.sym}`} title="Multi-factor exposure scoring" accent="#a78bfa">
          <QSection title="Factor scores (0–100 percentile)">
            {ex.factors.map((f, i) => (
              <FactorBar key={i} label={f.name} score={f.score} z={f.z} color={f.color} accent={t.accent} />
            ))}
          </QSection>
          <QSection title="Composite factor score" last>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ height: 12, background: 'rgba(255,255,255,.04)', borderRadius: 100, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: ex.compositeScore + '%', background: ex.compositeScore > 70 ? GT.green : ex.compositeScore > 45 ? GT.amber : GT.red, borderRadius: 100 }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: GT.textDim, lineHeight: 1.5 }}>{ex.factorNote}</div>
              </div>
              <div style={{ fontFamily: headline, fontSize: 48, color: ex.compositeScore > 70 ? GT.green : ex.compositeScore > 45 ? GT.amber : GT.red, lineHeight: 1, letterSpacing: -2 }}>{ex.compositeScore}</div>
            </div>
          </QSection>
        </Panel>

        <Panel kicker={`Volatility analysis · ${t.sym}`} title="Realized / Implied / Greeks" accent="#06b6d4">
          <QSection title="IV term structure">
            <VolTermChart points={ex.volTerm} />
          </QSection>
          <QSection title="Vol metrics">
            <QTable rows={ex.volRows.slice(0, 6)} />
          </QSection>
          <QSection title="Option Greeks (ATM 30d)" last>
            <QTable rows={ex.greeks} />
            <div style={{ marginTop: 8 }}>
              <QTable rows={ex.volRows.slice(6)} />
            </div>
          </QSection>
        </Panel>
      </div>

      {/* ── Row 4: Kelly Criterion + Correlation + Earnings Quality ── */}
      <div className="gt-cols-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>

        <Panel kicker={`Kelly criterion · ${t.sym}`} title="Optimal position sizing via Kelly formula" accent="#f59e0b">
          <QSection title="Kelly calculation">
            <QTable rows={ex.kelly.rows} />
          </QSection>
          <QSection title="Position sizing tiers" last>
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0 12px' }}>
              <KellyGauge pct={ex.kelly.full}    label="Full Kelly"    color={GT.red} />
              <KellyGauge pct={ex.kelly.half}    label="Half Kelly"    color={GT.amber} />
              <KellyGauge pct={ex.kelly.quarter} label="Quart. Kelly"  color={GT.green} />
            </div>
            <div style={{ padding: '8px 10px', background: 'rgba(251,191,36,.06)', border: `1px solid rgba(251,191,36,.2)`, fontSize: 11, color: GT.textDim, lineHeight: 1.5, borderRadius: 4 }}>
              <span style={{ color: GT.amber, fontWeight: 700, fontFamily: GT.fontMono, fontSize: 9, letterSpacing: 1 }}>SIZING NOTE · </span>
              {ex.kelly.note}
            </div>
          </QSection>
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap }}>
          <Panel kicker={`Correlation matrix · ${t.sym}`} title="Pairwise ρ with key instruments" accent="#10b981">
            <CorrelationMatrix corrs={ex.corr} sym={t.sym} accent={t.accent} />
          </Panel>
          <Panel kicker={`Earnings quality · ${t.sym}`} title="Accruals · Cash conversion · Audit" accent="#8b5cf6">
            <QTable rows={ex.earnQuality} />
          </Panel>
        </div>
      </div>

      {/* ── Row 5: Composite Fair Value ──────────────────────── */}
      <Panel kicker="Composite quantitative fair value" title="Weighted blend across all four methods" accent={palette.b}>
        <div style={{ padding: '0 8px' }}>
          <CompositeViz composite={q.composite} current={t.px} />
        </div>
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
          {q.composite.components.map((c, i) => {
            const col = c.tone === 'g' ? GT.green : c.tone === 'a' ? palette.a : c.tone === 't' ? GT.text : palette.b;
            return (
              <div key={i} style={{ padding: '16px 18px', borderRight: i < 3 ? `1px dashed ${palette.edge}` : 'none' }}>
                <Kicker color={GT.textDim}>{c.label}</Kicker>
                <div style={{ fontFamily: headline, fontSize: 34, color: col, lineHeight: 1, marginTop: 6, letterSpacing: -1.2 }}>${c.val}</div>
                <div style={{ fontFamily: GT.fontMono, fontSize: 9, color: GT.textDim, marginTop: 4 }}>Weight {c.weight}%</div>
                <div style={{ height: 3, background: palette.edge, marginTop: 5, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: c.weight + '%', background: col }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 20, padding: '22px 24px', background: `linear-gradient(135deg, ${palette.aSoft}, ${palette.bSoft})`, border: `1px solid ${palette.edge}`, display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 28 }}>
          <div>
            <Kicker>Weighted composite fair value</Kicker>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: headline, fontSize: 64, color: palette.a, letterSpacing: -3, lineHeight: 1 }}>${q.composite.fair}</span>
              <span style={{ fontFamily: GT.fontMono, fontSize: 15, fontWeight: 700, color: upside >= 0 ? GT.green : GT.red }}>
                {upside >= 0 ? '▲' : '▼'} {upside >= 0 ? '+' : ''}{upside.toFixed(1)}% vs ${t.px.toFixed(2)}
              </span>
            </div>
            <div style={{ fontFamily: GT.fontMono, fontSize: 10, color: GT.textDim, marginTop: 8 }}>{q.composite.formula}</div>
          </div>
          {q.composite.note && (
            <div style={{ maxWidth: 300, padding: '10px 12px', background: 'rgba(251,191,36,.06)', border: `1px solid rgba(251,191,36,.2)`, fontSize: 11, color: GT.textDim, lineHeight: 1.5 }}>
              <span style={{ color: GT.amber, fontWeight: 700, fontFamily: GT.fontMono, fontSize: 9, letterSpacing: 1 }}>WEIGHTING NOTE · </span>
              {q.composite.note}
            </div>
          )}
        </div>
      </Panel>

    </div>
  );
}

Object.assign(window, { TabQuant });
