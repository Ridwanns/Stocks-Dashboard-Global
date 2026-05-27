// ════════════════════════════════════════════════════════════════════
// Page sections — Nav, Hero, About, Contact, Footer.
// All composed on top of the Aurora background and use the same Theme
// context as the Dashboard.
// v2 — TSM added · active nav · contrast fixes · memos archive · mobile
// ════════════════════════════════════════════════════════════════════

const { useState: pgUseState, useEffect: pgUseEffect, useRef: pgUseRef } = React;

// ── Responsive helper ─────────────────────────────────────────────
// Injects a single <style> block with breakpoints once per page load.
(function injectResponsiveStyles() {
  if (document.getElementById('gt-responsive-styles')) return;
  const s = document.createElement('style');
  s.id = 'gt-responsive-styles';
  s.textContent = `
    /* ── Mobile-first responsive backbone ── */
    @media (max-width: 768px) {
      .gt-hero-grid      { grid-template-columns: 1fr !important; }
      .gt-hero-right     { display: none !important; }
      .gt-hero-h1        { font-size: clamp(72px, 22vw, 140px) !important; letter-spacing: -4px !important; }
      .gt-hero-sub       { font-size: 20px !important; }
      .gt-hero-stats     { grid-template-columns: repeat(2, 1fr) !important; }
      .gt-hero-stat-num  { font-size: 44px !important; }
      .gt-about-grid     { grid-template-columns: 1fr !important; }
      .gt-contact-grid   { grid-template-columns: 1fr !important; }
      .gt-method-grid    { grid-template-columns: 1fr 1fr !important; }
      .gt-method-item    { border-right: none !important; border-bottom: 1px dashed rgba(255,255,255,.08) !important; }
      .gt-archive-grid   { grid-template-columns: 1fr !important; }
      .gt-nav-links      { display: none !important; }
      .gt-nav-mobile-toggle { display: flex !important; }
      .gt-nav-mkt        { display: none !important; }
      .gt-section-pad    { padding: 60px 0 !important; }
      .gt-section-inner  { padding: 0 18px !important; }
      .gt-sub-input-row  { flex-direction: column !important; border-radius: 12px !important; }
      .gt-sub-input-row input  { border-bottom: 1px solid rgba(255,255,255,.12) !important; border-radius: 0 !important; }
      .gt-sub-input-row button { border-radius: 100px !important; width: 100% !important; padding: 13px !important; }
      .gt-footer-row     { flex-direction: column !important; gap: 8px !important; align-items: flex-start !important; }
    }
    @media (max-width: 480px) {
      .gt-hero-h1        { font-size: clamp(56px, 24vw, 100px) !important; }
      .gt-hero-stats     { grid-template-columns: 1fr 1fr !important; }
      .gt-method-grid    { grid-template-columns: 1fr !important; }
      .gt-glance-grid    { grid-template-columns: 1fr !important; }
    }
    /* ── Mobile nav menu ── */
    .gt-nav-mobile-toggle { display: none; align-items: center; justify-content: center;
      width: 36px; height: 36px; background: transparent; border: 1px solid rgba(255,255,255,.18);
      border-radius: 6px; cursor: pointer; flex-direction: column; gap: 4px; }
    .gt-nav-mobile-toggle span { display: block; width: 16px; height: 1.5px; background: #e2e8f0; border-radius: 2px; }
    /* hide mobile menu entirely on desktop */
    @media (min-width: 769px) {
      .gt-mobile-menu { display: none !important; }
    }
    .gt-mobile-menu {
      position: fixed; top: 56px; left: 0; right: 0; z-index: 49;
      background: rgba(10,14,28,.97); backdrop-filter: blur(24px);
      border-bottom: 1px solid rgba(255,255,255,.1);
      padding: 18px 22px 22px; display: flex; flex-direction: column; gap: 6px;
      transform: translateY(-110%); transition: transform .22s cubic-bezier(.4,0,.2,1);
    }
    .gt-mobile-menu.open { transform: translateY(0); }
    .gt-mobile-menu a {
      font-family: 'JetBrains Mono', monospace; font-size: 14px; color: rgba(226,232,240,.7);
      letter-spacing: 1px; padding: 11px 14px; border-radius: 6px;
      transition: background .12s, color .12s; text-decoration: none;
    }
    .gt-mobile-menu a:hover, .gt-mobile-menu a.active { background: rgba(255,255,255,.06); color: #e2e8f0; }
    /* ── Active nav indicator ── */
    .gt-nav-link { position: relative; text-decoration: none; }
    .gt-nav-link::after {
      content: ''; position: absolute; left: 0; right: 0; bottom: -4px;
      height: 1px; background: currentColor; transform: scaleX(0);
      transition: transform .2s ease; transform-origin: left;
    }
    .gt-nav-link.active::after { transform: scaleX(1); }
    /* ── Contrast fixes ── */
    .gt-dim-readable { color: rgba(148,163,184,.85) !important; }
    .gt-clock-label  { color: rgba(226,232,240,.9) !important; }
    .gt-price-pct-up { color: #4ade80 !important; font-weight: 700; }
    .gt-price-pct-dn { color: #f87171 !important; font-weight: 700; }
  `;
  document.head.appendChild(s);
})();

