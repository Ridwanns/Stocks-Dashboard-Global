// ════════════════════════════════════════════════════════════════════
// Theme — base palette + tweakable variants, plus shared atoms used
// across the Glass Terminal prototype (aurora, panel, chart primitives).
// ════════════════════════════════════════════════════════════════════

// Three accent palettes the user can switch via Tweaks. Each picks the two
// hero accents that appear on top borders, gradients, donut slices, headline
// dot. Everything else (greens, reds, ambers) stays consistent so the data
// reading doesn't change between palettes.
// Each palette is keyed by its swatch array so the TweakColor chip control
// (which uses JSON.stringify equality) can light up the right chip.
const PALETTES = [
  { id: ['#8b5cf6','#22d3ee'], name: 'Violet+Cyan',
    a: '#8b5cf6', aSoft: 'rgba(139,92,246,.18)', b: '#22d3ee', bSoft: 'rgba(34,211,238,.18)',
    edge: 'rgba(139,92,246,.18)', heroGrad: 'linear-gradient(180deg, #fff 0%, #b8b0ff 100%)' },
  { id: ['#f472b6','#a3e635'], name: 'Pink+Lime',
    a: '#f472b6', aSoft: 'rgba(244,114,182,.18)', b: '#a3e635', bSoft: 'rgba(163,230,53,.18)',
    edge: 'rgba(244,114,182,.15)', heroGrad: 'linear-gradient(180deg, #fff 0%, #ffc8e3 100%)' },
  { id: ['#fbbf24','#22d3ee'], name: 'Amber+Cyan',
    a: '#fbbf24', aSoft: 'rgba(251,191,36,.18)', b: '#22d3ee', bSoft: 'rgba(34,211,238,.18)',
    edge: 'rgba(251,191,36,.15)', heroGrad: 'linear-gradient(180deg, #fff 0%, #ffe9b0 100%)' },
  { id: ['#8b5cf6'], name: 'Mono Violet',
    a: '#8b5cf6', aSoft: 'rgba(139,92,246,.18)', b: '#8b5cf6', bSoft: 'rgba(139,92,246,.10)',
    edge: 'rgba(139,92,246,.15)', heroGrad: 'linear-gradient(180deg, #fff 0%, #b8b0ff 100%)' },
];

// Resolve a palette by its swatch-array id (compared as JSON).
function lookupPalette(id) {
  const key = JSON.stringify(id).toLowerCase();
  return PALETTES.find(p => JSON.stringify(p.id).toLowerCase() === key) || PALETTES[0];
}

const HEADLINE_FONTS = {
  'Serif (Instrument)': "'Instrument Serif', 'Times New Roman', serif",
  'Sans (Space Grotesk)': "'Space Grotesk', 'Inter', system-ui, sans-serif",
  'Mono (JetBrains)':   "'JetBrains Mono', ui-monospace, monospace",
};

const DENSITIES = {
  Spacious: { panelPad: 28, gap: 18, blockPad: '32px 36px' },
  Default:  { panelPad: 22, gap: 14, blockPad: '24px 28px' },
  Dense:    { panelPad: 16, gap: 10, blockPad: '18px 22px' },
};

// Static palette pieces that don't change with tweaks.
const GT = {
  bg: '#0a0e1c',
  glass: 'rgba(20,26,52,.55)',
  glassDeep: 'rgba(15,20,42,.75)',
  glassFlat: 'rgba(20,26,52,.4)',
  text: '#eef0ff',
  textDim: '#8b95b8',
  textVeryDim: '#525a78',
  green: '#34d399',
  red: '#fb7185',
  amber: '#fbbf24',
  fontUI: "'Space Grotesk', 'Inter', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', 'Geist Mono', ui-monospace, monospace",
};

// React context so deep children can read the current theme without prop-drilling.
const ThemeCtx = React.createContext({
  palette: PALETTES[0],
  headline: HEADLINE_FONTS['Serif (Instrument)'],
  density: DENSITIES.Default,
  auroraOn: true,
});

function useTheme() { return React.useContext(ThemeCtx); }

