import * as store from '../store.js';
import { h, icon, toast } from '../dom.js';
import { metronome, tapTempo } from '../metronome.js';
import { openLogSheet } from '../log.js';
import { mountFace, FACE_STYLES } from '../face.js';

const SUBS = [[1, 'Quarters'], [2, 'Eighths'], [3, 'Triplets'], [4, '16ths']];

function persist() {
  const { bpm, beats, sub, accent, volume } = metronome;
  store.setSetting('metronome', { bpm, beats, sub, accent, volume });
}

export async function render(root, { query }) {
  let style = await store.getSetting('metroStyle', 'pendulum');
  const face = mountFace(style);
  const styleSeg = h('div', { class: 'seg' });
  const item = query.get('item') ? store.getItem(query.get('item')) : null;
  const section = item ? item.sections.find((s) => s.id === query.get('section')) : null;

  if (section) {
    const st = store.sectionStats(section);
    const start = section.lastBpm || st.current || (section.targetBpm ? Math.round(section.targetBpm * 0.6) : null);
    if (start) metronome.setBpm(start);
  }

  const bpmEl = h('div', { class: 'bpm-num', 'aria-live': 'off' });
  const slider = h('input', { type: 'range', min: 30, max: 260, step: 1, 'aria-label': 'Tempo', oninput: () => metronome.setBpm(Number(slider.value)) });
  const startBtn = h('button', { class: 'btn primary start', onclick: () => metronome.toggle() });
  const beatsEl = h('span', { class: 'num' });
  const subSeg = h('div', { class: 'seg' });
  const accentBox = h('input', { type: 'checkbox', onchange: () => metronome.set({ accent: accentBox.checked }) });
  const volume = h('input', { type: 'range', min: 0, max: 1, step: 0.05, 'aria-label': 'Click volume', oninput: () => metronome.set({ volume: Number(volume.value) }) });
  const logBtn = h('button', { class: 'btn log' });
  const context = h('div', { class: 'context' });

  const step = (d) => h('button', { class: 'btn step', 'aria-label': `${d > 0 ? 'Up' : 'Down'} ${Math.abs(d)} bpm`, onclick: () => metronome.setBpm(metronome.bpm + d) }, (d > 0 ? '+' : '−') + Math.abs(d));

  function drawContext() {
    if (!section) {
      context.replaceChildren();
      return;
    }
    const st = store.sectionStats(section);
    context.replaceChildren(
      h('a', { class: 'btn ghost icon-btn', href: `#/item/${item.id}`, 'aria-label': `Back to ${item.title}` }, icon('back')),
      h('div', { class: 'grow' },
        h('div', { class: 'context-title' }, `${item.title} · ${section.name}`),
        h('div', { class: 'muted small' }, [st.current ? `Last clean at ${st.current}` : 'Nothing logged yet', section.targetBpm ? `target ${section.targetBpm}` : null].filter(Boolean).join(' · ')))
    );
  }

  function draw() {
    bpmEl.replaceChildren(String(metronome.bpm), h('span', { class: 'bpm-unit' }, 'bpm'));
    slider.value = metronome.bpm;
    startBtn.replaceChildren(icon(metronome.running ? 'stop' : 'play', 26), metronome.running ? 'Stop' : 'Start');
    startBtn.classList.toggle('running', metronome.running);
    beatsEl.textContent = String(metronome.beats);
    accentBox.checked = metronome.accent;
    volume.value = metronome.volume;
    subSeg.replaceChildren(...SUBS.map(([n, label]) => h('button', { class: metronome.sub === n ? 'on' : '', onclick: () => metronome.set({ sub: n }) }, label)));
    styleSeg.replaceChildren(...FACE_STYLES.map(([key, label]) => h('button', { class: style === key ? 'on' : '', onclick: () => {
      style = key;
      store.setSetting('metroStyle', key);
      face.use(key);
      draw();
    } }, label)));
    logBtn.replaceChildren(icon('check', 20), section ? `Log ${metronome.bpm} bpm as clean` : 'Log this tempo…');
  }

  logBtn.addEventListener('click', async () => {
    if (section) {
      await store.logBpm(item.id, section.id, metronome.bpm);
      toast(`Logged ${metronome.bpm} bpm for ${section.name}`);
      drawContext();
    } else {
      openLogSheet({ bpm: metronome.bpm });
    }
  });

  const off = metronome.on((type, detail) => {
    if (type === 'tick') return;
    if (type === 'change') persist();
    draw();
  });

  const onKey = (e) => {
    if (e.target.closest('input, textarea, select, button, a')) return;
    if (e.code === 'Space') { e.preventDefault(); metronome.toggle(); }
    if (e.key === 'ArrowUp') metronome.setBpm(metronome.bpm + 1);
    if (e.key === 'ArrowDown') metronome.setBpm(metronome.bpm - 1);
  };
  document.addEventListener('keydown', onKey);

  root.classList.add('metronome-view');
  root.append(
    section ? context : h('header', { class: 'page-head' }, h('h1', null, 'Metronome')),
    h('div', { class: 'metro-face' }, face.el, bpmEl),
    h('div', { class: 'tempo-row' }, step(-5), step(-1), slider, step(1), step(5)),
    h('div', { class: 'row gap metro-actions' },
      startBtn,
      h('button', { class: 'btn tap', onclick: () => { const t = tapTempo(); if (t) metronome.setBpm(t); } }, 'Tap')),
    logBtn,
    h('div', { class: 'card options' },
      h('div', { class: 'option' }, h('span', null, 'Beats per bar'),
        h('div', { class: 'row gap' },
          h('button', { class: 'btn step', 'aria-label': 'Fewer beats', onclick: () => metronome.set({ beats: Math.max(1, metronome.beats - 1) }) }, '−'),
          beatsEl,
          h('button', { class: 'btn step', 'aria-label': 'More beats', onclick: () => metronome.set({ beats: Math.min(12, metronome.beats + 1) }) }, '+'))),
      h('div', { class: 'option col' }, h('span', null, 'Look'), styleSeg),
      h('div', { class: 'option col' }, h('span', null, 'Clicks'), subSeg),
      h('label', { class: 'option' }, h('span', null, 'Accent the first beat'), accentBox),
      h('label', { class: 'option' }, h('span', null, 'Volume'), volume))
  );
  drawContext();
  draw();

  return () => {
    off();
    face.off();
    document.removeEventListener('keydown', onKey);
    if (section && section.lastBpm !== metronome.bpm) {
      section.lastBpm = metronome.bpm;
      store.saveItem(item);
    }
  };
}
