import { useEffect, useRef } from 'react';

export interface ThemeConfig {
  name: string;
  coreColor: string;
  glowColor: string;
  tailColor: string;
  accentColors: string[];
  gradientText: string;
}

export const GALAXY_THEMES: Record<string, ThemeConfig> = {
  purple: {
    name: 'purple',
    coreColor: '#9333ea',
    glowColor: '#c084fc',
    tailColor: 'rgba(147, 51, 234, 0.12)',
    accentColors: ['#7c6aef', '#e06aaf'],
    gradientText: 'linear-gradient(135deg, #fff 20%, #c084fc 70%, #e06aaf 100%)',
  },
  green: {
    name: 'green',
    coreColor: '#059669',
    glowColor: '#34d399',
    tailColor: 'rgba(5, 150, 105, 0.12)',
    accentColors: ['#10b981', '#6ee7b7'],
    gradientText: 'linear-gradient(135deg, #fff 20%, #34d399 70%, #5ce0d8 100%)',
  },
  red: {
    name: 'red',
    coreColor: '#dc2626',
    glowColor: '#f87171',
    tailColor: 'rgba(220, 38, 38, 0.12)',
    accentColors: ['#ef4444', '#fca5a5'],
    gradientText: 'linear-gradient(135deg, #fff 20%, #f87171 70%, #dc2626 100%)',
  },
  gold: {
    name: 'gold',
    coreColor: '#d97706',
    glowColor: '#fbbf24',
    tailColor: 'rgba(217, 119, 6, 0.12)',
    accentColors: ['#f59e0b', '#fde68a'],
    gradientText: 'linear-gradient(135deg, #fff 20%, #fbbf24 70%, #d97706 100%)',
  },
  orange: {
    name: 'orange',
    coreColor: '#ea580c',
    glowColor: '#fb923c',
    tailColor: 'rgba(234, 88, 12, 0.12)',
    accentColors: ['#f97316', '#fdba74'],
    gradientText: 'linear-gradient(135deg, #fff 20%, #fb923c 70%, #ea580c 100%)',
  },
};

interface GalaxyBackgroundProps {
  themeName: string;
}

export function GalaxyBackground({ themeName }: GalaxyBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const theme = GALAXY_THEMES[themeName] || GALAXY_THEMES.purple;

    let animFrame = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Resize handler
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // --- Generate Static Background Stars ---
    const starCount = window.innerWidth < 768 ? 250 : 500;
    const stars: { x: number; y: number; r: number; alpha: number; speed: number; twinkles: boolean }[] = [];
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.5 + Math.random() * 1.5,
        alpha: 0.2 + Math.random() * 0.8,
        speed: 0.005 + Math.random() * 0.015,
        twinkles: Math.random() > 0.4,
      });
    }

    // --- Generate Spiral Galaxy Particles ---
    const galaxyParticles: { angle: number; dist: number; size: number; alpha: number; color: string }[] = [];
    const particleCount = window.innerWidth < 768 ? 600 : 1200;
    const maxDist = Math.min(width, height) * 0.7;
    const arms = 2;

    for (let i = 0; i < particleCount; i++) {
      // Distribution weighted towards center
      const pow = Math.pow(Math.random(), 2.5);
      const dist = Math.max(10, pow * maxDist);
      
      // Base arm angle + spiral curvature twist
      const armIndex = i % arms;
      const baseAngle = (armIndex / arms) * Math.PI * 2;
      const twist = dist * 0.006;
      const randomSpread = (Math.random() - 0.5) * (0.3 + (dist / maxDist) * 0.8);
      const angle = baseAngle + twist + randomSpread;

      // Pick color mixture
      const clr = Math.random() > 0.4 ? theme.coreColor : theme.glowColor;

      galaxyParticles.push({
        angle,
        dist,
        size: 0.8 + Math.random() * 2.2,
        alpha: (1 - dist / maxDist) * (0.3 + Math.random() * 0.5),
        color: clr,
      });
    }

    // --- Generate Live Comets ---
    interface Comet {
      x: number;
      y: number;
      vx: number;
      vy: number;
      length: number;
      size: number;
      life: number;
      delay: number;
      headColor: string;
    }
    const comets: Comet[] = [];
    const cometCount = window.innerWidth < 768 ? 3 : 5;

    const resetComet = (c: Partial<Comet> = {}): Comet => {
      // Spawn slightly off screen top/right to shoot down/left
      const startX = width * 0.2 + Math.random() * width * 1.2;
      const startY = -100 - Math.random() * 200;
      const speed = 8 + Math.random() * 8;
      const angle = Math.PI * 0.75 + (Math.random() - 0.5) * 0.1; // roughly down-left

      return {
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: 80 + Math.random() * 150,
        size: 1.5 + Math.random() * 2,
        life: 1,
        delay: c.delay ?? Math.random() * 120, // frame delay before spawning
        headColor: Math.random() > 0.3 ? '#ffffff' : theme.glowColor,
      };
    };

    for (let i = 0; i < cometCount; i++) {
      comets.push(resetComet({ delay: Math.random() * 200 }));
    }

    // --- Animation Loop ---
    let globalAngle = 0;

    const render = () => {
      globalAngle += 0.0004; // extreme slow cinematic rotation of the galaxy

      // Fill rich dark background
      ctx.fillStyle = '#05050c';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // 1. Render Deep Space Core Nebula Gradients
      const outerRadius = Math.max(width, height) * 0.7;
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerRadius);
      coreGrad.addColorStop(0, `${theme.coreColor}25`);
      coreGrad.addColorStop(0.4, `${theme.coreColor}0d`);
      coreGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Render Field Stars
      ctx.save();
      for (const star of stars) {
        if (star.twinkles) {
          star.alpha += star.speed;
          if (star.alpha > 1 || star.alpha < 0.1) star.speed = -star.speed;
        }
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 3. Render Rotating Spiral Galaxy Core
      ctx.save();
      // Apply subtle dynamic rotation to the center
      ctx.translate(cx, cy);
      ctx.rotate(globalAngle);

      // Central dense glow
      const innerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, maxDist * 0.25);
      innerGrad.addColorStop(0, `${theme.glowColor}60`);
      innerGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(0, 0, maxDist * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Spiral arms particles
      for (const p of galaxyParticles) {
        const px = Math.cos(p.angle) * p.dist;
        const py = Math.sin(p.angle) * p.dist * 0.75; // subtle tilt to feel 3D

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 2;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 4. Render Dynamic Comets
      ctx.save();
      for (let i = 0; i < comets.length; i++) {
        const c = comets[i];
        if (c.delay > 0) {
          c.delay--;
          continue;
        }

        // Update pos
        c.x += c.vx;
        c.y += c.vy;

        // Draw tail gradient
        const tailX = c.x - c.vx * (c.length / 10);
        const tailY = c.y - c.vy * (c.length / 10);

        const tailGrad = ctx.createLinearGradient(c.x, c.y, tailX, tailY);
        tailGrad.addColorStop(0, c.headColor);
        tailGrad.addColorStop(0.1, theme.glowColor);
        tailGrad.addColorStop(1, 'transparent');

        ctx.strokeStyle = tailGrad;
        ctx.lineWidth = c.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Bright leading head glow
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = c.headColor;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size * 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Respawn if out of bounds
        if (c.x < -200 || c.y > height + 200) {
          comets[i] = resetComet({ delay: Math.random() * 80 });
        }
      }
      ctx.restore();

      animFrame = requestAnimationFrame(render);
    };

    animFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', handleResize);
    };
  }, [themeName]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'hidden', transition: 'opacity 0.8s ease' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
}