// ── Aurora layer ──────────────────────────────────────────────────
// Fixed full-viewport background with two color blobs, a WebGL starfield
// canvas, and a faint grid overlay. When `off`, falls back to a flat solid bg.
function Aurora() {
  const { palette, auroraOn } = useTheme();
  const canvasRef = React.useRef(null);
  const stopRef = React.useRef(null);

  // Spin up the WebGL starfield once three.js is available, and re-mount it
  // whenever the palette accents change so star colors track the theme.
  React.useEffect(() => {
    if (!auroraOn) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const start = () => {
      if (!window.startGalaxy) return false;
      stopRef.current = window.startGalaxy(canvas, palette.a, palette.b);
      return true;
    };
    if (!start()) {
      const onReady = () => start();
      window.addEventListener('__galaxyReady', onReady);
      return () => {
        window.removeEventListener('__galaxyReady', onReady);
        stopRef.current?.();
      };
    }
    return () => stopRef.current?.();
  }, [palette.a, palette.b, auroraOn]);

  if (!auroraOn) {
    return <div style={{ position: 'fixed', inset: 0, background: GT.bg, zIndex: -1 }} />;
  }
  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden',
      pointerEvents: 'none', zIndex: -1, background: GT.bg,
    }}>
      {/* WebGL starfield — uniformly scattered, drifts slowly with parallax */}
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
      }} />
      {/* Soft color blobs for atmosphere */}
      <div style={{
        position: 'absolute', top: -200, left: '12%', width: 800, height: 800,
        background: `radial-gradient(circle, ${palette.a}59, transparent 65%)`,
        filter: 'blur(90px)', mixBlendMode: 'screen',
      }} />
      <div style={{
        position: 'absolute', bottom: -260, right: -140, width: 800, height: 800,
        background: `radial-gradient(circle, ${palette.b}40, transparent 65%)`,
        filter: 'blur(80px)', mixBlendMode: 'screen',
      }} />
      <div style={{
        position: 'absolute', top: '42%', right: '28%', width: 460, height: 460,
        background: 'radial-gradient(circle, rgba(244,114,182,.13), transparent 70%)',
        filter: 'blur(70px)', mixBlendMode: 'screen',
      }} />
      {/* Faint grid overlay for terminal-doc feel */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.4 }}>
        <defs>
          <pattern id="gtGrid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M64 0H0V64" fill="none" stroke={palette.a} strokeOpacity="0.06" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gtGrid)" />
      </svg>
    </div>
  );
}

// ── Glass panel ───────────────────────────────────────────────────
// All cards use this shell — borderless rectangles with a 2px hard accent
// across the top, optional dashed-rule header, and a content body.
function Panel({ kicker, title, right, p, accent, children, style }) {
  const { palette, headline, density } = useTheme();
  const c = accent || palette.a;
  const pad = p ?? density.panelPad;
  return (
    <div style={{
      background: GT.glass,
      backdropFilter: 'blur(20px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
      border: `1px solid ${palette.edge}`,
      position: 'relative',
      ...style,
    }}>
      {/* hard accent top */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: 2,
        background: `linear-gradient(90deg, ${c}, transparent 70%)`,
      }} />
      {(kicker || title || right) && (
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          padding: `${pad - 6}px ${pad}px ${pad - 10}px`,
          borderBottom: `1px dashed ${palette.edge}`, gap: 16,
        }}>
          <div style={{ minWidth: 0 }}>
            {kicker && (
              <div className="gt-panel-kicker" style={{
                fontFamily: GT.fontMono, fontSize: 9, color: c,
                letterSpacing: 2, fontWeight: 600, textTransform: 'uppercase',
              }}>// {kicker}</div>
            )}
            {title && (
              <div className="gt-panel-title" style={{
                fontFamily: headline, fontSize: 22, color: GT.text,
                marginTop: 4, lineHeight: 1.05, fontWeight: 400, letterSpacing: -0.3,
              }}>{title}</div>
            )}
          </div>
          {right && (
            <span style={{ fontFamily: GT.fontMono, fontSize: 10, color: GT.textDim, letterSpacing: 0.6, textAlign: 'right' }}>
              {right}
            </span>
          )}
        </div>
      )}
      <div style={{ padding: pad }}>{children}</div>
    </div>
  );
}

