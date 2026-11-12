import * as store from '../store.js';
import { h, icon, sheet, confirmSheet, field, toast, ago, shortDate, sparkline, pickFile, rater } from '../dom.js';
import { GOALS, ACTIVITIES, GOAL_NOTE } from './list.js';
import { songMap, transitionList, openOrderSheet } from '../songmap.js';
import { recordButton, clipList } from '../clips.js';

const KIND_LABEL = { gp: 'Tab with playback', tex: 'Tab with playback', pdf: 'PDF', image: 'Image' };

function openSectionSheet(item, section) {
  const isNew = !section;
  sheet(isNew ? 'Add a section' : 'Edit section', (body, close) => {
    const name = h('input', { type: 'text', placeholder: 'e.g. Intro, Solo, Whole thing', value: section ? section.name : '' });
    const target = h('input', { type: 'number', inputMode: 'numeric', min: 30, max: 300, placeholder: 'optional', value: section && section.targetBpm ? section.targetBpm : '' });
    const bars = h('input', { type: 'text', placeholder: 'optional, e.g. 8', value: section && section.bars ? section.bars : '' });
    const form = h('form', {
      class: 'stack',
      onsubmit: async (e) => {
        e.preventDefault();
        if (!name.value.trim()) {
          name.focus();
          return;
        }
        if (isNew) {
          const made = await store.addSection(item.id, { name: name.value.trim(), targetBpm: Number(target.value) || null });
          made.bars = bars.value.trim();
          if (item.form && item.form.length) item.form.push(made.id);
          await store.saveItem(item);
        } else {
          section.bars = bars.value.trim();
          section.name = name.value.trim();
          section.targetBpm = Number(target.value) || null;
          await store.saveItem(item);
        }
        close();
      },
    },
      field('Name', name),
      item.type === 'song' ? field('Bars', bars) : null,
      field('Target tempo (bpm)', target, 'The tempo you are working up to. Leave blank if there isn’t one.'),
      h('div', { class: 'row end' }, h('button', { class: 'btn primary', type: 'submit' }, isNew ? 'Add section' : 'Save'))
    );
    body.append(form);

    if (!isNew) {
      const history = h('div', { class: 'stack' });
      const drawHistory = () => {
        const log = section.log.slice().reverse();
        history.replaceChildren(
          h('h3', null, 'Tempo history'),
          log.length
            ? h('ul', { class: 'plain history' }, log.map((entry) =>
                h('li', null,
                  h('span', { class: 'num' }, `${entry.bpm} bpm`),
                  h('span', { class: 'muted small grow' }, shortDate(entry.t) + (entry.note ? ` · ${entry.note}` : '')),
                  h('button', {
                    class: 'btn ghost icon-btn', 'aria-label': `Remove the ${entry.bpm} bpm entry`,
                    onclick: async () => {
                      section.log = section.log.filter((x) => x !== entry);
                      section.lastBpm = section.log.length ? section.log[section.log.length - 1].bpm : section.lastBpm;
                      await store.saveItem(item);
                      drawHistory();
                    },
                  }, icon('trash', 18))
                )))
            : h('p', { class: 'muted small' }, 'Nothing logged yet.'),
          h('button', {
            class: 'btn danger-ghost',
            onclick: () => {
              close();
              confirmSheet('Delete this section?', `"${section.name}" and its tempo history will be removed.`, 'Delete section', async () => {
                item.sections = item.sections.filter((s) => s.id !== section.id);
                await store.saveItem(item);
              });
            },
          }, 'Delete section')
        );
      };
      drawHistory();
      body.append(history);
    }
  });
}

function sectionRow(item, section) {
  const st = store.sectionStats(section);
  const tempo = st.current
    ? [h('span', { class: 'num big' }, String(st.current)), section.targetBpm ? h('span', { class: 'muted' }, ` of ${section.targetBpm} bpm`) : h('span', { class: 'muted' }, ' bpm')]
    : [h('span', { class: 'muted small' }, [section.bars ? `${section.bars} bars` : null, section.targetBpm ? `target ${section.targetBpm} bpm` : null].filter(Boolean).join(' · ') || (item.type === 'song' ? 'Tap for the metronome' : 'Nothing logged yet'))];
  return h('div', { class: 'card section-row' },
    h('a', { class: 'section-main', href: `#/metronome?item=${item.id}&section=${section.id}`, 'aria-label': `Practise ${section.name} with the metronome` },
      h('div', { class: 'section-top' }, h('span', { class: 'section-name' }, section.name), sparkline(section.log, section.targetBpm)),
      h('div', { class: 'section-tempo' }, tempo),
      st.progress != null ? h('div', { class: 'bar' }, h('div', { class: 'bar-fill' + (st.progress >= 1 ? ' done' : ''), style: { width: `${Math.round(st.progress * 100)}%` } })) : null
    ),
    item.type === 'song' ? rater(section.rating, async (r) => { store.setRating(section, r); await store.saveItem(item); }, { small: true }) : null,
    h('button', { class: 'btn ghost icon-btn', 'aria-label': `Edit ${section.name}`, onclick: () => openSectionSheet(item, section) }, icon('more'))
  );
}

