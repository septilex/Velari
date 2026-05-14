import { useState, useRef, useEffect, useCallback } from 'react';
import { VelariEngine } from './engine/VelariEngine';
import { VelariAudio } from './engine/VelariAudio';
import { ATMOSPHERES, DEFAULT_ATMOSPHERE } from './config/atmospheres';
import type { Atmosphere } from './config/atmospheres';
import { GalaxyBackground, GALAXY_THEMES } from './components/GalaxyBackground';

/* ===== SVG Icons (inline for zero-dep) ===== */
const Icons = {
  gravity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 5v-2M12 21v-2M5 12H3M21 12h-2" />
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
    </svg>
  ),
  drift: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round"/>
      <path d="M12 6l2 2-2 2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="18" cy="6" r="2" fill="currentColor" opacity="0.5"/>
    </svg>
  ),
  gyro: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <ellipse cx="12" cy="12" rx="4" ry="10" />
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </svg>
  ),
  dna: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 3c0 4 8 4 8 8s-8 4-8 8" strokeLinecap="round"/>
      <path d="M16 3c0 4-8 4-8 8s8 4 8 8" strokeLinecap="round"/>
      <path d="M8 7h8M8 17h8" strokeLinecap="round"/>
    </svg>
  ),
  clear: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    </svg>
  ),
  logo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  ),
  copy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 4v12m0 0l-3.5-3.5M12 16l3.5-3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 19h14" strokeLinecap="round"/>
    </svg>
  ),
};

const SYMMETRY_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12];