// ── Kicker (small monospace label) ────────────────────────────────
// Renders kicker text; if the content begins with "//" the slash prefix is
// wrapped in a dimmed span so it reads as a syntactic marker, not as label
// text. Mixed children (string + nodes) keep working untouched.
function renderKickerChildren(children) {
  if (typeof children === 'string') {
    const m = children.match(/^(\s*\/\/\s*)(.*)$/);
    if (m) {
      return React.createElement(
        React.Fragment, null,
        React.createElement('span', { style: { opacity: 0.4 } }, m[1]),
        m[2]
      );
    }
    return children;
  }
  if (Array.isArray(children)) {
    return children.map((c, i) => {
      if (typeof c === 'string' && i === 0) {
        const m = c.match(/^(\s*\/\/\s*)(.*)$/);
        if (m) {
          return React.createElement(
            React.Fragment, { key: i },
            React.createElement('span', { style: { opacity: 0.4 } }, m[1]),
            m[2]
          );
        }
      }
      return c;
    });
  }
  return children;
}

function Kicker({ children, color, style }) {
  const { palette } = useTheme();
  return (
    <span style={{
      fontFamily: GT.fontMono, fontSize: 10, color: color || palette.a,
      letterSpacing: 2, fontWeight: 600, textTransform: 'uppercase', ...style,
    }}>{renderKickerChildren(children)}</span>
  );
}

// ── Sparkline ────────────────────────────────────────────────────
function Spark({ data, w = 80, h = 22, color, strokeWidth = 1.4 }) {
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={gtSpark(data, w, h)} fill="none" stroke={color} strokeWidth={strokeWidth} />
    </svg>
  );
}

// ── Candle chart ─────────────────────────────────────────────────
// Renders OHLC candles + a 20-day MA line. SVG, responsive via viewBox.
// Candles fade in left-to-right via a per-bar animation-delay; the MA
// line draws itself via stroke-dashoffset.
function CandleChart({ data, ma, height = 240, w = 760 }) {
  const { palette } = useTheme();
  const min = Math.min(...data.map(b => b.l));
  const max = Math.max(...data.map(b => b.h));
  const scale = v => height - ((v - min) / (max - min)) * (height - 20) - 10;
  const bw = w / data.length;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1={0} x2={w} y1={p * height} y2={p * height}
          stroke={palette.edge} strokeDasharray="2,4" />
      ))}
      {data.map((d, i) => {
        const c = d.up ? GT.green : GT.red;
        const delay = (i / data.length) * 600;
        return (
          <g key={i} style={{
            opacity: 0,
            animation: `gtFadeUp .4s cubic-bezier(.2,.7,.3,1) both`,
            animationDelay: `${delay}ms`,
          }}>
            <line x1={i * bw + bw / 2} x2={i * bw + bw / 2} y1={scale(d.h)} y2={scale(d.l)} stroke={c} strokeWidth={1} />
            <rect x={i * bw + 1.5} y={scale(Math.max(d.o, d.c))} width={Math.max(bw - 3, 1)}
              height={Math.abs(scale(d.o) - scale(d.c)) + 1} fill={c} />
          </g>
        );
      })}
      {ma && (
        <path d={gtSpark(ma, w, height, 10)} fill="none"
          stroke={palette.b} strokeWidth={1.5} opacity={0.85}
          className="gt-draw" style={{ '--gt-dash': 3000, animationDelay: '300ms' }} />
      )}
    </svg>
  );
}

// ── Bar chart (used for quarterly revenue) ────────────────────────
function QuarterBars({ data, height = 130, accent }) {
  const { palette } = useTheme();
  const ac = accent || palette.a;
  const max = Math.max(...data.map(d => d.rev));
  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${data.length},1fr)`, gap: 8,
        alignItems: 'end', height,
      }}>
        {data.map((b, i) => {
          const isLast = i === data.length - 1;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
              <div style={{
                fontFamily: GT.fontMono, fontSize: 10, color: GT.text, textAlign: 'center', marginBottom: 4,
                animation: 'gtFadeUp .4s both', animationDelay: `${500 + i * 80}ms`, opacity: 0,
              }}>
                ${b.rev}B
              </div>
              <div className="gt-bar" style={{
                width: '100%', height: `${(b.rev / max) * 100}%`,
                background: isLast
                  ? `linear-gradient(180deg, ${ac}, ${palette.b})`
                  : palette.aSoft,
                border: `1px solid ${isLast ? ac : palette.edge}`,
                animationDelay: `${i * 80}ms`,
              }} />
            </div>
          );
        })}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${data.length},1fr)`, gap: 8,
        fontFamily: GT.fontMono, fontSize: 10, color: GT.textDim,
        textAlign: 'center', marginTop: 8, letterSpacing: 0.5,
      }}>
        {data.map((d, i) => <span key={i}>{d.q}</span>)}
      </div>
    </div>
  );
}

