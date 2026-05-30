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

// ── Cinematic 3D loading screen ───────────────────────────────────
// Rotating spiral galaxy that holds until the live feed lands its first
// tick (or a max timeout), then dollies through the core and fades to
// reveal the dashboard already rendered behind it.
function LoadingScreen({ onDone }) {
  const canvasRef = React.useRef(null);
  const ctrlRef = React.useRef(null);
  const [phase, setPhase] = React.useState('loading');
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

    const t0 = Date.now();
    const MIN_MS = reduced ? 350 : 2300;   // let the loop breathe
    const MAX_MS = reduced ? 1200 : 6500;  // never hang
    let finished = false;
    const finish = () => {
      if (finished) return; finished = true;
      const wait = Math.max(0, MIN_MS - (Date.now() - t0));
      setTimeout(() => {
        setPhase('zoom');
        const c = ctrlRef.current;
        if (c && c.zoomIn && !reduced) {
          c.zoomIn(1700, () => { try { c.stop(); } catch (e) {} onDone && onDone(); });
        } else {
          if (c) try { c.stop(); } catch (e) {}
          onDone && onDone();
        }
      }, wait);
    };

    const onTick = () => finish();
    window.addEventListener('live-tick', onTick);
    const maxTimer = setTimeout(finish, MAX_MS);
    if (window.LIVE && window.LIVE.feedStatus === 'LIVE') finish();

    return () => {
      cleanupReady && cleanupReady();
      window.removeEventListener('live-tick', onTick);
      clearTimeout(maxTimer);
      const c = ctrlRef.current;
      if (c) try { c.stop(); } catch (e) {}
    };
  }, []);

  return (
    <div className="gt-loader" data-phase={phase}>
      <canvas ref={canvasRef} />
      <div className="gt-loader-ui">
        <div className="gt-loader-kicker">// RIDWAN · CHIP DESK</div>
        <div className="gt-loader-title">AI chip stocks<span style={{ color: '#22d3ee' }}>.</span></div>
        <div className="gt-loader-bar"><i /></div>
        <div className="gt-loader-sub">Initializing live terminal</div>
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
      {booting && <LoadingScreen onDone={() => setBooting(false)} />}
      <Aurora />
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
    </ThemeCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
