import { h } from './dom.js';
import { metronome } from './metronome.js';

// The moving part of the metronome. Three looks: a swinging pendulum, a pulsing ring, and beat dots.

export const FACE_STYLES = [['pendulum', 'Pendulum'], ['pulse', 'Pulse'], ['dots', 'Dots']];

const SWING = 24; // degrees each side

function pendulum() {
  const el = h('div', { class: 'face pendulum' });
  el.innerHTML =
    '<svg viewBox="0 0 200 236" aria-hidden="true">' +
    '<path class="pm-body" d="M74 14h52a8 8 0 0 1 7.800 6.300L170 214a8 8 0 0 1-7.800 9.700H37.800A8 8 0 0 1 30 214L66.200 20.300A8 8 0 0 1 74 14z"/>' +
    '<path class="pm-plate" d="M86 30h28l22 150H64z"/>' +
    Array.from({ length: 9 }, (_, i) => `<line class="pm-mark" x1="${i % 2 ? 93 : 89}" x2="${i % 2 ? 107 : 111}" y1="${46 + i * 15}" y2="${46 + i * 15}"/>`).join('') +
    '<g class="pm-arm"><line class="pm-rod" x1="100" y1="196" x2="100" y2="24"/><rect class="pm-weight" x="88" y="60" width="24" height="18" rx="3"/></g>' +
    '<path class="pm-foot" d="M40 184h120l8 30a8 8 0 0 1-7.800 9.700H39.800A8 8 0 0 1 32 214z"/>' +
    '<circle class="pm-lamp" cx="100" cy="204" r="5"/>' +
    '</svg>';
  const arm = el.querySelector('.pm-arm');
  const weight = el.querySelector('.pm-weight');
  const lamp = el.querySelector('.pm-lamp');
  let side = 1;
  let lampTimer = null;
  const rest = () => {
    arm.style.transition = 'transform 0.35s ease-out';
    arm.style.transform = 'rotate(0deg)';
    side = 1;
  };
  return {
    el,
    // Faster tempos sit the weight lower on the rod, as on a real one.
    change() { weight.setAttribute('y', String(Math.round(34 + ((metronome.bpm - 30) / 270) * 120))); },
    tick(detail) {
      if (!detail.isBeat) return;
      side = -side;
      arm.style.transition = `transform ${60 / metronome.bpm}s cubic-bezier(0.37, 0, 0.63, 1)`;
      arm.style.transform = `rotate(${side * SWING}deg)`;
      lamp.classList.toggle('down', detail.isDownbeat);
      lamp.classList.add('on');
      clearTimeout(lampTimer);
      lampTimer = setTimeout(() => lamp.classList.remove('on'), 90);
    },
    stop: rest,
  };
}

function pulse() {
  const count = h('div', { class: 'pulse-count' }, '');
  const ring = h('div', { class: 'pulse-ring' });
  const el = h('div', { class: 'face pulse' }, ring, count);
  return {
    el,
    change() {},
    tick(detail) {
      if (!detail.isBeat) return;
      count.textContent = String(detail.beat + 1);
      el.classList.toggle('down', detail.isDownbeat);
      ring.style.animation = 'none';
      void ring.offsetWidth;
      ring.style.animation = `pulse ${Math.min(0.6, 60 / metronome.bpm)}s ease-out`;
    },
    stop() { count.textContent = ''; ring.style.animation = 'none'; },
  };
}

function dots() {
  const el = h('div', { class: 'face dots', 'aria-hidden': 'true' });
  const fill = () => {
    if (el.children.length !== metronome.beats) el.replaceChildren(...Array.from({ length: metronome.beats }, () => h('span', { class: 'dot' })));
  };
  fill();
  return {
    el,
    change: fill,
    tick(detail) {
      if (!detail.isBeat) return;
      for (const d of el.children) d.classList.remove('on');
      const dot = el.children[detail.beat];
      if (dot) { dot.classList.add('on'); dot.classList.toggle('down', detail.isDownbeat); }
    },
    stop() { for (const d of el.children) d.classList.remove('on'); },
  };
}

const MAKERS = { pendulum, pulse, dots };

// Returns a holder element that follows the metronome, and a function to stop following.
export function mountFace(style) {
  const holder = h('div', { class: 'face-holder' });
  let face = null;
  const use = (name) => {
    face = (MAKERS[name] || pendulum)();
    holder.replaceChildren(face.el);
    face.change();
  };
  use(style);
  const off = metronome.on((type, detail) => {
    if (type === 'tick') face.tick(detail);
    else if (type === 'state' && !metronome.running) face.stop();
    else if (type === 'change') face.change();
  });
  return { el: holder, use, off };
}