function openLinkSheet(item) {
  sheet('Add a link', (body, close) => {
    const url = h('input', { type: 'text', placeholder: 'songsterr.com/…', inputMode: 'url', autocomplete: 'off', autocapitalize: 'off', spellcheck: false });
    const label = h('input', { type: 'text', placeholder: 'e.g. Songsterr tab, lesson video' });
    body.append(h('form', {
      class: 'stack',
      onsubmit: async (e) => {
        e.preventDefault();
        let value = url.value.trim();
        if (!value) {
          url.focus();
          return;
        }
        if (!/^https?:\/\//i.test(value)) value = 'https://' + value;
        let host = value;
        try { host = new URL(value).hostname.replace(/^www\./, ''); } catch (err) { /* keep raw */ }
        item.links.push({ id: store.uid(), url: value, label: label.value.trim() || host });
        await store.saveItem(item);
        close();
      },
    }, field('Address', url), field('Label', label), h('div', { class: 'row end' }, h('button', { class: 'btn primary', type: 'submit' }, 'Add link'))));
  });
}

async function uploadFile(item) {
  const file = await pickFile();
  if (!file) return;
  if (!store.fileKind(file.name, file.type)) {
    toast('That file type isn’t supported. Use Guitar Pro, MusicXML, PDF or an image.');
    return;
  }
  try {
    const data = await file.arrayBuffer();
    await store.addFile(item.id, { name: file.name, type: file.type, data });
    toast('Added');
  } catch (e) {
    toast('Could not save that file. The device may be out of space.');
  }
}

export function render(root, { id }) {
  const dynamic = h('div', { class: 'dynamic' });
  const clipRec = recordButton(id);
  clipRec.el.classList.add('small');
  const draw = () => {
    const item = store.getItem(id);
    if (!item) {
      root.replaceChildren(h('div', { class: 'empty' }, h('h2', null, 'That one is no longer on the list'), h('a', { class: 'btn', href: '#/library' }, 'Back to the library')));
      return;
    }

    const head = h('header', { class: 'page-head' },
      h('a', { class: 'btn ghost icon-btn', href: '#/library', 'aria-label': 'Back to the library' }, icon('back')),
      h('div', { class: 'grow head-title' },
        h('h1', null, item.title),
        h('div', { class: 'muted small' }, [item.type === 'song' ? item.artist || 'Song' : 'Exercise', item.lastPracticedAt ? `last practised ${ago(item.lastPracticedAt)}` : 'not yet practised'].join(' · '))
      ),
      h('button', {
        class: 'btn ghost icon-btn', 'aria-label': 'Rename',
        onclick: () => sheet('Rename', (body, close) => {
          const title = h('input', { type: 'text', value: item.title });
          const artist = h('input', { type: 'text', value: item.artist || '' });
          body.append(h('form', {
            class: 'stack',
            onsubmit: async (e) => {
              e.preventDefault();
              if (!title.value.trim()) return;
              item.title = title.value.trim();
              item.artist = artist.value.trim();
              await store.saveItem(item);
              close();
            },
          }, field('Title', title), item.type === 'song' ? field('Artist', artist) : null, h('div', { class: 'row end' }, h('button', { class: 'btn primary', type: 'submit' }, 'Save'))));
        }),
      }, icon('edit', 20))
    );

    const seg = (label, options, key) => h('div', { class: 'seg', role: 'group', 'aria-label': label },
      options.map(([value, text]) => h('button', {
        class: item[key] === value ? 'on' : '',
        onclick: async () => { item[key] = value; await store.saveItem(item); },
      }, text)));
    const isSong = item.type === 'song';
    const status = h('div', { class: 'stack tight' },
      isSong ? h('div', { class: 'field-label' }, 'Goal') : null,
      isSong ? seg('Goal', GOALS, 'goal') : null,
      isSong ? h('p', { class: 'muted small' }, GOAL_NOTE[item.goal]) : null,
      h('div', { class: 'field-label' }, 'Activity'),
      seg('Activity', ACTIVITIES, 'activity'),
      h('p', { class: 'muted small' }, item.activity === 'active' ? 'On the board every session.' : item.activity === 'rotation' ? 'Comes up now and then, so it doesn’t fade.' : 'Off the board until you bring it back.'),
      !isSong && item.kind !== 'improv' ? h('label', { class: 'option' }, h('span', null, 'Start every session with this'),
        h('input', { type: 'checkbox', checked: !!item.warmup, onchange: async (e) => { item.warmup = e.target.checked; await store.saveItem(item); } })) : null);

    const joins = isSong && item.goal !== 'casual' ? transitionList(item) : null;
    const map = isSong && item.goal !== 'casual' ? h('section', { class: 'group' },
      h('div', { class: 'group-head' }, h('h2', { class: 'group-title' }, 'Song map'),
        item.sections.length ? h('button', { class: 'btn small', onclick: () => openOrderSheet(item) }, 'Order') : null),
      songMap(item),
      joins ? h('h3', { class: 'sub' }, 'Transitions') : null,
      joins) : null;

    const clips = !isSong && item.kind !== 'improv' ? h('section', { class: 'group' },
      h('div', { class: 'group-head' }, h('h2', { class: 'group-title' }, 'Clips'), clipRec.el),
      clipList(item)) : null;

    const sections = h('section', { class: 'group' },
      h('div', { class: 'group-head' }, h('h2', { class: 'group-title' }, isSong && item.goal === 'casual' ? 'Bits' : 'Sections'), h('button', { class: 'btn small', onclick: () => openSectionSheet(item, null) }, icon('plus', 18), 'Section')),
      item.sections.length
        ? item.sections.map((s) => sectionRow(item, s))
        : h('p', { class: 'muted hint' }, 'Break it into the parts you practise separately: an intro, a solo, one hard bar. Each gets its own tempo log. One section called "Whole thing" is fine too.')
    );

    const files = h('section', { class: 'group' },
      h('div', { class: 'group-head' }, h('h2', { class: 'group-title' }, 'Tabs and links'),
        h('div', { class: 'row gap' },
          h('button', { class: 'btn small', onclick: () => uploadFile(item) }, icon('plus', 18), 'File'),
          h('button', { class: 'btn small', onclick: () => openLinkSheet(item) }, icon('plus', 18), 'Link'))),
      item.files.length || item.links.length
        ? [
            ...item.files.map((f) => h('div', { class: 'card file-row' },
              h('a', { class: 'file-main', href: f.kind === 'gp' || f.kind === 'tex' ? `#/play/${f.id}` : `#/view/${f.id}` },
                icon(f.kind === 'gp' || f.kind === 'tex' ? 'note' : 'file'),
                h('div', { class: 'grow' }, h('div', { class: 'file-name' }, f.name), h('div', { class: 'muted small' }, KIND_LABEL[f.kind])),
                icon('chevron', 18)),
              h('button', {
                class: 'btn ghost icon-btn', 'aria-label': `Remove ${f.name}`,
                onclick: () => confirmSheet('Remove this file?', `"${f.name}" will be deleted from this device.`, 'Remove', () => store.deleteFile(item.id, f.id)),
              }, icon('trash', 18)))),
            ...item.links.map((l) => h('div', { class: 'card file-row' },
              h('a', { class: 'file-main', href: l.url, target: '_blank', rel: 'noopener noreferrer' },
                icon('link'),
                h('div', { class: 'grow' }, h('div', { class: 'file-name' }, l.label), h('div', { class: 'muted small clip' }, l.url)),
                icon('chevron', 18)),
              h('button', {
                class: 'btn ghost icon-btn', 'aria-label': `Remove the link ${l.label}`,
                onclick: async () => { item.links = item.links.filter((x) => x.id !== l.id); await store.saveItem(item); },
              }, icon('trash', 18)))),
          ]
        : h('p', { class: 'muted hint' }, 'Upload a Guitar Pro file for a scrolling tab with playback, slow-down and looping. PDFs and photos of tabs open as pages beside a metronome. Links open in a new tab.')
    );

    dynamic.replaceChildren(...[head, status, map, sections, clips, files].filter(Boolean));
  };

  // The notes box is built once and left alone on redraws, so typing is never interrupted.
  const first = store.getItem(id);
  if (first) {
    let noteTimer = null;
    const notes = h('textarea', {
      rows: 4, placeholder: 'Fingerings, things to fix, what your teacher said…', value: first.notes || '',
      oninput: () => {
        clearTimeout(noteTimer);
        noteTimer = setTimeout(() => {
          const item = store.getItem(id);
          if (!item) return;
          item.notes = notes.value;
          store.saveItem(item);
        }, 500);
      },
    });
    const remove = h('button', {
      class: 'btn danger-ghost',
      onclick: () => {
        const item = store.getItem(id);
        confirmSheet('Delete this from your list?', `"${item.title}", its sections, tempo history and files will be removed from this device.`, 'Delete', async () => {
          await store.deleteItem(id);
          location.hash = '#/library';
        });
      },
    }, 'Delete from list');
    root.append(dynamic, h('section', { class: 'group' }, h('h2', { class: 'group-title' }, 'Notes'), notes), h('div', { class: 'pad-top' }, remove));
  }
  draw();
  const off = store.subscribe(draw);
  return () => { off(); clipRec.stop(); };
}
