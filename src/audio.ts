// Neon Curling VR — Audio Manager

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicOsc: OscillatorNode | null = null;
  private musicPad: OscillatorNode | null = null;
  private musicLfo: OscillatorNode | null = null;
  private masterVol = 0.8;
  private sfxVol = 0.8;
  private musicVol = 0.5;

  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVol;
    this.masterGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.masterGain);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVol;
    this.musicGain.connect(this.masterGain);
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) this.init();
    if (this.ctx!.state === 'suspended') this.ctx!.resume();
    return this.ctx!;
  }

  setMasterVolume(v: number): void {
    this.masterVol = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }
  setSfxVolume(v: number): void {
    this.sfxVol = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }
  setMusicVolume(v: number): void {
    this.musicVol = v;
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  getMasterVolume(): number { return this.masterVol; }
  getSfxVolume(): number { return this.sfxVol; }
  getMusicVolume(): number { return this.musicVol; }

  private playSfx(freq: number, type: OscillatorType, dur: number, vol = 0.3): void {
    const ctx = this.ensureCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  private playNoise(dur: number, vol = 0.2, filterFreq = 2000): void {
    const ctx = this.ensureCtx();
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain!);
    src.start();
    src.stop(ctx.currentTime + dur);
  }

  playStoneRelease(): void {
    this.playSfx(200, 'sine', 0.3, 0.25);
    this.playNoise(0.2, 0.1, 800);
  }

  playStoneSlideBrush(): void {
    this.playNoise(0.15, 0.08, 600);
  }

  playSweep(): void {
    this.playNoise(0.1, 0.15, 1200);
    this.playSfx(440, 'triangle', 0.05, 0.05);
  }

  playStoneCollision(intensity: number): void {
    const vol = Math.min(0.4, intensity * 0.3);
    this.playSfx(150 + intensity * 100, 'square', 0.15, vol);
    this.playNoise(0.12, vol * 0.7, 1500);
  }

  playHouseHit(): void {
    const ctx = this.ensureCtx();
    const notes = [523, 659, 784]; // C5 E5 G5
    notes.forEach((f, i) => {
      setTimeout(() => this.playSfx(f, 'sine', 0.3, 0.2), i * 80);
    });
  }

  playScore(): void {
    const ctx = this.ensureCtx();
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      setTimeout(() => this.playSfx(f, 'triangle', 0.4, 0.2), i * 120);
    });
  }

  playCountdownTick(): void {
    this.playSfx(880, 'sine', 0.1, 0.3);
  }

  playCountdownGo(): void {
    this.playSfx(1047, 'triangle', 0.3, 0.35);
    setTimeout(() => this.playSfx(1319, 'triangle', 0.3, 0.3), 100);
  }

  playGameStart(): void {
    const notes = [262, 330, 392, 523];
    notes.forEach((f, i) => {
      setTimeout(() => this.playSfx(f, 'sine', 0.5, 0.25), i * 150);
    });
  }

  playGameEnd(): void {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => {
      setTimeout(() => this.playSfx(f, 'triangle', 0.6, 0.2), i * 200);
    });
  }

  playGameOver(): void {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => {
      setTimeout(() => this.playSfx(f, 'sawtooth', 0.5, 0.15), i * 200);
    });
  }

  playAchievement(): void {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => {
      setTimeout(() => this.playSfx(f, 'sine', 0.3, 0.2), i * 100);
    });
  }

  playButtonClick(): void {
    this.playSfx(660, 'sine', 0.05, 0.15);
  }

  playTakeout(): void {
    this.playSfx(200, 'square', 0.2, 0.3);
    this.playNoise(0.3, 0.2, 2000);
    setTimeout(() => this.playSfx(300, 'sawtooth', 0.15, 0.2), 100);
  }

  playExtraEnd(): void {
    // Dramatic ascending tone
    const notes = [330, 440, 554, 659, 880];
    notes.forEach((f, i) => {
      setTimeout(() => this.playSfx(f, 'sine', 0.5, 0.25), i * 150);
    });
  }

  playTournamentWin(): void {
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this.playSfx(f, 'sine', 0.6, 0.25);
        this.playSfx(f * 0.5, 'triangle', 0.6, 0.15);
      }, i * 180);
    });
  }

  playSkinUnlock(): void {
    const notes = [440, 554, 659, 880];
    notes.forEach((f, i) => {
      setTimeout(() => this.playSfx(f, 'triangle', 0.4, 0.2), i * 100);
    });
  }

  playHogViolation(): void {
    this.playSfx(200, 'sawtooth', 0.3, 0.2);
    setTimeout(() => this.playSfx(150, 'sawtooth', 0.3, 0.15), 150);
  }

  startAmbientMusic(): void {
    const ctx = this.ensureCtx();
    if (this.musicOsc) return;

    // Deep bass drone
    this.musicOsc = ctx.createOscillator();
    this.musicOsc.type = 'sine';
    this.musicOsc.frequency.value = 55;
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.15;
    this.musicOsc.connect(bassGain);
    bassGain.connect(this.musicGain!);
    this.musicOsc.start();

    // Pad
    this.musicPad = ctx.createOscillator();
    this.musicPad.type = 'triangle';
    this.musicPad.frequency.value = 82.5;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 300;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.08;
    this.musicPad.connect(padFilter);
    padFilter.connect(padGain);
    padGain.connect(this.musicGain!);
    this.musicPad.start();

    // LFO for subtle movement
    this.musicLfo = ctx.createOscillator();
    this.musicLfo.type = 'sine';
    this.musicLfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 5;
    this.musicLfo.connect(lfoGain);
    lfoGain.connect(this.musicOsc.frequency);
    this.musicLfo.start();
  }

  stopAmbientMusic(): void {
    try {
      this.musicOsc?.stop();
      this.musicPad?.stop();
      this.musicLfo?.stop();
    } catch {}
    this.musicOsc = null;
    this.musicPad = null;
    this.musicLfo = null;
  }
}
