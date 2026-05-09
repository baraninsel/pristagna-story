/**
 * Turnuva Yöneticisi
 * Fotoğraf eşleştirme, tur yönetimi, puanlama mantığı
 */

class TournamentManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.photos = [];           // Tüm fotoğraflar [{id, filename, originalName, uploadedBy}]
    this.bracket = [];          // Tüm turlar [[maç1, maç2...], [maç5, maç6...], ...]
    this.currentRound = 0;      // Şu anki tur index'i
    this.currentMatchIndex = 0; // Şu anki maç index'i (tur içinde)
    this.votes = {};            // { matchId: { '1': count, '2': count } }
    this.voterLog = {};         // { matchId: { username: '1'|'2' } }  — tekrar oy engeli
    this.voteStream = [];       // Son oylar akışı [{username, choice, timestamp}]
    this.isActive = false;      // Turnuva aktif mi?
    this.winner = null;         // Final kazananı
    this.matchHistory = [];     // Geçmiş maçlar
  }

  /**
   * Fotoğraf ekle
   */
  addPhoto(photo) {
    this.photos.push({
      id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      ...photo
    });
    return this.photos;
  }

  /**
   * Fotoğraf sil
   */
  removePhoto(photoId) {
    this.photos = this.photos.filter(p => p.id !== photoId);
    return this.photos;
  }

  /**
   * Tüm fotoğrafları getir
   */
  getPhotos() {
    return this.photos;
  }

  /**
   * Turnuvayı başlat — fotoğrafları karıştır ve bracket oluştur
   */
  startTournament() {
    if (this.photos.length < 2) {
      throw new Error('En az 2 fotoğraf gerekli!');
    }

    this.bracket = [];
    this.currentRound = 0;
    this.currentMatchIndex = 0;
    this.votes = {};
    this.voterLog = {};
    this.voteStream = [];
    this.isActive = true;
    this.winner = null;
    this.matchHistory = [];

    // Fotoğrafları karıştır
    const shuffled = [...this.photos].sort(() => Math.random() - 0.5);

    // İlk tur maçlarını oluştur
    const firstRound = this._createRoundMatches(shuffled);
    this.bracket.push(firstRound);

    // Her maç için vote tracker başlat
    firstRound.forEach(match => {
      this._initMatchVotes(match.id);
    });

    return this.getState();
  }

  /**
   * Bir tur için maçları oluştur
   */
  _createRoundMatches(participants) {
    const matches = [];
    for (let i = 0; i < participants.length; i += 2) {
      const match = {
        id: `match_${this.bracket.length}_${Math.floor(i / 2)}`,
        photo1: participants[i],
        photo2: participants[i + 1] || null, // Tek sayı durumunda bye
        winner: null,
        isBye: !participants[i + 1]
      };

      // Bye durumunda otomatik kazanan
      if (match.isBye) {
        match.winner = match.photo1;
      }

      matches.push(match);
    }
    return matches;
  }

  /**
   * Maç oylarını başlat
   */
  _initMatchVotes(matchId) {
    this.votes[matchId] = { '1': 0, '2': 0 };
    this.voterLog[matchId] = {};
  }

  /**
   * Oy ver
   */
  castVote(username, choice) {
    if (!this.isActive) return null;

    const currentMatch = this.getCurrentMatch();
    if (!currentMatch || currentMatch.isBye) return null;

    const matchId = currentMatch.id;
    const normalizedChoice = String(choice).trim();

    if (normalizedChoice !== '1' && normalizedChoice !== '2') return null;

    // Daha önce oy verdiyse, eski oyunu güncelle
    const previousVote = this.voterLog[matchId]?.[username];
    if (previousVote) {
      this.votes[matchId][previousVote]--;
    }

    // Yeni oy kaydet
    this.voterLog[matchId][username] = normalizedChoice;
    this.votes[matchId][normalizedChoice]++;

    // Vote stream'e ekle
    const voteEntry = {
      username,
      choice: normalizedChoice,
      timestamp: Date.now(),
      isUpdate: !!previousVote
    };
    this.voteStream.unshift(voteEntry);

    // Stream'i son 50 ile sınırla
    if (this.voteStream.length > 50) {
      this.voteStream = this.voteStream.slice(0, 50);
    }

    return {
      matchId,
      votes: this.votes[matchId],
      voteEntry,
      totalVoters: Object.keys(this.voterLog[matchId]).length
    };
  }

  /**
   * Şu anki maçı getir
   */
  getCurrentMatch() {
    if (!this.isActive || !this.bracket[this.currentRound]) return null;

    const round = this.bracket[this.currentRound];
    if (this.currentMatchIndex >= round.length) return null;

    return round[this.currentMatchIndex];
  }

  /**
   * Yayıncı seçim yapar — maçı bitirir
   */
  selectWinner(side) {
    if (!this.isActive) return null;

    const currentMatch = this.getCurrentMatch();
    if (!currentMatch || currentMatch.isBye) return null;

    const winner = side === '1' ? currentMatch.photo1 : currentMatch.photo2;
    currentMatch.winner = winner;

    // Maç geçmişine ekle
    this.matchHistory.push({
      matchId: currentMatch.id,
      photo1: currentMatch.photo1,
      photo2: currentMatch.photo2,
      winner,
      votes: { ...this.votes[currentMatch.id] },
      round: this.currentRound
    });

    // Sonraki maça geç
    return this._advanceToNextMatch();
  }

  /**
   * Sonraki maça / tura geç
   */
  _advanceToNextMatch() {
    const round = this.bracket[this.currentRound];

    // Bye maçlarını atla
    let nextIndex = this.currentMatchIndex + 1;
    while (nextIndex < round.length && round[nextIndex].isBye) {
      this.matchHistory.push({
        matchId: round[nextIndex].id,
        photo1: round[nextIndex].photo1,
        photo2: null,
        winner: round[nextIndex].winner,
        votes: { '1': 0, '2': 0 },
        round: this.currentRound,
        isBye: true
      });
      nextIndex++;
    }

    if (nextIndex < round.length) {
      // Aynı turda sonraki maç
      this.currentMatchIndex = nextIndex;
      this.voteStream = []; // Yeni maç için oy akışını sıfırla
      return this.getState();
    }

    // Tur bitti — kazananları topla
    const roundWinners = round.map(m => m.winner).filter(Boolean);

    if (roundWinners.length === 1) {
      // Turnuva bitti!
      this.winner = roundWinners[0];
      this.isActive = false;
      return this.getState();
    }

    // Yeni tur oluştur
    this.currentRound++;
    this.currentMatchIndex = 0;
    this.voteStream = [];

    const newRound = this._createRoundMatches(roundWinners);
    this.bracket.push(newRound);

    // Yeni maçlar için vote tracker
    newRound.forEach(match => {
      this._initMatchVotes(match.id);
    });

    // İlk maç bye ise atla
    while (this.currentMatchIndex < newRound.length && newRound[this.currentMatchIndex].isBye) {
      this.matchHistory.push({
        matchId: newRound[this.currentMatchIndex].id,
        photo1: newRound[this.currentMatchIndex].photo1,
        photo2: null,
        winner: newRound[this.currentMatchIndex].winner,
        votes: { '1': 0, '2': 0 },
        round: this.currentRound,
        isBye: true
      });
      this.currentMatchIndex++;
    }

    // Eğer tüm maçlar bye ise, turnuva bitti
    if (this.currentMatchIndex >= newRound.length) {
      const winners = newRound.map(m => m.winner).filter(Boolean);
      if (winners.length === 1) {
        this.winner = winners[0];
        this.isActive = false;
      }
    }

    return this.getState();
  }

  /**
   * Toplam tur sayısını hesapla
   */
  getTotalRounds() {
    if (this.photos.length <= 1) return 0;
    return Math.ceil(Math.log2(this.photos.length));
  }

  /**
   * Tam durum bilgisini getir
   */
  getState() {
    const currentMatch = this.getCurrentMatch();
    const currentRoundMatches = this.bracket[this.currentRound] || [];

    return {
      isActive: this.isActive,
      photos: this.photos,
      currentRound: this.currentRound,
      totalRounds: this.bracket.length > 0 ? Math.ceil(Math.log2(this.photos.length)) : 0,
      currentMatchIndex: this.currentMatchIndex,
      totalMatchesInRound: currentRoundMatches.filter(m => !m.isBye).length,
      currentMatch: currentMatch ? {
        id: currentMatch.id,
        photo1: currentMatch.photo1,
        photo2: currentMatch.photo2,
        isBye: currentMatch.isBye,
        votes: this.votes[currentMatch.id] || { '1': 0, '2': 0 },
        totalVoters: this.voterLog[currentMatch.id]
          ? Object.keys(this.voterLog[currentMatch.id]).length
          : 0
      } : null,
      voteStream: this.voteStream,
      winner: this.winner,
      bracket: this.bracket,
      matchHistory: this.matchHistory
    };
  }
}

module.exports = TournamentManager;
