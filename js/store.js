// Data layer. Everything lives in IndexedDB on this device.
//   items  — songs and exercises, with their sections, BPM logs, links and file metadata
//   files  — the uploaded file contents (ArrayBuffer), keyed by file id
//   kv     — small settings

const DB_NAME = 'guitar-practice';
const DB_VERSION = 1;

let dbPromise = null;
let items = [];
const listeners = new Set();

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Records written by older versions are filled in here, never rewritten on disk until next saved.
function normalize(rec) {
  if (rec.type === 'song' || rec.type === 'exercise') {
    if (!rec.activity) rec.activity = rec.status === 'shelved' ? 'shelved' : rec.status === 'maintaining' ? 'rotation' : 'active';
    if (rec.type === 'song' && !rec.goal) rec.goal = 'recording';
    rec.sections = rec.sections || [];
    rec.links = rec.links || [];
    rec.files = rec.files || [];
    rec.clips = rec.clips || [];
    rec.transitions = rec.transitions || {};
    for (const s of rec.sections) {
      s.log = s.log || [];
      s.ratings = s.ratings || [];
    }
  }
  if (rec.type === 'change') rec.ratings = rec.ratings || [];
  return rec;
}

export async function init() {
  items = ((await tx('items', 'readonly', (s) => s.getAll())) || []).map(normalize);
}

// Songs and exercises. Chord changes and past sessions share the store but have their own getters.
export function getItems() {
  return items.filter((i) => i.type === 'song' || i.type === 'exercise');
}

export function getChanges() {
  return items.filter((i) => i.type === 'change').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getSessions() {
  return items.filter((i) => i.type === 'session').sort((a, b) => a.t.localeCompare(b.t));
}

export async function addChange(title) {
  return saveItem({ id: uid(), type: 'change', title, rating: null, ratings: [], createdAt: new Date().toISOString() });
}

export async function removeRecord(id) {
  items = items.filter((i) => i.id !== id);
  await tx('items', 'readwrite', (s) => s.delete(id));
  emit();
}

// ---- ratings: rough, ok, clean ----

export const RATINGS = [['rough', 'Rough'], ['ok', 'Okay'], ['clean', 'Clean']];

// target is anything that carries { rating, ratings[] }: a section, a transition, a chord change.
export function setRating(target, rating) {
  target.rating = rating;
  (target.ratings = target.ratings || []).push({ t: new Date().toISOString(), r: rating });
}

// ---- song maps ----

// The order the sections are played in. Without a saved order, it is the section list itself.
export function songForm(item) {
  const ids = new Set(item.sections.map((s) => s.id));
  const form = (item.form || []).filter((id) => ids.has(id));
  return form.length ? form : item.sections.map((s) => s.id);
}

// Each distinct move from one section to a different one, in the order it first happens.
export function songTransitions(item) {
  const form = songForm(item);
  const seen = new Set();
  const out = [];
  for (let i = 0; i < form.length - 1; i++) {
    const key = `${form[i]}>${form[i + 1]}`;
    if (form[i] === form[i + 1] || seen.has(key)) continue;
    seen.add(key);
    const from = item.sections.find((s) => s.id === form[i]);
    const to = item.sections.find((s) => s.id === form[i + 1]);
    item.transitions[key] = item.transitions[key] || { rating: null, ratings: [] };
    out.push({ key, from, to, state: item.transitions[key] });
  }
  return out;
}

export function getItem(id) {
  return items.find((i) => i.id === id) || null;
}

export function findFile(fileId) {
  for (const item of items) {
    const file = (item.files || []).find((f) => f.id === fileId);
    if (file) return { item, file };
  }
  return null;
}

export async function saveItem(item) {
  item.updatedAt = new Date().toISOString();
  const i = items.findIndex((x) => x.id === item.id);
  if (i >= 0) items[i] = item;
  else items.push(item);
  await tx('items', 'readwrite', (s) => s.put(item));
  emit();
  return item;
}

export function newItem({ type = 'song', title, artist = '' }) {
  return {
    id: uid(),
    type,
    title,
    artist,
    status: 'learning',
    activity: 'active',
    goal: type === 'song' ? 'recording' : undefined,
    warmup: false,
    notes: '',
    sections: [],
    form: [],
    transitions: {},
    links: [],
    files: [],
    clips: [],
    createdAt: new Date().toISOString(),
    lastPracticedAt: null,
  };
}

export async function deleteItem(id) {
  const item = getItem(id);
  if (!item) return;
  for (const f of [...(item.files || []), ...(item.clips || [])]) await tx('files', 'readwrite', (s) => s.delete(f.id));
  items = items.filter((i) => i.id !== id);
  await tx('items', 'readwrite', (s) => s.delete(id));
  emit();
}

// ---- sections and the BPM log ----

export async function addSection(itemId, { name, targetBpm = null }) {
  const item = getItem(itemId);
  const section = { id: uid(), name, targetBpm, log: [], lastBpm: null, rating: null, ratings: [] };
  item.sections.push(section);
  await saveItem(item);
  return section;
}

export async function logBpm(itemId, sectionId, bpm, note = '') {
  const item = getItem(itemId);
  const section = item.sections.find((s) => s.id === sectionId);
  const now = new Date().toISOString();
  section.log.push({ t: now, bpm: Math.round(bpm), note });
  section.lastBpm = Math.round(bpm);
  item.lastPracticedAt = now;
  await saveItem(item);
}

export function sectionStats(section) {
  const log = section.log || [];
  const current = log.length ? log[log.length - 1].bpm : null;
  const best = log.length ? Math.max(...log.map((e) => e.bpm)) : null;
  const first = log.length ? log[0].bpm : null;
  const progress = section.targetBpm && current ? Math.min(1, current / section.targetBpm) : null;
  return { current, best, first, progress, count: log.length };
}

// ---- files ----

const GP_EXT = ['gp', 'gp3', 'gp4', 'gp5', 'gpx', 'gp7', 'xml', 'musicxml', 'mxl', 'cap', 'capx'];
const TEX_EXT = ['tex', 'alphatex', 'atex'];
const IMG_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'avif'];

