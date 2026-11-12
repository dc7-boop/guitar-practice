import * as store from './store.js';
import { h, icon, toast, shortDate, clock } from './dom.js';

// Short recordings of an exercise, kept on the device so progress can be heard later.

const MAX_SECONDS = 30;

export function recordButton(itemId, onSaved) {
  let recorder = null;
  let timer = null;
  let started = 0;
  const label = h('span', null, 'Record a clip');
  const btn = h('button', { class: 'btn', type: 'button' }, icon('mic', 20), label);

  const stop = () => { if (recorder && recorder.state !== 'inactive') recorder.stop(); };

  btn.addEventListener('click', async () => {
    if (recorder) { stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast('This browser can’t record sound'); return; }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      toast('The microphone is blocked. Allow it in the browser’s site settings.');
      return;
    }
    const chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      const seconds = Math.round((Date.now() - started) / 1000);
      const mime = recorder.mimeType || 'audio/webm';
      recorder = null;
      btn.classList.remove('recording');
      label.textContent = 'Record a clip';
      if (seconds < 1 || !chunks.length) return;
      await store.addClip(itemId, { data: await new Blob(chunks, { type: mime }).arrayBuffer(), mime, seconds });
      toast('Clip saved');
      if (onSaved) onSaved();
    };
    started = Date.now();
    recorder.start();
    btn.classList.add('recording');
    const draw = () => {
      const s = (Date.now() - started) / 1000;
      label.textContent = `Stop · ${clock(s)}`;
      if (s >= MAX_SECONDS) stop();
    };
    draw();
    timer = setInterval(draw, 250);
  });

  return { el: btn, stop };
}

// The saved clips for one exercise, newest first, each with a play button.
export function clipList(item) {
  if (!item.clips || !item.clips.length) return h('p', { class: 'muted hint' }, 'No clips yet. Record twenty seconds now and then, and listen back in a month.');
  let playing = null;
  return h('ul', { class: 'plain history' }, item.clips.slice().reverse().map((clip) => {
    const play = h('button', { class: 'btn small', onclick: async () => {
      if (playing) { playing.pause(); playing = null; }
      const data = await store.getFileData(clip.id);
      if (!data) { toast('That clip is no longer on this device'); return; }
      const url = URL.createObjectURL(new Blob([data], { type: clip.mime }));
      playing = new Audio(url);
      playing.onended = () => URL.revokeObjectURL(url);
      playing.play().catch(() => toast('Could not play that clip'));
    } }, icon('play', 16), 'Play');
    return h('li', null,
      h('span', { class: 'num' }, shortDate(clip.t)),
      h('span', { class: 'muted small grow' }, `${clip.seconds} seconds`),
      play,
      h('button', { class: 'btn ghost icon-btn', 'aria-label': `Delete the clip from ${shortDate(clip.t)}`, onclick: () => store.deleteClip(item.id, clip.id) }, icon('trash', 18)));
  }));
}
