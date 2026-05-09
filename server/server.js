/**
 * Story Seçisi — Ana Sunucu
 * Express + Socket.IO + Multer
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const TournamentManager = require('./tournamentManager');
const KickChatIntegration = require('./chatIntegration');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ── Uploads dizini ─────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ── Multer ayarları ────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    cb(null, ext && mime);
  }
});

// ── Static dosyalar ───────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(uploadsDir));
app.use(express.json());

// ── Turnuva ve Chat yöneticileri ──────────────────────────
const tournament = new TournamentManager();
let kickChat = null;

// ── Fotoğraf Onay Sistemi ──────────────────────────────────
// Fotoğraflar yüklenince pending (beklemede) durumunda olur
// Yayıncı onayladığında approved (onaylandı) olur
let pendingPhotos = [];   // Onay bekleyen fotoğraflar
let approvedPhotos = [];  // Onaylanmış fotoğraflar (turnuvaya katılabilir)

let voteUpdateTimeout = null;

function initChat() {
  kickChat = new KickChatIntegration((username, choice) => {
    const result = tournament.castVote(username, choice);
    if (result) {
      // Throttle: Yüksek trafik anında saniyede maks 5 kez güncelleme yolla
      if (!voteUpdateTimeout) {
        voteUpdateTimeout = setTimeout(() => {
          const currentMatch = tournament.getCurrentMatch();
          io.emit('vote:update', {
            matchId: result.matchId,
            votes: currentMatch ? currentMatch.votes : { '1': 0, '2': 0 },
            voteEntry: result.voteEntry // Akışa sadece son oyu düşür (DOM kasmasını da önler)
          });
          voteUpdateTimeout = null;
        }, 200);
      }
    }
  });

  // Gerçek zamanlı durum güncellemesi
  kickChat.onStatusChange((status) => {
    console.log('📡 Chat durum değişti:', status.isConnected ? 'Bağlı' : 'Bağlı Değil');
    io.emit('chat:status', status);
  });
}

initChat();

// ── API Routes ────────────────────────────────────────────

// Auth middleware
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Yetkisiz erişim' });
  }
}

// Admin giriş
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD });
  } else {
    res.status(401).json({ error: 'Yanlış şifre' });
  }
});

// ── Fotoğraf Yükleme (İzleyici → Pending) ────────────────
app.post('/api/photos/upload', (req, res) => {
  upload.array('photos', 20)(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'Dosya boyutu çok büyük veya sınır aşıldı (Maks: 10MB).' });
    } else if (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Dosya formatı desteklenmiyor (Sadece JPG, PNG, GIF, WEBP) veya dosya seçilmedi.' });
    }

    const uploadedBy = req.body.uploadedBy || 'İzleyici';
    const isAdmin = req.headers['x-admin-token'] === ADMIN_PASSWORD;

    const photos = req.files.map(file => {
      const photo = {
        id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        filename: file.filename,
        originalName: file.originalname,
        uploadedBy,
        uploadedAt: Date.now()
      };

      if (isAdmin) {
        // Admin yüklerse direkt onaylanır ve turnuvaya eklenir
        approvedPhotos.push(photo);
        tournament.addPhoto(photo);
      } else {
        // İzleyici yüklerse onay bekler
        pendingPhotos.push(photo);
      }

      return photo;
    });

    // Durumu yayınla
    io.emit('photos:updated', tournament.getPhotos());
    io.emit('pending:updated', pendingPhotos);

    res.json({ success: true, photos: tournament.getPhotos(), pending: pendingPhotos });
  });
});

// ── Bekleyen Fotoğrafları Listele ────────────────────────
app.get('/api/photos/pending', requireAdmin, (req, res) => {
  res.json(pendingPhotos);
});

// ── Fotoğraf Onayla (Pending → Approved) ─────────────────
app.post('/api/photos/approve/:photoId', requireAdmin, (req, res) => {
  const idx = pendingPhotos.findIndex(p => p.id === req.params.photoId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Fotoğraf bulunamadı' });
  }

  const photo = pendingPhotos.splice(idx, 1)[0];
  approvedPhotos.push(photo);
  tournament.addPhoto(photo);

  io.emit('photos:updated', tournament.getPhotos());
  io.emit('pending:updated', pendingPhotos);

  res.json({ success: true, photos: tournament.getPhotos(), pending: pendingPhotos });
});

// ── Bekleyen Fotoğrafı Reddet ────────────────────────────
app.delete('/api/photos/reject/:photoId', requireAdmin, (req, res) => {
  const idx = pendingPhotos.findIndex(p => p.id === req.params.photoId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Fotoğraf bulunamadı' });
  }

  const photo = pendingPhotos.splice(idx, 1)[0];

  // Dosyayı diskten sil
  const filePath = path.join(uploadsDir, photo.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  io.emit('pending:updated', pendingPhotos);

  res.json({ success: true, pending: pendingPhotos });
});

// ── Tüm Bekleyenleri Onayla ──────────────────────────────
app.post('/api/photos/approve-all', requireAdmin, (req, res) => {
  pendingPhotos.forEach(photo => {
    approvedPhotos.push(photo);
    tournament.addPhoto(photo);
  });
  pendingPhotos = [];

  io.emit('photos:updated', tournament.getPhotos());
  io.emit('pending:updated', pendingPhotos);

  res.json({ success: true, photos: tournament.getPhotos(), pending: pendingPhotos });
});

// Fotoğrafları listele
app.get('/api/photos', (req, res) => {
  res.json(tournament.getPhotos());
});

// Fotoğraf sil (onaylanmış)
app.delete('/api/photos/:photoId', requireAdmin, (req, res) => {
  const photo = tournament.getPhotos().find(p => p.id === req.params.photoId);
  if (photo) {
    // Dosyayı diskten sil
    const filePath = path.join(uploadsDir, photo.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  const remaining = tournament.removePhoto(req.params.photoId);
  approvedPhotos = approvedPhotos.filter(p => p.id !== req.params.photoId);
  io.emit('photos:updated', remaining);
  res.json({ success: true, photos: remaining });
});

// Turnuva durumu
app.get('/api/tournament/state', (req, res) => {
  res.json(tournament.getState());
});

// Turnuvayı başlat
app.post('/api/tournament/start', requireAdmin, (req, res) => {
  try {
    const state = tournament.startTournament();
    io.emit('tournament:started', state);
    io.emit('state:update', state);
    res.json({ success: true, state });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Kazanan seç (yayıncı kararı)
app.post('/api/tournament/select', requireAdmin, (req, res) => {
  const { side } = req.body; // '1' veya '2'
  const state = tournament.selectWinner(side);
  if (state) {
    if (state.winner) {
      io.emit('tournament:finished', state);
    } else {
      io.emit('match:next', state);
    }
    io.emit('state:update', state);
    res.json({ success: true, state });
  } else {
    res.status(400).json({ error: 'Seçim yapılamadı' });
  }
});

// Turnuvayı sıfırla
app.post('/api/tournament/reset', requireAdmin, (req, res) => {
  tournament.reset();
  io.emit('tournament:reset');
  io.emit('state:update', tournament.getState());
  res.json({ success: true });
});

// Chat bağlantısı
app.post('/api/chat/connect', requireAdmin, async (req, res) => {
  const { channelSlug } = req.body;
  if (!channelSlug) {
    return res.status(400).json({ error: 'Kanal slug gerekli' });
  }

  console.log(`🔗 Chat bağlantısı istendi: ${channelSlug}`);

  const result = await kickChat.connect(channelSlug);
  const status = kickChat.getStatus();

  console.log(`📡 Chat sonuç: ${result ? 'Başarılı' : 'Başarısız'}`, status);

  res.json({ success: result, status });
});

// Chat bağlantısını kes
app.post('/api/chat/disconnect', requireAdmin, (req, res) => {
  kickChat.disconnect();
  res.json({ success: true, status: kickChat.getStatus() });
});

// Chat durumu
app.get('/api/chat/status', (req, res) => {
  res.json(kickChat.getStatus());
});

// Manuel oy (test amaçlı)
app.post('/api/tournament/vote', (req, res) => {
  const { username, choice } = req.body;
  const result = tournament.castVote(username || `user_${Date.now()}`, choice);
  if (result) {
    io.emit('vote:update', result);
    io.emit('state:update', tournament.getState());
    res.json({ success: true, result });
  } else {
    res.status(400).json({ error: 'Oy verilemedi' });
  }
});

// ── Socket.IO ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Bağlandı: ${socket.id}`);

  // İlk bağlandığında mevcut durumu gönder
  socket.emit('state:update', tournament.getState());
  socket.emit('chat:status', kickChat.getStatus());
  socket.emit('pending:updated', pendingPhotos);

  socket.on('disconnect', () => {
    console.log(`🔌 Ayrıldı: ${socket.id}`);
  });
});

// ── Sayfa yönlendirmeleri ─────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.get('/upload', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'upload.html'));
});

// ── Sunucuyu başlat ───────────────────────────────────────
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║   🎬 Story Seçisi — Aktif!                  ║
  ║                                              ║
  ║   Ana Sayfa:    http://localhost:${PORT}         ║
  ║   Admin Panel:  http://localhost:${PORT}/admin   ║
  ║   Yükleme:      http://localhost:${PORT}/upload  ║
  ╚══════════════════════════════════════════════╝
  `);

  // .env'de kanal slug varsa otomatik bağlan
  if (process.env.KICK_CHANNEL_SLUG) {
    kickChat.connect(process.env.KICK_CHANNEL_SLUG);
  }
});
