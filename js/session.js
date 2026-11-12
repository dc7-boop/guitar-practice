import * as store from './store.js';

// Today's practice session: a checklist of timed blocks, kept in settings until it is finished,
// then filed as a 'session' record so the stats can count it.

let current = null;
const day = (d = new Date()) => new Date(d).toLocaleDateString('en-CA');
export const dayKey = day;

export async function load() {
  current = await store.getSetting('session', null);
  // A board left over from another day is filed as it stands.
  if (current && day(current.startedAt) !== day()) await finish();
  return current;
}

export function get() {
  return current;
}

async function persist() {
  await store.setSetting('session', current);
}

const byOldest = (a, b) => (a.lastPracticedAt || '').localeCompare(b.lastPracticedAt || '');

function block(kind, ref, title, minutes, extra = {}) {
  return { id: store.uid(), kind, ref, title, minutes, spent: 0, done: false, rating: null, ...extra };
}

export function rotationPool() {
  return store.getItems().filter((i) => i.type === 'song' && i.activity === 'rotation').sort(byOldest);
}

export async function start(length) {
  // Oldest first, so the board keeps the order things were added in.
  const items = store.getItems().filter((i) => i.activity !== 'shelved').sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const blocks = [];
  for (const i of items.filter((x) => x.type === 'exercise' && x.warmup)) blocks.push(block('exercise', i.id, i.title, 5));
  for (const i of items.filter((x) => x.type === 'song' && x.activity === 'active')) blocks.push(block('song', i.id, i.title, length >= 60 ? 10 : 5));
  for (const i of items.filter((x) => x.type === 'exercise' && !x.warmup && x.kind !== 'improv' && x.activity === 'active')) blocks.push(block('exercise', i.id, i.title, 5));
  blocks.push(block('changes', null, 'Chord changes', 5));
  if (length >= 60) {
    const improv = items.find((x) => x.kind === 'improv');
    blocks.push(block('improv', improv ? improv.id : null, improv ? improv.title : 'Improvisation', 10));
    const rot = rotationPool()[0];
    if (rot) blocks.push(block('song', rot.id, rot.title, 5, { rotation: true }));
  }
  current = { id: store.uid(), length, startedAt: new Date().toISOString(), blocks };
  await persist();
  return current;
}

export function getBlock(id) {
  return current ? current.blocks.find((b) => b.id === id) : null;
}

export async function update(blockId, props) {
  const b = getBlock(blockId);
  if (!b) return;
  Object.assign(b, props);
  await persist();
}

// Swap the rotation song for the next one in line.
export async function swapRotation(blockId) {
  const b = getBlock(blockId);
  const pool = rotationPool();
  if (!b || pool.length < 2) return false;
  const next = pool[(pool.findIndex((i) => i.id === b.ref) + 1) % pool.length];
  Object.assign(b, { ref: next.id, title: next.title, spent: 0, done: false, rating: null });
  await persist();
  return true;
}

export async function complete(blockId, rating) {
  const b = getBlock(blockId);
  if (!b) return;
  b.done = true;
  if (rating) b.rating = rating;
  const item = b.ref ? store.getItem(b.ref) : null;
  if (item) {
    item.lastPracticedAt = new Date().toISOString();
    await store.saveItem(item);
  }
  await persist();
}

export function minutesOf(blocks) {
  return Math.round(blocks.reduce((a, b) => a + (b.spent > 0 ? b.spent / 60 : b.done ? b.minutes : 0), 0));
}

export async function finish() {
  if (!current) return;
  const touched = current.blocks.filter((b) => b.done || b.spent > 0);
  if (touched.length) {
    await store.saveItem({
      id: current.id, type: 'session', t: current.startedAt, length: current.length, minutes: minutesOf(touched),
      blocks: touched.map(({ kind, ref, title, minutes, spent, done, rating }) => ({ kind, ref, title, minutes, spent, done, rating })),
    });
  }
  current = null;
  await store.setSetting('session', null);
}

export async function discard() {
  current = null;
  await store.setSetting('session', null);
}

// ---- numbers for the board and the stats screen ----

export function summary() {
  const sessions = store.getSessions();
  const days = new Set(sessions.map((s) => day(s.t)));
  let streak = 0;
  const d = new Date();
  if (!days.has(day(d))) d.setDate(d.getDate() - 1);
  while (days.has(day(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  const weekAgo = Date.now() - 7 * 86400000;
  const week = sessions.filter((s) => new Date(s.t).getTime() > weekAgo).reduce((a, s) => a + (s.minutes || 0), 0);
  const total = sessions.reduce((a, s) => a + (s.minutes || 0), 0);
  return { streak, week, total, count: sessions.length, sessions };
}