export function fileKind(name, mime = '') {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (GP_EXT.includes(ext)) return 'gp';
  if (TEX_EXT.includes(ext)) return 'tex';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (IMG_EXT.includes(ext) || mime.startsWith('image/')) return 'image';
  return null;
}

export async function addFile(itemId, { name, type = '', data }) {
  const kind = fileKind(name, type);
  if (!kind) throw new Error('unsupported');
  const item = getItem(itemId);
  const meta = { id: uid(), name, kind, type, size: data.byteLength, addedAt: new Date().toISOString() };
  await tx('files', 'readwrite', (s) => s.put({ id: meta.id, data }));
  item.files.push(meta);
  await saveItem(item);
  return meta;
}

export async function getFileData(fileId) {
  const rec = await tx('files', 'readonly', (s) => s.get(fileId));
  return rec ? rec.data : null;
}

export async function deleteFile(itemId, fileId) {
  const item = getItem(itemId);
  item.files = item.files.filter((f) => f.id !== fileId);
  await tx('files', 'readwrite', (s) => s.delete(fileId));
  await saveItem(item);
}

// ---- recorded clips ----

export async function addClip(itemId, { data, mime, seconds }) {
  const item = getItem(itemId);
  const meta = { id: uid(), t: new Date().toISOString(), mime, seconds };
  await tx('files', 'readwrite', (s) => s.put({ id: meta.id, data }));
  item.clips.push(meta);
  await saveItem(item);
  return meta;
}

export async function deleteClip(itemId, clipId) {
  const item = getItem(itemId);
  item.clips = item.clips.filter((c) => c.id !== clipId);
  await tx('files', 'readwrite', (s) => s.delete(clipId));
  await saveItem(item);
}

// ---- settings ----

export async function getSetting(key, fallback = null) {
  const v = await tx('kv', 'readonly', (s) => s.get(key));
  return v === undefined ? fallback : v;
}

export async function setSetting(key, value) {
  await tx('kv', 'readwrite', (s) => s.put(value, key));
}

// ---- backup ----

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export async function exportBackup() {
  const files = [];
  for (const item of items) {
    for (const f of [...(item.files || []), ...(item.clips || [])]) {
      const data = await getFileData(f.id);
      if (data) files.push({ id: f.id, data: bufToBase64(data) });
    }
  }
  return {
    app: 'guitar-practice',
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
    files,
  };
}

// Merges by id: anything in the backup replaces the same item here, everything else is kept.
export async function importBackup(backup) {
  if (!backup || backup.app !== 'guitar-practice' || !Array.isArray(backup.items)) {
    throw new Error('not-a-backup');
  }
  for (const f of backup.files || []) {
    await tx('files', 'readwrite', (s) => s.put({ id: f.id, data: base64ToBuf(f.data) }));
  }
  for (const item of backup.items) {
    normalize(item);
    const i = items.findIndex((x) => x.id === item.id);
    if (i >= 0) items[i] = item;
    else items.push(item);
    await tx('items', 'readwrite', (s) => s.put(item));
  }
  emit();
  return backup.items.filter((i) => i.type === 'song' || i.type === 'exercise').length;
}
