/**
 * Admin Panel JS — Turnuva yönetimi
 */

const socket = io();
let adminToken = null;
let selectedFiles = [];

// ── Auth ──────────────────────────────────
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
      loadPhotos();
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

// ── Photos ────────────────────────────────
function loadPhotos() {
  fetch('/api/photos').then(r => r.json()).then(renderPhotos);
}

function renderPhotos(photos) {
  document.getElementById('photoCount').textContent = photos.length;
  const grid = document.getElementById('photoGrid');
  if (photos.length === 0) {
    grid.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;grid-column:1/-1;">Henüz fotoğraf yok</div>';
    return;
  }
  grid.innerHTML = photos.map(p => `
    <div class="photo-thumb">
      <img src="/uploads/${p.filename}" alt="${p.originalName}">
      <button class="delete-btn" onclick="deletePhoto('${p.id}')" title="Sil">✕</button>
    </div>
  `).join('');
}

function deletePhoto(id) {
  fetch(`/api/photos/${id}`, { method: 'DELETE', headers: authHeaders() })
    .then(r => r.json())
    .then(data => { if (data.success) renderPhotos(data.photos); });
}

// ── Upload ────────────────────────────────
function handleFiles(files) {
  selectedFiles = Array.from(files);
  const preview = document.getElementById('uploadPreview');
  const btnUpload = document.getElementById('btnUpload');
  if (selectedFiles.length === 0) { preview.style.display = 'none'; btnUpload.style.display = 'none'; return; }

  preview.style.display = '';
  btnUpload.style.display = '';
  preview.innerHTML = selectedFiles.map((f, i) => {
    const url = URL.createObjectURL(f);
    return `<div class="preview-item"><img src="${url}" alt="${f.name}"></div>`;
  }).join('');
}

function uploadPhotos() {
  if (selectedFiles.length === 0) return;
  const fd = new FormData();
  selectedFiles.forEach(f => fd.append('photos', f));
  fd.append('uploadedBy', 'Yayıncı');

  fetch('/api/photos/upload', { method: 'POST', body: fd, headers: { 'x-admin-token': adminToken } })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        renderPhotos(data.photos);
        selectedFiles = [];
        document.getElementById('uploadPreview').style.display = 'none';
        document.getElementById('btnUpload').style.display = 'none';
        document.getElementById('fileInput').value = '';
      }
    });
}

// Upload zone drag events
const uploadZone = document.getElementById('uploadZone');
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });

// ── Tournament ────────────────────────────
function startTournament() {
  fetch('/api/tournament/start', { method: 'POST', headers: authHeaders() })
    .then(r => r.json())
    .then(data => {
      if (data.error) alert(data.error);
    });
}

function resetTournament() {
  if (!confirm('Turnuvayı sıfırlamak istediğinize emin misiniz?')) return;
  fetch('/api/tournament/reset', { method: 'POST', headers: authHeaders() });
}

function selectWinner(side) {
  fetch('/api/tournament/select', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ side })
  });
}

// ── Chat ──────────────────────────────────
function connectChat() {
  const slug = document.getElementById('channelSlug').value.trim();
  if (!slug) return alert('Kanal adı girin!');
  fetch('/api/chat/connect', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ channelSlug: slug })
  });
}

function disconnectChat() {
  fetch('/api/chat/disconnect', { method: 'POST', headers: authHeaders() });
}

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

// ── State Update ──────────────────────────
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

// ── Socket Events ────────────────────────
socket.on('state:update', updateAdminState);
socket.on('chat:status', updateChatStatus);
socket.on('photos:updated', renderPhotos);
socket.on('vote:update', (data) => {
  if (data.votes) {
    document.getElementById('aVote1').textContent = data.votes['1'] || 0;
    document.getElementById('aVote2').textContent = data.votes['2'] || 0;
  }
});
