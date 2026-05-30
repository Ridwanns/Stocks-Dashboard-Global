// ════════════════════════════════════════════════════════════════════
// App entry — wires Theme context, Tweaks panel, and the page sections.
// Tweak values persist via the host (see EDITMODE-BEGIN block); the
// palette is stored as its swatch-array so TweakColor can hi-light it.
// ════════════════════════════════════════════════════════════════════

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": ["#8b5cf6","#22d3ee"],
  "headlineFont": "Serif (Instrument)",
  "density": "Default",
  "aurora": true
}/*EDITMODE-END*/;

// ── Cinematic 3D landing screen ───────────────────────────────────
// The rotating spiral galaxy is the hero: it idles and spins while live
// data syncs in the background. The user presses "Enter" (or clicks
// anywhere) to dolly the camera through the core, then hand off to the
// dashboard — whose section reveal animations play fresh on mount.
function LoadingScreen({ onEnter }) {
  const canvasRef = React.useRef(null);
  const ctrlRef = React.useRef(null);
  const [phase, setPhase] = React.useState('idle');   // idle → zoom
  const [ready, setReady] = React.useState(false);     // live data synced
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  React.useEffect(() => {
    const canvas = canvasRef.current;
    let cleanupReady = null;
    const begin = () => {
      if (!window.startLoadingGalaxy || !canvas) return false;
      ctrlRef.current = window.startLoadingGalaxy(canvas, { accentA: '#8b5cf6', accentB: '#22d3ee' });
      return true;
    };
    if (!begin()) {
      const onReady = () => begin();
      window.addEventListener('__galaxyReady', onReady);
      cleanupReady = () => window.removeEventListener('__galaxyReady', onReady);
    }

    // Background data sync — only flips the status label; never auto-advances.
    const markReady = () => setReady(true);
    window.addEventListener('live-tick', markReady);
    if (window.LIVE && window.LIVE.feedStatus === 'LIVE') setReady(true);
    const readyFallback = setTimeout(markReady, 4000);

    return () => {
      cleanupReady && cleanupReady();
      window.removeEventListener('live-tick', markReady);
      clearTimeout(readyFallback);
      const c = ctrlRef.current;
      if (c) try { c.stop(); } catch (e) {}
    };
  }, []);

  const enteringRef = React.useRef(false);
  const enter = React.useCallback(() => {
    if (enteringRef.current) return;
    enteringRef.current = true;
    setPhase('zoom');
    const c = ctrlRef.current;
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      try { c && c.stop(); } catch (e) {}
      onEnter && onEnter();
    };
    if (c && c.zoomIn && !reduced) {
      c.zoomIn(1700, finish);
      // Safety net: guarantee the handoff fires even if requestAnimationFrame
      // is throttled (e.g. the tab loses focus mid-zoom).
      setTimeout(finish, 2100);
    } else {
      setTimeout(finish, 260);
    }
  }, [reduced, onEnter]);

  return (
    <div className="gt-loader" data-phase={phase} onClick={enter} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); } }}>
      <canvas ref={canvasRef} />
      <div className="gt-loader-ui">
        <div className="gt-loader-kicker">// RIDWAN · CHIP DESK</div>
        <div className="gt-loader-title">AI chip stocks<span style={{ color: '#22d3ee' }}>.</span></div>
        <div className="gt-loader-enter-wrap">
          <button className="gt-loader-enter" onClick={(e) => { e.stopPropagation(); enter(); }}>
            Enter terminal <span className="gt-loader-arrow">→</span>
          </button>
          <div className="gt-loader-sub">
            {ready ? '● live market data ready — click anywhere to launch'
                   : '◌ syncing live market data…'}
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [booting, setBooting] = React.useState(true);

  // Lock body scroll while the loader is on screen.
  React.useEffect(() => {
    document.body.style.overflow = booting ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [booting]);

  const theme = React.useMemo(() => ({
    palette: lookupPalette(t.palette),
    headline: HEADLINE_FONTS[t.headlineFont] || HEADLINE_FONTS['Serif (Instrument)'],
    density: DENSITIES[t.density] || DENSITIES.Default,
    auroraOn: !!t.aurora,
  }), [t.palette, t.headlineFont, t.density, t.aurora]);

  // Open the Tweaks panel via the in-page "◇ TWEAKS" nav button by faking
  // the host's activate message (the panel only listens for that channel).
  const openTweaks = React.useCallback(() => {
    window.postMessage({ type: '__activate_edit_mode' }, '*');
  }, []);

  return (
    <ThemeCtx.Provider value={theme}>
      <GTAnimStyle />
      <Aurora />
      {booting && <LoadingScreen onEnter={() => setBooting(false)} />}
      {/* Gate the whole app behind the landing screen so the section reveal
          animations play FRESH the moment the user enters — not silently
          behind the galaxy. */}
      {!booting && (
      <div className="gt-app-enter">
      <Nav onTweaks={openTweaks} />
      <Hero />
      <Dashboard />
      <About />
      <Contact />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Accent palette">
          <TweakColor
            label="Palette"
            value={t.palette}
            onChange={(v) => setTweak('palette', v)}
            options={PALETTES.map(p => p.id)}
          />
        </TweakSection>

        <TweakSection label="Typography">
          <TweakSelect
            label="Headline font"
            value={t.headlineFont}
            onChange={(v) => setTweak('headlineFont', v)}
            options={Object.keys(HEADLINE_FONTS)}
          />
        </TweakSection>

        <TweakSection label="Layout">
          <TweakRadio
            label="Density"
            value={t.density}
            onChange={(v) => setTweak('density', v)}
            options={Object.keys(DENSITIES)}
          />
          <TweakToggle
            label="Aurora background"
            value={t.aurora}
            onChange={(v) => setTweak('aurora', v)}
          />
        </TweakSection>
      </TweaksPanel>
      </div>
      )}
    </ThemeCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
