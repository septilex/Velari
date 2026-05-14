import * as Tone from 'tone';

export class VelariAudio {
  private synth: Tone.PolySynth | null = null;
  private pad: Tone.Synth | null = null;
  private reverb: Tone.Reverb | null = null;
  private delay: Tone.FeedbackDelay | null = null;
  private filter: Tone.Filter | null = null;
  private initialized = false;
  private _enabled = false;

  get enabled() { return this._enabled; }

  async init() {
    if (this.initialized) return;
    await Tone.start();

    this.reverb = new Tone.Reverb({ decay: 6, wet: 0.5 }).toDestination();
    this.delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3, wet: 0.2 }).connect(this.reverb);
    this.filter = new Tone.Filter({ frequency: 2000, type: 'lowpass' }).connect(this.delay);

    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.3, decay: 0.8, sustain: 0.4, release: 2 },
      volume: -18,
    }).connect(this.filter);

    this.pad = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 1.5, decay: 2, sustain: 0.6, release: 4 },
      volume: -24,
    }).connect(this.reverb);

    this.initialized = true;
  }

  async toggle() {
    if (!this.initialized) await this.init();
    this._enabled = !this._enabled;
    return this._enabled;
  }

  onStroke(speed: number, x: number, y: number, width: number, height: number) {
    if (!this._enabled || !this.synth) return;

    // Map position to musical notes
    const notes = ['C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5'];
    const noteIdx = Math.floor((x / width) * notes.length);
    const note = notes[Math.min(noteIdx, notes.length - 1)];

    // Fast strokes = sharper, brighter
    if (speed > 1.5) {
      const highNotes = ['E4', 'G4', 'A4', 'C5', 'E5'];
      const n = highNotes[Math.floor(Math.random() * highNotes.length)];
      this.synth.triggerAttackRelease(n, '16n', undefined, 0.15);
    }

    // Slow strokes = ambient pads
    if (speed < 0.5 && Math.random() < 0.05) {
      const padNotes = ['C3', 'E3', 'G3', 'A3'];
      const n = padNotes[Math.floor(Math.random() * padNotes.length)];
      this.pad?.triggerAttackRelease(n, '2n', undefined, 0.08);
    }

    // Normal stroke sounds
    if (Math.random() < 0.15) {
      this.synth.triggerAttackRelease(note, '8n', undefined, 0.1);
    }

    // Update filter based on Y position
    if (this.filter) {
      const freq = 400 + (1 - y / height) * 3000;
      this.filter.frequency.rampTo(freq, 0.1);
    }

    // Update reverb based on speed
    if (this.reverb) {
      this.reverb.wet.rampTo(Math.min(0.8, 0.3 + speed * 0.1), 0.2);
    }
  }

  playBloom() {
    if (!this._enabled || !this.synth) return;
    this.synth.triggerAttackRelease(['C4', 'E4', 'G4'], '4n', undefined, 0.06);
  }

  dispose() {
    this.synth?.dispose();
    this.pad?.dispose();
    this.reverb?.dispose();
    this.delay?.dispose();
    this.filter?.dispose();
  }
}