// Detect if device likely has a gyroscope
const HAS_GYRO = typeof DeviceOrientationEvent !== 'undefined' &&
  /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VelariEngine | null>(null);
  const audioRef  = useRef<VelariAudio>(new VelariAudio());

  const [showLanding, setShowLanding]   = useState(true);
  const [landingExit, setLandingExit]   = useState(false);
  const [atmosphere, setAtmosphere]     = useState<Atmosphere>(DEFAULT_ATMOSPHERE);
  const [symmetry, setSymmetry]         = useState(6);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isDrawing, setIsDrawing]       = useState(false);
  const [gravityMode, setGravityMode]   = useState(false);
  const [driftEnabled, setDriftEnabled] = useState(false);
  const [gyroEnabled, setGyroEnabled]   = useState(false);
  const [flowState, setFlowState]       = useState('Calm Flow');
  const [fps, setFps]                   = useState(60);
  const [particleCount, setParticleCount] = useState(0);
  const [dna, setDna]                   = useState('--');
  const [dnaCopied, setDnaCopied]       = useState(false);
  const [transparentBg, setTransparentBg] = useState(false);
  const [exportCopied, setExportCopied]   = useState(false);
  const [isExporting, setIsExporting]     = useState(false);
  const [landingTheme]                    = useState(() => {
    const themes = ['purple', 'green', 'red', 'gold', 'orange'];
    return themes[Math.floor(Math.random() * themes.length)];
  });

  /* ===== Initialize Engine ===== */
  useEffect(() => {
    if (!canvasRef.current || showLanding) return;

    const engine = new VelariEngine(canvasRef.current, atmosphere);
    engine.setSymmetry(symmetry);
    engine.onFlowStateChange = setFlowState;
    engine.onFpsUpdate = (f) => {
      setFps(f);
      setParticleCount(engine.getParticleCount());
    };
    engineRef.current = engine;

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      engine.destroy();
      window.removeEventListener('resize', handleResize);
    };
  }, [showLanding]);

  /* ===== Sync settings ===== */
  useEffect(() => { engineRef.current?.setAtmosphere(atmosphere); }, [atmosphere]);
  useEffect(() => { engineRef.current?.setSymmetry(symmetry); },    [symmetry]);
  useEffect(() => { engineRef.current?.setDrift(driftEnabled); },   [driftEnabled]);
  useEffect(() => {
    if (!engineRef.current) return;
    if (gyroEnabled) engineRef.current.enableGyroscope();
    else             engineRef.current.disableGyroscope();
  }, [gyroEnabled]);

  /* ===== Pointer Handlers ===== */
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!engineRef.current) return;
    const x = e.clientX, y = e.clientY, pressure = e.pressure || 0.5;

    if (gravityMode) {
      engineRef.current.addGravityWell(x, y);
      return;
    }

    engineRef.current.startStroke(x, y, pressure);
    setIsDrawing(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [gravityMode]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!engineRef.current || !isDrawing) return;
    const x = e.clientX, y = e.clientY, pressure = e.pressure || 0.5;
    engineRef.current.moveStroke(x, y, pressure);
    audioRef.current.onStroke(0.5, x, y, window.innerWidth, window.innerHeight);
  }, [isDrawing]);

  const onPointerUp = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.endStroke();
    audioRef.current.playBloom();
    setIsDrawing(false);
    // Refresh DNA after each stroke
    setDna(engineRef.current.generateDNA());
  }, []);

  /* ===== Actions ===== */
  const handleEnter = () => {
    setLandingExit(true);
    setTimeout(() => setShowLanding(false), 900);
  };

  const toggleSound = async () => {
    const enabled = await audioRef.current.toggle();
    setSoundEnabled(enabled);
  };

  const copyDNA = () => {
    const code = `VELARI DNA: ${dna}`;
    navigator.clipboard.writeText(code).then(() => {
      setDnaCopied(true);
      setTimeout(() => setDnaCopied(false), 1800);
    });
  };

  const saveDrawing = async () => {
    if (!engineRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const blob = await engineRef.current.exportCanvas(transparentBg);
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `velari-drawing-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Save drawing failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = async () => {
    if (!engineRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const blob = await engineRef.current.exportCanvas(transparentBg);
      if (!blob) throw new Error('Failed to export canvas');

      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      alert('Copy to clipboard failed or is not supported by your browser.');
    } finally {
      setIsExporting(false);
    }
  };

  /* ===== Landing ===== */
  if (showLanding) {
    const themeConfig = GALAXY_THEMES[landingTheme] || GALAXY_THEMES.purple;
    return (
      <div
        className={`velari-landing ${landingExit ? 'exiting' : ''}`}
        style={{ background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
      >
        <GalaxyBackground themeName={landingTheme} />

        <div className="velari-logo" style={{ position: 'relative', top: 'auto', left: 'auto', marginBottom: 56 }}>
          <div
            className="velari-logo__icon"
            style={{ background: `linear-gradient(135deg, ${themeConfig.coreColor}, ${themeConfig.glowColor})` }}
          >
            {Icons.logo}
          </div>
          <span className="velari-logo__text">VELARI</span>
        </div>

        <h1 className="landing-tagline" style={{ backgroundImage: themeConfig.gradientText }}>
          Draw the impossible.
        </h1>

        <p style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: '15px',
          fontWeight: 300,
          marginBottom: 44,
          letterSpacing: '0.5px',
          fontFamily: 'var(--font-body)',
        }}>
          A living generative art universe
        </p>

        <button className="landing-cta" onClick={handleEnter} id="begin-creating-btn">
          BEGIN CREATING
        </button>
      </div>
    );
  }

  /* ===== Main Experience ===== */
  return (
    <>
      <div className="velari-canvas-layer">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{ touchAction: 'none' }}
        />
      </div>

      <div className={`velari-ui ${isDrawing ? 'drawing' : ''}`}>
        {/* Logo */}
        <div className="velari-logo">
          <div className="velari-logo__icon">{Icons.logo}</div>
          <span className="velari-logo__text">VELARI</span>
        </div>

        {/* Symmetry Controls */}
        <div className="symmetry-controls glass-panel">
          {SYMMETRY_OPTIONS.map((n) => (
            <button
              key={n}
              className={`sym-btn ${symmetry === n ? 'active' : ''}`}
              onClick={() => setSymmetry(n)}
              id={`symmetry-${n}-btn`}
            >
              {n}×
            </button>
          ))}
        </div>

        {/* Sound Toggle */}
        <div className="sound-toggle glass-panel" onClick={toggleSound} style={{ cursor: 'pointer' }} id="sound-toggle">
          <span className="sound-toggle__label">Sound</span>
          <div className={`sound-toggle__switch ${soundEnabled ? 'active' : ''}`} />
        </div>

        {/* Export Panel */}
        <div className="export-panel glass-panel" id="export-panel">
          <button
            className="export-btn"
            onClick={saveDrawing}
            id="save-drawing-btn"
            title="Save Drawing as PNG"
          >
            {Icons.download}
            <span className="desktop-only">Save Drawing</span>
            <span className="mobile-only">Save</span>
          </button>

          <button
            className={`export-btn ${exportCopied ? 'copied' : ''}`}
            onClick={copyToClipboard}
            id="copy-clipboard-btn"
            title="Copy to Clipboard"
          >
            {exportCopied ? '✓' : Icons.copy}
            <span className="desktop-only">{exportCopied ? 'Copied' : 'Copy to Clipboard'}</span>
            <span className="mobile-only">{exportCopied ? 'Copied' : 'Copy'}</span>
          </button>

          <div
            className="export-toggle"
            onClick={() => setTransparentBg(!transparentBg)}
            title="Preserve transparent background"
          >
            <span className="export-toggle__label desktop-only">Transparent</span>
            <span className="export-toggle__label mobile-only">Tr</span>
            <div className={`export-toggle__switch ${transparentBg ? 'active' : ''}`} />
          </div>
        </div>

        {/* Right Toolbar */}
        <div className="velari-toolbar glass-panel">
          {/* Gravity Wells */}
          <button
            className={`toolbar-btn ${gravityMode ? 'active' : ''}`}
            onClick={() => setGravityMode(!gravityMode)}
            id="gravity-btn"
          >
            {Icons.gravity}
            <span className="toolbar-btn__tooltip">Gravity Wells</span>
          </button>

          {/* Infinite Drift */}
          <button
            className={`toolbar-btn ${driftEnabled ? 'active' : ''}`}
            onClick={() => setDriftEnabled(!driftEnabled)}
            id="drift-btn"
            title="Infinite Mirror Drift"
          >
            {Icons.drift}
            <span className="toolbar-btn__tooltip">Mirror Drift</span>
          </button>

          {/* Gyroscope — only shown on mobile */}
          {HAS_GYRO && (
            <button
              className={`toolbar-btn ${gyroEnabled ? 'active' : ''}`}
              onClick={() => setGyroEnabled(!gyroEnabled)}
              id="gyro-btn"
            >
              {Icons.gyro}
              <span className="toolbar-btn__tooltip">Gyroscope</span>
            </button>
          )}

          {/* Clear */}
          <button className="toolbar-btn" onClick={() => engineRef.current?.clearCanvas()} id="clear-btn">
            {Icons.clear}
            <span className="toolbar-btn__tooltip">Clear Canvas</span>
          </button>
        </div>

        {/* Atmosphere Selector */}
        <div className="atmosphere-ring glass-panel">
          {ATMOSPHERES.map((atmo) => (
            <button
              key={atmo.id}
              className={`atmo-btn ${atmosphere.id === atmo.id ? 'active' : ''}`}
              onClick={() => setAtmosphere(atmo)}
              style={{
                background: `linear-gradient(135deg, ${atmo.colors[0]}50, ${atmo.colors[1]}50)`,
              }}
              id={`atmosphere-${atmo.id}-btn`}
            >
              {atmo.emoji}
              <span className="atmo-btn__label">{atmo.name}</span>
            </button>
          ))}
        </div>

        {/* DNA Fingerprint Panel */}
        <div className="dna-panel glass-panel" id="dna-panel">
          <div className="dna-panel__icon">{Icons.dna}</div>
          <div className="dna-panel__content">
            <span className="dna-panel__label">VELARI DNA</span>
            <span className="dna-panel__code">{dna}</span>
          </div>
          <button
            className={`dna-panel__copy ${dnaCopied ? 'copied' : ''}`}
            onClick={copyDNA}
            id="dna-copy-btn"
            title="Copy DNA code"
          >
            {dnaCopied ? '✓' : Icons.copy}
          </button>
        </div>

        {/* Flow State Meter */}
        <div className="flow-meter glass-panel">
          <span className="flow-meter__label">Flow State</span>
          <span className="flow-meter__state">{flowState}</span>
        </div>

        {/* Info Panel */}
        <div className="info-panel glass-panel">
          <span>{fps} FPS</span>
          <span>{particleCount} particles</span>
          {driftEnabled && <span className="info-badge drift-badge">⟳ Drift</span>}
          {gyroEnabled  && <span className="info-badge gyro-badge">⌀ Gyro</span>}
        </div>
      </div>
    </>
  );
}
