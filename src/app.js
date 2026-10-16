import { createState, currentCard, nextCard, previousCard, reveal, setFilter, setMode, summary, toggleFlag, serialize } from './review.js';
import { loadSaved, saveReview } from './storage.js';

const $ = id => document.getElementById(id);
let state;
let storage;
try { storage = window.localStorage; } catch { /* Storage can be unavailable in private or restricted contexts. */ }

function announce(message) {
  $('announcement').textContent = message;
}

function persist() {
  const saved = saveReview(storage, serialize(state));
  $('save-note').textContent = saved
    ? '복습 표시는 이 브라우저에 저장돼요.'
    : '이 브라우저에서 저장할 수 없어, 지금 창에서만 기록이 유지돼요.';
}

function update(nextState, message) {
  const wasComplete = state.complete;
  const hadCard = currentCard(state);
  state = nextState;
  persist();
  render();
  if (!wasComplete && state.complete) $('complete-title').focus();
  if (hadCard && !currentCard(state)) $('empty-title').focus();
  if (message) announce(message);
}

function render() {
  const card = currentCard(state);
  const empty = !card;
  const complete = state.complete && !empty;
  const counts = summary(state);
  $('filter').value = state.filter;
  $('mode-recall').setAttribute('aria-pressed', String(state.mode === 'recall'));
  $('mode-browse').setAttribute('aria-pressed', String(state.mode === 'browse'));
  $('total').textContent = String(state.deck.length).padStart(2, '0');
  $('position').textContent = empty ? '00' : String(state.index + 1).padStart(2, '0');
  $('progress').max = Math.max(1, state.deck.length);
  $('progress').value = empty ? 0 : complete ? state.deck.length : state.index + 1;
  $('deck-label').textContent = state.filter === 'all' ? '나의 N1 단어장' : $('filter').selectedOptions[0].textContent;
  $('word-card').hidden = empty || complete;
  $('empty-state').hidden = !empty;
  $('complete-state').hidden = !complete;
  $('navigation').hidden = empty || complete;
  if (complete) {
    $('complete-detail').textContent = counts.marked
      ? `뜻이 헷갈린 단어 ${counts.meaning}개, 읽기가 헷갈린 단어 ${counts.reading}개, 모르는 단어 ${counts.unknown}개가 있어요. 표시한 단어를 다시 만나볼까요?`
      : '표시한 단어는 없어요. 다음에도 가볍게 한 장씩 만나봐요.';
    $('review-marked').hidden = counts.marked === 0;
  }
  if (!card || complete) return;

  const record = state.records[card.id] ?? {};
  $('word').textContent = card.word;
  $('dictionary-link').href = `https://ja.dict.naver.com/#/search?query=${encodeURIComponent(card.word)}&range=all`;
  $('dictionary-link').setAttribute('aria-label', `${card.word} 네이버 일본어 사전에서 검색 (새 탭)`);
  $('word').style.setProperty('--word-length', String([...card.word].length));
  $('word').classList.toggle('word-long', [...card.word].length > 5);
  $('reading').textContent = card.reading;
  $('reading').style.setProperty('--reading-length', String([...card.reading].length));
  $('meanings').replaceChildren(...card.meanings.map(meaning => {
    const item = document.createElement('span');
    item.textContent = meaning;
    return item;
  }));
  $('word-card').classList.toggle('is-revealed', state.revealed);
  for (const id of ['reading', 'meanings']) $(id).setAttribute('aria-hidden', String(!state.revealed));
  $('reveal').setAttribute('aria-expanded', String(state.revealed));
  $('reveal').setAttribute('aria-label', state.revealed ? `${card.word}. ${card.reading}. ${card.meanings.join(', ')}` : `${card.word}. 읽는 법과 뜻 보기`);
  $('reveal').setAttribute('aria-disabled', String(state.revealed));
  $('flags').hidden = !state.revealed;
  $('reveal-hint').hidden = state.revealed;
  $('card-prompt').textContent = state.revealed ? '얼마나 기억났나요?' : '기억을 천천히 꺼내 보세요';
  $('card-footnote').textContent = '단어를 길게 누르면 선택해서 복사할 수 있어요.';
  $('flag-meaning').setAttribute('aria-pressed', String(record.meaning === true));
  $('flag-reading').setAttribute('aria-pressed', String(record.reading === true));
  $('flag-unknown').setAttribute('aria-pressed', String(record.unknown === true));
  $('previous').disabled = state.index === 0;
  $('next').querySelector('span').textContent = state.index === state.deck.length - 1 ? '복습 마치기' : '다음 단어';
}

