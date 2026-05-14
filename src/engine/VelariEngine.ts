import type { Atmosphere } from '../config/atmospheres';

/* ===== Types ===== */
interface Point { x: number; y: number; pressure: number; time: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; alpha: number; }
interface GravityWell { x: number; y: number; strength: number; life: number; }

/* ===== Engine ===== */
export class VelariEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private drawCanvas: HTMLCanvasElement;
  private drawCtx: CanvasRenderingContext2D;
  private glowCanvas: HTMLCanvasElement;
  private glowCtx: CanvasRenderingContext2D;

  private width = 0;
  private height = 0;
  private dpr = 1;

  private isDrawing = false;
  private points: Point[] = [];
  private particles: Particle[] = [];
  private gravityWells: GravityWell[] = [];
  private ambientParticles: Particle[] = [];

  private symmetryCount = 6;
  private atmosphere: Atmosphere;
  private animFrame = 0;
  private time = 0;
  private idleTime = 0;

  // Flow tracking
  private strokeSpeeds: number[] = [];
  private flowState = 'Calm Flow';

  // Callbacks
  onFlowStateChange?: (state: string) => void;
  onFpsUpdate?: (fps: number) => void;

  private fpsFrames = 0;
  private fpsTime = 0;
  private currentFps = 60;

  // Phase 1 — Infinite Mirror Drift
  private driftEnabled = false;
  private driftAngle = 0;          // accumulated rotation (radians)
  private readonly DRIFT_SPEED = 0.00018; // ~0.01 deg/frame — hypnotic, not aggressive

  // Phase 1 — Gyroscope
  private gyroEnabled = false;
  private gyroX = 0;               // target tilt x (−1…1)
  private gyroY = 0;               // target tilt y
  private smoothGyroX = 0;         // interpolated
  private smoothGyroY = 0;
  private readonly GYRO_LERP = 0.04;  // very smooth — no jitter
  private readonly GYRO_SENS = 0.3;   // low sensitivity
  private gyroHandler: ((e: DeviceOrientationEvent) => void) | null = null;

  // Phase 1 — DNA System
  private strokeCount = 0;
  private dnaSessionSeed = Math.floor(Math.random() * 0xFFFF);

  // Phase 2 — Void Mode
  private voidEnabled = false;
  private voidPulse = 0;       // animates the accretion disk rings
  private readonly VOID_PULL = 0.0018; // gentle singularity pull strength

  // Phase 2 — Dream Mode
  private dreamEnabled = false;
  // Crystalline nodes emitted along stroke paths
  private dreamNodes: { x: number; y: number; r: number; angle: number; life: number; maxLife: number; color: string; sides: number }[] = [];

  // Pre-generated stars
  private stars: { x: number; y: number; s: number; b: number; speed: number }[] = [];

  constructor(canvas: HTMLCanvasElement, atmosphere: Atmosphere) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.atmosphere = atmosphere;

    this.drawCanvas = document.createElement('canvas');
    this.drawCtx = this.drawCanvas.getContext('2d')!;

    this.glowCanvas = document.createElement('canvas');
    this.glowCtx = this.glowCanvas.getContext('2d')!;

    this.resize();
    this.initStars();
    this.initAmbientParticles();
    this.startLoop();
  }

  /* ===== Lifecycle ===== */
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    const prevDraw = this.drawCanvas.width > 0 ?
      this.drawCtx.getImageData(0, 0, this.drawCanvas.width, this.drawCanvas.height) : null;
    const prevGlow = this.glowCanvas.width > 0 ?
      this.glowCtx.getImageData(0, 0, this.glowCanvas.width, this.glowCanvas.height) : null;

    for (const c of [this.canvas, this.drawCanvas, this.glowCanvas]) {
      c.width = this.width * this.dpr;
      c.height = this.height * this.dpr;
      c.style.width = this.width + 'px';
      c.style.height = this.height + 'px';
    }

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.glowCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Restore drawings
    if (prevDraw) this.drawCtx.putImageData(prevDraw, 0, 0);
    if (prevGlow) this.glowCtx.putImageData(prevGlow, 0, 0);
  }

  destroy() {
    cancelAnimationFrame(this.animFrame);
    this.disableGyroscope();
  }
  setAtmosphere(atmo: Atmosphere) { this.atmosphere = atmo; }
  setSymmetry(count: number) { this.symmetryCount = count; }
  getFlowState() { return this.flowState; }
  getFps() { return this.currentFps; }
  getParticleCount() { return this.particles.length + this.ambientParticles.length; }

  // ── Phase 1: Drift ──────────────────────────────────────────────────────────
  setDrift(enabled: boolean) { this.driftEnabled = enabled; }
  getDriftAngle() { return this.driftAngle; }

  // ── Phase 1: Gyroscope ──────────────────────────────────────────────────────
  enableGyroscope() {
    if (this.gyroEnabled) return;
    this.gyroHandler = (e: DeviceOrientationEvent) => {
      const b = e.beta  ?? 0;   // front-back tilt  -180…180
      const g = e.gamma ?? 0;   // left-right tilt  -90…90
      this.gyroX = Math.max(-1, Math.min(1, g / 45)) * this.GYRO_SENS;
      this.gyroY = Math.max(-1, Math.min(1, b / 45)) * this.GYRO_SENS;
    };
    window.addEventListener('deviceorientation', this.gyroHandler);
    this.gyroEnabled = true;
  }

  disableGyroscope() {
    if (!this.gyroEnabled || !this.gyroHandler) return;
    window.removeEventListener('deviceorientation', this.gyroHandler);
    this.gyroHandler = null;
    this.gyroEnabled = false;
    this.smoothGyroX = 0;
    this.smoothGyroY = 0;
  }

  getGyroEnabled() { return this.gyroEnabled; }

  // ── Phase 1: DNA ────────────────────────────────────────────────────────────
  generateDNA(): string {
    // Lightweight deterministic fingerprint
    const atmoPart = this.atmosphere.id.slice(0, 2).toUpperCase();
    const symPart  = this.symmetryCount.toString(16).toUpperCase();
    const seedPart = (this.dnaSessionSeed ^ this.strokeCount).toString(36).toUpperCase().padStart(3, '0').slice(-3);
    const flowChar = { 'Calm Flow': 'C', 'Dream Sequence': 'D', 'Chaotic Energy': 'X', 'Celestial Rhythm': 'R' }[this.flowState] ?? 'V';
    return `${atmoPart}${symPart}-${seedPart}${flowChar}`;
  }

  getDNAState() {
    return {
      atmosphereId: this.atmosphere.id,
      symmetry:     this.symmetryCount,
      seed:         this.dnaSessionSeed,
      flow:         this.flowState,
      driftEnabled: this.driftEnabled,
    };
  }

  /* ===== Init ===== */
  private initStars() {
    this.stars = [];
    for (let i = 0; i < 300; i++) {
      this.stars.push({
        x: Math.random(), y: Math.random(),
        s: 0.2 + Math.random() * 1.5,
        b: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.8,
      });
    }
  }

  private initAmbientParticles() {
    const colors = this.atmosphere.colors;
    for (let i = 0; i < 40; i++) {
      this.ambientParticles.push({
        x: Math.random() * this.width, y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        life: 1, maxLife: 9999, size: 1 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.1 + Math.random() * 0.2,
      });
    }
  }

  /* ===== Input ===== */
  startStroke(x: number, y: number, pressure = 0.5) {
    this.isDrawing = true;
    this.idleTime = 0;
    this.points = [{ x, y, pressure, time: performance.now() }];
  }

  moveStroke(x: number, y: number, pressure = 0.5) {
    if (!this.isDrawing) return;
    const now = performance.now();
    const last = this.points[this.points.length - 1];
    const dx = x - last.x, dy = y - last.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1.5) return;

    const speed = dist / Math.max(1, now - last.time);
    this.strokeSpeeds.push(speed);
    if (this.strokeSpeeds.length > 60) this.strokeSpeeds.shift();

    this.points.push({ x, y, pressure, time: now });

    // Render with smoothing using last few points
    this.renderSmoothedStroke(speed);

    // Particles
    this.emitStrokeParticles(x, y, dx, dy, speed);

    // Keep manageable point history
    if (this.points.length > 6) this.points.shift();
  }

  endStroke() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    if (this.points.length > 0) {
      const last = this.points[this.points.length - 1];
      this.emitBloomBurst(last.x, last.y);
    }
    this.updateFlowState();
    this.strokeCount++;
    this.points = [];
  }

  addGravityWell(x: number, y: number) {
    const existing = this.gravityWells.findIndex(w => Math.hypot(w.x - x, w.y - y) < 50);
    if (existing >= 0) { this.gravityWells.splice(existing, 1); return; }
    this.gravityWells.push({ x, y, strength: 150, life: 1 });
  }

  clearCanvas() {
    this.drawCtx.clearRect(0, 0, this.width, this.height);
    this.glowCtx.clearRect(0, 0, this.width, this.height);
    this.particles = [];
    this.gravityWells = [];
  }

  /* ===== Stroke Rendering ===== */
  private renderSmoothedStroke(speed: number) {
    const pts = this.points;
    if (pts.length < 2) return;

    const atmo = this.atmosphere;
    const color = atmo.colors[Math.floor(Math.random() * atmo.colors.length)];
    const baseWidth = (2 + 5 * (1 - Math.min(speed / 2.5, 1))) * atmo.brushWidth;
    const cx = this.width / 2, cy = this.height / 2;
    const len = pts.length;

    // Calculate smooth control points
    const p1 = pts[len - 2], p2 = pts[len - 1];
    let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

    if (len >= 3) {
      const p0 = pts[len - 3];
      cp1x = p1.x + (p2.x - p0.x) * 0.2;
      cp1y = p1.y + (p2.y - p0.y) * 0.2;
      cp2x = p2.x - (p2.x - p1.x) * 0.2;
      cp2y = p2.y - (p2.y - p1.y) * 0.2;
    } else {
      cp1x = p1.x; cp1y = p1.y;
      cp2x = p2.x; cp2y = p2.y;
    }

    const totalAxes = this.symmetryCount * 2; // rotational + mirror

    for (let s = 0; s < this.symmetryCount; s++) {
      // Drift adds a slow, time-based rotation offset to each axis
      const angle = (s / this.symmetryCount) * Math.PI * 2 + this.driftAngle;

      // Rotational symmetry
      this.drawStrokeOnAxis(p1, p2, cp1x, cp1y, cp2x, cp2y, cx, cy, angle, false, baseWidth, color, atmo);
      // Mirror symmetry
      this.drawStrokeOnAxis(p1, p2, cp1x, cp1y, cp2x, cp2y, cx, cy, angle, true, baseWidth, color, atmo);
    }
  }

  private drawStrokeOnAxis(
    p1: Point, p2: Point,
    cp1x: number, cp1y: number, cp2x: number, cp2y: number,
    cx: number, cy: number, angle: number, mirror: boolean,
    width: number, color: string, atmo: Atmosphere
  ) {
    // Transform points
    const transform = (px: number, py: number) => {
      let dx = px - cx, dy = py - cy;
      if (mirror) dx = -dx;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    };

    const tp1 = transform(p1.x, p1.y);
    const tp2 = transform(p2.x, p2.y);
    const tcp1 = transform(cp1x, cp1y);
    const tcp2 = transform(cp2x, cp2y);

    const alpha = mirror ? 0.45 : 0.65;

    // Main stroke - core line
    this.drawCtx.save();
    this.drawCtx.globalAlpha = alpha;
    this.drawCtx.strokeStyle = color;
    this.drawCtx.lineWidth = width;
    this.drawCtx.lineCap = 'round';
    this.drawCtx.lineJoin = 'round';
    this.drawCtx.shadowColor = color;
    this.drawCtx.shadowBlur = 8 * atmo.glowIntensity;
    this.drawCtx.beginPath();
    this.drawCtx.moveTo(tp1.x, tp1.y);
    this.drawCtx.bezierCurveTo(tcp1.x, tcp1.y, tcp2.x, tcp2.y, tp2.x, tp2.y);
    this.drawCtx.stroke();
    this.drawCtx.restore();

    // Bright inner core (thinner, brighter)
    this.drawCtx.save();
    this.drawCtx.globalAlpha = alpha * 0.8;
    this.drawCtx.strokeStyle = '#fff';
    this.drawCtx.lineWidth = Math.max(0.5, width * 0.25);
    this.drawCtx.lineCap = 'round';
    this.drawCtx.shadowColor = color;
    this.drawCtx.shadowBlur = 4;
    this.drawCtx.beginPath();
    this.drawCtx.moveTo(tp1.x, tp1.y);
    this.drawCtx.bezierCurveTo(tcp1.x, tcp1.y, tcp2.x, tcp2.y, tp2.x, tp2.y);
    this.drawCtx.stroke();
    this.drawCtx.restore();

    // Soft glow halo
    this.glowCtx.save();
    this.glowCtx.globalAlpha = 0.08 * atmo.glowIntensity * (mirror ? 0.6 : 1);
    this.glowCtx.strokeStyle = color;
    this.glowCtx.lineWidth = width * 4;
    this.glowCtx.lineCap = 'round';
    this.glowCtx.shadowColor = color;
    this.glowCtx.shadowBlur = 25 * atmo.glowIntensity;
    this.glowCtx.beginPath();
    this.glowCtx.moveTo(tp1.x, tp1.y);
    this.glowCtx.bezierCurveTo(tcp1.x, tcp1.y, tcp2.x, tcp2.y, tp2.x, tp2.y);
    this.glowCtx.stroke();
    this.glowCtx.restore();
  }

  /* ===== Particles ===== */
  private emitStrokeParticles(x: number, y: number, dx: number, dy: number, speed: number) {
    const count = Math.min(2, Math.floor(speed * 1.5) + 1);
    const atmo = this.atmosphere;
    const cx = this.width / 2, cy = this.height / 2;

    for (let s = 0; s < this.symmetryCount; s++) {
      const angle = (s / this.symmetryCount) * Math.PI * 2;
      const cos = Math.cos(angle), sin = Math.sin(angle);

      for (const mirror of [false, true]) {
        let ldx = x - cx, ldy = y - cy;
        if (mirror) ldx = -ldx;
        const rx = cx + ldx * cos - ldy * sin;
        const ry = cy + ldx * sin + ldy * cos;

        for (let i = 0; i < count; i++) {
          const color = atmo.colors[Math.floor(Math.random() * atmo.colors.length)];
          const spread = 15 + speed * 8;
          this.particles.push({
            x: rx + (Math.random() - 0.5) * spread,
            y: ry + (Math.random() - 0.5) * spread,
            vx: (Math.random() - 0.5) * 1.2 + dx * 0.015,
            vy: (Math.random() - 0.5) * 1.2 + dy * 0.015,
            life: 1, maxLife: 80 + Math.random() * 120,
            size: 0.8 + Math.random() * 2.5, color,
            alpha: 0.5 + Math.random() * 0.5,
          });
        }
      }
    }

    if (this.particles.length > 3000) this.particles.splice(0, this.particles.length - 3000);
  }

  private emitBloomBurst(x: number, y: number) {
    const atmo = this.atmosphere;
    const cx = this.width / 2, cy = this.height / 2;

    for (let s = 0; s < this.symmetryCount; s++) {
      const angle = (s / this.symmetryCount) * Math.PI * 2;
      const cos = Math.cos(angle), sin = Math.sin(angle);

      for (const mirror of [false, true]) {
        let ldx = x - cx, ldy = y - cy;
        if (mirror) ldx = -ldx;
        const rx = cx + ldx * cos - ldy * sin;
        const ry = cy + ldx * sin + ldy * cos;

        for (let i = 0; i < 12; i++) {
          const a = Math.random() * Math.PI * 2;
          const v = 0.3 + Math.random() * 1.8;
          this.particles.push({
            x: rx, y: ry,
            vx: Math.cos(a) * v, vy: Math.sin(a) * v,
            life: 1, maxLife: 50 + Math.random() * 80,
            size: 1 + Math.random() * 3,
            color: atmo.colors[Math.floor(Math.random() * atmo.colors.length)],
            alpha: 0.7,
          });
        }
      }
    }
  }

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      for (const well of this.gravityWells) {
        const dx = well.x - p.x, dy = well.y - p.y;
        const dist = Math.max(15, Math.sqrt(dx * dx + dy * dy));
        const force = well.strength / (dist * dist) * well.life;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }
      p.x += p.vx * this.atmosphere.particleSpeed;
      p.y += p.vy * this.atmosphere.particleSpeed;
      p.vx *= 0.988; p.vy *= 0.988;
      p.life -= 1 / p.maxLife;
      if (p.life <= 0) { this.particles[i] = this.particles[this.particles.length - 1]; this.particles.pop(); }
    }

    // Ambient particles
    for (const p of this.ambientParticles) {
      p.x += p.vx + Math.sin(this.time * 0.0005 + p.y * 0.01) * 0.1;
      p.y += p.vy + Math.cos(this.time * 0.0004 + p.x * 0.01) * 0.1;
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;
    }

    // Decay gravity wells
    for (let i = this.gravityWells.length - 1; i >= 0; i--) {
      this.gravityWells[i].life *= 0.9985;
      if (this.gravityWells[i].life < 0.01) this.gravityWells.splice(i, 1);
    }
  }

  private renderParticles() {
    const ctx = this.ctx;

    // Batch similar particles
    ctx.save();
    for (const p of this.particles) {
      const alpha = p.alpha * p.life * p.life; // quadratic falloff
      if (alpha < 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.size * 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.3 + 0.7 * p.life), 0, Math.PI * 2);
      ctx.fill();
    }

    // Ambient particles
    for (const p of this.ambientParticles) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 0.002 + p.x);
      ctx.globalAlpha = p.alpha * pulse;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.size * 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ===== Background ===== */
  private renderBackground() {
    const ctx = this.ctx;
    const [c1, c2] = this.atmosphere.bgGradient;
    const t = this.time * 0.0002;

    // Gyro offsets subtle drift of the cosmic center
    const gx = this.smoothGyroX * 0.06;
    const gy = this.smoothGyroY * 0.06;

    // Radial deep space gradient — center shifts slightly with gyro
    const grad = ctx.createRadialGradient(
      this.width  * (0.5 + 0.05 * Math.sin(t) + gx),
      this.height * (0.5 + 0.05 * Math.cos(t * 0.7) + gy), 0,
      this.width / 2, this.height / 2, this.width * 0.85
    );
    grad.addColorStop(0, c2);
    grad.addColorStop(1, c1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Nebula clouds (4 layers) — each layer offsets slightly more with gyro
    const colors = this.atmosphere.colors;
    for (let i = 0; i < 4; i++) {
      const x = this.width  * (0.25 + 0.5 * Math.sin(t * (0.8 + i * 0.3) + i * 1.8) + gx * (1 + i * 0.3));
      const y = this.height * (0.25 + 0.5 * Math.cos(t * (0.6 + i * 0.2) + i * 2.3) + gy * (1 + i * 0.3));
      const r = this.width * (0.15 + 0.12 * Math.sin(t * 0.4 + i * 1.5));

      const ng = ctx.createRadialGradient(x, y, 0, x, y, r);
      const color = colors[i % colors.length];
      ng.addColorStop(0, color + '14');
      ng.addColorStop(0.4, color + '0a');
      ng.addColorStop(1, 'transparent');
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Stars — tiny parallax from gyro
    const st = this.time * 0.0008;
    ctx.save();
    for (const star of this.stars) {
      const alpha = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(st * star.speed + star.b));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(
        star.x * this.width  + this.smoothGyroX * 18 * star.s,
        star.y * this.height + this.smoothGyroY * 18 * star.s,
        star.s, 0, Math.PI * 2
      );
      ctx.fill();
    }
    ctx.restore();
  }

  /* ===== Gravity Wells ===== */
  private renderGravityWells() {
    const ctx = this.ctx;
    for (const well of this.gravityWells) {
      const a = 0.2 * well.life;
      const r = 35 + 15 * Math.sin(this.time * 0.004);
      const color = this.atmosphere.colors[0];

      // Outer glow
      const g1 = ctx.createRadialGradient(well.x, well.y, 0, well.x, well.y, r * 2);
      g1.addColorStop(0, color + Math.floor(a * 80).toString(16).padStart(2, '0'));
      g1.addColorStop(0.5, color + Math.floor(a * 20).toString(16).padStart(2, '0'));
      g1.addColorStop(1, 'transparent');
      ctx.fillStyle = g1;
      ctx.fillRect(well.x - r * 2, well.y - r * 2, r * 4, r * 4);

      // Ring
      ctx.save();
      ctx.globalAlpha = a * 0.6;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(well.x, well.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Inner dot
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(well.x, well.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ===== Idle Animation ===== */
  private renderIdleAnimation() {
    if (this.isDrawing) { this.idleTime = 0; return; }
    this.idleTime++;
  }

  /* ===== Flow State ===== */
  private updateFlowState() {
    if (this.strokeSpeeds.length < 5) return;
    const avg = this.strokeSpeeds.reduce((a, b) => a + b, 0) / this.strokeSpeeds.length;
    const variance = this.strokeSpeeds.reduce((a, b) => a + (b - avg) ** 2, 0) / this.strokeSpeeds.length;

    let state: string;
    if (avg < 0.5 && variance < 0.1) state = 'Calm Flow';
    else if (avg < 1.0 && variance < 0.3) state = 'Dream Sequence';
    else if (avg > 2.0 || variance > 1.0) state = 'Chaotic Energy';
    else state = 'Celestial Rhythm';

    if (state !== this.flowState) {
      this.flowState = state;
      this.onFlowStateChange?.(state);
    }
  }

  /* ===== Render Loop ===== */
  private startLoop() {
    const loop = (timestamp: number) => {
      this.time = timestamp;

      // FPS
      this.fpsFrames++;
      if (timestamp - this.fpsTime > 1000) {
        this.currentFps = this.fpsFrames;
        this.fpsFrames = 0;
        this.fpsTime = timestamp;
        this.onFpsUpdate?.(this.currentFps);
      }

      // ── Infinite Mirror Drift: accumulate rotation each frame ──────────────
      if (this.driftEnabled) {
        this.driftAngle += this.DRIFT_SPEED;
        if (this.driftAngle > Math.PI * 2) this.driftAngle -= Math.PI * 2;
      }

      // ── Gyroscope: smooth interpolation (LERP) ─────────────────────────────
      if (this.gyroEnabled) {
        this.smoothGyroX += (this.gyroX - this.smoothGyroX) * this.GYRO_LERP;
        this.smoothGyroY += (this.gyroY - this.smoothGyroY) * this.GYRO_LERP;
      }

      this.ctx.clearRect(0, 0, this.width, this.height);
      this.renderBackground();

      // Composite layers
      this.ctx.globalAlpha = 0.55;
      this.ctx.drawImage(this.glowCanvas, 0, 0, this.width, this.height);
      this.ctx.globalAlpha = 1;
      this.ctx.drawImage(this.drawCanvas, 0, 0, this.width, this.height);

      this.updateParticles();
      this.renderParticles();
      this.renderGravityWells();
      this.renderIdleAnimation();

      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  /* ===== Export ===== */
  exportCanvas(transparentBg: boolean): Promise<Blob | null> {
    return new Promise((resolve) => {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = this.canvas.width;
      exportCanvas.height = this.canvas.height;
      const exportCtx = exportCanvas.getContext('2d')!;

      if (!transparentBg) {
        exportCtx.drawImage(this.canvas, 0, 0);
      } else {
        exportCtx.globalAlpha = 0.55;
        exportCtx.drawImage(this.glowCanvas, 0, 0);
        exportCtx.globalAlpha = 1.0;
        exportCtx.drawImage(this.drawCanvas, 0, 0);
      }

      exportCanvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  }
}

