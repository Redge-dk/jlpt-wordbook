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

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function prepareRound(cards, saved, random, firstId = null) {
  const available = new Set(cards.map(card => card.id));
  const seen = new Set();
  const order = [];
  for (const id of Array.isArray(saved?.order) ? saved.order : []) {
    if (!available.has(id) || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  // When upgrading an older save, start the new round with the word already on screen.
  if (!order.length && available.has(firstId)) {
    order.push(firstId);
    seen.add(firstId);
  }
  const added = shuffled(cards.filter(card => !seen.has(card.id)).map(card => card.id), random);
  order.push(...added);
  const complete = saved?.complete === true && added.length === 0 && order.length > 0;
  const currentId = complete ? order.at(-1)
    : saved?.complete === true && added.length ? added[0]
    : available.has(saved?.currentId) ? saved.currentId
    : order[0] ?? null;
  return { order, currentId, complete };
}

function activateRound(state, level, random, restart = false) {
  const cards = selectDeck(state.cards, state.records, 'all', level);
  const round = restart ? prepareRound(cards, null, random)
    : state.rounds[level] ?? prepareRound(cards, null, random);
  const byId = new Map(cards.map(card => [card.id, card]));
  return {
    ...state, level, filter: 'all',
    rounds: { ...state.rounds, [level]: round },
    deck: round.order.map(id => byId.get(id)),
    index: Math.max(0, round.order.indexOf(round.currentId)), complete: round.complete,
    revealed: state.mode === 'browse', examplesOpen: state.mode === 'browse',
  };
}

function rememberPosition(state) {
  if (state.filter !== 'all') return state;
  return {
    ...state,
    rounds: {
      ...state.rounds,
      [state.level]: {
        ...state.rounds[state.level],
        currentId: currentCard(state)?.id ?? null, complete: state.complete,
      },
    },
  };
}

export function createState(cards, saved = {}, random = Math.random) {
  const mode = MODES.has(saved?.mode) ? saved.mode : 'recall';
  const filter = FILTERS.has(saved?.filter) ? saved.filter : 'all';
  const level = LEVELS.has(saved?.level) ? saved.level : 'all';
  const records = cleanRecords(saved?.records);
  const rounds = {};
  for (const scope of LEVELS) {
    const savedRound = saved?.rounds?.[scope];
    if (!Array.isArray(savedRound?.order)) continue;
    rounds[scope] = prepareRound(selectDeck(cards, records, 'all', scope), savedRound, random);
  }
  if (filter === 'all' && !rounds[level]) {
    rounds[level] = prepareRound(selectDeck(cards, records, 'all', level), null, random, saved?.currentId);
  }
  const deck = selectDeck(cards, records, filter, level);
  const state = {
    cards, records, mode, filter, level, deck, rounds,
    index: Math.max(0, deck.findIndex(({ id }) => id === saved?.currentId)),
    revealed: mode === 'browse',
    examplesOpen: mode === 'browse',
    complete: false,
  };
  return filter === 'all' ? activateRound(state, level, random) : state;
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

export function setFilter(state, filter, random = Math.random) {
  if (!FILTERS.has(filter)) return state;
  if (filter === 'all') return activateRound(state, state.level, random, state.filter === 'all' && state.complete);
  return {
    ...state, filter,
    // Freeze this round's membership so clearing a flag cannot remove the card mid-review.
    deck: selectDeck(state.cards, state.records, filter, state.level),
    index: 0, complete: false, revealed: state.mode === 'browse',
    examplesOpen: state.mode === 'browse',
  };
}

export function setLevel(state, level, random = Math.random) {
  if (!LEVELS.has(level)) return state;
  if (state.filter === 'all') return activateRound(state, level, random);
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
  if (state.index === state.deck.length - 1) return rememberPosition({ ...state, complete: true });
  return rememberPosition({ ...state, index: state.index + 1, revealed: state.mode === 'browse', examplesOpen: state.mode === 'browse' });
}

export function previousCard(state) {
  if (!currentCard(state) || (!state.complete && state.index === 0)) return state;
  return rememberPosition({
    ...state, complete: false,
    index: state.complete ? state.index : state.index - 1,
    revealed: state.mode === 'browse',
    examplesOpen: state.mode === 'browse',
  });
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
    rounds: state.rounds,
  };
}
