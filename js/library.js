import * as store from './store.js';

// Built-in songs and exercises. Each is added once; anything deleted on the device stays deleted.
// Songs carry only an outline: section names, bar counts, and the order they are played in.

const P = (name, bars) => ({ name, bars });

const LIBRARY = [
  { id: 'lib:pentatonic', type: 'exercise', title: 'Pentatonic scale', warmup: true,
    parts: [P('Whole scale')] },
  { id: 'lib:major', type: 'exercise', title: 'Major scale', warmup: true,
    parts: [P('Whole scale')] },
  { id: 'lib:improv', type: 'exercise', title: 'Improvisation', kind: 'improv',
    notes: '12-bar blues, 3-2 method: one octave of the pentatonic scale.', parts: [] },
  { id: 'lib:say-it-aint-so', type: 'song', title: 'Say It Ain’t So', artist: 'Weezer', goal: 'recording', tempo: 76,
    notes: 'Tuned down a half step.',
    link: 'https://www.songsterr.com/a/wsa/weezer-say-it-aint-so-tab-s10122',
    parts: [P('Intro', '8'), P('Verse', '6 to 8'), P('Interlude', '4'), P('Chorus', '8'), P('Bridge', '10'), P('Solo', '6'), P('Outro', '5')],
    form: ['Intro', 'Verse', 'Interlude', 'Verse', 'Chorus', 'Interlude', 'Verse', 'Chorus', 'Bridge', 'Solo', 'Chorus', 'Outro'] },
  { id: 'lib:about-a-girl', type: 'song', title: 'About a Girl', artist: 'Nirvana', goal: 'recording', tempo: 131,
    link: 'https://www.songsterr.com/a/wsa/nirvana-about-a-girl-tab-s29',
    parts: [P('Intro', '8'), P('Verse', '8'), P('Chorus', '6'), P('Post-chorus', '4'), P('Solo', '8'), P('Interlude', '6'), P('Bridge', '3 and a half'), P('Outro', '12')],
    form: ['Intro', 'Verse', 'Chorus', 'Post-chorus', 'Verse', 'Chorus', 'Post-chorus', 'Solo', 'Interlude', 'Post-chorus', 'Verse', 'Chorus', 'Bridge', 'Outro'] },
  { id: 'lib:plush', type: 'song', title: 'Plush', artist: 'Stone Temple Pilots', goal: 'recording', tempo: 73,
    link: 'https://www.songsterr.com/a/wsa/stone-temple-pilots-plush-tab-s293',
    parts: [P('Intro', '8 and a half'), P('Verse', '6'), P('Pre-chorus', '4'), P('Chorus', '8'), P('Interlude', '4 and a half'), P('Post-chorus', '8'), P('Break', '8 and a half'), P('Outro', '8'), P('Ending', '4')],
    form: ['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Interlude', 'Verse', 'Pre-chorus', 'Chorus', 'Post-chorus', 'Break', 'Chorus', 'Post-chorus', 'Outro', 'Ending'] },
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function build(entry) {
  const item = store.newItem({ type: entry.type, title: entry.title, artist: entry.artist || '' });
  item.id = entry.id;
  item.warmup = !!entry.warmup;
  if (entry.kind) item.kind = entry.kind;
  if (entry.goal) item.goal = entry.goal;
  if (entry.tempo) item.tempo = entry.tempo;
  item.notes = entry.notes || '';
  item.sections = entry.parts.map((p) => ({
    id: `${entry.id}:${slug(p.name)}`, name: p.name, bars: p.bars || '', targetBpm: null, log: [], lastBpm: null, rating: null, ratings: [],
  }));
  if (entry.form) item.form = entry.form.map((name) => `${entry.id}:${slug(name)}`);
  if (entry.link) item.links.push({ id: `${entry.id}:songsterr`, url: entry.link, label: 'Songsterr tab' });
  return item;
}

export async function syncLibrary() {
  const seen = new Set(await store.getSetting('librarySeen', []));
  let added = 0;
  for (const entry of LIBRARY) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    if (!store.getItem(entry.id)) {
      await store.saveItem(build(entry));
      added++;
    }
  }
  if (added) await store.setSetting('librarySeen', [...seen]);
  return added;
}