// ── Top nav (sticky, active-state aware) ─────────────────────────
function Nav({ onTweaks }) {
  const { palette } = useTheme();
  const [scrolled, setScrolled] = pgUseState(false);
  const [activeSection, setActiveSection] = pgUseState('hero');
  const [mobileOpen, setMobileOpen] = pgUseState(false);

  pgUseEffect(() => {
    // scroll background
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });

    // IntersectionObserver for active section
    const sections = ['hero', 'about', 'dashboard', 'methodology', 'contact'];
    const observers = [];
    const visible = {};

    const pick = () => {
      // pick the section with largest intersection ratio, fallback to topmost
      let best = 'hero', bestRatio = 0;
      for (const id of sections) {
        if ((visible[id] || 0) > bestRatio) { bestRatio = visible[id]; best = id; }
      }
      setActiveSection(best);
    };

    sections.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { visible[id] = entry.intersectionRatio; pick(); },
        { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0], rootMargin: '-10% 0px -10% 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      observers.forEach(o => o.disconnect());
    };
  }, []);

  // close mobile menu when navigating
  const handleNavClick = () => setMobileOpen(false);

  const navLinks = [
    ['About',       '#about'],
    ['Dashboard',   '#dashboard'],
    ['Methodology', '#methodology'],
    ['Contact',     '#contact'],
  ];

  const linkSectionId = h => h.replace('#', '');

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 32px',
        background: scrolled ? 'rgba(10,14,28,.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px) saturate(1.3)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(1.3)' : 'none',
        borderBottom: scrolled ? `1px solid ${palette.edge}` : '1px solid transparent',
        transition: 'all .25s',
      }}>
        <a href="#hero" style={{
          fontFamily: GT.fontMono, fontSize: 12, color: palette.a,
          letterSpacing: 3, fontWeight: 700, textDecoration: 'none',
        }}>R · I · D · W · A · N</a>

        {/* Desktop links */}
        <div className="gt-nav-links" style={{ display: 'flex', gap: 28 }}>
          {navLinks.map(([t, h], i) => {
            const isActive = activeSection === linkSectionId(h) ||
              (linkSectionId(h) === 'about' && activeSection === 'methodology');
            return (
              <a key={i} href={h} onClick={handleNavClick}
                className={`gt-nav-link${isActive ? ' active' : ''}`}
                style={{
                  fontFamily: GT.fontUI, fontSize: 13,
                  color: isActive ? GT.text : 'rgba(148,163,184,.8)',
                  letterSpacing: 0.4, transition: 'color .15s',
                  textDecoration: 'none',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = GT.text; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'rgba(148,163,184,.8)'; }}
              >{t}</a>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="gt-nav-mkt" style={{
            fontFamily: GT.fontMono, fontSize: 11, color: GT.green,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: GT.green, boxShadow: `0 0 8px ${GT.green}` }} />
            MKT · OPEN
          </span>
          <button onClick={onTweaks} style={{
            padding: '7px 14px', background: 'transparent', color: palette.a,
            border: `1px solid ${palette.a}`, borderRadius: 100,
            fontFamily: GT.fontMono, fontSize: 11, fontWeight: 700,
            letterSpacing: 1.4, cursor: 'pointer', textTransform: 'uppercase',
          }}>Settings</button>
          {/* Mobile hamburger */}
          <button className="gt-nav-mobile-toggle"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle menu">
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      <div className={`gt-mobile-menu${mobileOpen ? ' open' : ''}`}>
        <a href="#hero" onClick={handleNavClick} className={activeSection === 'hero' ? 'active' : ''}>
          // HERO
        </a>
        {navLinks.map(([t, h], i) => {
          const isActive = activeSection === linkSectionId(h) ||
            (linkSectionId(h) === 'about' && activeSection === 'methodology');
          return (
            <a key={i} href={h} onClick={handleNavClick} className={isActive ? 'active' : ''}>
              // {t.toUpperCase()}
            </a>
          );
        })}
      </div>
    </>
  );
}

// ── Hero ─────────────────────────────────────────────────────────
function Hero() {
  const { palette, headline } = useTheme();
  // Re-render when live prices arrive
  const [, setTick] = pgUseState(0);
  pgUseEffect(() => {
    const handler = () => setTick(v => v + 1);
    window.addEventListener('live-tick', handler);
    return () => window.removeEventListener('live-tick', handler);
  }, []);
  return (
    <section id="hero" data-screen-label="Hero"
      style={{ position: 'relative', minHeight: '100vh', paddingTop: 90, overflow: 'hidden' }}>
      <div className="gt-hero-grid" style={{
        maxWidth: 1400, margin: '0 auto', padding: '0 32px',
        display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: 40,
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column' }}>
          <Reveal style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 30 }}>
            <span style={{
              fontFamily: GT.fontMono, fontSize: 11, color: palette.a, letterSpacing: 2,
              padding: '5px 12px', border: `1px solid ${palette.a}`, borderRadius: 100,
            }}>SEMICONDUCTOR ANALYST</span>
            <span style={{ flex: 1, height: 1, background: palette.edge }} />
            <span style={{ fontFamily: GT.fontMono, fontSize: 10, color: 'rgba(148,163,184,.85)', letterSpacing: 1 }}>
              VOL.XII · WK 21 · 2026
            </span>
          </Reveal>

          <Reveal delay={150} as="h1" className="gt-hero-h1" style={{
            margin: 0, fontFamily: headline, fontWeight: 400,
            fontSize: 'clamp(120px, 18vw, 220px)', lineHeight: 0.85, letterSpacing: -8,
            color: GT.text,
          }}>Ridwan<span style={{ color: palette.b }}>.</span></Reveal>

          <Reveal delay={350} className="gt-hero-sub" style={{
            marginTop: 22, fontFamily: headline, fontSize: 30, fontWeight: 400,
            lineHeight: 1.25, letterSpacing: -0.6, maxWidth: 760, color: GT.text,
          }}>
            The long memo on{' '}
            <span style={{ color: GT.green }}>NVIDIA</span>,{' '}
            <span style={{ color: GT.red }}>AMD</span>,{' '}
            <span style={{ color: palette.b }}>Micron</span>, and{' '}
            <span style={{ color: GT.amber }}>Taiwan Semi</span> — fundamentals,
            technicals, moat, and three-scenario price paths, published weekly.
          </Reveal>

          {/* monospaced spec strip */}
          <Reveal delay={500} className="gt-stagger" style={{
            marginTop: 32, fontFamily: GT.fontMono, fontSize: 11, color: 'rgba(148,163,184,.85)',
            display: 'flex', flexWrap: 'wrap', gap: 14, letterSpacing: 0.5,
          }}>
            {['FUNDAMENTAL', 'TECHNICAL', 'COMPETITIVE MOAT', 'SCENARIO'].map((x, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ color: GT.text, letterSpacing: 1 }}>{x}</span>
                {i < 3 && <span style={{ color: 'rgba(148,163,184,.4)', marginLeft: 4 }}>—</span>}
              </span>
            ))}
          </Reveal>

          <Reveal delay={650} style={{ marginTop: 'auto', paddingTop: 36 }}>
            <div className="gt-stagger gt-hero-stats" style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              borderTop: `1px dashed ${palette.edge}`, paddingTop: 22,
            }}>
              {[
                ['4', 'Core tickers'],
                ['52', 'Weekly memos'],
                ['25+', 'Indicators'],
                ['67%', 'Hit rate · 24M'],
              ].map(([v, l], i) => (
                <div key={i} style={{ paddingLeft: i ? 22 : 0, borderLeft: i ? `1px solid ${palette.edge}` : 'none' }}>
                  <div className="gt-hero-stat-num" style={{
                    fontFamily: headline, fontSize: 64, fontWeight: 400, color: GT.text,
                    lineHeight: 1, letterSpacing: -2,
                  }}>
                    <NumberFlicker value={v} ms={700 + i * 100} scrambleChars="0123456789+%" />
                  </div>
                  <Kicker color="rgba(148,163,184,.85)" style={{ marginTop: 6 }}>{l}</Kicker>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href="#dashboard" style={{
                padding: '13px 26px', background: palette.a, color: '#fff',
                borderRadius: 100, fontFamily: GT.fontUI, fontSize: 13, fontWeight: 600,
                letterSpacing: 0.5, boxShadow: `0 0 30px ${palette.aSoft}`,
                textDecoration: 'none',
              }}>Open dashboard →</a>
              <a href="#contact" style={{
                padding: '13px 26px', background: 'transparent', color: GT.text,
                border: `1px solid ${palette.edge}`, borderRadius: 100,
                fontFamily: GT.fontUI, fontSize: 13, fontWeight: 500, letterSpacing: 0.5,
                textDecoration: 'none',
              }}>Subscribe</a>
            </div>
          </Reveal>
        </div>

        {/* right side ticker stack */}
        <Reveal delay={250} className="gt-hero-right" style={{ padding: '40px 0 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Panel kicker="Live coverage · today's tape" right="● LIVE" accent={palette.a} p={0}>
            {ORDER.map((s, i) => {
              const t = TICKERS[s];
              const up = t.chg >= 0;
              const c = up ? GT.green : GT.red;
              return (
                <a key={s} href="#dashboard" style={{
                  padding: '20px 22px',
                  borderBottom: i < ORDER.length - 1 ? `1px dashed ${palette.edge}` : 'none',
                  display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                  transition: 'background .15s', textDecoration: 'none',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = palette.aSoft}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontFamily: headline, fontSize: 28, color: GT.text, letterSpacing: -1, lineHeight: 1 }}>
                        {t.sym}
                      </span>
                      <span style={{ fontFamily: GT.fontMono, fontSize: 10, color: 'rgba(148,163,184,.85)', letterSpacing: 0.8 }}>
                        {window.fmtMcap ? window.fmtMcap(t.mcap) : t.mcap}
                      </span>
                    </div>
                    <div style={{
                      fontFamily: GT.fontMono, fontSize: 11, color: 'rgba(148,163,184,.85)', marginTop: 2,
                    }}>{t.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: GT.fontMono, fontSize: 18, fontWeight: 700, color: GT.text }}>
                      {t.px.toFixed(2)}
                    </div>
                    <div className={up ? 'gt-price-pct-up' : 'gt-price-pct-dn'} style={{ fontFamily: GT.fontMono, fontSize: 12, marginTop: 2 }}>
                      {up ? '▲' : '▼'} {up ? '+' : ''}{t.chgPct.toFixed(2)}%
                    </div>
                  </div>
                  <Spark data={SPARKS[s]} w={70} h={36} color={c} />
                </a>
              );
            })}
          </Panel>

          <Panel kicker="Macro regime" title="" accent={palette.b}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                ['Risk-On', GT.green], ['AI Capex ↑', GT.green], ['DRAM Cycle ↑', GT.green],
                ['HBM Tight', GT.green], ['China Risk', GT.amber], ['VIX 14.8', GT.green],
              ].map(([t, c], i) => (
                <span key={i} style={{
                  fontFamily: GT.fontMono, fontSize: 10, padding: '5px 9px',
                  border: `1px solid ${c}`, color: c, letterSpacing: 0.5, borderRadius: 100,
                }}>{t}</span>
              ))}
            </div>
          </Panel>

          <Panel kicker="This week's note" title="" accent="#f472b6">
            <Kicker color="rgba(148,163,184,.85)">2026-05-19 · NVDA</Kicker>
            <div style={{ fontFamily: headline, fontSize: 18, color: GT.text, marginTop: 6, lineHeight: 1.35, letterSpacing: -0.2 }}>
              Blackwell ramp clean. Why I'm holding through CSP digestion noise.
            </div>
          </Panel>
        </Reveal>
      </div>
    </section>
  );
}

