/**
 * Kick Chat Entegrasyonu
 * Kick'in Pusher tabanlı WebSocket bağlantısı üzerinden chat mesajlarını dinler
 */

const Pusher = require('pusher-js').Pusher || require('pusher-js');

class KickChatIntegration {
  constructor(onVote) {
    this.onVote = onVote;            // Oy geldiğinde çağrılacak callback
    this.pusherClient = null;
    this.channel = null;
    this.channelSlug = null;
    this.channelId = null;
    this.isConnected = false;
    this._statusCallback = null;     // Durum değişikliği callback
  }

  /**
   * Durum değişikliği callback'i set et
   */
  onStatusChange(callback) {
    this._statusCallback = callback;
  }

  /**
   * Durum değiştiğinde callback'i çağır
   */
  _emitStatus() {
    if (this._statusCallback) {
      this._statusCallback(this.getStatus());
    }
  }

  /**
   * Kick kanalına bağlan
   * Kick'in public chat'i Pusher üzerinden çalışır
   */
  async connect(channelSlug) {
    if (this.isConnected) {
      this.disconnect();
    }

    this.channelSlug = channelSlug;

    try {
      // Kick kanal bilgisini al — channel ID'ye ihtiyacımız var
      const channelId = await this._getChannelId(channelSlug);
      if (!channelId) {
        console.error(`❌ Kick kanal bulunamadı: ${channelSlug}`);
        this.isConnected = false;
        this._emitStatus();
        return false;
      }

      this.channelId = channelId;
      console.log(`📡 Kanal ID bulundu: ${channelId}, Pusher'a bağlanılıyor...`);

      // Pusher'a bağlan
      this.pusherClient = new Pusher('32cbd69e4b950bf97679', {
        cluster: 'us2',
        forceTLS: true,
        disableStats: true,
        enabledTransports: ['ws', 'wss']
      });

      // Bağlantı durumlarını dinle
      return new Promise((resolve) => {
        let resolved = false;

        this.pusherClient.connection.bind('connected', () => {
          this.isConnected = true;
          console.log(`✅ Pusher bağlandı! Chat kanalına abone olunuyor...`);

          // Chat kanalına abone ol
          const chatChannelName = `chatrooms.${this.channelId}.v2`;
          console.log(`📢 Abone olunuyor: ${chatChannelName}`);
          this.channel = this.pusherClient.subscribe(chatChannelName);

          this.channel.bind('pusher:subscription_succeeded', () => {
            console.log(`✅ Kick chat bağlandı: ${channelSlug} (Chatroom ID: ${channelId})`);
            this._emitStatus();
            if (!resolved) { resolved = true; resolve(true); }
          });

          this.channel.bind('pusher:subscription_error', (err) => {
            console.error('❌ Kanal abone olma hatası:', err);
            this.isConnected = false;
            this._emitStatus();
            if (!resolved) { resolved = true; resolve(false); }
          });

          // Chat mesajlarını dinle
          this.channel.bind('App\\Events\\ChatMessageEvent', (data) => {
            this._handleMessage(data);
          });

          // Alternatif event isimleri de dene
          this.channel.bind('ChatMessageEvent', (data) => {
            this._handleMessage(data);
          });

          // Tüm eventleri logla (debug için)
          this.channel.bind_global((eventName, data) => {
            if (!eventName.startsWith('pusher:')) {
              console.log(`💬 Event: ${eventName}`, typeof data === 'object' ? JSON.stringify(data).substring(0, 200) : data);
            }
          });
        });

        this.pusherClient.connection.bind('disconnected', () => {
          this.isConnected = false;
          console.log('❌ Pusher bağlantısı kesildi');
          this._emitStatus();
        });

        this.pusherClient.connection.bind('error', (err) => {
          console.error('❌ Pusher hata:', err);
          this.isConnected = false;
          this._emitStatus();
          if (!resolved) { resolved = true; resolve(false); }
        });

        this.pusherClient.connection.bind('failed', () => {
          console.error('❌ Pusher bağlantısı başarısız');
          this.isConnected = false;
          this._emitStatus();
          if (!resolved) { resolved = true; resolve(false); }
        });

        // 15 saniye timeout
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            if (!this.isConnected) {
              console.error('❌ Bağlantı zaman aşımına uğradı');
              this._emitStatus();
              resolve(false);
            } else {
              resolve(true);
            }
          }
        }, 15000);
      });
    } catch (error) {
      console.error('❌ Kick bağlantı hatası:', error);
      this.isConnected = false;
      this._emitStatus();
      return false;
    }
  }

  async _getChannelId(slug) {
    return new Promise((resolve, reject) => {
      console.log(`🔍 Kanal aranıyor: ${slug}`);
      const https = require('https');
      
      const options = {
        hostname: 'kick.com',
        path: `/api/v2/channels/${slug}`,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PostmanRuntime/7.32.3'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(data);
              const chatroomId = json.chatroom?.id;
              if (chatroomId) {
                console.log(`✅ Chatroom ID bulundu: ${chatroomId}`);
                resolve(chatroomId);
              } else {
                console.log('⚠️ API chatroom ID içermiyor.');
                resolve(json.id || null);
              }
            } catch (e) {
              console.error('❌ JSON parse hatası:', e.message);
              resolve(null);
            }
          } else {
            console.log(`⚠️ API cevabı: ${res.statusCode}`);
            resolve(null);
          }
        });
      });

      req.on('error', (e) => {
        console.error('❌ İstek hatası:', e.message);
        resolve(null);
      });

      req.end();
    });
  }

  /**
   * Gelen chat mesajını işle
   */
  _handleMessage(data) {
    try {
      const content = (data.content || data.message || '').trim();
      const username = data.sender?.username || data.sender?.slug || data.user?.username || 'anonim';

      console.log(`💬 [${username}]: ${content}`);

      // Sadece "1" veya "2" mesajlarını dinle
      if (content === '1' || content === '2') {
        this.onVote(username, content);
      }
    } catch (error) {
      console.error('Mesaj işleme hatası:', error);
    }
  }

  /**
   * Bağlantıyı kes
   */
  disconnect() {
    if (this.pusherClient) {
      this.pusherClient.disconnect();
      this.pusherClient = null;
      this.channel = null;
    }
    this.isConnected = false;
    this.channelSlug = null;
    this.channelId = null;
    console.log('🔌 Kick chat bağlantısı kapatıldı');
    this._emitStatus();
  }

  /**
   * Bağlantı durumu
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      channelSlug: this.channelSlug,
      channelId: this.channelId
    };
  }
}

module.exports = KickChatIntegration;
