export interface Atmosphere {
  id: string;
  name: string;
  emoji: string;
  colors: [string, string, string, string];
  bgGradient: [string, string];
  particleSpeed: number;
  glowIntensity: number;
  brushWidth: number;
}

export const ATMOSPHERES: Atmosphere[] = [
  {
    id: 'eclipse',
    name: 'Eclipse',
    emoji: '🌑',
    colors: ['#8b5cf6', '#6d28d9', '#a78bfa', '#c4b5fd'],
    bgGradient: ['#0a0612', '#130a24'],
    particleSpeed: 0.6,
    glowIntensity: 1.2,
    brushWidth: 1.0,
  },
  {
    id: 'aurora',
    name: 'Aurora',
    emoji: '🌌',
    colors: ['#06d6a0', '#00b4d8', '#48cae4', '#90e0ef'],
    bgGradient: ['#041218', '#06202e'],
    particleSpeed: 0.8,
    glowIntensity: 1.0,
    brushWidth: 1.1,
  },
  {
    id: 'ember',
    name: 'Ember',
    emoji: '🔥',
    colors: ['#ff6b35', '#f72585', '#ff9e00', '#ffd60a'],
    bgGradient: ['#140a06', '#1a0c0c'],
    particleSpeed: 1.0,
    glowIntensity: 1.4,
    brushWidth: 0.9,
  },
  {
    id: 'abyss',
    name: 'Abyss',
    emoji: '🖤',
    colors: ['#64748b', '#94a3b8', '#475569', '#cbd5e1'],
    bgGradient: ['#060608', '#0a0a10'],
    particleSpeed: 0.4,
    glowIntensity: 0.8,
    brushWidth: 1.2,
  },
  {
    id: 'bloom',
    name: 'Bloom',
    emoji: '🌸',
    colors: ['#ec4899', '#f472b6', '#c084fc', '#fb7185'],
    bgGradient: ['#140610', '#1a0818'],
    particleSpeed: 0.7,
    glowIntensity: 1.1,
    brushWidth: 1.0,
  },
  {
    id: 'nova',
    name: 'Nova',
    emoji: '⚡',
    colors: ['#38bdf8', '#818cf8', '#c084fc', '#e879f9'],
    bgGradient: ['#060814', '#0c0e20'],
    particleSpeed: 1.2,
    glowIntensity: 1.5,
    brushWidth: 0.8,
  },
];

export const DEFAULT_ATMOSPHERE = ATMOSPHERES[0];
