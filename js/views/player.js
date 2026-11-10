import * as store from '../store.js';
import { h, icon, sheet, field, toast } from '../dom.js';
import { keepAwake } from '../metronome.js';
import { openLogSheet } from '../log.js';

// The tab player: a scrolling tab with synthesized playback, built on alphaTab.

let alphaTabLoading = null;
function loadAlphaTab() {
  if (window.alphaTab) return Promise.resolve(window.alphaTab);
  if (!alphaTabLoading) {
    alphaTabLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'vendor/alphatab/alphaTab.min.js';
      script.onload = () => resolve(window.alphaTab);
      script.onerror = () => {
        alphaTabLoading = null;
        reject(new Error('The tab player could not be loaded. Check your connection and try again.'));
      };
      document.head.append(script);
    });
  }
  return alphaTabLoading;
}

function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  return {
    mainGlyphColor: v('--tab-ink'),
    secondaryGlyphColor: v('--tab-ink-soft'),
    staffLineColor: v('--tab-line'),
    barSeparatorColor: v('--tab-bar'),
    barNumberColor: v('--accent'),
    scoreInfoColor: v('--tab-ink'),
  };
}

export async function render(root, { id }) {
  const hit = store.findFile(id);
  const data = hit ? await store.getFileData(id) : null;
  if (!hit || !data) {
    root.append(h('div', { class: 'empty' }, h('h2', null, 'That tab is no longer on this device'), h('a', { class: 'btn', href: '#/' }, 'Back to the practice list')));
    return null;
  }
  const { item, file } = hit;
  const alphaTab = await loadAlphaTab();
  const prefs = Object.assign({ track: 0, speed: 1, scale: window.innerWidth < 600 ? 0.8 : 1, notation: false, click: false, countIn: true }, await store.getSetting(`player:${id}`, {}));
  const savePrefs = () => store.setSetting(`player:${id}`, prefs);

  const state = { score: null, ready: false, playing: false, tempo: null, loop: null, bar: 1, destroyed: false };

  // ---- layout ----
  root.classList.add('player-view');
  const subtitle = h('div', { class: 'muted small clip' }, 'Loading…');
  const tracksBtn = h('button', { class: 'btn ghost icon-btn', 'aria-label': 'Tracks', disabled: true, onclick: openTracks }, icon('tracks'));
  const moreBtn = h('button', { class: 'btn ghost icon-btn', 'aria-label': 'View and sound options', onclick: openOptions }, icon('more'));
  const top = h('header', { class: 'player-top' },
    h('a', { class: 'btn ghost icon-btn', href: `#/item/${item.id}`, 'aria-label': `Back to ${item.title}` }, icon('back')),
    h('div', { class: 'grow head-title' }, h('div', { class: 'player-title clip' }, item.title), subtitle),
    tracksBtn, moreBtn);

  const atEl = h('div', { class: 'at-surface' });
  const overlay = h('div', { class: 'player-overlay' }, h('div', { class: 'spinner' }), h('div', { class: 'muted' }, 'Drawing the tab…'));
  const viewport = h('div', { class: 'player-viewport' }, atEl, overlay);

  const playBtn = h('button', { class: 'btn primary play', 'aria-label': 'Play', disabled: true, onclick: () => api.playPause() }, icon('play', 28));
  const restartBtn = h('button', { class: 'btn ghost icon-btn', 'aria-label': 'Back to the start', disabled: true, onclick: () => api.stop() }, icon('restart', 24));
  const speedLabel = h('button', { class: 'speed-label', 'aria-label': 'Reset speed to 100%', onclick: () => setSpeed(1) });
  const loopBtn = h('button', { class: 'btn ghost icon-btn loop-btn', 'aria-label': 'Loop a range of bars', disabled: true, onclick: openLoop }, icon('loop', 24));
  const logBtn = h('button', { class: 'btn ghost icon-btn', 'aria-label': 'Log this tempo', disabled: true, onclick: logTempo }, icon('check', 24));
  const controls = h('footer', { class: 'player-controls' },
    restartBtn, playBtn,
    h('div', { class: 'speed' },
      h('button', { class: 'btn step', 'aria-label': 'Slower', onclick: () => setSpeed(prefs.speed - 0.05) }, '−'),
      speedLabel,
      h('button', { class: 'btn step', 'aria-label': 'Faster', onclick: () => setSpeed(prefs.speed + 0.05) }, '+')),
    loopBtn, logBtn);

  root.append(top, viewport, controls);

  // ---- alphaTab ----
  const base = (path) => new URL(path, document.baseURI).href;
  const api = new alphaTab.AlphaTabApi(atEl, {
    core: {
      fontDirectory: base('vendor/alphatab/font/'),
      scriptFile: base('vendor/alphatab/alphaTab.min.js'),
    },
    display: {
      scale: prefs.scale,
      layoutMode: alphaTab.LayoutMode.Page,
      staveProfile: prefs.notation ? alphaTab.StaveProfile.ScoreTab : alphaTab.StaveProfile.Tab,
      resources: themeColors(),
    },
    notation: { rhythmMode: alphaTab.TabRhythmMode.ShowWithBars },
    player: {
      playerMode: alphaTab.PlayerMode.EnabledSynthesizer,
      soundFont: base('vendor/alphatab/soundfont/sonivox.sf2'),
      scrollElement: viewport,
      scrollOffsetY: -24,
      enableCursor: true,
      enableUserInteraction: true,
    },
  });
  api.playbackSpeed = prefs.speed;
  api.metronomeVolume = prefs.click ? 1 : 0;
  api.countInVolume = prefs.countIn ? 1 : 0;

  function fail(message) {
    overlay.hidden = false;
    overlay.replaceChildren(h('h2', null, 'This file couldn’t be opened'), h('p', { class: 'muted' }, message),
      h('a', { class: 'btn', href: `#/item/${item.id}` }, `Back to ${item.title}`));
  }

  api.error.on((e) => {
    console.error(e);
    if (!state.score) fail('It may not be a Guitar Pro or MusicXML file, or it may be damaged. Try downloading it again.');
  });

  api.scoreLoaded.on((score) => {
    state.score = score;
    state.tempo = score.tempo;
    if (prefs.track >= score.tracks.length) prefs.track = 0;
    tracksBtn.disabled = score.tracks.length < 1;
    loopBtn.disabled = false;
    logBtn.disabled = false;
    drawStatus();
  });

  api.renderFinished.on(() => {
    overlay.hidden = true;
    if (state.loop) highlightLoop();
  });

  api.playerReady.on(() => {
    state.ready = true;
    playBtn.disabled = false;
    restartBtn.disabled = false;
    drawStatus();
  });

  api.playerStateChanged.on((e) => {
    state.playing = e.state === alphaTab.synth.PlayerState.Playing;
    playBtn.replaceChildren(icon(state.playing ? 'pause' : 'play', 28));
    playBtn.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
    keepAwake(state.playing);
  });

  api.playerPositionChanged.on((e) => {
    if (e.originalTempo) state.tempo = e.originalTempo;
    const bar = barAtTick(e.currentTick);
    if (bar !== state.bar) {
      state.bar = bar;
      drawStatus();
    }
  });

  function barAtTick(tick) {
    const bars = state.score ? state.score.masterBars : [];
    let n = 1;
    for (let i = 0; i < bars.length; i++) {
      if (bars[i].start <= tick) n = i + 1;
      else break;
    }
    return n;
  }

  function currentTrack() {
    return state.score.tracks[prefs.track] || state.score.tracks[0];
  }

  function drawStatus() {
    const pct = Math.round(prefs.speed * 100);
    const bpm = state.tempo ? Math.round(state.tempo * prefs.speed) : null;
    speedLabel.replaceChildren(h('span', { class: 'num' }, `${pct}%`), bpm ? h('span', { class: 'muted small' }, `${bpm} bpm`) : null);
    loopBtn.classList.toggle('active', !!state.loop);
    if (!state.score) return;
    const parts = [currentTrack().name || 'Track 1', `bar ${state.bar} of ${state.score.masterBars.length}`];
    if (state.loop) parts.push(`looping ${state.loop.from} to ${state.loop.to}`);
    if (!state.ready) parts.push('loading sounds…');
    subtitle.textContent = parts.join(' · ');
  }

  function setSpeed(value) {
    prefs.speed = Math.max(0.25, Math.min(1.5, Math.round(value * 20) / 20));
    api.playbackSpeed = prefs.speed;
    savePrefs();
    drawStatus();
  }

  // ---- looping ----
  function highlightLoop() {
    try {
      const bars = currentTrack().staves[0].bars;
      const first = bars[state.loop.from - 1].voices[0].beats[0];
      const lastBeats = bars[state.loop.to - 1].voices[0].beats;
      api.highlightPlaybackRange(first, lastBeats[lastBeats.length - 1]);
    } catch (e) {
      /* the highlight is cosmetic; the range below is what matters */
    }
  }

  function setLoop(from, to) {
    const mbs = state.score.masterBars;
    from = Math.max(1, Math.min(mbs.length, from));
    to = Math.max(from, Math.min(mbs.length, to));
    state.loop = { from, to };
    const end = mbs[to - 1];
    api.playbackRange = { startTick: mbs[from - 1].start, endTick: end.start + end.calculateDuration() };
    api.isLooping = true;
    highlightLoop();
    drawStatus();
  }

  function clearLoop() {
    state.loop = null;
    api.playbackRange = null;
    api.isLooping = false;
    try { api.clearPlaybackRangeHighlight(); } catch (e) { /* older builds */ }
    drawStatus();
  }

  function openLoop() {
    const total = state.score.masterBars.length;
    sheet('Loop a range of bars', (body, close) => {
      const from = h('input', { type: 'number', inputMode: 'numeric', min: 1, max: total, value: state.loop ? state.loop.from : state.bar });
      const to = h('input', { type: 'number', inputMode: 'numeric', min: 1, max: total, value: state.loop ? state.loop.to : Math.min(total, state.bar + 3) });
      body.append(h('form', {
        class: 'stack',
        onsubmit: (e) => {
          e.preventDefault();
          setLoop(Number(from.value) || 1, Number(to.value) || Number(from.value) || 1);
          close();
        },
      },
        h('p', { class: 'muted small' }, `This tab has ${total} bars. Playback is at bar ${state.bar}.`),
        h('div', { class: 'row gap' }, field('From bar', from), field('To bar', to)),
        h('div', { class: 'row end gap' },
          state.loop ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { clearLoop(); close(); } }, 'Stop looping') : null,
          h('button', { class: 'btn primary', type: 'submit' }, 'Loop these bars'))
      ));
    });
  }

  // ---- tracks ----
  function openTracks() {
    sheet('Tracks', (body, close) => {
      const muted = state.muted || (state.muted = new Set());
      const draw = () => {
        body.replaceChildren(h('ul', { class: 'plain tracks' }, state.score.tracks.map((track, i) =>
          h('li', { class: i === prefs.track ? 'on' : '' },
            h('button', {
              class: 'track-pick grow',
              'aria-pressed': i === prefs.track ? 'true' : 'false',
              onclick: () => {
                prefs.track = i;
                savePrefs();
                overlay.hidden = false;
                api.renderTracks([track]);
                drawStatus();
                close();
              },
            }, h('span', { class: 'track-name' }, track.name || `Track ${i + 1}`), i === prefs.track ? h('span', { class: 'muted small' }, 'showing') : null),
            h('button', {
              class: 'btn small' + (muted.has(i) ? ' on' : ''), 'aria-pressed': muted.has(i) ? 'true' : 'false',
              onclick: () => {
                if (muted.has(i)) muted.delete(i);
                else muted.add(i);
                api.changeTrackMute([track], muted.has(i));
                draw();
              },
            }, muted.has(i) ? 'Muted' : 'Mute')))),
          h('p', { class: 'muted small' }, 'Tap a track to show its tab. Mute your own part to play along with the rest.'));
      };
      draw();
    });
  }

  // ---- view and sound options ----
  function rerender() {
    overlay.hidden = false;
    api.updateSettings();
    api.render();
  }

  function openOptions() {
    sheet('View and sound', (body) => {
      const toggle = (label, key, apply) => {
        const box = h('input', { type: 'checkbox', checked: prefs[key], onchange: () => { prefs[key] = box.checked; savePrefs(); apply(); } });
        return h('label', { class: 'option' }, h('span', null, label), box);
      };
      const sizeLabel = h('span', { class: 'num' }, `${Math.round(prefs.scale * 100)}%`);
      const zoom = (d) => {
        prefs.scale = Math.max(0.5, Math.min(1.6, Math.round((prefs.scale + d) * 10) / 10));
        sizeLabel.textContent = `${Math.round(prefs.scale * 100)}%`;
        api.settings.display.scale = prefs.scale;
        savePrefs();
        rerender();
      };
      body.append(h('div', { class: 'card options flat' },
        h('div', { class: 'option' }, h('span', null, 'Tab size'),
          h('div', { class: 'row gap' },
            h('button', { class: 'btn step', 'aria-label': 'Smaller', onclick: () => zoom(-0.1) }, '−'), sizeLabel,
            h('button', { class: 'btn step', 'aria-label': 'Larger', onclick: () => zoom(0.1) }, '+'))),
        toggle('Show standard notation above the tab', 'notation', () => {
          api.settings.display.staveProfile = prefs.notation ? alphaTab.StaveProfile.ScoreTab : alphaTab.StaveProfile.Tab;
          rerender();
        }),
        toggle('Metronome click during playback', 'click', () => { api.metronomeVolume = prefs.click ? 1 : 0; }),
        toggle('Count in before playing', 'countIn', () => { api.countInVolume = prefs.countIn ? 1 : 0; })));
    });
  }

  function logTempo() {
    const bpm = Math.round((state.tempo || 80) * prefs.speed);
    openLogSheet({ itemId: item.id, bpm, suggestName: state.loop ? `Bars ${state.loop.from} to ${state.loop.to}` : '' });
  }

  const onKey = (e) => {
    if (e.target.closest('input, textarea, select, button, a') || document.querySelector('.backdrop')) return;
    if (e.code === 'Space') { e.preventDefault(); if (state.ready) api.playPause(); }
  };
  document.addEventListener('keydown', onKey);

  drawStatus();
  try {
    if (file.kind === 'tex') api.tex(new TextDecoder().decode(data), [prefs.track]);
    else api.load(new Uint8Array(data), [prefs.track]);
  } catch (e) {
    console.error(e);
    fail('It may not be a Guitar Pro or MusicXML file, or it may be damaged.');
  }

  return () => {
    state.destroyed = true;
    document.removeEventListener('keydown', onKey);
    keepAwake(false);
    try { api.destroy(); } catch (e) { /* already gone */ }
  };
}
