import * as store from './store.js';
import { h, sheet, field, toast } from './dom.js';

// "Log a tempo" sheet, used from the metronome, the tab player and the page viewer.
// itemId is optional: with it the song is fixed, without it you choose one.
export function openLogSheet({ itemId = null, sectionId = null, bpm = 80, suggestName = '', onDone = null } = {}) {
  const items = store.getItems().filter((i) => i.status !== 'shelved' || i.id === itemId);
  if (!items.length) {
    toast('Add a song or exercise first');
    return;
  }
  sheet('Log a clean tempo', (body, close) => {
    const NEW = '__new__';
    let currentItem = store.getItem(itemId) || items[0];

    const itemSelect = h('select', { onchange: () => { currentItem = store.getItem(itemSelect.value); fillSections(); } },
      items.map((i) => h('option', { value: i.id, selected: i.id === currentItem.id }, i.title)));
    const sectionSelect = h('select', { onchange: () => syncNew() });
    const newName = h('input', { type: 'text', placeholder: 'e.g. Intro, Solo, Bars 9 to 16', value: suggestName });
    const newTarget = h('input', { type: 'number', inputMode: 'numeric', min: 30, max: 300, placeholder: 'optional' });
    const newFields = h('div', { class: 'stack' }, field('New section name', newName), field('Target tempo (bpm)', newTarget));
    const bpmInput = h('input', { type: 'number', inputMode: 'numeric', min: 30, max: 300, value: Math.round(bpm) });
    const note = h('input', { type: 'text', placeholder: 'optional, e.g. "still tense in bar 3"' });

    function fillSections() {
      sectionSelect.replaceChildren(
        ...currentItem.sections.map((s) => h('option', { value: s.id }, s.name)),
        h('option', { value: NEW }, 'New section…')
      );
      const wanted = sectionId && currentItem.sections.some((s) => s.id === sectionId) ? sectionId : null;
      sectionSelect.value = wanted || (suggestName || !currentItem.sections.length ? NEW : currentItem.sections[0].id);
      syncNew();
    }
    function syncNew() {
      newFields.hidden = sectionSelect.value !== NEW;
    }
    fillSections();

    const form = h('form', {
      class: 'stack',
      onsubmit: async (e) => {
        e.preventDefault();
        const value = Number(bpmInput.value);
        if (!value || value < 20 || value > 400) {
          bpmInput.focus();
          return;
        }
        let sid = sectionSelect.value;
        if (sid === NEW) {
          const name = newName.value.trim();
          if (!name) {
            newName.focus();
            return;
          }
          const section = await store.addSection(currentItem.id, { name, targetBpm: Number(newTarget.value) || null });
          sid = section.id;
        }
        await store.logBpm(currentItem.id, sid, value, note.value.trim());
        close();
        toast(`Logged ${Math.round(value)} bpm`);
        if (onDone) onDone();
      },
    },
      itemId ? null : field('Song or exercise', itemSelect),
      field('Section', sectionSelect),
      newFields,
      field('Tempo you played cleanly (bpm)', bpmInput),
      field('Note', note),
      h('div', { class: 'row end' }, h('button', { class: 'btn primary', type: 'submit' }, 'Log it'))
    );
    body.append(form);
  });
}
