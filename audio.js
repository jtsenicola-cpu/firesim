/**
 * Zero-asset procedural Web Audio synthesizer for Firesim:
 * - Continuous fire roar & crackle scaled by active fire intensity
 * - Water hose spray & steam hiss
 * - Thermal glass shatter burst
 */
export class FireAudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.initialized = false;
    this.fireGain = null;
    this.hoseGain = null;
    this.noiseBuffer = null;
    this.lastSteamTime = 0;
  }

  unlock() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.initialized = true;

    // 2-second looping pink/brownish noise buffer
    const sampleRate = this.ctx.sampleRate;
    const len = sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.04 * white) / 1.04;
      lastOut = data[i];
      data[i] *= 3.2;
    }

    // Fire roar loop (lowpass filtered noise)
    const fireSrc = this.ctx.createBufferSource();
    fireSrc.buffer = this.noiseBuffer;
    fireSrc.loop = true;
    const fireFilter = this.ctx.createBiquadFilter();
    fireFilter.type = 'lowpass';
    fireFilter.frequency.value = 340;
    this.fireGain = this.ctx.createGain();
    this.fireGain.gain.value = 0;
    fireSrc.connect(fireFilter).connect(this.fireGain).connect(this.ctx.destination);
    fireSrc.start();

    // Water hose loop (bandpass filtered noise)
    const hoseSrc = this.ctx.createBufferSource();
    hoseSrc.buffer = this.noiseBuffer;
    hoseSrc.loop = true;
    const hoseFilter = this.ctx.createBiquadFilter();
    hoseFilter.type = 'bandpass';
    hoseFilter.frequency.value = 1400;
    hoseFilter.Q.value = 0.7;
    this.hoseGain = this.ctx.createGain();
    this.hoseGain.gain.value = 0;
    hoseSrc.connect(hoseFilter).connect(this.hoseGain).connect(this.ctx.destination);
    hoseSrc.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted && this.ctx) {
      if (this.fireGain) this.fireGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      if (this.hoseGain) this.hoseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  update(fireLevel, isSpraying) {
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;
    const targetFire = this.muted ? 0 : Math.min(0.28, fireLevel * 0.09);
    const targetHose = this.muted || !isSpraying ? 0 : 0.16;
    this.fireGain.gain.setTargetAtTime(targetFire, now, 0.08);
    this.hoseGain.gain.setTargetAtTime(targetHose, now, 0.04);

    // Random wood crackle pops when fire is active
    if (!this.muted && fireLevel > 0.2 && Math.random() < Math.min(0.35, fireLevel * 0.12)) {
      this._triggerCrackle(now);
    }
  }

  _triggerCrackle(now) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160 + Math.random() * 520, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.035);
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  playSteamHiss() {
    if (!this.initialized || !this.ctx || this.muted || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSteamTime < 0.18) return;
    this.lastSteamTime = now;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    src.connect(hp).connect(g).connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.24);
  }

  playGlassShatter() {
    if (!this.initialized || !this.ctx || this.muted || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    src.connect(hp).connect(g).connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.46);

    // High crystalline shard pings
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400 + Math.random() * 2200, now + i * 0.04);
      og.gain.setValueAtTime(0.05, now + i * 0.04);
      og.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.14);
      osc.connect(og).connect(this.ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.15);
    }
  }
}