function attachEvents() {
  $('reveal').addEventListener('click', () => {
    if (state.revealed || window.getSelection()?.isCollapsed === false) return;
    update(reveal(state), `${currentCard(state).reading}. ${currentCard(state).meanings.join(', ')}`);
  });
  $('reveal').addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.code !== 'Space') return;
    event.preventDefault();
    event.stopPropagation();
    $('reveal').click();
  });
  $('flag-meaning').addEventListener('click', () => update(toggleFlag(state, 'meaning')));
  $('flag-reading').addEventListener('click', () => update(toggleFlag(state, 'reading')));
  $('flag-unknown').addEventListener('click', () => update(toggleFlag(state, 'unknown')));
  $('next').addEventListener('click', () => update(nextCard(state), '다음 카드'));
  $('previous').addEventListener('click', () => update(previousCard(state), '이전 카드'));
  $('mode-recall').addEventListener('click', () => update(setMode(state, 'recall')));
  $('mode-browse').addEventListener('click', () => update(setMode(state, 'browse')));
  $('filter').addEventListener('change', event => update(setFilter(state, event.target.value)));
  $('empty-all').addEventListener('click', () => update(setFilter(state, 'all')));
  $('review-marked').addEventListener('click', () => update(setFilter(state, 'marked')));
  $('restart').addEventListener('click', () => update(setFilter(state, state.filter)));
  document.addEventListener('keydown', event => {
    if ($('about-dialog').open || event.altKey || event.ctrlKey || event.metaKey || window.getSelection()?.isCollapsed === false || event.target.closest('select, input, textarea, [contenteditable]')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); update(nextCard(state)); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); update(previousCard(state)); }
    if (event.code === 'Space' && !event.target.closest('button, a, [role="button"]') && !state.complete && currentCard(state)) {
      event.preventDefault();
      update(reveal(state));
    }
  });
}

async function prepareOffline() {
  const status = $('offline-status');
  const address = new URL(location.href);
  const localDevelopment = ['localhost', '127.0.0.1', '[::1]'].includes(address.hostname) && address.port === '5173';
  if (address.searchParams.get('dev') === '1' || localDevelopment) {
    status.textContent = '화면 확인 중 · 오프라인 복습은 정식 실행에서 준비해요';
    return;
  }
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    status.textContent = '오프라인 저장은 HTTPS에서 준비할 수 있어요';
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register(new URL('../sw.js', import.meta.url));
    function check(activeRegistration) {
      const channel = new MessageChannel();
      channel.port1.onmessage = event => {
        if (event.data?.type === 'OFFLINE_STATUS') {
          status.textContent = event.data.ready ? '오프라인 사용 준비 완료' : '오프라인 저장을 준비하고 있어요';
          status.classList.toggle('is-ready', event.data.ready);
        }
        channel.port1.close();
      };
      activeRegistration.active?.postMessage({ type: 'CHECK_OFFLINE' }, [channel.port2]);
    }
    function watchInstallation() {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'redundant' && !registration.active) {
          status.textContent = '오프라인 저장을 마치지 못했어요. 연결 후 다시 열어 주세요';
        }
      });
    }
    watchInstallation();
    registration.addEventListener('updatefound', watchInstallation);
    navigator.serviceWorker.ready.then(check);
    navigator.serviceWorker.addEventListener('controllerchange', () => navigator.serviceWorker.ready.then(check));
  } catch {
    status.textContent = '오프라인 저장을 마치지 못했어요. 연결 후 다시 열어 주세요';
  }
}

$('about-button').addEventListener('click', () => $('about-dialog').showModal());
$('close-about').addEventListener('click', () => $('about-dialog').close());
$('about-dialog').addEventListener('click', event => {
  if (event.target !== $('about-dialog')) return;
  const rect = event.target.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close();
});

async function start() {
  try {
    const response = await fetch(new URL('../data/cards.json', import.meta.url));
    if (!response.ok) throw new Error('Could not load vocabulary.');
    const data = await response.json();
    if (!Array.isArray(data.cards) || data.cards.length === 0) throw new Error('No reviewed vocabulary.');
    const restored = loadSaved(storage);
    state = createState(data.cards, restored.saved);
    $('dataset-info').textContent = `OpenJLPT N1 목록 전체 ${data.cards.length.toLocaleString('ko-KR')}개 단어가 들어 있어요. 짧은 한국어 핵심 뜻으로 복습하고, 자세한 용법은 카드의 사전 버튼으로 확인할 수 있어요.`;
    if (!restored.available) $('save-note').textContent = '저장된 기록을 읽을 수 없어요. 지금 창에서는 복습할 수 있어요.';
    $('load-message').hidden = true;
    $('review-app').hidden = false;
    attachEvents();
    render();
    prepareOffline();
  } catch {
    $('load-message').textContent = '단어장을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'text-button';
    retry.textContent = '다시 불러오기';
    retry.addEventListener('click', () => { retry.remove(); start(); });
    $('load-message').after(retry);
  }
}

start();
