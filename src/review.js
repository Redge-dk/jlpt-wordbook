const FILTERS = new Set(['all', 'marked', 'meaning', 'reading', 'unknown']);
const MODES = new Set(['recall', 'browse']);
const LEVELS = new Set(['all', 'N1', 'N2', 'N3', 'N4', 'N5']);
const ID_PATTERN = /^[a-f0-9]{10}$/;

export function cleanRecords(records) {
  if (!records || typeof records !== 'object' || Array.isArray(records)) return {};
  return Object.fromEntries(Object.entries(records)
    .filter(([id, record]) => ID_PATTERN.test(id) && record && typeof record === 'object')
    .map(([id, record]) => [id, {
      meaning: record.meaning === true,
      reading: record.reading === true,
      unknown: record.unknown === true,
    }]));
}

function selectDeck(cards, records, filter, level) {
  return cards.filter(card => {
    if (level !== 'all' && card.level !== level) return false;
    const { id } = card;
    const record = records[id] ?? {};
    if (filter === 'marked') return record.meaning || record.reading || record.unknown;
    if (filter === 'meaning') return record.meaning;
    if (filter === 'reading') return record.reading;
    if (filter === 'unknown') return record.unknown;
    return true;
  });
}

export function createState(cards, saved = {}) {
  const mode = MODES.has(saved?.mode) ? saved.mode : 'recall';
  const filter = FILTERS.has(saved?.filter) ? saved.filter : 'all';
  const level = LEVELS.has(saved?.level) ? saved.level : 'all';
  const records = cleanRecords(saved?.records);
  const deck = selectDeck(cards, records, filter, level);
  return {
    cards, records, mode, filter, level, deck,
    index: Math.max(0, deck.findIndex(({ id }) => id === saved?.currentId)),
    revealed: mode === 'browse',
    examplesOpen: mode === 'browse',
    complete: false,
  };
}

export function currentCard(state) {
  return state.deck[state.index] ?? null;
}

export function reveal(state) {
  return currentCard(state) && !state.complete && !state.revealed
    ? { ...state, revealed: true, examplesOpen: true } : state;
}

export function toggleExamples(state) {
  return currentCard(state)?.examples?.length && !state.complete
    ? { ...state, examplesOpen: !state.examplesOpen } : state;
}

export function setMode(state, mode) {
  return MODES.has(mode) ? { ...state, mode, revealed: mode === 'browse', examplesOpen: mode === 'browse' } : state;
}

export function setFilter(state, filter) {
  if (!FILTERS.has(filter)) return state;
  return {
    ...state, filter,
    // Freeze this round's membership so clearing a flag cannot remove the card mid-review.
    deck: selectDeck(state.cards, state.records, filter, state.level),
    index: 0, complete: false, revealed: state.mode === 'browse',
    examplesOpen: state.mode === 'browse',
  };
}

export function setLevel(state, level) {
  if (!LEVELS.has(level)) return state;
  return {
    ...state, level,
    deck: selectDeck(state.cards, state.records, state.filter, level),
    index: 0, complete: false, revealed: state.mode === 'browse',
    examplesOpen: state.mode === 'browse',
  };
}

export function toggleFlag(state, kind) {
  const card = currentCard(state);
  if (!card || !state.revealed || state.complete || !['meaning', 'reading', 'unknown'].includes(kind)) return state;
  const record = state.records[card.id] ?? { meaning: false, reading: false, unknown: false };
  return {
    ...state,
    records: { ...state.records, [card.id]: { ...record, [kind]: !record[kind] } },
  };
}

export function nextCard(state) {
  if (!currentCard(state) || state.complete) return state;
  if (state.index === state.deck.length - 1) return { ...state, complete: true };
  return { ...state, index: state.index + 1, revealed: state.mode === 'browse', examplesOpen: state.mode === 'browse' };
}

export function previousCard(state) {
  if (!currentCard(state) || (!state.complete && state.index === 0)) return state;
  return {
    ...state, complete: false,
    index: state.complete ? state.index : state.index - 1,
    revealed: state.mode === 'browse',
    examplesOpen: state.mode === 'browse',
  };
}

export function summary(state) {
  const records = state.cards
    .filter(card => state.level === 'all' || card.level === state.level)
    .map(({ id }) => state.records[id] ?? {});
  return {
    meaning: records.filter(record => record.meaning).length,
    reading: records.filter(record => record.reading).length,
    unknown: records.filter(record => record.unknown).length,
    marked: records.filter(record => record.meaning || record.reading || record.unknown).length,
  };
}

export function serialize(state) {
  return {
    version: 1, mode: state.mode, filter: state.filter, level: state.level,
    currentId: currentCard(state)?.id ?? null,
    records: state.records,
  };
}