// ── Donut chart for segment mix ──────────────────────────────────
function Donut({ segments, size = 180, accent }) {
  const { palette } = useTheme();
  const colors = [palette.a, palette.b, '#f472b6', palette.a + 'aa'];
  const cx = size / 2, cy = size / 2, r = size / 2 - 8, ir = r - 22;
  let a0 = -Math.PI / 2;
  const arcs = segments.map((s, i) => {
    const a1 = a0 + (s.pct / 100) * Math.PI * 2;
    const lf = (a1 - a0) > Math.PI ? 1 : 0;
    const p = [
      `M ${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)}`,
      `A ${r},${r} 0 ${lf} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)}`,
      `L ${cx + ir * Math.cos(a1)},${cy + ir * Math.sin(a1)}`,
      `A ${ir},${ir} 0 ${lf} 0 ${cx + ir * Math.cos(a0)},${cy + ir * Math.sin(a0)}`,
      'Z',
    ].join(' ');
    a0 = a1;
    return { p, color: colors[i % colors.length], delay: i * 110 };
  });
  return (
    <svg width={size} height={size}>
      {arcs.map((a, i) => (
        <path key={i} d={a.p} fill={a.color} opacity={0.92}
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            opacity: 0,
            animation: 'gtFadeUp .5s cubic-bezier(.22,.7,.3,1) both',
            animationDelay: `${a.delay}ms`,
          }} />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={11}
        fill={GT.textDim} fontFamily={GT.fontMono} letterSpacing={1}>
        SEGMENT
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={20}
        fill={GT.text} fontFamily={GT.fontUI} fontWeight={600}>
        MIX
      </text>
    </svg>
  );
}

// Maps a tone string from the data file to the actual color.
function toneColor(tone) {
  return tone === 'green' ? GT.green
       : tone === 'red'   ? GT.red
       : tone === 'amber' ? GT.amber
       : GT.text;
}

// ── Animation infrastructure ─────────────────────────────────────
// All keyframes + helper classes live in one stylesheet that mounts on
// first paint. Components opt in via className OR via the React
// helpers below (NumberFlicker, AnimGate).
const GT_ANIM_CSS = `
@keyframes gtFadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes gtClipRevealR {
  from { clip-path: inset(0 100% 0 0); }
  to   { clip-path: inset(0 0 0 0); }
}
@keyframes gtBarGrow {
  from { transform: scaleY(0); }
  to   { transform: scaleY(1); }
}
@keyframes gtDrawLine {
  from { stroke-dashoffset: var(--gt-dash, 2000); }
  to   { stroke-dashoffset: 0; }
}
@keyframes gtArcDraw {
  from { stroke-dashoffset: var(--gt-arc-len, 600); }
  to   { stroke-dashoffset: 0; }
}
@keyframes gtScanSweep {
  0%   { transform: translateX(-30%); opacity: 0; }
  20%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { transform: translateX(130%); opacity: 0; }
}
@keyframes gtTickerFlash {
  0%   { background-color: transparent; }
  35%  { background-color: var(--gt-flash, rgba(139,92,246,.22)); }
  100% { background-color: transparent; }
}
@keyframes gtBlink {
  0%, 60% { opacity: 1; }
  61%, 100% { opacity: 0; }
}

.gt-fade-up { animation: gtFadeUp .55s cubic-bezier(.22,.7,.3,1) both; }
.gt-clip-r  { animation: gtClipRevealR .7s cubic-bezier(.2,.7,.3,1) both; }
.gt-bar     { transform-origin: bottom; animation: gtBarGrow .75s cubic-bezier(.34,1.36,.4,1) both; }
.gt-flash   { animation: gtTickerFlash 1.2s cubic-bezier(.2,.7,.3,1) both; }

/* Stagger children — used for KPI grids, signal grids, etc. */
.gt-stagger > * { animation: gtFadeUp .55s cubic-bezier(.22,.7,.3,1) both; opacity: 0; }
.gt-stagger > *:nth-child(1) { animation-delay: 0ms; }
.gt-stagger > *:nth-child(2) { animation-delay: 55ms; }
.gt-stagger > *:nth-child(3) { animation-delay: 110ms; }
.gt-stagger > *:nth-child(4) { animation-delay: 165ms; }
.gt-stagger > *:nth-child(5) { animation-delay: 220ms; }
.gt-stagger > *:nth-child(6) { animation-delay: 275ms; }
.gt-stagger > *:nth-child(7) { animation-delay: 330ms; }
.gt-stagger > *:nth-child(8) { animation-delay: 385ms; }

/* ──────── Tab content reveal ────────
   Each tab/section is wrapped in a keyed container, so switching tabs
   remounts it and replays these. We stagger the panels (grandchildren of
   the wrapper: .wrapper > tabRootDiv > panel*) so they cascade up on press. */
.gt-tab-stagger > * > * { animation: gtFadeUp .5s cubic-bezier(.22,.7,.3,1) both; }
.gt-tab-stagger > * > *:nth-child(1)  { animation-delay: 40ms; }
.gt-tab-stagger > * > *:nth-child(2)  { animation-delay: 100ms; }
.gt-tab-stagger > * > *:nth-child(3)  { animation-delay: 160ms; }
.gt-tab-stagger > * > *:nth-child(4)  { animation-delay: 220ms; }
.gt-tab-stagger > * > *:nth-child(5)  { animation-delay: 280ms; }
.gt-tab-stagger > * > *:nth-child(6)  { animation-delay: 340ms; }
.gt-tab-stagger > * > *:nth-child(7)  { animation-delay: 400ms; }
.gt-tab-stagger > * > *:nth-child(8)  { animation-delay: 460ms; }
.gt-tab-stagger > * > *:nth-child(9)  { animation-delay: 520ms; }
.gt-tab-stagger > * > *:nth-child(n+10) { animation-delay: 580ms; }

/* SVG bar grow-in — bars scale up from their own baseline. transform-box
   keeps the origin within each rect's own box despite the chart's viewBox. */
.gt-grow-bar { transform-box: fill-box; transform-origin: bottom; animation: gtBarGrow .6s cubic-bezier(.34,1.3,.42,1) both; }

@media (prefers-reduced-motion: reduce) {
  .gt-tab-stagger > * > *, .gt-grow-bar, .gt-fade-up, .gt-stagger > * { animation: none !important; opacity: 1 !important; }
}

/* SVG draw helpers */
.gt-draw     { stroke-dasharray: var(--gt-dash, 2000); animation: gtDrawLine 1.1s cubic-bezier(.2,.7,.3,1) both; }
.gt-arc-draw { stroke-dasharray: var(--gt-arc-len, 600); animation: gtArcDraw .9s cubic-bezier(.3,.7,.3,1) both; }

/* Scanline sweep — overlay applied to dashboard frame when ticker changes */
.gt-scan-host { position: relative; overflow: hidden; }
.gt-scan-host::after {
  content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 35%;
  background: linear-gradient(90deg, transparent, var(--gt-scan-c, rgba(139,92,246,.25)), transparent);
  pointer-events: none; transform: translateX(-100%); opacity: 0;
}
.gt-scan-host[data-scan="1"]::after { animation: gtScanSweep 1.1s cubic-bezier(.2,.7,.3,1) both; }

/* Caret blink for terminal feel */
.gt-caret { animation: gtBlink 1.05s steps(1, end) infinite; }

/* ──────── Mobile / tablet responsive layout ──────── */
/* Hide the WebGL canvas on mobile to save battery & GPU. */
@media (max-width: 760px) {
  #galaxy-canvas, .gt-galaxy { display: none !important; }
}

/* Tablet: tighten paddings. */
@media (max-width: 1100px) {
  .gt-dash-frame > .gt-dash-grid { grid-template-columns: 1fr !important; }
  .gt-dash-frame > .gt-dash-grid > .gt-dash-rail { border-right: none !important; border-top: 1px dashed currentColor; }
}

/* Mobile breakpoint — full single-column. */
@media (max-width: 760px) {
  /* dashboard frame: smaller paddings */
  .gt-dash-frame { border-radius: 0 !important; }
  .gt-quote-head { padding: 18px 18px 0 !important; }
  .gt-quote-name { font-size: 48px !important; letter-spacing: -1.2px !important; }
  .gt-quote-px   { font-size: 30px !important; }
  .gt-quote-meta { font-size: 10px !important; gap: 10px !important; }

  /* Ticker switcher row scrolls horizontally */
  .gt-ticker-row { overflow-x: auto; flex-wrap: nowrap !important; padding-bottom: 6px; }
  .gt-ticker-row > button { flex: 0 0 auto; min-width: 110px !important; }

  /* Top-level tabs scroll horizontally too */
  .gt-tabs-row { overflow-x: auto; padding-bottom: 2px; }
  .gt-tabs-row > button { flex: 0 0 auto; white-space: nowrap; }

  /* Content paddings */
  .gt-dash-main, .gt-dash-rail { padding: 14px !important; }

  /* Collapse 2-col grids to 1 */
  .gt-cols-2 { grid-template-columns: 1fr !important; }

  /* KPI strip 2x2 instead of 4 */
  .gt-kpi-grid { grid-template-columns: 1fr 1fr !important; }

  /* Panel headers smaller */
  .gt-panel-title { font-size: 18px !important; }
  .gt-panel-kicker { font-size: 9px !important; }

  /* Statement tables scroll horizontally on mobile */
  table { font-size: 11px !important; }

  /* Ratios collapse to 2 cols */
  .gt-ratios-grid { grid-template-columns: 1fr 1fr !important; }
  .gt-ratios-grid > * { border-right: none !important; border-bottom: 1px dashed currentColor !important; }

  /* Narrative business: stack label and value */
  .gt-narr-row { grid-template-columns: 1fr !important; gap: 4px !important; }

  /* Deep-dive headline + banner */
  .gt-deep-headline { font-size: 20px !important; line-height: 1.3 !important; }
  .gt-deep-banner { padding: 18px 16px !important; }

  /* Narrative paragraphs slightly smaller */
  .gt-narr-row > div { font-size: 13px !important; }

  /* Section heading less giant */
  #dashboard h2 { font-size: 32px !important; letter-spacing: -1px !important; }
  #dashboard { padding-top: 60px !important; padding-bottom: 30px !important; }
  #dashboard > div { padding: 0 12px !important; }

  /* Top nav: hide secondary items on tiny mobile */
}

@media (max-width: 460px) {
  .gt-quote-name { font-size: 36px !important; }
  .gt-quote-px   { font-size: 24px !important; }
  .gt-kpi-grid   { grid-template-columns: 1fr !important; }
}

/* ════════ Cinematic 3D loading screen ════════ */
.gt-loader {
  position: fixed; inset: 0; z-index: 99999; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at 50% 45%, #0d1228 0%, #070a16 62%, #04060f 100%);
  transition: opacity .5s ease;
}
.gt-loader[data-phase="zoom"] { pointer-events: none; }
.gt-loader > canvas { position: absolute; inset: 0; width: 100% !important; height: 100% !important; display: block; }
.gt-loader-ui {
  position: relative; z-index: 2; text-align: center; pointer-events: none;
  animation: gtFadeUp .8s cubic-bezier(.22,.7,.3,1) both; padding: 0 24px;
  transition: opacity .55s ease, transform .55s ease;
}
.gt-loader[data-phase="zoom"] .gt-loader-ui { opacity: 0; transform: scale(1.12); }
.gt-loader-kicker { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 3px; color: #8b95b8; text-transform: uppercase; }
.gt-loader-title { font-family: 'Instrument Serif', serif; font-size: clamp(34px, 8vw, 66px); color: #eef0ff; letter-spacing: -1.5px; line-height: 1; margin-top: 12px; }
.gt-loader-enter-wrap { margin-top: 30px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.gt-loader-enter {
  pointer-events: auto; cursor: pointer;
  font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;
  color: #eef0ff; padding: 14px 34px; border-radius: 100px;
  background: rgba(139,92,246,.15);
  border: 1px solid rgba(139,92,246,.6);
  box-shadow: 0 0 26px -8px rgba(139,92,246,.85), inset 0 0 18px -12px rgba(34,211,238,.7);
  transition: background .22s ease, transform .22s ease, box-shadow .22s ease;
  animation: gtEnterPulse 2.6s ease-in-out infinite;
}
.gt-loader-enter:hover { background: rgba(139,92,246,.3); transform: translateY(-2px) scale(1.04); box-shadow: 0 0 42px -6px rgba(139,92,246,1); }
.gt-loader-enter:active { transform: translateY(0) scale(.99); }
.gt-loader-arrow { display: inline-block; transition: transform .22s ease; }
.gt-loader-enter:hover .gt-loader-arrow { transform: translateX(6px); }
@keyframes gtEnterPulse { 0%,100% { box-shadow: 0 0 22px -10px rgba(139,92,246,.7), inset 0 0 18px -12px rgba(34,211,238,.6); } 50% { box-shadow: 0 0 40px -6px rgba(139,92,246,1), inset 0 0 22px -10px rgba(34,211,238,.8); } }
.gt-loader[data-phase="zoom"] .gt-loader-enter { animation: none; }
.gt-loader-sub { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 2.5px; color: #8b95b8; text-transform: uppercase; }

/* Whole-app cinematic settle as the galaxy hands off to the dashboard. */
.gt-app-enter { animation: gtAppEnter .9s cubic-bezier(.2,.7,.3,1) both; }
@keyframes gtAppEnter { from { opacity: 0; transform: scale(1.035); } to { opacity: 1; transform: none; } }

/* Skeleton shimmer for index values awaiting their first live fetch. */
@keyframes gtShimmer { 0%,100% { opacity: .3; } 50% { opacity: .7; } }
.gt-idx-skel { animation: gtShimmer 1.25s ease-in-out infinite; }

/* ════════ Rich Financials / section transitions ════════ */
@keyframes gtSlideFadeR { from { opacity: 0; transform: translateX(34px); } to { opacity: 1; transform: translateX(0); } }
@keyframes gtSlideFadeL { from { opacity: 0; transform: translateX(-34px); } to { opacity: 1; transform: translateX(0); } }
@keyframes gtZoomFade  { from { opacity: 0; transform: scale(.965) translateY(14px); } to { opacity: 1; transform: scale(1) translateY(0); } }
/* keyed remount replays these; children also cascade */
.gt-sec-zoom  > * { animation: gtZoomFade .5s cubic-bezier(.22,.8,.3,1) both; }
.gt-sec-zoom  > *:nth-child(1) { animation-delay: 30ms; }
.gt-sec-zoom  > *:nth-child(2) { animation-delay: 95ms; }
.gt-sec-zoom  > *:nth-child(3) { animation-delay: 160ms; }
.gt-sec-zoom  > *:nth-child(4) { animation-delay: 225ms; }
.gt-sec-zoom  > *:nth-child(n+5) { animation-delay: 290ms; }
.gt-slide-r { animation: gtSlideFadeR .46s cubic-bezier(.22,.8,.3,1) both; }
.gt-slide-l { animation: gtSlideFadeL .46s cubic-bezier(.22,.8,.3,1) both; }

@media (prefers-reduced-motion: reduce) {
  .gt-sec-zoom > *, .gt-slide-r, .gt-slide-l, .gt-loader-ui, .gt-loader-enter, .gt-app-enter { animation: none !important; opacity: 1 !important; transform: none !important; }
}

/* ════════ Extra mobile hardening ════════ */
@media (max-width: 760px) {
  /* Charts & SVGs never exceed the viewport */
  svg { max-width: 100%; }
  /* Statement tables get a horizontal scroll affordance instead of breaking */
  .gt-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .gt-table-scroll > table { min-width: 480px; }
  /* Financial section sub-nav scrolls horizontally */
  .gt-fin-sections { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .gt-fin-sections > button { flex: 0 0 auto !important; white-space: nowrap; }
  /* Donut / segment rows stack */
  .gt-seg-row { flex-direction: column !important; align-items: stretch !important; gap: 14px !important; }
  /* Generic 2-col → 1-col safety net for moat etc. */
  .gt-moat-grid { grid-template-columns: 1fr !important; }
  .gt-moat-grid > * { border-right: none !important; }

  /* Overview 4 ticker cards → 2×2 so symbol + price never overlap */
  .gt-overview-cards { grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
  /* Thesis stat strip (Sector / Analysts / 12M target) → stack, no clipping */
  .gt-thesis-stats { grid-template-columns: 1fr !important; gap: 0 !important; }
  .gt-thesis-stats > * { border-right: none !important; border-bottom: 1px dashed rgba(255,255,255,.08); padding: 8px 0 !important; }
  .gt-thesis-stats > *:last-child { border-bottom: none; }
  /* Deep Dive nav + content → stack; nav becomes a horizontal scroll strip */
  .gt-dd-layout { grid-template-columns: 1fr !important; }
  .gt-dd-layout > div:first-child { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,.08); display: flex; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .gt-dd-layout > div:first-child > div:first-child { display: none; } /* hide "// SECTIONS" label inline */
  .gt-dd-nav-item { flex: 0 0 auto !important; }
  /* Risk / scenario 3-col → horizontal scroll, no cut-off */
  .gt-scenarios-3 { display: flex !important; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .gt-scenarios-3 > * { flex: 0 0 78% !important; border-right: 1px dashed rgba(255,255,255,.08) !important; }
  .gt-scenarios-3 .gt-scn-px { font-size: 40px !important; }
  /* Global market globe stacks: Earth on top, index list below */
  .gt-globe-wrap { grid-template-columns: 1fr !important; }
  .gt-globe-canvas { min-height: 280px !important; }
}

@media (max-width: 380px) {
  .gt-overview-cards { grid-template-columns: 1fr !important; }
}
`;

function GTAnimStyle() {
  React.useEffect(() => {
    if (document.getElementById('__gt-anim')) return;
    const s = document.createElement('style');
    s.id = '__gt-anim';
    s.textContent = GT_ANIM_CSS;
    document.head.appendChild(s);
  }, []);
  return null;
}

// ── NumberFlicker — terminal-style scramble reveal of a value ────
// Briefly scrambles digits/letters, then settles to the final value
// progressively from left to right. Triggers when `value` changes.
function NumberFlicker({ value, ms = 480, scrambleChars = '0123456789' }) {
  const target = String(value);
  const [display, setDisplay] = React.useState(target);
  React.useEffect(() => {
    let cancelled = false;
    const steps = Math.max(8, Math.min(18, target.length + 8));
    const stepMs = ms / steps;
    let s = 0;
    const tick = () => {
      if (cancelled) return;
      s++;
      if (s >= steps) { setDisplay(target); return; }
      const revealed = Math.floor((s / steps) * target.length);
      let next = '';
      for (let i = 0; i < target.length; i++) {
        const ch = target[i];
        if (i < revealed) next += ch;
        else if (/[0-9]/.test(ch)) next += scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
        else next += ch;
      }
      setDisplay(next);
      setTimeout(tick, stepMs);
    };
    setTimeout(tick, stepMs);
    return () => { cancelled = true; };
  }, [target, ms, scrambleChars]);
  return <React.Fragment>{display}</React.Fragment>;
}

// ── useReveal — IntersectionObserver-driven entrance animation ───
// Returns a ref to attach to any element. Once the element scrolls into
// the viewport (≥10% visible), `revealed` flips true. Combine with
// className="gt-reveal" to fade-up the element on entrance.
function useReveal(threshold = 0.12) {
  const ref = React.useRef(null);
  const [revealed, setRevealed] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // If the element is already in view at mount (hero on page-load), reveal
    // immediately — the observer fires async and would otherwise flash.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) { setRevealed(true); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { setRevealed(true); io.disconnect(); }
      }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, revealed];
}

// ── Reveal — drop-in wrapper that fades a section up when it enters view.
// Use it on every <section> and large block; `delay` cascades children.
function Reveal({ children, delay = 0, as: As = 'div', style, ...rest }) {
  const [ref, on] = useReveal();
  return (
    <As ref={ref} {...rest} style={{
      opacity: on ? 1 : 0,
      transform: on ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity .85s cubic-bezier(.22,.7,.3,1) ${delay}ms, transform .85s cubic-bezier(.22,.7,.3,1) ${delay}ms`,
      willChange: 'opacity, transform',
      ...style,
    }}>{children}</As>
  );
}

Object.assign(window, {
  PALETTES, HEADLINE_FONTS, DENSITIES, GT, ThemeCtx, useTheme, lookupPalette,
  Aurora, Panel, Kicker, Spark, CandleChart, QuarterBars, Donut, toneColor,
  GTAnimStyle, NumberFlicker, useReveal, Reveal,
});
