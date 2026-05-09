/**
 * Ana Sayfa JS — Turnuva görüntüleme + canlı oylar
 */

const socket = io();

// DOM Elements
const waitingState = document.getElementById('waitingState');
const tournamentView = document.getElementById('tournamentView');
const winnerOverlay = document.getElementById('winnerOverlay');

const roundNum = document.getElementById('roundNum');
const totalRounds = document.getElementById('totalRounds');
const matchNum = document.getElementById('matchNum');
const totalMatches = document.getElementById('totalMatches');

const imgLeft = document.getElementById('imgLeft');
const imgRight = document.getElementById('imgRight');
const cardLeft = document.getElementById('cardLeft');
const cardRight = document.getElementById('cardRight');

const voteCountLeft = document.getElementById('voteCountLeft');
const voteCountRight = document.getElementById('voteCountRight');
const votePercentLeft = document.getElementById('votePercentLeft');
const votePercentRight = document.getElementById('votePercentRight');
const voteBarLeft = document.getElementById('voteBarLeft');
const voteBarRight = document.getElementById('voteBarRight');

const voteStream = document.getElementById('voteStream');
const bracketVisual = document.getElementById('bracketVisual');
const winnerImg = document.getElementById('winnerImg');
const winnerText = document.getElementById('winnerText');

/**
 * Durumu güncelle
 */
function updateState(state) {
  if (!state.isActive && !state.winner) {
    waitingState.style.display = '';
    tournamentView.style.display = 'none';
    return;
  }

  if (state.winner) {
    showWinner(state.winner);
  }

  waitingState.style.display = 'none';
  tournamentView.style.display = '';

  // Round/Match info
  roundNum.textContent = state.currentRound + 1;
  totalRounds.textContent = state.totalRounds;
  matchNum.textContent = state.currentMatchIndex + 1;
  totalMatches.textContent = state.totalMatchesInRound;

  // Current match
  if (state.currentMatch && !state.currentMatch.isBye) {
    const match = state.currentMatch;

    imgLeft.src = `/uploads/${match.photo1.filename}`;
    imgRight.src = `/uploads/${match.photo2.filename}`;

    const v1 = match.votes['1'] || 0;
    const v2 = match.votes['2'] || 0;
    const total = v1 + v2;
    const p1 = total > 0 ? Math.round((v1 / total) * 100) : 0;
    const p2 = total > 0 ? Math.round((v2 / total) * 100) : 0;

    voteCountLeft.textContent = v1;
    voteCountRight.textContent = v2;
    votePercentLeft.textContent = p1;
    votePercentRight.textContent = p2;
    voteBarLeft.style.width = p1 + '%';
    voteBarRight.style.width = p2 + '%';
  }

  // Vote stream
  if (state.voteStream && state.voteStream.length > 0) {
    voteStream.innerHTML = state.voteStream.map(v => `
      <div class="vote-entry choice-${v.choice}">
        <span class="username">${escapeHtml(v.username)}</span>
        <span class="arrow">→</span>
        <span class="choice">${v.choice === '1' ? 'SOL' : 'SAĞ'}</span>
      </div>
    `).join('');
  }

  // Bracket
  renderBracket(state);
}

/**
 * Bracket'i render et
 */
function renderBracket(state) {
  if (!state.bracket || state.bracket.length === 0) {
    bracketVisual.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;">Turnuva başladığında bracket burada görünecek</div>';
    return;
  }

  const roundNames = ['Çeyrek Final', 'Yarı Final', 'Final', 'Şampiyon'];

  bracketVisual.innerHTML = state.bracket.map((round, ri) => {
    const roundTitle = state.bracket.length - ri <= 4
      ? roundNames[Math.max(0, 4 - (state.bracket.length - ri))]
      : `Tur ${ri + 1}`;

    return `
      <div class="bracket-round">
        <div class="bracket-round-title">${roundTitle}</div>
        ${round.map(match => {
          const isActive = ri === state.currentRound && match.id === state.currentMatch?.id;
          const p1Name = match.photo1?.originalName?.substring(0, 15) || '?';
          const p2Name = match.photo2?.originalName?.substring(0, 15) || 'BYE';
          const p1Class = match.winner?.id === match.photo1?.id ? 'winner' : (match.winner ? 'loser' : '');
          const p2Class = match.winner?.id === match.photo2?.id ? 'winner' : (match.winner ? 'loser' : '');

          return `
            <div class="bracket-match ${isActive ? 'active' : ''}">
              <div class="bm-photo ${p1Class}">${p1Name}</div>
              <div class="bm-photo ${p2Class}">${p2Name}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }).join('');
}

/**
 * Kazananı göster
 */
function showWinner(winner) {
  winnerOverlay.classList.remove('hidden');
  winnerImg.src = `/uploads/${winner.filename}`;
  winnerText.textContent = winner.originalName;
  spawnConfetti();
}

/**
 * Konfeti efekti
 */
function spawnConfetti() {
  const colors = ['#7c3aed', '#a855f7', '#2dd4bf', '#f59e0b', '#ef4444', '#22c55e'];
  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 2 + 's';
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.width = (6 + Math.random() * 8) + 'px';
    piece.style.height = (6 + Math.random() * 8) + 'px';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 4000);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── Socket Events ────────────────────────
socket.on('state:update', updateState);
socket.on('tournament:started', (state) => {
  winnerOverlay.classList.add('hidden');
  updateState(state);
});
socket.on('tournament:finished', (state) => updateState(state));
socket.on('match:next', (state) => {
  // Geçiş animasyonu
  cardLeft.style.opacity = '0';
  cardRight.style.opacity = '0';
  setTimeout(() => {
    updateState(state);
    cardLeft.style.opacity = '1';
    cardRight.style.opacity = '1';
  }, 300);
});
socket.on('vote:update', (data) => {
  if (data.votes) {
    const v1 = data.votes['1'] || 0;
    const v2 = data.votes['2'] || 0;
    const total = v1 + v2;
    const p1 = total > 0 ? Math.round((v1 / total) * 100) : 0;
    const p2 = total > 0 ? Math.round((v2 / total) * 100) : 0;

    voteCountLeft.textContent = v1;
    voteCountRight.textContent = v2;
    votePercentLeft.textContent = p1;
    votePercentRight.textContent = p2;
    voteBarLeft.style.width = p1 + '%';
    voteBarRight.style.width = p2 + '%';
  }

  if (data.voteEntry) {
    const v = data.voteEntry;
    const entry = document.createElement('div');
    entry.className = `vote-entry choice-${v.choice}`;
    entry.innerHTML = `
      <span class="username">${escapeHtml(v.username)}</span>
      <span class="arrow">→</span>
      <span class="choice">${v.choice === '1' ? 'SOL' : 'SAĞ'}</span>
    `;
    // İlk "henüz oy yok" mesajını kaldır
    const placeholder = voteStream.querySelector('div[style]');
    if (placeholder) placeholder.remove();
    voteStream.prepend(entry);
  }
});
socket.on('tournament:reset', () => {
  winnerOverlay.classList.add('hidden');
  waitingState.style.display = '';
  tournamentView.style.display = 'none';
});

// Opacity transitions
cardLeft.style.transition = 'opacity 0.3s ease';
cardRight.style.transition = 'opacity 0.3s ease';
