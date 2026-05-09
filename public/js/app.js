/**
 * Story Seçisi — Birleşik SPA JavaScript
 * Navigasyon + Ana Sayfa + Admin + Upload + Fotoğraf Kontrol
 */

const socket = io();

// ═══════════════════════════════════════════
// NAVİGASYON
// ═══════════════════════════════════════════

function navigate(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.add('active');

  const targetBtn = document.querySelector(`.nav-btn[data-view="${viewName}"]`);
  if (targetBtn) targetBtn.classList.add('active');

  if (viewName === 'admin' && adminToken) {
    loadPhotos();
    loadPendingPhotos();
  }

  window.scrollTo(0, 0);
}

// ═══════════════════════════════════════════
// ANA SAYFA — TURNUVA
// ═══════════════════════════════════════════

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

function updateMainView(state) {
  if (!state.isActive && !state.winner) {
    waitingState.style.display = '';
    tournamentView.style.display = 'none';
    return;
  }
  if (state.winner) showWinner(state.winner);

  waitingState.style.display = 'none';
  tournamentView.style.display = '';
  roundNum.textContent = state.currentRound + 1;
  totalRounds.textContent = state.totalRounds;
  matchNum.textContent = state.currentMatchIndex + 1;
  totalMatches.textContent = state.totalMatchesInRound;

  if (state.currentMatch && !state.currentMatch.isBye) {
    const match = state.currentMatch;
    imgLeft.src = `/uploads/${match.photo1.filename}`;
    imgRight.src = `/uploads/${match.photo2.filename}`;
    updateVoteBars(match.votes);
  }

  if (state.voteStream && state.voteStream.length > 0) {
    voteStream.innerHTML = state.voteStream.map(v => `
      <div class="vote-entry choice-${v.choice}">
        <span class="username">${escapeHtml(v.username)}</span>
        <span class="arrow">→</span>
        <span class="choice">${v.choice === '1' ? 'SOL' : 'SAĞ'}</span>
      </div>
    `).join('');
  }
  renderBracket(state);
}

function updateVoteBars(votes) {
  const v1 = votes['1'] || 0, v2 = votes['2'] || 0;
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

function renderBracket(state) {
  if (!state.bracket || state.bracket.length === 0) {
    bracketVisual.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;">Bracket burada görünecek</div>';
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

function showWinner(winner) {
  winnerOverlay.classList.remove('hidden');
  winnerImg.src = `/uploads/${winner.filename}`;
  winnerText.textContent = winner.originalName;
  spawnConfetti();
}

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

document.getElementById('btnCloseWinner').addEventListener('click', () => {
  winnerOverlay.classList.add('hidden');
});

cardLeft.style.transition = 'opacity 0.3s ease';
cardRight.style.transition = 'opacity 0.3s ease';

// ── Admin: Ana Sayfadan Kazanan Seçme ──────────
cardLeft.addEventListener('click', (e) => {
  if (e.target.closest('button, a')) return;
  if (adminToken) selectWinnerFromMain('1');
});

cardRight.addEventListener('click', (e) => {
  if (e.target.closest('button, a')) return;
  if (adminToken) selectWinnerFromMain('2');
});

function selectWinnerFromMain(side) {
  if (!adminToken) return;

  fetch('/api/tournament/select', { 
    method: 'POST', 
    headers: authHeaders(), 
    body: JSON.stringify({ side }) 
  })
  .then(r => r.json())
  .then(data => {
    if(data.error) alert('Seçim hatası: ' + data.error);
  })
  .catch(err => console.error('Seçim hatası:', err));
}

// ═══════════════════════════════════════════
// ADMIN PANELİ
// ═══════════════════════════════════════════

let adminToken = null;
let adminSelectedFiles = [];

// Login
document.getElementById('btnLogin').addEventListener('click', doLogin);
document.getElementById('passwordInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});

function doLogin() {
  const pw = document.getElementById('passwordInput').value;
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      adminToken = data.token;
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('adminPanel').style.display = '';
      document.getElementById('navAdminBadge').style.display = 'flex';
      loadPhotos();
      loadPendingPhotos();
    } else {
      const err = document.getElementById('loginError');
      err.textContent = 'Yanlış şifre!';
      err.style.display = '';
    }
  });
}

function authHeaders() {
  return { 'x-admin-token': adminToken, 'Content-Type': 'application/json' };
}

// ── Onaylanmış Fotoğraflar ─────────────────
function loadPhotos() {
  fetch('/api/photos').then(r => r.json()).then(renderPhotos);
}

function renderPhotos(photos) {
  document.getElementById('photoCount').textContent = photos.length;
  const grid = document.getElementById('photoGrid');
  if (photos.length === 0) {
    grid.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;grid-column:1/-1;">Henüz onaylanmış fotoğraf yok</div>';
    return;
  }
  grid.innerHTML = photos.map(p => `
    <div class="photo-thumb">
      <img src="/uploads/${p.filename}" alt="${escapeHtml(p.originalName)}">
      <button class="delete-btn" data-photo-id="${p.id}" title="Sil">✕</button>
    </div>
  `).join('');

  grid.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.photoId;
      fetch(`/api/photos/${id}`, { method: 'DELETE', headers: authHeaders() })
        .then(r => r.json())
        .then(data => { if (data.success) renderPhotos(data.photos); });
    });
  });
}