// ── About ────────────────────────────────────────────────────────
function About() {
  const { palette, headline } = useTheme();
  return (
    <section id="about" data-screen-label="About"
      className="gt-section-pad"
      style={{ position: 'relative', padding: '100px 0' }}>
      <div className="gt-section-inner" style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px' }}>
        <Reveal style={{ marginBottom: 30 }}>
          <Kicker>About</Kicker>
          <h2 style={{
            margin: '6px 0 0', fontFamily: headline, fontSize: 56, fontWeight: 400,
            lineHeight: 1, letterSpacing: -2, color: GT.text,
          }}>Who is Ridwan<span style={{ color: palette.b }}>?</span></h2>
        </Reveal>

        <div className="gt-about-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 28 }}>
          <Reveal delay={100}>
            <Panel kicker="Profile" title="" accent={palette.a}>
              <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start' }}>
                {/* monogram badge */}
                <div style={{
                  flex: '0 0 96px', height: 96, border: `1px solid ${palette.a}`,
                  background: palette.aSoft, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: headline, fontSize: 56, color: palette.a, letterSpacing: -2,
                }}>R</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: headline, fontSize: 26, color: GT.text, letterSpacing: -0.5 }}>
                    Semiconductor deep-dive analyst.
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(148,163,184,.9)', marginTop: 12, lineHeight: 1.65 }}>
                    I cover four names —{' '}
                    <span style={{ color: GT.green, fontWeight: 600 }}>NVDA</span>,{' '}
                    <span style={{ color: GT.red, fontWeight: 600 }}>AMD</span>,{' '}
                    <span style={{ color: palette.b, fontWeight: 600 }}>MU</span>, and{' '}
                    <span style={{ color: GT.amber, fontWeight: 600 }}>TSM</span>{' '}
                    — and I publish a long memo every Sunday. The format is the same each week:
                    business model, Q-over-Q financial deltas, technical levels worth watching,
                    and a three-scenario 12-month price path with explicit probabilities.
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(148,163,184,.9)', marginTop: 12, lineHeight: 1.65 }}>
                    I write what I'd want to read before sizing a position.
                    No noise. No hype.{' '}
                    <span style={{ color: GT.text, fontStyle: 'italic', fontFamily: headline }}>
                      Just the math and the moat.
                    </span>
                  </div>
                  {/* Coverage badges */}
                  <div style={{ marginTop: 14, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {[['NVDA', GT.green], ['AMD', GT.red], ['MU', palette.b], ['TSM', GT.amber]].map(([sym, c]) => (
                      <span key={sym} style={{
                        fontFamily: GT.fontMono, fontSize: 10, padding: '4px 10px',
                        border: `1px solid ${c}`, color: c, borderRadius: 100, letterSpacing: 1,
                      }}>{sym}</span>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={220}>
            <Panel kicker="At a glance" title="" accent={palette.b}>
              <div className="gt-stagger gt-glance-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                {[
                  ['Based',        'Jakarta · Indonesia'],
                  ['Cadence',      'Weekly · Sun 22:00 GMT+7'],
                  ['Format',       'Long memo + dashboard'],
                  ['Subscribers',  '1,847 readers'],
                  ['Hit rate',     '67% · 24M horizon'],
                  ['Backtest',     '6 years rolling'],
                ].map(([l, v], i) => (
                  <div key={i} style={{
                    padding: '14px 16px',
                    borderRight: i % 2 === 0 ? `1px dashed ${palette.edge}` : 'none',
                    borderBottom: i < 4 ? `1px dashed ${palette.edge}` : 'none',
                  }}>
                    <Kicker color="rgba(148,163,184,.8)">{l}</Kicker>
                    <div style={{ fontFamily: headline, fontSize: 22, color: GT.text, marginTop: 4, letterSpacing: -0.5 }}>{v}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </Reveal>
        </div>

        {/* Methodology */}
        <Reveal delay={120} as="div" style={{ marginTop: 28 }}>
          <div id="methodology">
            <Panel kicker="Methodology" title="How a single memo is built" accent="#f472b6">
              <div className="gt-stagger gt-method-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
                {[
                  ['01', 'BUSINESS',   'Segment mix, end-market share, customer concentration. Always start with what the company actually sells.'],
                  ['02', 'FINANCIALS', 'YoY + sequential deltas on revenue, GM, opex, FCF. Quality of earnings — accruals vs cash. Capital allocation.'],
                  ['03', 'TECHNICAL',  '25+ indicators across momentum, trend, volatility, volume. Then ignore most of them; only 4–5 actually shape the entry.'],
                  ['04', 'SCENARIO',   'Three paths, probabilities sum to 100. Drivers stated explicitly. The exercise is not prediction — it is decision-making under uncertainty.'],
                ].map(([n, h, body], i) => (
                  <div key={i} className="gt-method-item" style={{
                    padding: '22px 22px 24px',
                    borderRight: i < 3 ? `1px dashed ${palette.edge}` : 'none',
                  }}>
                    <div style={{
                      fontFamily: GT.fontMono, fontSize: 24, color: palette.a, fontWeight: 700,
                      letterSpacing: 2,
                    }}>{n}</div>
                    <div style={{ fontFamily: headline, fontSize: 22, color: GT.text, marginTop: 8, letterSpacing: -0.4 }}>{h}</div>
                    <div style={{ fontSize: 13, color: 'rgba(148,163,184,.85)', marginTop: 8, lineHeight: 1.6 }}>{body}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Past Memos Archive ────────────────────────────────────────────
function PastMemosArchive({ palette, headline }) {
  const [expanded, setExpanded] = pgUseState(null);

  const memos = [
    {
      date: '2026-05-12',
      ticker: 'TSM',
      accentColor: GT.amber,
      title: 'CoWoS capacity tightens into H2 — what it means for AI silicon pricing',
      tags: ['SUPPLY CHAIN', 'AI PACKAGING', 'PRICING POWER'],
      excerpt: 'Advanced packaging is the new chokepoint. CoWoS utilisation hit ~98% in April; TSMC guided for only ~15% capacity expansion through year-end. For NVDA and AMD, this is a quiet margin lever nobody is pricing correctly.',
      bull: '$218 (prob 45%)',
      base: '$196 (prob 40%)',
      bear: '$161 (prob 15%)',
    },
    {
      date: '2026-05-05',
      ticker: 'MU',
      accentColor: palette.b,
      title: 'HBM3E yield inflection — Micron closes the gap faster than the market expects',
      tags: ['HBM', 'YIELD', 'COMPETITIVE MOAT'],
      excerpt: 'MU HBM3E yields are tracking ahead of internal plan. The gross margin profile for 2H26 is being underestimated by ~350bps consensus. The bear case rests on a DRAM spot correction that I think is structurally delayed by AI demand.',
      bull: '$1,240 (prob 38%)',
      base: '$1,020 (prob 44%)',
      bear: '$760 (prob 18%)',
    },
    {
      date: '2026-04-28',
      ticker: 'AMD',
      accentColor: GT.red,
      title: 'MI350 pull-in signals real hyperscaler conviction — not just a hedge against NVDA',
      tags: ['AI ACCELERATOR', 'DATACENTER', 'COMPETITIVE'],
      excerpt: 'Two large hyperscalers moved MI350 orders forward by one quarter. The narrative that AMD GPU wins are purely hedge buys is breaking down. ROCm software gaps narrowed materially in the past two quarters — the moat is shrinking.',
      bull: '$198 (prob 38%)',
      base: '$162 (prob 44%)',
      bear: '$114 (prob 18%)',
    },
  ];

  return (
    <Reveal delay={80}>
      <Panel kicker="PAST MEMOS ARCHIVE" title="" accent="rgba(148,163,184,.4)" p={0}>
        <div style={{
          padding: '16px 22px 8px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: `1px dashed ${palette.edge}`,
        }}>
          <div style={{ fontFamily: GT.fontMono, fontSize: 11, color: 'rgba(148,163,184,.7)', letterSpacing: 1 }}>
            ARCHIVE · 3 MOST RECENT ISSUES
          </div>
          <div style={{ fontFamily: GT.fontMono, fontSize: 10, color: palette.a, letterSpacing: 0.8 }}>
            52 total →
          </div>
        </div>

        <div className="gt-archive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
          {memos.map((m, i) => {
            const isOpen = expanded === i;
            return (
              <div key={i}
                style={{
                  padding: '20px 22px 22px',
                  borderRight: i < 2 ? `1px dashed ${palette.edge}` : 'none',
                  cursor: 'pointer', transition: 'background .15s',
                  background: isOpen ? 'rgba(255,255,255,.03)' : 'transparent',
                }}
                onClick={() => setExpanded(isOpen ? null : i)}
                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(255,255,255,.02)'; }}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* date + ticker */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontFamily: GT.fontMono, fontSize: 10, color: 'rgba(148,163,184,.7)', letterSpacing: 0.8 }}>
                    {m.date}
                  </span>
                  <span style={{
                    fontFamily: GT.fontMono, fontSize: 10, padding: '3px 8px',
                    border: `1px solid ${m.accentColor}`, color: m.accentColor,
                    borderRadius: 100, letterSpacing: 1,
                  }}>{m.ticker}</span>
                </div>

                {/* title */}
                <div style={{ fontFamily: headline, fontSize: 15, color: GT.text, lineHeight: 1.35, letterSpacing: -0.2 }}>
                  {m.title}
                </div>

                {/* tags */}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
                  {m.tags.map((tag, j) => (
                    <span key={j} style={{
                      fontFamily: GT.fontMono, fontSize: 9, padding: '3px 7px',
                      background: 'rgba(255,255,255,.04)', color: 'rgba(148,163,184,.7)',
                      borderRadius: 4, letterSpacing: 0.5,
                    }}>{tag}</span>
                  ))}
                </div>

                {/* expandable excerpt + scenarios */}
                <div style={{
                  overflow: 'hidden', maxHeight: isOpen ? 300 : 0,
                  transition: 'max-height .3s ease', marginTop: isOpen ? 14 : 0,
                }}>
                  <div style={{ fontSize: 13, color: 'rgba(148,163,184,.85)', lineHeight: 1.6, paddingTop: 2 }}>
                    {m.excerpt}
                  </div>
                  <div style={{
                    marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 6, borderTop: `1px dashed ${palette.edge}`, paddingTop: 12,
                  }}>
                    {[['BULL', m.bull, GT.green], ['BASE', m.base, palette.b], ['BEAR', m.bear, GT.red]].map(([sc, val, c]) => (
                      <div key={sc}>
                        <div style={{ fontFamily: GT.fontMono, fontSize: 9, color: c, letterSpacing: 1 }}>{sc}</div>
                        <div style={{ fontFamily: GT.fontMono, fontSize: 11, color: GT.text, marginTop: 2 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* expand caret */}
                <div style={{
                  marginTop: 12, fontFamily: GT.fontMono, fontSize: 10,
                  color: m.accentColor, letterSpacing: 0.8,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {isOpen ? '▲ COLLAPSE' : '▼ READ EXCERPT'}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </Reveal>
  );
}

// ── Contact ──────────────────────────────────────────────────────
function Contact() {
  const { palette, headline } = useTheme();
  return (
    <section id="contact" data-screen-label="Contact"
      className="gt-section-pad"
      style={{ position: 'relative', padding: '100px 0 60px' }}>
      <div className="gt-section-inner" style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px' }}>
        <Reveal style={{ marginBottom: 30 }}>
          <Kicker>Get in touch</Kicker>
          <h2 style={{
            margin: '6px 0 0', fontFamily: headline, fontSize: 56, fontWeight: 400,
            lineHeight: 1, letterSpacing: -2, color: GT.text,
          }}>Contact<span style={{ color: palette.b }}>.</span></h2>
        </Reveal>

        <div className="gt-contact-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 28 }}>
          <Reveal delay={100}>
            <Panel kicker="Channels" title="" accent={palette.a}>
              {[
                ['Email',    'ridwan.finance@email.com',  'Best for collaboration & long-form questions.'],
                ['Location', 'Jakarta · Indonesia',        'GMT+7 — replies usually within 12 hours.'],
                ['Focus',    'NVDA · AMD · MU · TSM',      'Four names, done well. No other coverage.'],
                ['Note',     'Not financial advice',       'For information only. Do your own work.'],
              ].map(([l, v, sub], i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '110px 1fr', gap: 18,
                  padding: '14px 0', alignItems: 'flex-start',
                  borderBottom: i < 3 ? `1px dashed ${palette.edge}` : 'none',
                }}>
                  <Kicker color="rgba(148,163,184,.8)">{l}</Kicker>
                  <div>
                    <div style={{ fontFamily: headline, fontSize: 22, color: GT.text, letterSpacing: -0.4 }}>{v}</div>
                    <div style={{ fontSize: 12, color: 'rgba(148,163,184,.8)', marginTop: 4 }}>{sub}</div>
                  </div>
                </div>
              ))}
            </Panel>
          </Reveal>

          <Reveal delay={220}>
            <Panel kicker="Subscribe to the weekly memo" title="" accent={palette.b}>
              <div style={{ fontFamily: headline, fontSize: 26, color: GT.text, letterSpacing: -0.4, lineHeight: 1.3 }}>
                One memo, every Sunday.{' '}
                <span style={{ color: GT.green }}>NVDA</span> ·{' '}
                <span style={{ color: GT.red }}>AMD</span> ·{' '}
                <span style={{ color: palette.b }}>MU</span> ·{' '}
                <span style={{ color: GT.amber }}>TSM</span>.
              </div>
              <div style={{ fontSize: 13, color: 'rgba(148,163,184,.85)', marginTop: 8, lineHeight: 1.6 }}>
                Drops at 22:00 GMT+7. Free. Unsubscribe in one click. No spam, no upsells —
                just the long memo and the dashboard refresh.
              </div>
              <div className="gt-sub-input-row" style={{
                marginTop: 20, display: 'flex', gap: 10,
                border: `1px solid ${palette.edge}`, padding: 6, borderRadius: 100,
                background: 'rgba(255,255,255,.02)',
              }}>
                <input placeholder="you@email.com" style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: GT.text, fontFamily: GT.fontUI, fontSize: 14, padding: '8px 14px',
                }} />
                <button style={{
                  padding: '10px 22px', background: palette.a, color: '#fff', border: 'none',
                  borderRadius: 100, fontFamily: GT.fontUI, fontSize: 13, fontWeight: 600,
                  letterSpacing: 0.4, cursor: 'pointer',
                }}>Subscribe →</button>
              </div>
              <div style={{
                marginTop: 18, fontFamily: GT.fontMono, fontSize: 10, color: 'rgba(148,163,184,.75)',
                letterSpacing: 0.8,
              }}>
                1,847 readers · 52 issues · 6 years running
              </div>
            </Panel>
          </Reveal>
        </div>

        {/* Past Memos Archive */}
        <div style={{ marginTop: 28 }}>
          <PastMemosArchive palette={palette} headline={headline} />
        </div>

        {/* Footer line */}
        <Reveal delay={100}>
          <div className="gt-footer-row" style={{
            marginTop: 60, paddingTop: 26, borderTop: `1px solid ${palette.edge}`,
            display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
            fontFamily: GT.fontMono, fontSize: 11, color: 'rgba(148,163,184,.7)', letterSpacing: 0.8,
          }}>
            <span>© RIDWAN FINANCE · 2026 · ALL RIGHTS RESERVED</span>
            <span>FOR INFORMATIONAL PURPOSES ONLY · NOT INVESTMENT ADVICE</span>
            <span style={{ color: palette.a }}>BUILT WITH CARE IN JAKARTA</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

Object.assign(window, { Nav, Hero, About, Contact });
