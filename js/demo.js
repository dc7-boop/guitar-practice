import * as store from './store.js';

// A small original exercise written in alphaTex, so the tab player can be tried
// before any Guitar Pro file has been uploaded.
const DEMO_TEX = `\\title "A minor pentatonic run"
\\subtitle "Demo exercise"
\\tempo 80
.
\\track "Guitar"
\\staff {tabs}
\\tuning E4 B3 G3 D3 A2 E2
:8 5.6 8.6 5.5 7.5 5.4 7.4 5.3 7.3 |
5.2 8.2 5.1 8.1 5.1 8.1 5.2 8.2 |
7.3 5.3 7.4 5.4 7.5 5.5 8.6 5.6 |
:4 5.6 5.4 :2 7.4 |
:8 5.6 8.6 5.5 7.5 5.4 7.4 5.3 7.3 |
5.2 8.2 5.1 8.1 5.1 8.1 5.2 8.2 |
7.3 5.3 7.4 5.4 7.5 5.5 8.6 5.6 |
:1 5.6
`;

export async function addDemo() {
  const item = store.newItem({ type: 'exercise', title: 'A minor pentatonic run (demo)' });
  item.notes = 'A demo so you can try the tab player and the tempo log. Delete it whenever you like.';
  item.sections.push({ id: store.uid(), name: 'Whole run', targetBpm: 120, log: [], lastBpm: 80 });
  await store.saveItem(item);
  const data = new TextEncoder().encode(DEMO_TEX).buffer;
  await store.addFile(item.id, { name: 'pentatonic-run.alphatex', type: 'text/plain', data });
  return store.getItem(item.id);
}