// ── Fotoğraf Kontrol (Pending) ─────────────
function loadPendingPhotos() {
  if (!adminToken) return;
  fetch('/api/photos/pending', { headers: authHeaders() })
    .then(r => r.json())
    .then(renderPendingPhotos);
}

function renderPendingPhotos(photos) {
  const grid = document.getElementById('pendingPhotosGrid');
  const badge = document.getElementById('pendingBadge');
  const actions = document.getElementById('pendingActions');

  if (photos.length === 0) {
    badge.style.display = 'none';
    actions.style.display = 'none';
    grid.innerHTML = `
      <div class="review-empty">
        <div style="font-size:2rem;margin-bottom:0.5rem;">📭</div>
        <div>Bekleyen fotoğraf yok</div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem;">İzleyiciler fotoğraf gönderdiğinde buraya düşecek</div>
      </div>
    `;
    return;
  }

  badge.style.display = '';
  badge.textContent = photos.length;
  actions.style.display = '';

  grid.innerHTML = photos.map(p => `
    <div class="review-card" data-photo-id="${p.id}">
      <div class="review-card-img">
        <img src="/uploads/${p.filename}" alt="${escapeHtml(p.originalName)}" loading="lazy">
        <div class="review-card-overlay">
          <div class="review-card-name">${escapeHtml(p.originalName)}</div>
          <div class="review-card-by">Gönderen: ${escapeHtml(p.uploadedBy)}</div>
        </div>
      </div>
      <div class="review-card-actions">
        <button class="btn btn-success btn-sm review-approve" data-id="${p.id}" title="Onayla">✅ Onayla</button>
        <button class="btn btn-danger btn-sm review-reject" data-id="${p.id}" title="Reddet">❌ Reddet</button>
      </div>
    </div>
  `).join('');

  // Event listeners
  grid.querySelectorAll('.review-approve').forEach(btn => {
    btn.addEventListener('click', () => approvePhoto(btn.dataset.id));
  });
  grid.querySelectorAll('.review-reject').forEach(btn => {
    btn.addEventListener('click', () => rejectPhoto(btn.dataset.id));
  });
}

function approvePhoto(photoId) {
  fetch(`/api/photos/approve/${photoId}`, { method: 'POST', headers: authHeaders() })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        renderPhotos(data.photos);
        renderPendingPhotos(data.pending);
      }
    });
}

