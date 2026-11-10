import * as store from '../store.js';
import { h, toast, downloadBlob, pickFile, shortDate } from '../dom.js';
import { addDemo } from '../demo.js';
import { APP_VERSION } from '../version.js';

export async function render(root) {
  const lastBackup = await store.getSetting('lastBackupAt');
  const backupNote = h('p', { class: 'muted small' }, lastBackup ? `Last backup saved ${shortDate(lastBackup)}.` : 'No backup saved yet.');

  let persisted = null;
  if (navigator.storage && navigator.storage.persisted) persisted = await navigator.storage.persisted();
  const storageNote = h('p', { class: 'muted small' });
  const drawStorage = () => {
    storageNote.textContent = persisted
      ? 'This device has been asked to keep your data even when storage runs low.'
      : 'Browsers can clear a site’s data when the device runs low on space. Installing the app to your home screen, and saving a backup now and then, protects against that.';
  };
  drawStorage();

  root.append(
    h('header', { class: 'page-head' }, h('h1', null, 'Settings')),

    h('section', { class: 'group' },
      h('h2', { class: 'group-title' }, 'Backup and moving devices'),
      h('div', { class: 'card pad stack' },
        h('p', null, 'Everything lives on this device. A backup file holds your whole list, tempo history and uploaded tabs. To move to a new phone or tablet, save a backup here and load it there.'),
        h('div', { class: 'row gap wrap' },
          h('button', {
            class: 'btn primary',
            onclick: async () => {
              const backup = await store.exportBackup();
              const stamp = new Date().toISOString().slice(0, 10);
              downloadBlob(new Blob([JSON.stringify(backup)], { type: 'application/json' }), `guitar-practice-backup-${stamp}.json`);
              await store.setSetting('lastBackupAt', backup.exportedAt);
              backupNote.textContent = `Last backup saved ${shortDate(backup.exportedAt)}.`;
              toast('Backup saved to your downloads');
            },
          }, 'Save a backup'),
          h('button', {
            class: 'btn',
            onclick: async () => {
              const file = await pickFile();
              if (!file) return;
              try {
                const count = await store.importBackup(JSON.parse(await file.text()));
                toast(`Loaded ${count} ${count === 1 ? 'item' : 'items'} from the backup`);
              } catch (e) {
                toast('That file isn’t a Guitar Practice backup');
              }
            },
          }, 'Load a backup')),
        backupNote,
        h('p', { class: 'muted small' }, 'Loading a backup adds to what is here. Where the same song exists in both, the backup’s version wins.'))),

    h('section', { class: 'group' },
      h('h2', { class: 'group-title' }, 'Storage'),
      h('div', { class: 'card pad stack' },
        storageNote,
        navigator.storage && navigator.storage.persist && !persisted
          ? h('button', {
              class: 'btn',
              onclick: async (e) => {
                persisted = await navigator.storage.persist();
                drawStorage();
                if (persisted) e.target.remove();
                else toast('The browser declined for now. Installing the app usually changes that.');
              },
            }, 'Ask this device to keep my data')
          : null)),

    h('section', { class: 'group' },
      h('h2', { class: 'group-title' }, 'Finding tabs'),
      h('div', { class: 'card pad stack' },
        h('p', null, 'The player reads Guitar Pro files (.gp, .gp3, .gp4, .gp5, .gpx) and MusicXML. Tab sites that offer a "Guitar Pro" version of a song usually have a download button for the file. Save it to this device, then add it to a song with the File button.'),
        h('p', { class: 'muted small' }, 'PDFs and photos of paper tabs work too. They open as pages with a metronome, without playback.'),
        h('div', null, h('button', {
          class: 'btn',
          onclick: async () => {
            const item = await addDemo();
            toast('Demo exercise added');
            location.hash = `#/item/${item.id}`;
          },
        }, 'Add the demo exercise')))),

    h('p', { class: 'muted small pad' }, `Guitar Practice ${APP_VERSION}. Tab rendering and playback by alphaTab; PDF pages by PDF.js.`)
  );
  return null;
}
