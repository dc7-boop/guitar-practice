// Metronome engine. Clicks are scheduled on the Web Audio clock a little ahead of time,
// so timing stays steady even when the page is busy drawing.

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

let ctx = null;

function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

class Metronome {
  constructor() {
    this.bpm = 80;
    this.beats = 4; // beats per bar
    this.sub = 1; // clicks per beat
    this.accent = true;
    this.volume = 0.8;
    this.running = false;
    this._timer = null;
    this._next = 0;
    this._tick = 0;
    this._queue = [];
    this._raf = null;
    this._listeners = new Set();
  }

  on(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit(type, detail) {
    this._listeners.forEach((fn) => fn(type, detail));
  }

  setBpm(bpm) {
    this.bpm = Math.max(30, Math.min(300, Math.round(bpm)));
    this._emit('change');
  }

  set(props) {
    Object.assign(this, props);
    this._emit('change');
  }

  start() {
    if (this.running) return;
    const ac = audio();
    if (ac.state === 'suspended') ac.resume();
    this.running = true;
    this._tick = 0;
    this._queue = [];
    this._next = ac.currentTime + 0.08;
    this._timer = setInterval(() => this._schedule(), LOOKAHEAD_MS);
    this._schedule();
    const draw = () => {
      if (!this.running) return;
      const now = ac.currentTime;
      while (this._queue.length && this._queue[0].time <= now) {
        this._emit('tick', this._queue.shift());
      }
      this._raf = requestAnimationFrame(draw);
    };
    this._raf = requestAnimationFrame(draw);
    this._emit('state');
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this._timer);
    cancelAnimationFrame(this._raf);
    this._queue = [];
    this._emit('state');
  }

  toggle() {
    if (this.running) this.stop();
    else this.start();
  }

  _schedule() {
    const ac = audio();
    while (this._next < ac.currentTime + SCHEDULE_AHEAD) {
      const perBar = this.beats * this.sub;
      const pos = this._tick % perBar;
      const beat = Math.floor(pos / this.sub);
      const isBeat = pos % this.sub === 0;
      const isDownbeat = pos === 0;
      this._click(this._next, isDownbeat && this.accent ? 'accent' : isBeat ? 'beat' : 'sub');
      this._queue.push({ time: this._next, beat, isBeat, isDownbeat });
      this._next += 60 / this.bpm / this.sub;
      this._tick++;
    }
  }

  _click(time, kind) {
    const ac = audio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const freq = kind === 'accent' ? 1568 : kind === 'beat' ? 1046 : 784;
    const level = this.volume * (kind === 'accent' ? 1 : kind === 'beat' ? 0.75 : 0.35);
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * 0.5), time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    osc.connect(gain).connect(ac.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }
}

export const metronome = new Metronome();

// Tap tempo: average of the last few gaps; a long pause starts over.
const taps = [];
export function tapTempo() {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
  taps.push(now);
  if (taps.length > 6) taps.shift();
  if (taps.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1]);
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return Math.round(60000 / avg);
}

// Keep the screen on while something is playing.
let wakeLock = null;
let wakeWanted = false;

export async function keepAwake(on) {
  wakeWanted = on;
  try {
    if (on && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) {
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeWanted) keepAwake(true);
});