function rejectPhoto(photoId) {
  fetch(`/api/photos/reject/${photoId}`, { method: 'DELETE', headers: authHeaders() })
    .then(r => r.json())
    .then(data => {
      if (data.success) renderPendingPhotos(data.pending);
    });
}

// Toplu işlemler
document.getElementById('btnApproveAll').addEventListener('click', () => {
  fetch('/api/photos/approve-all', { method: 'POST', headers: authHeaders() })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        renderPhotos(data.photos);
        renderPendingPhotos(data.pending);
      }
    });
});

document.getElementById('btnRejectAll').addEventListener('click', () => {
  if (!confirm('Tüm bekleyen fotoğrafları reddetmek istediğinize emin misiniz?')) return;
  // Her birini tek tek reddet
  const cards = document.querySelectorAll('.review-card');
  const ids = Array.from(cards).map(c => c.dataset.photoId);
  Promise.all(ids.map(id =>
    fetch(`/api/photos/reject/${id}`, { method: 'DELETE', headers: authHeaders() })
  )).then(() => loadPendingPhotos());
});

// ── Admin Upload ───────────────────────────
const adminUploadZone = document.getElementById('adminUploadZone');
const adminFileInput = document.getElementById('adminFileInput');
const btnAdminUpload = document.getElementById('btnAdminUpload');

adminFileInput.addEventListener('change', () => handleAdminFiles(adminFileInput.files));
adminUploadZone.addEventListener('dragover', e => { e.preventDefault(); adminUploadZone.classList.add('dragover'); });
adminUploadZone.addEventListener('dragleave', () => adminUploadZone.classList.remove('dragover'));
adminUploadZone.addEventListener('drop', e => { e.preventDefault(); adminUploadZone.classList.remove('dragover'); handleAdminFiles(e.dataTransfer.files); });

function handleAdminFiles(files) {
  adminSelectedFiles = Array.from(files);
  const preview = document.getElementById('adminUploadPreview');
  if (adminSelectedFiles.length === 0) { preview.style.display = 'none'; btnAdminUpload.style.display = 'none'; return; }
  preview.style.display = '';
  btnAdminUpload.style.display = '';
  preview.innerHTML = adminSelectedFiles.map(f => {
    const url = URL.createObjectURL(f);
    return `<div class="preview-item"><img src="${url}" alt="${f.name}"></div>`;
  }).join('');
}

btnAdminUpload.addEventListener('click', () => {
  if (adminSelectedFiles.length === 0) return;
  const fd = new FormData();
  adminSelectedFiles.forEach(f => fd.append('photos', f));
  fd.append('uploadedBy', 'Yayıncı');
  fetch('/api/photos/upload', { method: 'POST', body: fd, headers: { 'x-admin-token': adminToken } })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        renderPhotos(data.photos);
        adminSelectedFiles = [];
        document.getElementById('adminUploadPreview').style.display = 'none';
        btnAdminUpload.style.display = 'none';
        adminFileInput.value = '';
      }
    });
});

// ── Tournament Controls ────────────────────
document.getElementById('btnStart').addEventListener('click', () => {
  fetch('/api/tournament/start', { method: 'POST', headers: authHeaders() })
    .then(r => r.json())
    .then(data => { if (data.error) alert(data.error); });
});

document.getElementById('btnReset').addEventListener('click', () => {
  if (!confirm('Turnuvayı sıfırlamak istediğinize emin misiniz?')) return;
  fetch('/api/tournament/reset', { method: 'POST', headers: authHeaders() });
});

document.getElementById('btnSelectLeft').addEventListener('click', () => {
  fetch('/api/tournament/select', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ side: '1' }) });
});

document.getElementById('btnSelectRight').addEventListener('click', () => {
  fetch('/api/tournament/select', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ side: '2' }) });
});

