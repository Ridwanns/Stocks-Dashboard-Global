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

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

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
