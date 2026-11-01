/* =========================================================
   ارسم وخمّن — منطق اللعبة الأونلاين
   ========================================================= */
(function () {
  'use strict';

  /* ==================== ثوابت ==================== */
  const W = 800, H = 600;
  const PLAYER_COLORS = ['#FF6B6B', '#FFA500', '#E0A800', '#4CAF50', '#4D96FF', '#A855F7', '#EC4899', '#14B8A6'];
  const PALETTE = ['#111111', '#7F8C8D', '#FFFFFF', '#E74C3C', '#E67E22', '#F1C40F', '#2ECC71', '#16A085', '#3498DB', '#1F3A93', '#9B59B6', '#EC4899', '#8B4513', '#FFB6C1'];
  const SIZES = [4, 9, 18, 32];
  const CRAZY_COLORS = ['#E74C3C', '#E67E22', '#F1C40F', '#2ECC71', '#3498DB', '#9B59B6', '#EC4899', '#111111'];

  const TWISTS = [
    { id: 'mirror', name: 'مرآة', emoji: '🪞', desc: 'رسمتك تنعكس يمين ويسار' },
    { id: 'upside', name: 'بالمقلوب', emoji: '🙃', desc: 'رسمتك تنقلب فوق تحت' },
    { id: 'shaky', name: 'إيد ترجف', emoji: '📳', desc: 'الخط يهتز وأنت ترسم' },
    { id: 'color', name: 'قلم مجنون', emoji: '🌈', desc: 'لون القلم يتغير كل ثانية' },
    { id: 'size', name: 'خط مطاطي', emoji: '📏', desc: 'سمك الخط يكبر ويصغر لحاله' },
    { id: 'invisible', name: 'حبر مخفي', emoji: '👻', desc: 'أنت ما تشوف رسمتك، بس الباقين يشوفونها' },
    { id: 'lag', name: 'قلم كسول', emoji: '🐢', desc: 'الخط يلحق إصبعك ببطء' }
  ];
  const SABS = [
    { id: 'upside', name: 'قلب الشاشة', emoji: '🙃', ms: 7000 },
    { id: 'mirror', name: 'مرآة', emoji: '🪞', ms: 7000 },
    { id: 'shake', name: 'زلزال', emoji: '🌋', ms: 7000 },
    { id: 'rainbow', name: 'قوس قزح', emoji: '🌈', ms: 7000 },
    { id: 'giant', name: 'قلم عملاق', emoji: '🖌️', ms: 6000 },
    { id: 'tiny', name: 'قلم نملة', emoji: '🐜', ms: 7000 },
    { id: 'lag', name: 'تثقيل', emoji: '🐢', ms: 7000 },
    { id: 'blind', name: 'تعمية', emoji: '🙈', ms: 4000 }
  ];
  const TWIST_BY_ID = Object.fromEntries(TWISTS.map((t) => [t.id, t]));
  const SAB_BY_ID = Object.fromEntries(SABS.map((t) => [t.id, t]));

  const MIN_PLAYERS = 2, MAX_PLAYERS = 8;
  const CHOOSE_MS = 15000, RESULTS_MS = 8000;
  const DRAW_TIME = 30; // وقت الرسم بالثواني
  const MAX_SAB_PER_TURN = 2, MAX_CHARGES = 5;
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  /* ==================== الحالة ==================== */
  const S = {
    db: null,
    me: { id: null, name: '' },
    code: null,
    meta: null,
    players: {},
    game: null,
    chat: [],
    sabs: new Map(),
    unsubs: [],
    stopPresence: null,
    screen: null,
    hostBusy: null,
    hostBusyAt: 0,
    lowSince: null,
    lobbyAdDone: false,
    lastPhaseKey: null,
    localMsgs: [],
    lastTick: -1,
    muted: false
  };

  /* ==================== أدوات ==================== */
  const $ = (s, r) => (r || document).querySelector(s);
  const app = () => document.getElementById('app');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const now = () => (S.db ? S.db.now() : Date.now());
  const rp = (p) => `rooms/${S.code}${p ? '/' + p : ''}`;
  const primary = (entry) => String(entry || '').split('|')[0];
  const firstChar = (n) => esc(Array.from(String(n || '?').trim())[0] || '?');

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[ً-ْـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => (w.length > 3 && w.startsWith('ال') ? w.slice(2) : w))
      .join('');
  }
  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  function checkGuess(text, entry) {
    const g = normalize(text);
    if (!g) return 'miss';
    let close = false;
    for (const alt of String(entry || '').split('|')) {
      const a = normalize(alt);
      if (!a) continue;
      if (g === a) return 'hit';
      const d = lev(g, a);
      if (d === 1 || (d === 2 && a.length >= 6)) close = true;
    }
    return close ? 'close' : 'miss';
  }

  function isOnline(p) {
    if (!p || p.online === false) return false;
    if (S.db && S.db.onlineTimeout && p.seen && now() - p.seen > S.db.onlineTimeout) return false;
    return true;
  }
  function playerList() {
    return Object.entries(S.players || {}).filter(([, p]) => p && p.name).map(([id, p]) => ({ id, ...p })).sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
  }
  const onlinePlayers = () => playerList().filter(isOnline);
  const amHost = () => S.meta && S.meta.hostId === S.me.id;
  const myPlayer = () => S.players[S.me.id] || {};
  const nameOf = (id) => (S.players[id] && S.players[id].name) || 'لاعب';
  const colorOf = (id) => (S.players[id] && S.players[id].color) || '#999';

  /* ==================== صوت ==================== */
  const Sound = {
    ctx: null,
    unlock() {
      if (this.ctx) return;
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ }
    },
    beep(freq, dur, type, vol, delay) {
      if (S.muted || !this.ctx) return;
      const c = this.ctx, t = c.currentTime + (delay || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.02);
    },
    correct() { this.beep(880, 0.12); this.beep(1320, 0.18, 'sine', 0.08, 0.1); },
    otherCorrect() { this.beep(660, 0.1, 'triangle', 0.05); },
    tick() { this.beep(700, 0.05, 'square', 0.025); },
    sab() { this.beep(160, 0.3, 'sawtooth', 0.06); this.beep(120, 0.3, 'sawtooth', 0.05, 0.12); },
    turn() { this.beep(523, 0.1, 'triangle', 0.06); this.beep(784, 0.15, 'triangle', 0.06, 0.1); },
    win() { [523, 659, 784, 1047].forEach((f, i) => this.beep(f, 0.18, 'triangle', 0.07, i * 0.12)); }
  };
  document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
  window.Ads && Ads.onPause(() => { if (Sound.ctx) Sound.ctx.suspend(); });
  window.Ads && Ads.onResume(() => { if (Sound.ctx) Sound.ctx.resume(); });

  /* ==================== رسائل منبثقة ==================== */
  function toast(msg, kind, ms) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.classList.add('out'), (ms || 2600) - 300);
    setTimeout(() => el.remove(), ms || 2600);
  }
  function confetti(n) {
    const set = ['🎉', '🎨', '🏆', '⭐', '✨', '🎊', '🌟', '😈'];
    for (let i = 0; i < (n || 40); i++) {
      setTimeout(() => {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.textContent = pick(set);
        c.style.left = Math.random() * 100 + 'vw';
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 3000);
      }, i * 30);
    }
  }
  function setSeoVisible(v) {
    const seo = document.getElementById('seo');
    if (seo) seo.hidden = !v;
    document.body.classList.toggle('in-room', !v);
  }

  /* ==================== لوحة الرسم ==================== */
  const Board = {
    canvas: null, ctx: null,
    chunks: new Map(),
    localKeys: new Set(),
    pending: false,
    mount(canvas) {
      this.canvas = canvas;
      const scale = 2;
      canvas.width = W * scale; canvas.height = H * scale;
      this.ctx = canvas.getContext('2d');
      this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
      this.redraw();
    },
    alpha(ch) {
      const g = S.game;
      if (g && g.phase === 'drawing' && g.drawerId === S.me.id && g.twist === 'invisible' && !ch.e) return 0.05;
      return 1;
    },
    drawChunk(ch, alphaOverride) {
      const ctx = this.ctx;
      if (!ctx || !ch || !ch.p || ch.p.length < 2) return;
      ctx.save();
      ctx.globalAlpha = alphaOverride != null ? alphaOverride : this.alpha(ch);
      ctx.strokeStyle = ctx.fillStyle = ch.e ? '#FFFFFF' : ch.c || '#111';
      ctx.lineWidth = ch.w || 8;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const p = ch.p;
      if (p.length === 2) {
        ctx.beginPath(); ctx.arc(p[0], p[1], (ch.w || 8) / 2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
        ctx.stroke();
      }
      ctx.restore();
    },
    redraw() {
      const ctx = this.ctx;
      if (!ctx) return;
      ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H); ctx.restore();
      for (const ch of this.chunks.values()) this.drawChunk(ch);
    },
    scheduleRedraw() {
      if (this.pending) return;
      this.pending = true;
      requestAnimationFrame(() => { this.pending = false; this.redraw(); });
    },
    add(k, v) {
      this.chunks.set(k, v);
      if (this.localKeys.has(k)) return;
      this.drawChunk(v);
    },
    remove(k) {
      this.chunks.delete(k);
      this.localKeys.delete(k);
      this.scheduleRedraw();
    },
    reset() { this.chunks.clear(); this.localKeys.clear(); this.redraw(); },
    snapshot() {
      // صورة للمشاركة: خلفية بيضا + اسم الكلمة + اسم اللعبة
      const g = S.game || {};
      const last = g.last || {};
      const out = document.createElement('canvas');
      out.width = 1080; out.height = 1080;
      const c = out.getContext('2d');
      const grd = c.createLinearGradient(0, 0, 1080, 1080);
      grd.addColorStop(0, '#FF6B6B'); grd.addColorStop(0.5, '#FFD93D'); grd.addColorStop(1, '#4D96FF');
      c.fillStyle = grd; c.fillRect(0, 0, 1080, 1080);
      c.fillStyle = '#fff';
      roundRect(c, 60, 190, 960, 720, 36); c.fill();
      c.drawImage(this.canvas, 80, 210, 920, 690);
      c.direction = 'rtl'; c.textAlign = 'center'; c.fillStyle = '#fff';
      c.font = '900 64px Tajawal, sans-serif';
      c.fillText('الكلمة: ' + primary(last.word || g.word), 540, 110);
      const tw = TWIST_BY_ID[last.twist || g.twist];
      c.font = '700 40px Tajawal, sans-serif';
      if (tw) c.fillText(`التحدي: ${tw.name} ${tw.emoji} — رسم ${nameOf(last.drawerId || g.drawerId)}`, 540, 165);
      c.font = '800 42px Tajawal, sans-serif';
      c.fillText('🎨 ارسم وخمّن — ' + location.host, 540, 1000);
      return out;
    }
  };
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  /* ==================== القلم (للرسام) ==================== */
  const Pen = {
    color: '#111111', size: 9, eraser: false,
    down: false, sid: null, sids: [], target: null, cur: null, last: null, buf: null, pushedForSid: 0,
    flushIv: null, raf: null, active: [],
    fx() {
      const g = S.game || {};
      const t = g.twist;
      const n = Date.now();
      this.active = this.active.filter((a) => a.until > n);
      const s = new Set(this.active.map((a) => a.id));
      return {
        mirror: (t === 'mirror') !== s.has('mirror'),
        upside: (t === 'upside') !== s.has('upside'),
        jitter: s.has('shake') ? 24 : t === 'shaky' ? 7 : 0,
        lag: t === 'lag' || s.has('lag'),
        rainbow: s.has('rainbow'),
        crazy: t === 'color',
        giant: s.has('giant'),
        tiny: s.has('tiny'),
        rubber: t === 'size'
      };
    },
    style(fx) {
      const n = Date.now();
      let c = this.color, w = this.size;
      if (fx.rainbow) c = CRAZY_COLORS[Math.floor(n / 180) % CRAZY_COLORS.length];
      else if (fx.crazy) c = CRAZY_COLORS[Math.floor(seeded(Math.floor(n / 1000))() * CRAZY_COLORS.length)];
      if (fx.giant) w = 42;
      else if (fx.tiny) w = 2;
      else if (fx.rubber) w = Math.round(3 + seeded(Math.floor(n / 280) + 7)() * 28);
      if (this.eraser) return { c: '#FFFFFF', w: Math.max(w, 14) * 1.6, e: 1 };
      return { c, w, e: 0 };
    },
    canDraw() {
      const g = S.game;
      return g && g.phase === 'drawing' && g.drawerId === S.me.id && now() < g.endsAt;
    },
    rawPoint(ev) {
      const r = Board.canvas.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
    },
    map(pt, fx) {
      let { x, y } = pt;
      if (fx.mirror) x = W - x;
      if (fx.upside) y = H - y;
      return { x: clamp(x, 0, W), y: clamp(y, 0, H) };
    },
    attach(canvas) {
      canvas.addEventListener('pointerdown', (e) => this.onDown(e));
      canvas.addEventListener('pointermove', (e) => this.onMove(e));
      canvas.addEventListener('pointerup', (e) => this.onUp(e));
      canvas.addEventListener('pointercancel', (e) => this.onUp(e));
      canvas.addEventListener('lostpointercapture', (e) => this.onUp(e));
    },
    onDown(e) {
      if (!this.canDraw() || this.down) return;
      e.preventDefault();
      try { Board.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const fx = this.fx();
      this.down = true;
      this.sid = Net.randId(6);
      this.sids.push(this.sid);
      this.pushedForSid = 0;
      this.target = this.map(this.rawPoint(e), fx);
      this.cur = { ...this.target };
      const p = this.jit(this.cur, fx);
      this.last = p;
      const st = this.style(fx);
      this.buf = { ...st, p: [p.x, p.y] };
      Board.drawChunk({ ...st, p: [p.x, p.y] }, Board.alpha(st));
      this.flushIv = setInterval(() => this.flush(false), 70);
      const loop = () => {
        if (!this.down) return;
        const f = this.fx();
        if (f.lag) {
          this.cur.x += (this.target.x - this.cur.x) * 0.1;
          this.cur.y += (this.target.y - this.cur.y) * 0.1;
          this.step(this.cur, f);
        } else if (f.jitter && this.target) {
          // الرجفة تشتغل حتى لو الإصبع واقف
          if (Math.random() < 0.35) this.step(this.target, f);
        }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    },
    onMove(e) {
      if (!this.down) return;
      e.preventDefault();
      if (!this.canDraw()) return this.onUp(e);
      const fx = this.fx();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of (evs.length ? evs : [e])) {
        this.target = this.map(this.rawPoint(ev), fx);
        if (!fx.lag) { this.cur = { ...this.target }; this.step(this.target, fx); }
      }
    },
    jit(pt, fx) {
      if (!fx.jitter) return { x: Math.round(pt.x), y: Math.round(pt.y) };
      return {
        x: Math.round(clamp(pt.x + (Math.random() - 0.5) * 2 * fx.jitter, 0, W)),
        y: Math.round(clamp(pt.y + (Math.random() - 0.5) * 2 * fx.jitter, 0, H))
      };
    },
    step(pt, fx) {
      const p = this.jit(pt, fx);
      if (this.last && p.x === this.last.x && p.y === this.last.y) return;
      const st = this.style(fx);
      if (this.buf && (st.c !== this.buf.c || st.w !== this.buf.w || st.e !== this.buf.e)) {
        this.flush(true);
        this.buf = { ...st, p: [this.last.x, this.last.y] };
      }
      Board.drawChunk({ ...st, p: [this.last.x, this.last.y, p.x, p.y] }, Board.alpha(st));
      this.buf.p.push(p.x, p.y);
      this.last = p;
    },
    flush(force) {
      const b = this.buf;
      if (!b || b.p.length < 4) return;
      if (!force && b.p.length < 6 && this.down) return;
      const key = S.db.key();
      Board.localKeys.add(key);
      S.db.set(rp('strokes/' + key), { s: this.sid, by: S.me.id, c: b.c, w: b.w, e: b.e, p: b.p });
      this.pushedForSid++;
      this.buf = { c: b.c, w: b.w, e: b.e, p: [this.last.x, this.last.y] };
    },
    onUp() {
      if (!this.down) return;
      this.down = false;
      clearInterval(this.flushIv);
      cancelAnimationFrame(this.raf);
      if (this.buf && this.buf.p.length >= 4) this.flush(true);
      else if (this.buf && this.pushedForSid === 0) {
        const key = S.db.key();
        Board.localKeys.add(key);
        S.db.set(rp('strokes/' + key), { s: this.sid, by: S.me.id, c: this.buf.c, w: this.buf.w, e: this.buf.e, p: this.buf.p.slice(0, 2) });
      }
      this.buf = null;
    },
    undo() {
      if (!this.canDraw()) return;
      while (this.sids.length) {
        const sid = this.sids.pop();
        const keys = [...Board.chunks.entries()].filter(([, v]) => v.s === sid).map(([k]) => k);
        if (keys.length) {
          const upd = {};
          keys.forEach((k) => { upd[k] = null; });
          S.db.update(rp('strokes'), upd);
          return;
        }
      }
    },
    clear() {
      if (!this.canDraw()) return;
      S.db.remove(rp('strokes'));
      this.sids = [];
    },
    resetTurn() {
      this.active = [];
      this.sids = [];
      this.eraser = false;
      this.down = false;
      clearInterval(this.flushIv);
      cancelAnimationFrame(this.raf);
    }
  };

  function renderConnError() {
    setSeoVisible(false);
    const ua = navigator.userAgent || '';
    const inApp = /Discord|Snapchat|Instagram|FBAN|FBAV|Twitter|TikTok|musical_ly|Line\/|WhatsApp/i.test(ua);
    app().innerHTML = `
      <div class="glass-card text-center home-card">
        <div class="emoji-huge">📡</div>
        <h2>ما قدرنا نتصل باللعبة</h2>
        ${inApp
          ? '<p>أنت فاتح الرابط من داخل تطبيق (ديسكورد أو سناب أو غيره). افتحه في <b>Safari</b> أو <b>Chrome</b> وبيشتغل 👌</p><p class="muted small">اضغط ⋯ أو أيقونة المشاركة، واختر "فتح في المتصفح"</p>'
          : '<p>تأكد من اتصالك بالإنترنت وجرّب مرة ثانية.</p>'}
        <button class="btn btn-primary btn-block" id="retryBtn">🔄 حاول مرة ثانية</button>
        <button class="btn btn-outline btn-block" id="copyLinkBtn" style="margin-top:10px">🔗 نسخ الرابط</button>
      </div>`;
    $('#retryBtn').onclick = () => location.reload();
    $('#copyLinkBtn').onclick = () => copyText(location.href);
  }

  /* ==================== الشاشة: البداية ==================== */
  function renderLoading() {
    app().innerHTML = `<div class="glass-card text-center"><div class="emoji-huge spin">🎨</div><h2>جاري التحميل…</h2></div>`;
  }

  function renderHome(prefillCode, err) {
    S.screen = 'home';
    setSeoVisible(true);
    const code = prefillCode || '';
    const local = S.db && S.db.mode === 'local';
    app().innerHTML = `
      <div class="glass-card text-center home-card">
        <div class="emoji-huge bounce">🎨</div>
        <h1>ارسم وخمّن</h1>
        <p class="tagline">ارسم بالمقلوب، بقلم مجنون، وخرّب على ربعك 😈</p>
        ${local ? localBanner() : ''}
        ${err ? `<div class="alert">${esc(err)}</div>` : ''}
        <label class="field-label" for="nameInput">اسمك</label>
        <input id="nameInput" class="input-modern" maxlength="15" placeholder="✏️ اكتب اسمك" value="${esc(S.me.name)}" autocomplete="nickname">
        ${code ? `
          <div class="join-invite">
            <p>انعزمت على غرفة <b class="code-pill">${esc(code)}</b></p>
            <button class="btn btn-success btn-block" id="joinInviteBtn">🚪 ادخل الغرفة</button>
          </div>
          <button class="btn btn-link" id="newRoomInstead">أو سوّ غرفة جديدة</button>
        ` : `
          <button class="btn btn-primary btn-block" id="createBtn">✨ سوّ غرفة جديدة</button>
          <div class="or"><span>أو ادخل برمز الغرفة</span></div>
          <div class="row">
            <input id="codeInput" class="input-modern code-input" maxlength="5" placeholder="ABCDE" autocomplete="off" autocapitalize="characters" dir="ltr">
            <button class="btn btn-info" id="joinBtn">دخول</button>
          </div>
        `}
      </div>`;
    const nameInput = $('#nameInput');
    const getName = () => {
      const n = nameInput.value.trim().replace(/\s+/g, ' ').slice(0, 15);
      if (!n) { nameInput.focus(); nameInput.classList.add('shake'); setTimeout(() => nameInput.classList.remove('shake'), 500); toast('اكتب اسمك أول 🙏', 'warn'); return null; }
      S.me.name = n;
      localStorage.setItem('dg_name', n);
      return n;
    };
    if (code) {
      $('#joinInviteBtn').onclick = () => getName() && joinRoom(code);
      $('#newRoomInstead').onclick = () => { history.replaceState(null, '', location.pathname); renderHome(); };
      nameInput.onkeydown = (e) => { if (e.key === 'Enter') $('#joinInviteBtn').click(); };
    } else {
      $('#createBtn').onclick = () => getName() && createRoom();
      const ci = $('#codeInput');
      ci.oninput = () => { ci.value = ci.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
      const doJoin = () => {
        const c = ci.value.trim();
        if (c.length < 4) { toast('اكتب رمز الغرفة', 'warn'); ci.focus(); return; }
        if (getName()) joinRoom(c);
      };
      $('#joinBtn').onclick = doJoin;
      ci.onkeydown = (e) => { if (e.key === 'Enter') doJoin(); };
      nameInput.onkeydown = (e) => { if (e.key === 'Enter') $('#createBtn').click(); };
    }
    if (!S.me.name) nameInput.focus();
  }

  function localBanner() {
    return `<div class="local-banner">🧪 <b>وضع التجربة:</b> الغرف تشتغل بين تبويبات نفس المتصفح بس. انسخ رابط الغرفة وافتحه في تبويب جديد عشان تجرّب. للعب أونلاين بين الجوالات حط إعدادات Firebase في <code>js/config.js</code>.</div>`;
  }

  /* ==================== الغرف ==================== */
  function genCode() {
    let s = '';
    const r = crypto.getRandomValues(new Uint8Array(5));
    for (const x of r) s += CODE_CHARS[x % CODE_CHARS.length];
    return s;
  }

  async function createRoom() {
    renderLoading();
    try {
      let code = null;
      for (let i = 0; i < 6; i++) {
        const c = genCode();
        const exists = await S.db.get(`rooms/${c}/meta`);
        if (!exists) { code = c; break; }
      }
      if (!code) throw new Error('no code');
      S.me.id = S.me.id || Net.randId(12);
      await S.db.set(`rooms/${code}`, {
        meta: { hostId: S.me.id, createdAt: now(), settings: { rounds: 2, drawTime: 80 } },
        game: { phase: 'lobby' }
      });
      await joinRoom(code, false, true);
    } catch (e) {
      console.error(e);
      renderHome('', 'صار خطأ وما قدرنا نسوي الغرفة. جرّب مرة ثانية.');
    }
  }

  async function joinRoom(code, resume, created) {
    renderLoading();
    try {
      const meta = await S.db.get(`rooms/${code}/meta`);
      if (!meta) { history.replaceState(null, '', location.pathname); sessionStorage.removeItem('dg_sess'); return renderHome('', 'الغرفة هذي مو موجودة أو انتهت 😕'); }
      const players = (await S.db.get(`rooms/${code}/players`)) || {};
      S.me.id = S.me.id || Net.randId(12);
      const existing = players[S.me.id];
      const onlineCount = Object.entries(players).filter(([id, p]) => id !== S.me.id && isOnline(p)).length;
      if (!existing && onlineCount >= MAX_PLAYERS) { return renderHome('', 'الغرفة فل (8 لاعبين) 😅'); }
      const used = new Set(Object.entries(players).filter(([id, p]) => id !== S.me.id && isOnline(p)).map(([, p]) => p.color));
      const color = (existing && existing.color) || PLAYER_COLORS.find((c) => !used.has(c)) || pick(PLAYER_COLORS);

      S.code = code;
      await S.db.update(rp('players/' + S.me.id), {
        name: S.me.name,
        color,
        joinedAt: (existing && existing.joinedAt) || now(),
        score: (existing && existing.score) || 0,
        sab: existing && existing.sab != null ? existing.sab : 0,
        online: true
      });
      sessionStorage.setItem('dg_sess', JSON.stringify({ code, pid: S.me.id }));
      history.replaceState(null, '', location.pathname + '?r=' + code);
      if (!existing && !created) S.db.push(rp('chat'), { k: 'sys', t: `${S.me.name} دخل الغرفة 👋`, at: now() });
      subscribe();
      S.stopPresence = S.db.presence(rp('players/' + S.me.id));
      S.lobbyAdDone = false;
    } catch (e) {
      console.error(e);
      renderHome(code, 'ما قدرنا ندخل الغرفة. تأكد من الاتصال وجرّب مرة ثانية.');
    }
  }

  function subscribe() {
    unsubscribe();
    S.chat = []; S.sabs.clear(); Board.chunks.clear(); Board.localKeys.clear();
    S.meta = null; S.players = {}; S.game = null; S.screen = null; S.lastPhaseKey = null;
    S.unsubs.push(S.db.onValue(rp('meta'), (v) => {
      if (!v) { leaveRoom('gone'); return; }
      S.meta = v; route();
    }));
    S.unsubs.push(S.db.onValue(rp('players'), (v) => {
      S.players = v || {};
      const mine = S.players[S.me.id];
      if (mine && mine.name) S.wasIn = true;
      else if (S.wasIn) { leaveRoom('kicked'); return; }
      checkHost(); route();
    }));
    S.unsubs.push(S.db.onValue(rp('game'), (v) => onGame(v || { phase: 'lobby' })));
    S.unsubs.push(S.db.onChild(rp('chat'), {
      added: (k, v) => { S.chat.push({ k, ...v }); if (S.chat.length > 120) S.chat.shift(); renderChat(); },
      removed: (k) => { S.chat = S.chat.filter((m) => m.k !== k); renderChat(); }
    }));
    S.unsubs.push(S.db.onChild(rp('strokes'), {
      added: (k, v) => Board.add(k, v),
      removed: (k) => Board.remove(k)
    }));
    S.unsubs.push(S.db.onChild(rp('sab'), {
      added: (k, v) => onSab(k, v),
      removed: (k) => { S.sabs.delete(k); updateSabUI(); }
    }));
    S.hostIv = setInterval(hostTick, 400);
    S.uiIv = setInterval(uiTick, 250);
  }

  function unsubscribe() {
    S.unsubs.forEach((u) => { try { u(); } catch (e) { /* ignore */ } });
    S.unsubs = [];
    clearInterval(S.hostIv); clearInterval(S.uiIv);
  }

  async function leaveRoom(reason) {
    const code = S.code;
    if (!code) return;
    unsubscribe();
    S.wasIn = false;
    if (S.stopPresence) { try { S.stopPresence(!!reason); } catch (e) { /* ignore */ } S.stopPresence = null; }
    if (!reason) {
      // آخر واحد يطلع يحذف الغرفة
      const others = playerList().filter((p) => p.id !== S.me.id && isOnline(p));
      if (!others.length) S.db.remove(`rooms/${code}`);
      else S.db.push(`rooms/${code}/chat`, { k: 'sys', t: `${S.me.name} طلع من الغرفة`, at: now() });
    }
    S.code = null; S.meta = null; S.game = null; S.players = {};
    sessionStorage.removeItem('dg_sess');
    history.replaceState(null, '', location.pathname);
    renderHome('', reason === 'gone' ? 'الغرفة انتهت' : reason === 'kicked' ? 'المضيف طلّعك من الغرفة' : '');
  }

  function checkHost() {
    if (!S.meta || !S.code) return;
    const host = S.players[S.meta.hostId];
    if (host && isOnline(host)) return;
    const cands = onlinePlayers();
    if (cands.length && cands[0].id === S.me.id) {
      S.db.update(rp('meta'), { hostId: S.me.id });
      toast('صرت أنت المضيف 👑', 'info');
    }
  }

  /* ==================== التوجيه ==================== */
  function onGame(g) {
    const prev = S.game;
    S.game = g;
    const key = g.phase + ':' + (g.turn != null ? g.turn : '');
    if (key !== S.lastPhaseKey) {
      const prevPhase = prev && prev.phase;
      S.lastPhaseKey = key;
      S.hostBusy = null;
      onPhaseChange(g, prevPhase);
    }
    route();
  }

  function onPhaseChange(g, prevPhase) {
    if (g.phase === 'choosing') {
      Pen.resetTurn();
      S.localMsgs = [];
      if (g.drawerId === S.me.id) { Sound.turn(); }
    }
    if (g.phase === 'drawing') {
      Pen.resetTurn();
      Board.scheduleRedraw();
    }
    if (g.phase === 'results') {
      Pen.onUp();
      Board.scheduleRedraw(); // يظهر الحبر المخفي للرسام
      const every = (window.ADS_CONFIG || {}).betweenTurnsEvery || 0;
      if (every > 0 && g.turn != null && (g.turn + 1) % every === 0) setTimeout(() => Ads.interstitial('between_turns', 'next'), 1500);
    }
    if (g.phase === 'gameover' && prevPhase && prevPhase !== 'gameover') {
      Sound.win(); confetti(50);
      setTimeout(() => Ads.interstitial('game_over', 'next'), 2500);
    }
    if (g.phase === 'lobby' && prevPhase && prevPhase !== 'lobby') {
      Board.reset();
    }
  }

  function route() {
    if (!S.code || !S.meta || !S.game) return;
    const ph = S.game.phase;
    const target = ph === 'lobby' ? 'lobby' : ph === 'gameover' ? 'gameover' : 'game';
    if (S.screen !== target) {
      S.screen = target;
      setSeoVisible(false);
      if (target === 'lobby') renderLobby();
      else if (target === 'game') renderGame();
      else renderGameOver();
    } else {
      if (target === 'lobby') updateLobby();
      else if (target === 'game') updateGame();
      else updateGameOver();
    }
  }

  /* ==================== شاشة الانتظار (اللوبي) ==================== */
  function roomLink() { return location.origin + location.pathname + '?r=' + S.code; }

  function shareButtons() {
    return `
      <div class="share-row">
        <button class="btn btn-outline" data-act="copy">🔗 نسخ الرابط</button>
      </div>`;
  }
  function bindShare(root) {
    root.querySelectorAll('[data-act]').forEach((b) => {
      const act = b.dataset.act;
      if (act === 'wa') b.onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(`تعال العب معي ارسم وخمّن 🎨😈\nرمز الغرفة: ${S.code}\n${roomLink()}`), '_blank');
      if (act === 'copy') b.onclick = () => copyText(roomLink());
      if (act === 'share') b.onclick = () => navigator.share({ title: 'ارسم وخمّن', text: `تعال العب معي! رمز الغرفة ${S.code}`, url: roomLink() }).catch(() => {});
    });
  }
  function copyText(t) {
    const done = () => toast('انسخ الرابط ✅', 'ok');
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done));
    else fallbackCopy(t, done);
  }
  function fallbackCopy(t, done) {
    const ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { prompt('انسخ الرابط:', t); }
    ta.remove();
  }

  function renderLobby() {
    app().innerHTML = `
      <div class="lobby">
        <div class="glass-card text-center">
          <div class="lobby-head">
            <button class="btn btn-ghost" id="leaveBtn" title="خروج">🚪</button>
            <div>
              <p class="muted">رمز الغرفة</p>
              <div class="room-code" dir="ltr">${esc(S.code)}</div>
            </div>
            <span style="width:42px"></span>
          </div>
          ${S.db.mode === 'local' ? localBanner() : ''}
          <p class="muted">ارسل الرابط لربعك يدخلون 👇</p>
          ${shareButtons()}
        </div>
        <div class="lobby-grid">
          <div class="glass-card">
            <h3>👥 اللاعبين <span id="pCount" class="muted"></span></h3>
            <div id="lobbyPlayers"></div>
          </div>
          <div class="glass-card">
            <h3>⚙️ الإعدادات</h3>
            <div id="lobbySettings"></div>
            <div class="sab-card">
              <div><b>😈 شحنات التخريب:</b> <span id="lobbyCharges"></span></div>
              <p class="muted small">كل دور عندك تخريب مجاني. الشحنات تعطيك تخريب زيادة.</p>
              <button class="btn btn-secondary btn-block" id="rewardBtn">🎬 شاهد إعلان = +1 تخريب</button>
            </div>
            <div id="startArea"></div>
          </div>
        </div>
      </div>`;
    $('#leaveBtn').onclick = () => confirmLeave();
    $('#rewardBtn').onclick = watchRewardAd;
    bindShare(app());
    updateLobby();
    if (!S.lobbyAdDone) {
      S.lobbyAdDone = true;
      // إعلان قبل القيم: وهم ينتظرون الباقين يدخلون
      setTimeout(() => { if (S.screen === 'lobby') Ads.interstitial('lobby_wait', 'start'); }, 1200);
    }
  }

  function updateLobby() {
    const list = playerList();
    const online = list.filter(isOnline);
    const host = amHost();
    const el = $('#lobbyPlayers');
    if (!el) return;
    $('#pCount').textContent = `(${online.length}/${MAX_PLAYERS})`;
    el.innerHTML = online.map((p) => `
      <div class="player-item ${p.id === S.me.id ? 'me' : ''}">
        <div class="player-avatar" style="background:${esc(p.color)}">${firstChar(p.name)}</div>
        <div class="player-name">${esc(p.name)} ${p.id === S.me.id ? '<span class="you">(أنت)</span>' : ''}</div>
        ${S.meta.hostId === p.id ? '<span title="المضيف">👑</span>' : ''}
        ${host && p.id !== S.me.id ? `<button class="btn-remove" data-kick="${esc(p.id)}" title="طرد">✕</button>` : ''}
      </div>`).join('') + (online.length < 2 ? '<div class="empty">⏳ بانتظار لاعبين ثانيين…</div>' : '');
    el.querySelectorAll('[data-kick]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.kick;
        if (confirm(`تطرد ${nameOf(id)}؟`)) S.db.remove(rp('players/' + id));
      };
    });

    const st = S.meta.settings || { rounds: 2, drawTime: 80 };
    const sEl = $('#lobbySettings');
    const roundsOpts = [1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${st.rounds === n ? 'selected' : ''}>${n}</option>`).join('');
    const active = document.activeElement && sEl.contains(document.activeElement);
    if (!active) {
      sEl.innerHTML = `
        <div class="setting"><label>عدد الجولات</label><select id="setRounds" ${host ? '' : 'disabled'}>${roundsOpts}</select></div>
        <div class="setting"><label>وقت الرسم</label><b>${DRAW_TIME} ثانية</b></div>
        ${host ? '' : '<p class="muted small">المضيف بس يقدر يغيّر الإعدادات</p>'}`;
      if (host) {
        $('#setRounds').onchange = (e) => S.db.update(rp('meta/settings'), { rounds: +e.target.value });
      }
    }
    $('#lobbyCharges').textContent = '⚡'.repeat(myPlayer().sab || 0) || '0';
    $('#rewardBtn').disabled = (myPlayer().sab || 0) >= MAX_CHARGES;

    const sa = $('#startArea');
    if (host) {
      sa.innerHTML = `<button class="btn btn-primary btn-block big" id="startBtn" ${online.length < MIN_PLAYERS ? 'disabled' : ''}>🚀 ابدأ اللعبة</button>
        ${online.length < MIN_PLAYERS ? '<p class="muted small text-center">تحتاج لاعبين على الأقل</p>' : ''}`;
      $('#startBtn').onclick = startGame;
    } else {
      sa.innerHTML = `<div class="waiting">⏳ بانتظار <b>${esc(nameOf(S.meta.hostId))}</b> يبدأ اللعبة…</div>`;
    }
  }

  function confirmLeave() {
    if (confirm('أكيد تبي تطلع من الغرفة؟')) leaveRoom();
  }
  function toggleMute() {
    S.muted = !S.muted;
    localStorage.setItem('dg_muted', S.muted ? '1' : '0');
    document.querySelectorAll('#muteBtn').forEach((b) => { b.textContent = S.muted ? '🔇' : '🔊'; });
  }

  async function watchRewardAd() {
    const cur = myPlayer().sab || 0;
    if (cur >= MAX_CHARGES) { toast('عندك الحد الأقصى من الشحنات ⚡', 'warn'); return; }
    const res = await Ads.reward('sabotage_charge');
    if (res && res.granted) {
      const latest = (S.players[S.me.id] && S.players[S.me.id].sab) || 0;
      await S.db.set(rp(`players/${S.me.id}/sab`), Math.min(MAX_CHARGES, latest + 1));
      toast('+1 شحنة تخريب 😈⚡', 'ok');
    } else if (res && !res.available) {
      toast('ما فيه إعلان متاح الحين، جرّب بعد شوي', 'warn');
    } else {
      toast('لازم تكمّل الإعلان عشان تاخذ الشحنة', 'warn');
    }
  }

  /* ==================== منطق المضيف ==================== */
  function hostLock(key, fn) {
    S.hostBusy = key; S.hostBusyAt = Date.now();
    Promise.resolve().then(fn).catch((e) => { console.error(e); S.hostBusy = null; });
  }

  async function startGame() {
    if (!amHost()) return;
    const online = onlinePlayers();
    if (online.length < MIN_PLAYERS) return;
    const st = S.meta.settings || { rounds: 2, drawTime: 80 };
    const order = shuffle(online.map((p) => p.id));
    const upd = {};
    for (const id of Object.keys(S.players)) upd[`players/${id}/score`] = 0;
    upd.chat = null;
    upd.strokes = null;
    upd.sab = null;
    upd.game = { phase: 'starting', order, rounds: st.rounds, totalTurns: order.length * st.rounds, drawTime: DRAW_TIME, turn: -1 };
    S.usedWords = new Set();
    await S.db.update(rp(''), upd);
    await startTurn(0, upd.game);
  }

  function pickWords(n) {
    S.usedWords = S.usedWords || new Set();
    let pool = window.WORDS.filter((w) => !S.usedWords.has(w));
    if (pool.length < n) { S.usedWords.clear(); pool = window.WORDS.slice(); }
    const res = shuffle(pool).slice(0, n);
    res.forEach((w) => S.usedWords.add(w));
    return res;
  }

  async function startTurn(turn, g) {
    g = g || S.game;
    const order = g.order || [];
    const total = g.totalTurns || 0;
    let t = turn, drawer = null;
    while (t < total) {
      const id = order[t % order.length];
      if (isOnline(S.players[id])) { drawer = id; break; }
      t++;
    }
    if (!drawer) return endGame();
    const twist = pick(TWISTS).id;
    const n = now();
    await S.db.update(rp(''), { strokes: null, sab: null });
    await S.db.update(rp('game'), {
      phase: 'choosing', turn: t, round: Math.floor(t / order.length) + 1,
      drawerId: drawer, choices: pickWords(3), twist,
      word: null, guessed: null, last: null, endsAt: null, startedAt: null,
      choiceEndsAt: n + CHOOSE_MS
    });
  }

  function chooseWord(word) {
    const g = S.game;
    if (!g || g.phase !== 'choosing') return;
    if (g.drawerId !== S.me.id && !amHost()) return;
    const n = now();
    const dt = DRAW_TIME * 1000;
    S.db.update(rp('game'), { phase: 'drawing', word, startedAt: n, endsAt: n + dt });
  }

  async function endTurn() {
    const g = S.game;
    if (!g || g.phase !== 'drawing') return;
    const guessed = Object.entries(g.guessed || {}).sort((a, b) => a[1].at - b[1].at);
    const dur = Math.max(1, (g.endsAt || 0) - (g.startedAt || 0));
    const gains = {};
    guessed.forEach(([pid, v], i) => {
      const frac = clamp(((g.endsAt || 0) - v.at) / dur, 0, 1);
      gains[pid] = Math.round(50 + 200 * frac) + (i === 0 ? 30 : 0);
    });
    const guessersCount = onlinePlayers().filter((p) => p.id !== g.drawerId).length;
    if (guessed.length) gains[g.drawerId] = Math.min(320, 40 * guessed.length + (guessed.length >= guessersCount ? 40 : 0));
    const upd = {};
    for (const [pid, pts] of Object.entries(gains)) {
      if (S.players[pid]) upd[`players/${pid}/score`] = (S.players[pid].score || 0) + pts;
    }
    upd['game/phase'] = 'results';
    upd['game/resultsEndsAt'] = now() + RESULTS_MS;
    upd['game/last'] = { word: g.word, gains, drawerId: g.drawerId, twist: g.twist };
    await S.db.update(rp(''), upd);
  }

  async function endGame() {
    await S.db.update(rp('game'), { phase: 'gameover', endedAt: now() });
    S.db.remove(rp('strokes'));
  }

  function hostTick() {
    if (!S.code || !amHost() || !S.game) return;
    const g = S.game;
    const n = now();
    if (S.hostBusy && Date.now() - S.hostBusyAt > 5000) S.hostBusy = null;
    const inGame = ['choosing', 'drawing', 'results'].includes(g.phase);
    const online = onlinePlayers();
    if (inGame && online.length < MIN_PLAYERS) {
      if (!S.lowSince) S.lowSince = Date.now();
      if (Date.now() - S.lowSince > 6000 && S.hostBusy !== 'end') { hostLock('end', endGame); }
      return;
    }
    S.lowSince = null;
    const key = g.phase + ':' + g.turn;
    if (S.hostBusy === key) return;
    if (g.phase === 'choosing') {
      if (!isOnline(S.players[g.drawerId])) return hostLock(key, () => startTurn(g.turn + 1));
      if (n > g.choiceEndsAt + 700) return hostLock(key, () => chooseWord((g.choices || [])[0] || pick(window.WORDS)));
    } else if (g.phase === 'drawing') {
      const guessers = online.filter((p) => p.id !== g.drawerId);
      const guessed = g.guessed || {};
      const all = guessers.length > 0 && guessers.every((p) => guessed[p.id]);
      if (n > g.endsAt || all || !isOnline(S.players[g.drawerId])) return hostLock(key, endTurn);
    } else if (g.phase === 'results') {
      if (n > g.resultsEndsAt) return hostLock(key, () => startTurn(g.turn + 1));
    }
  }

  /* ==================== شاشة اللعب ==================== */
  function renderGame() {
    app().innerHTML = `
      <div class="game">
        <div class="topbar glass-card">
          <button class="btn btn-ghost" id="leaveBtn" title="خروج">🚪</button>
          <div class="round-info" id="roundInfo"></div>
          <div class="word-hint" id="wordHint" dir="rtl"></div>
          <div class="timer-ring" id="timerRing"><div class="timer-ring-inner"><span id="timerText">–</span></div></div>
        </div>
        <div class="game-main">
          <aside class="players-panel glass-card" id="playersPanel"></aside>
          <section class="board-col">
            <div class="board-wrap" id="boardWrap">
              <div class="twist-badge" id="twistBadge"></div>
              <canvas id="board" aria-label="لوحة الرسم"></canvas>
              <div class="blind" id="blind" hidden>🙈</div>
              <div class="board-overlay" id="overlay" hidden></div>
            </div>
            <div class="tools glass-card" id="tools"></div>
          </section>
          <aside class="chat-panel glass-card">
            <div class="chat-log" id="chatLog"></div>
            <form class="chat-form" id="chatForm" autocomplete="off">
              <input id="chatInput" class="input-modern" maxlength="80" placeholder="اكتب تخمينك هنا…" enterkeyhint="send">
              <button class="btn btn-primary" type="submit">➤</button>
            </form>
          </aside>
        </div>
      </div>`;
    $('#leaveBtn').onclick = confirmLeave;
    const canvas = $('#board');
    Board.mount(canvas);
    Pen.attach(canvas);
    $('#chatForm').onsubmit = (e) => {
      e.preventDefault();
      const inp = $('#chatInput');
      sendChat(inp.value);
      inp.value = '';
    };
    S.toolsKey = null;
    S.overlayKey = null;
    updateGame();
    renderChat();
  }

  function updateGame() {
    if (S.screen !== 'game') return;
    const g = S.game;
    const me = S.me.id;
    const isDrawer = g.drawerId === me;
    const iGuessed = !!(g.guessed || {})[me];

    // معلومات الجولة
    const ri = $('#roundInfo');
    if (ri) ri.innerHTML = g.round ? `الجولة <b>${g.round}</b>/${g.rounds || 1}` : '';

    // التحدي
    const tw = TWIST_BY_ID[g.twist];
    const tb = $('#twistBadge');
    if (tb) {
      tb.hidden = !(tw && g.phase === 'drawing');
      if (tw) tb.innerHTML = `<span>${tw.emoji}</span> ${esc(tw.name)}`;
    }

    // اللاعبين
    renderPlayersPanel();

    // الأدوات
    const toolsKey = [g.phase, g.turn, isDrawer, iGuessed, myPlayer().sab || 0].join('|');
    if (toolsKey !== S.toolsKey) { S.toolsKey = toolsKey; renderTools(); }
    updateSabUI();

    // الطبقة فوق اللوحة
    const overlayKey = [g.phase, g.turn, isDrawer, g.phase === 'results' ? JSON.stringify(g.last || {}) : ''].join('|');
    if (overlayKey !== S.overlayKey) { S.overlayKey = overlayKey; renderOverlay(); }

    // حقل الكتابة
    const ci = $('#chatInput');
    if (ci) {
      const blocked = g.phase === 'drawing' && isDrawer;
      ci.disabled = blocked;
      ci.placeholder = blocked ? 'أنت الرسام، ارسم بس 🤐' : (g.phase === 'drawing' && !iGuessed ? 'اكتب تخمينك هنا…' : 'اكتب رسالة…');
    }
    const bw = $('#boardWrap');
    if (bw) bw.classList.toggle('can-draw', g.phase === 'drawing' && isDrawer);
    uiTick();
  }

  function renderPlayersPanel() {
    const el = $('#playersPanel');
    if (!el) return;
    const g = S.game;
    const list = playerList().filter((p) => isOnline(p) || (p.score || 0) > 0);
    const sorted = list.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
    el.innerHTML = sorted.map((p, i) => {
      const guessed = (g.guessed || {})[p.id];
      const drawing = g.drawerId === p.id;
      const gain = g.phase === 'results' && g.last && g.last.gains ? g.last.gains[p.id] : 0;
      return `<div class="pp ${p.id === S.me.id ? 'me' : ''} ${guessed ? 'guessed' : ''} ${drawing ? 'drawing' : ''} ${isOnline(p) ? '' : 'off'}">
        <div class="pp-rank">#${i + 1}</div>
        <div class="player-avatar sm" style="background:${esc(p.color)}">${firstChar(p.name)}</div>
        <div class="pp-info"><div class="pp-name">${esc(p.name)}${p.id === S.me.id ? ' <span class="you">(أنت)</span>' : ''}</div>
          <div class="pp-score">${p.score || 0}${gain ? ` <span class="gain">+${gain}</span>` : ''}</div></div>
        <div class="pp-icons">${drawing ? '✏️' : ''}${guessed ? '✅' : ''}${S.meta.hostId === p.id ? '👑' : ''}</div>
      </div>`;
    }).join('');
  }

  function renderTools() {
    const el = $('#tools');
    if (!el) return;
    const g = S.game;
    const isDrawer = g.drawerId === S.me.id;
    if (g.phase === 'drawing' && isDrawer) {
      const tw = g.twist;
      const lockColor = tw === 'color';
      const lockSize = tw === 'size';
      el.innerHTML = `
        <div class="palette ${lockColor ? 'locked' : ''}">${PALETTE.map((c) => `<button class="swatch ${Pen.color === c && !Pen.eraser ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="لون"></button>`).join('')}</div>
        <div class="tool-row">
          <div class="sizes ${lockSize ? 'locked' : ''}">${SIZES.map((s) => `<button class="size-btn ${Pen.size === s ? 'on' : ''}" data-size="${s}"><i style="width:${Math.min(s, 26)}px;height:${Math.min(s, 26)}px"></i></button>`).join('')}</div>
          <button class="btn tool ${Pen.eraser ? 'on' : ''}" id="eraserBtn">🧽</button>
          <button class="btn tool" id="undoBtn">↩️</button>
          <button class="btn tool" id="clearBtn">🗑️</button>
        </div>
        ${lockColor ? '<p class="muted small">🌈 التحدي يتحكم باللون!</p>' : ''}${lockSize ? '<p class="muted small">📏 التحدي يتحكم بالسمك!</p>' : ''}`;
      el.querySelectorAll('[data-color]').forEach((b) => b.onclick = () => { Pen.color = b.dataset.color; Pen.eraser = false; S.toolsKey = null; renderTools(); });
      el.querySelectorAll('[data-size]').forEach((b) => b.onclick = () => { Pen.size = +b.dataset.size; S.toolsKey = null; renderTools(); });
      $('#eraserBtn').onclick = () => { Pen.eraser = !Pen.eraser; renderTools(); };
      $('#undoBtn').onclick = () => Pen.undo();
      $('#clearBtn').onclick = () => { if (confirm('تمسح كل الرسمة؟')) Pen.clear(); };
    } else if (g.phase === 'drawing') {
      el.innerHTML = `
        <div class="sab-bar">
          <button class="btn btn-sab" id="sabBtn">😈 خرّب على الرسام!</button>
          <div class="sab-info" id="sabInfo"></div>
        </div>`;
      $('#sabBtn').onclick = throwSab;
    } else {
      el.innerHTML = `
        <div class="sab-bar">
          <button class="btn btn-secondary" id="rewardBtn">🎬 شاهد إعلان = +1 تخريب</button>
          <div class="sab-info">شحناتك: <b>${'⚡'.repeat(myPlayer().sab || 0) || '0'}</b></div>
        </div>`;
      $('#rewardBtn').onclick = watchRewardAd;
      $('#rewardBtn').disabled = (myPlayer().sab || 0) >= MAX_CHARGES;
    }
  }

  function renderOverlay() {
    const ov = $('#overlay');
    if (!ov) return;
    const g = S.game;
    const isDrawer = g.drawerId === S.me.id;
    const tw = TWIST_BY_ID[g.twist];
    if (g.phase === 'choosing') {
      ov.hidden = false;
      if (isDrawer) {
        ov.innerHTML = `
          <div class="ov-card">
            <h2>دورك ترسم! ✏️</h2>
            ${tw ? `<div class="twist-card"><div class="tw-emoji">${tw.emoji}</div><div><b>تحديك: ${esc(tw.name)}</b><p>${esc(tw.desc)}</p></div></div>` : ''}
            <p class="muted">اختر كلمة <span class="countdown" data-until="choiceEndsAt"></span></p>
            <div class="choices">${(g.choices || []).map((w, i) => `<button class="btn btn-info" data-choice="${i}">${esc(primary(w))}</button>`).join('')}</div>
          </div>`;
        ov.querySelectorAll('[data-choice]').forEach((b) => b.onclick = () => chooseWord(g.choices[+b.dataset.choice]));
      } else {
        ov.innerHTML = `
          <div class="ov-card">
            <div class="emoji-huge bounce">🤔</div>
            <h2>${esc(nameOf(g.drawerId))} يختار كلمة…</h2>
            ${tw ? `<p>تحديه هالمرة: <b>${tw.emoji} ${esc(tw.name)}</b></p><p class="muted small">${esc(tw.desc)}</p>` : ''}
            <p class="muted">جهّز التخريب 😈</p>
          </div>`;
      }
    } else if (g.phase === 'results') {
      const last = g.last || {};
      const gains = last.gains || {};
      const rows = Object.entries(gains).sort((a, b) => b[1] - a[1]).map(([pid, pts]) =>
        `<div class="res-row"><span class="dot" style="background:${esc(colorOf(pid))}"></span>${esc(nameOf(pid))}${pid === last.drawerId ? ' ✏️' : ''}<b>+${pts}</b></div>`).join('');
      const saboteurs = [...new Set([...S.sabs.values()].map((s) => s.from))].map(nameOf);
      ov.hidden = false;
      ov.innerHTML = `
        <div class="ov-card results">
          <p class="muted small">الكلمة كانت</p>
          <h2 class="the-word">${esc(primary(last.word))}</h2>
          ${rows || '<p>محد عرفها 😅</p>'}
          ${saboteurs.length ? `<div class="sab-reveal">😈 خرّبوا عليه: <b>${saboteurs.map(esc).join('، ')}</b></div>` : ''}
          <div class="ov-actions">
            <button class="btn btn-outline" id="saveImg">📸 احفظ الرسمة</button>
          </div>
          <p class="muted small">الدور الجاي بعد <b class="countdown" data-until="resultsEndsAt"></b> ثواني</p>
        </div>`;
      $('#saveImg').onclick = saveDrawing;
    } else if (g.phase === 'starting') {
      ov.hidden = false;
      ov.innerHTML = `<div class="ov-card"><div class="emoji-huge spin">🎨</div><h2>نجهّز اللعبة…</h2></div>`;
    } else {
      ov.hidden = true;
      ov.innerHTML = '';
    }
  }

  function wordHintHTML() {
    const g = S.game;
    if (!g) return '';
    const isDrawer = g.drawerId === S.me.id;
    const iGuessed = !!(g.guessed || {})[S.me.id];
    if (g.phase === 'choosing') return `<span class="muted">${isDrawer ? 'اختر كلمتك' : 'ينتظر الكلمة…'}</span>`;
    if (g.phase === 'results') return `<b>${esc(primary((g.last || {}).word))}</b>`;
    if (g.phase !== 'drawing' || !g.word) return '';
    const word = primary(g.word);
    if (isDrawer || iGuessed) return `<b class="word-full">${esc(word)}</b>`;
    const chars = Array.from(word);
    const letterIdx = chars.map((c, i) => (c === ' ' ? -1 : i)).filter((i) => i >= 0);
    const elapsed = clamp((now() - g.startedAt) / Math.max(1, g.endsAt - g.startedAt), 0, 1);
    let reveal = 0;
    if (letterIdx.length >= 4) reveal = elapsed > 0.75 ? 2 : elapsed > 0.5 ? 1 : 0;
    else if (letterIdx.length >= 3 && elapsed > 0.7) reveal = 1;
    const rnd = seeded(hash(g.word + ':' + g.turn));
    const order = letterIdx.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const shown = new Set(order.slice(0, reveal));
    const words = [];
    let cur = [];
    chars.forEach((c, i) => {
      if (c === ' ') { words.push(cur); cur = []; return; }
      cur.push(shown.has(i) ? `<span class="hl">${esc(c)}</span>` : '<span class="blank">_</span>');
    });
    words.push(cur);
    return `<span class="hint-letters">${words.map((w) => w.join('')).join('<span class="gap"></span>')}</span><sub>${letterIdx.length}</sub>`;
  }

  function uiTick() {
    if (!S.code || !S.game) return;
    const g = S.game;
    const n = now();
    if (S.screen === 'game') {
      let total = 1, left = 0;
      if (g.phase === 'drawing') { total = (g.endsAt - g.startedAt) || 1; left = g.endsAt - n; }
      else if (g.phase === 'choosing') { total = CHOOSE_MS; left = g.choiceEndsAt - n; }
      else if (g.phase === 'results') { total = RESULTS_MS; left = g.resultsEndsAt - n; }
      left = Math.max(0, left);
      const secs = Math.ceil(left / 1000);
      const tt = $('#timerText');
      if (tt) tt.textContent = g.phase === 'starting' ? '–' : secs;
      const ring = $('#timerRing');
      if (ring) {
        const deg = clamp(left / total, 0, 1) * 360;
        const col = g.phase === 'drawing' && secs <= 10 ? '#E74C3C' : '#FF6B6B';
        ring.style.background = `conic-gradient(${col} ${deg}deg, #E0E0E0 ${deg}deg)`;
        ring.classList.toggle('urgent', g.phase === 'drawing' && secs <= 10);
      }
      if (g.phase === 'drawing' && secs <= 5 && secs > 0 && secs !== S.lastTick) { S.lastTick = secs; Sound.tick(); }
      const wh = $('#wordHint');
      if (wh) {
        const html = wordHintHTML();
        if (wh._html !== html) { wh._html = html; wh.innerHTML = html; }
      }
      document.querySelectorAll('.countdown[data-until]').forEach((el) => {
        const t = g[el.dataset.until];
        el.textContent = t ? Math.max(0, Math.ceil((t - n) / 1000)) : '';
      });
      // التعمية
      const blind = $('#blind');
      if (blind) {
        const on = g.phase === 'drawing' && g.drawerId === S.me.id && Pen.active.some((a) => a.id === 'blind' && a.until > Date.now());
        blind.hidden = !on;
      }
      updateSabUI();
    }
  }

  /* ==================== التخريب ==================== */
  function mySabsThisTurn() {
    return [...S.sabs.values()].filter((s) => s.from === S.me.id).length;
  }
  function updateSabUI() {
    const btn = $('#sabBtn');
    const info = $('#sabInfo');
    if (!btn || !info) return;
    const g = S.game;
    const used = mySabsThisTurn();
    const charges = myPlayer().sab || 0;
    const free = used === 0;
    const can = g.phase === 'drawing' && g.drawerId !== S.me.id && used < MAX_SAB_PER_TURN && (free || charges > 0) && now() < g.endsAt;
    btn.disabled = !can || (S.sabCooldown && Date.now() < S.sabCooldown);
    const txt = used >= MAX_SAB_PER_TURN ? 'خلّصت تخريبك هالدور' : free ? 'تخريب مجاني متاح 🎁' : charges > 0 ? `شحنات: ${'⚡'.repeat(charges)}` : 'شاهد إعلان بين الأدوار عشان تاخذ شحنات';
    if (info.textContent !== txt) info.textContent = txt;
  }
  async function throwSab() {
    const g = S.game;
    if (!g || g.phase !== 'drawing' || g.drawerId === S.me.id) return;
    const used = mySabsThisTurn();
    if (used >= MAX_SAB_PER_TURN) return;
    const charges = myPlayer().sab || 0;
    if (used > 0) {
      if (charges <= 0) return;
      await S.db.set(rp(`players/${S.me.id}/sab`), charges - 1);
    }
    const type = pick(SABS).id;
    S.sabCooldown = Date.now() + 1500;
    S.db.push(rp('sab'), { from: S.me.id, type, at: now() });
    const s = SAB_BY_ID[type];
    toast(`رميت ${s.emoji} ${s.name} على الرسام 😈`, 'sab');
    updateSabUI();
  }
  function onSab(k, v) {
    S.sabs.set(k, v);
    const g = S.game;
    const s = SAB_BY_ID[v.type];
    if (!s || !g || g.phase !== 'drawing') { updateSabUI(); return; }
    const fresh = now() - (v.at || 0) < 4000;
    if (!fresh) { updateSabUI(); return; }
    if (g.drawerId === S.me.id) {
      Pen.active.push({ id: v.type, until: Date.now() + s.ms });
      Sound.sab();
      bigFlash(`😈 أحد خرّب عليك!<br>${s.emoji} ${s.name}`);
    } else if (v.from !== S.me.id) {
      toast(`😈 أحد رمى ${s.emoji} ${s.name} على الرسام`, 'sab', 2000);
    }
    updateSabUI();
  }
  function bigFlash(html) {
    const wrap = $('#boardWrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'flash';
    el.innerHTML = html;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  /* ==================== الشات والتخمين ==================== */
  function sendChat(raw) {
    const text = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!text) return;
    const g = S.game || {};
    const me = S.me.id;
    const base = { pid: me, name: S.me.name, at: now() };
    if (g.phase === 'drawing') {
      if (g.drawerId === me) { localMsg('أنت الرسام، ما تقدر تكتب 🤐'); return; }
      const guessed = !!(g.guessed || {})[me];
      if (!guessed && now() < g.endsAt) {
        const res = checkGuess(text, g.word);
        if (res === 'hit') {
          S.db.update(rp('game/guessed'), { [me]: { at: now() } });
          S.db.push(rp('chat'), { ...base, k: 'correct' });
          Sound.correct();
          return;
        }
        if (res === 'close') {
          // التخمين القريب ما ينرسل للباقين عشان ما ينكشف الجواب
          S.db.push(rp('chat'), { ...base, k: 'close' });
          localMsg(`"${text}" قريبة مرة! 🔥`);
          return;
        }
        S.db.push(rp('chat'), { ...base, k: 'msg', t: text });
        return;
      }
      if (guessed) { S.db.push(rp('chat'), { ...base, k: 'g', t: text }); return; }
    }
    S.db.push(rp('chat'), { ...base, k: 'msg', t: text });
  }
  function localMsg(t) {
    S.localMsgs.push({ k: 'local', t, at: now(), lk: Math.random() });
    renderChat();
  }
  let lastCorrectSeen = 0;
  function renderChat() {
    const log = $('#chatLog');
    if (!log) return;
    const g = S.game || {};
    const canSeeG = g.phase !== 'drawing' || g.drawerId === S.me.id || !!(g.guessed || {})[S.me.id];
    const msgs = S.chat.concat(S.localMsgs).sort((a, b) => (a.at || 0) - (b.at || 0)).slice(-80);
    log.innerHTML = msgs.map((m) => {
      if (m.k === 'sys') return `<div class="msg sys">${esc(m.t)}</div>`;
      if (m.k === 'local') return `<div class="msg local">${esc(m.t)}</div>`;
      if (m.k === 'close') return m.pid === S.me.id ? '' : `<div class="msg local">🔥 <b>${esc(m.name)}</b> قريب من الكلمة!</div>`;
      if (m.k === 'correct') return `<div class="msg correct">✅ <b>${esc(m.name)}</b> عرف الكلمة!</div>`;
      if (m.k === 'g') return canSeeG ? `<div class="msg gchat"><b style="color:${esc(colorOf(m.pid))}">${esc(m.name)}:</b> ${esc(m.t)}</div>` : '';
      return `<div class="msg"><b style="color:${esc(colorOf(m.pid))}">${esc(m.name)}:</b> ${esc(m.t)}</div>`;
    }).join('') || '<div class="msg sys">الشات هنا 💬 اكتب تخمينك!</div>';
    log.scrollTop = log.scrollHeight;
    // صوت لما أحد ثاني يعرف
    const lastCorrect = S.chat.filter((m) => m.k === 'correct').pop();
    if (lastCorrect && lastCorrect.at > lastCorrectSeen) {
      if (lastCorrectSeen && lastCorrect.pid !== S.me.id) Sound.otherCorrect();
      lastCorrectSeen = lastCorrect.at;
    }
  }

  function saveDrawing() {
    try {
      const c = Board.snapshot();
      c.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], 'rasm.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: 'ارسم وخمّن', text: 'شوف وش رسمنا 😂 ' + location.origin }); return; } catch (e) { /* cancelled */ }
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'rasm-' + Date.now() + '.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }, 'image/png');
    } catch (e) { toast('ما قدرنا نحفظ الصورة', 'warn'); }
  }

  /* ==================== نهاية اللعبة ==================== */
  function renderGameOver() {
    app().innerHTML = `
      <div class="glass-card text-center gameover">
        <div class="emoji-huge float">🏆</div>
        <h1>انتهت اللعبة!</h1>
        <div class="podium" id="podium"></div>
        <div id="standings"></div>
        <div id="goActions"></div>
        <div class="sab-card">
          <button class="btn btn-secondary btn-block" id="rewardBtn">🎬 شاهد إعلان = +1 تخريب للقيم الجاي</button>
        </div>
        ${shareButtons()}
        <button class="btn btn-link" id="leaveBtn">🚪 خروج من الغرفة</button>
      </div>`;
    $('#leaveBtn').onclick = confirmLeave;
    $('#rewardBtn').onclick = watchRewardAd;
    bindShare(app());
    updateGameOver();
  }
  function updateGameOver() {
    const list = playerList().filter((p) => isOnline(p) || (p.score || 0) > 0).sort((a, b) => (b.score || 0) - (a.score || 0));
    const pod = $('#podium');
    if (!pod) return;
    const top = list.slice(0, 3);
    const order = [top[1], top[0], top[2]];
    pod.innerHTML = order.map((p, i) => p ? `
      <div class="pod pod-${['2', '1', '3'][i]}">
        <div class="player-avatar" style="background:${esc(p.color)}">${firstChar(p.name)}</div>
        <div class="pod-name">${esc(p.name)}</div>
        <div class="pod-block">${['🥈', '🥇', '🥉'][i]}<br>${p.score || 0}</div>
      </div>` : '<div class="pod empty"></div>').join('');
    $('#standings').innerHTML = list.slice(3).map((p, i) => `
      <div class="score-item"><span>${i + 4}. ${esc(p.name)}</span><b>${p.score || 0}</b></div>`).join('');
    const ga = $('#goActions');
    if (amHost()) {
      ga.innerHTML = `<button class="btn btn-primary btn-block big" id="againBtn">🔄 قيم جديد</button>`;
      $('#againBtn').onclick = () => S.db.set(rp('game'), { phase: 'lobby' });
    } else {
      ga.innerHTML = `<div class="waiting">⏳ بانتظار المضيف يبدأ قيم جديد…</div>`;
    }
    const rb = $('#rewardBtn');
    if (rb) rb.disabled = (myPlayer().sab || 0) >= MAX_CHARGES;
  }

  /* ==================== التشغيل ==================== */
  async function boot() {
    renderLoading();
    try {
      S.db = await Net.init();
    } catch (e) {
      console.error(e);
      return renderConnError();
    }
    Ads.init();
    S.me.name = localStorage.getItem('dg_name') || '';
    const params = new URLSearchParams(location.search);
    const r = (params.get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    let sess = null;
    try { sess = JSON.parse(sessionStorage.getItem('dg_sess') || 'null'); } catch (e) { /* ignore */ }
    if (r && sess && sess.code === r && sess.pid && S.me.name) {
      S.me.id = sess.pid;
      return joinRoom(r, true);
    }
    renderHome(r);
  }

  // للاختبار
  window.__dg = { S, Board, Pen, normalize, checkGuess };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