// ── Chat Controls ──────────────────────────
document.getElementById('btnChatConnect').addEventListener('click', () => {
  const slug = document.getElementById('channelSlug').value.trim();
  if (!slug) return alert('Kanal adı girin!');

  const btn = document.getElementById('btnChatConnect');
  const info = document.getElementById('chatConnectInfo');
  btn.disabled = true;
  btn.textContent = 'Bağlanıyor...';
  info.style.display = '';
  info.textContent = `⏳ "${slug}" kanalına bağlanılıyor...`;

  fetch('/api/chat/connect', {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({ channelSlug: slug })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      info.textContent = `✅ "${slug}" kanalına başarıyla bağlanıldı!`;
      info.style.color = 'var(--success)';
    } else {
      info.textContent = `❌ Bağlantı başarısız. Kanal adını kontrol edin.`;
      info.style.color = 'var(--danger)';
    }
    updateChatStatus(data.status);
  })
  .catch(err => {
    info.textContent = `❌ Bağlantı hatası: ${err.message}`;
    info.style.color = 'var(--danger)';
  })
  .finally(() => {
    btn.disabled = false;
    btn.textContent = 'Bağlan';
  });
});

document.getElementById('btnChatDisconnect').addEventListener('click', () => {
  fetch('/api/chat/disconnect', { method: 'POST', headers: authHeaders() })
    .then(r => r.json())
    .then(data => {
      updateChatStatus(data.status);
      const info = document.getElementById('chatConnectInfo');
      info.textContent = '🔌 Bağlantı kesildi.';
      info.style.color = 'var(--text-secondary)';
    });
});

function updateChatStatus(status) {
  const badge = document.getElementById('chatStatus');
  const btnConnect = document.getElementById('btnChatConnect');
  const btnDisconnect = document.getElementById('btnChatDisconnect');

  if (status.isConnected) {
    badge.className = 'status-badge connected';
    badge.querySelector('span').textContent = `Bağlı: ${status.channelSlug}`;
    btnConnect.style.display = 'none';
    btnDisconnect.style.display = '';
    document.getElementById('channelSlug').value = status.channelSlug || '';
  } else {
    badge.className = 'status-badge disconnected';
    badge.querySelector('span').textContent = 'Bağlı Değil';
    btnConnect.style.display = '';
    btnDisconnect.style.display = 'none';
  }
}

function updateAdminState(state) {
  const btnStart = document.getElementById('btnStart');
  const btnReset = document.getElementById('btnReset');
  const activeControl = document.getElementById('activeMatchControl');
  const winnerDisplay = document.getElementById('winnerDisplay');

  if (state.winner) {
    btnStart.style.display = 'none';
    btnReset.style.display = '';
    activeControl.style.display = 'none';
    winnerDisplay.style.display = '';
    document.getElementById('winnerName').textContent = state.winner.originalName;
    return;
  }

  if (state.isActive) {
    btnStart.style.display = 'none';
    btnReset.style.display = '';
    activeControl.style.display = '';
    winnerDisplay.style.display = 'none';
    document.getElementById('aRound').textContent = state.currentRound + 1;
    document.getElementById('aTotalRounds').textContent = state.totalRounds;
    document.getElementById('aMatch').textContent = state.currentMatchIndex + 1;
    document.getElementById('aTotalMatches').textContent = state.totalMatchesInRound;

    if (state.currentMatch) {
      const m = state.currentMatch;
      document.getElementById('aVote1').textContent = m.votes['1'] || 0;
      document.getElementById('aVote2').textContent = m.votes['2'] || 0;
      document.getElementById('matchPreview').innerHTML = `
        <div class="match-preview-card">
          <img src="/uploads/${m.photo1.filename}" alt="Sol">
          <div class="info">SOL (1)</div>
        </div>
        <div class="match-preview-card">
          <img src="/uploads/${m.photo2.filename}" alt="Sağ">
          <div class="info">SAĞ (2)</div>
        </div>
      `;
    }
  } else {
    btnStart.style.display = '';
    btnReset.style.display = 'none';
    activeControl.style.display = 'none';
    winnerDisplay.style.display = 'none';
  }
}

// ═══════════════════════════════════════════
// İZLEYİCİ YÜKLEME
// ═══════════════════════════════════════════

let viewerSelectedFiles = [];
const viewerUploadZone = document.getElementById('viewerUploadZone');
const viewerFileInput = document.getElementById('viewerFileInput');
const btnViewerSubmit = document.getElementById('btnViewerSubmit');

viewerFileInput.addEventListener('change', () => handleViewerFiles(viewerFileInput.files));
viewerUploadZone.addEventListener('dragover', e => { e.preventDefault(); viewerUploadZone.classList.add('dragover'); });
viewerUploadZone.addEventListener('dragleave', () => viewerUploadZone.classList.remove('dragover'));
viewerUploadZone.addEventListener('drop', e => { e.preventDefault(); viewerUploadZone.classList.remove('dragover'); handleViewerFiles(e.dataTransfer.files); });

function handleViewerFiles(files) {
  viewerSelectedFiles = Array.from(files);
  const area = document.getElementById('viewerPreviewArea');
  if (viewerSelectedFiles.length === 0) { area.style.display = 'none'; btnViewerSubmit.style.display = 'none'; return; }
  area.style.display = '';
  btnViewerSubmit.style.display = '';
  area.innerHTML = viewerSelectedFiles.map(f => {
    const url = URL.createObjectURL(f);
    return `<div class="preview-item"><img src="${url}" alt="${f.name}"></div>`;
  }).join('');
}

btnViewerSubmit.addEventListener('click', () => {
  if (viewerSelectedFiles.length === 0) return;
  const fd = new FormData();
  viewerSelectedFiles.forEach(f => fd.append('photos', f));
  fd.append('uploadedBy', 'İzleyici');
  btnViewerSubmit.disabled = true;
  btnViewerSubmit.textContent = 'Yükleniyor...';
  fetch('/api/photos/upload', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        document.getElementById('viewerSuccessMsg').style.display = '';
        document.getElementById('viewerPreviewArea').style.display = 'none';
        btnViewerSubmit.style.display = 'none';
        viewerSelectedFiles = [];
        viewerFileInput.value = '';
      }
    })
    .finally(() => {
      btnViewerSubmit.disabled = false;
      btnViewerSubmit.textContent = '📤 Fotoğrafları Gönder';
    });
});

// ═══════════════════════════════════════════
// SOCKET.IO EVENT'LERİ
// ═══════════════════════════════════════════

socket.on('state:update', (state) => {
  updateMainView(state);
  updateAdminState(state);
});

socket.on('tournament:started', (state) => {
  winnerOverlay.classList.add('hidden');
  updateMainView(state);
  updateAdminState(state);
});

socket.on('tournament:finished', (state) => {
  updateMainView(state);
  updateAdminState(state);
});

socket.on('match:next', (state) => {
  cardLeft.style.opacity = '0';
  cardRight.style.opacity = '0';
  setTimeout(() => {
    updateMainView(state);
    updateAdminState(state);
    cardLeft.style.opacity = '1';
    cardRight.style.opacity = '1';
  }, 300);
});

socket.on('vote:update', (data) => {
  if (data.votes) {
    updateVoteBars(data.votes);
    const aVote1 = document.getElementById('aVote1');
    const aVote2 = document.getElementById('aVote2');
    if (aVote1) aVote1.textContent = data.votes['1'] || 0;
    if (aVote2) aVote2.textContent = data.votes['2'] || 0;
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

socket.on('chat:status', updateChatStatus);
socket.on('photos:updated', renderPhotos);
socket.on('pending:updated', (photos) => {
  if (adminToken) renderPendingPhotos(photos);
});

// ═══════════════════════════════════════════
// YARDIMCI
// ═══════════════════════════════════════════

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
