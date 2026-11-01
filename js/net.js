/* =========================================================
   طبقة الاتصال: Firebase Realtime Database أو وضع تجربة محلي
   الواجهة نفسها في الحالتين:
   get / set / update / remove / key / onValue / onChild / presence / now
   ========================================================= */
(function () {
  'use strict';
  const FB_VER = '10.12.2';

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = () => rej(new Error('تعذر تحميل ' + src));
      document.head.appendChild(s);
    });
  }

  function randId(n) {
    const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const r = crypto.getRandomValues(new Uint8Array(n));
    let s = '';
    for (const x of r) s += a[x % a.length];
    return s;
  }

  const split = (p) => String(p).split('/').filter(Boolean);

  function clean(v) {
    if (v === undefined || v === null) return null;
    if (Array.isArray(v)) return v.map(clean);
    if (typeof v === 'object') {
      const o = {};
      for (const [k, x] of Object.entries(v)) {
        const c = clean(x);
        if (c !== null) o[k] = c;
      }
      return Object.keys(o).length ? o : null;
    }
    return v;
  }

  /* ---------------- وضع التجربة المحلي ---------------- */
  function LocalAdapter() {
    const KEY = 'dg_localdb_v1';
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('dg_localdb_v1') : null;
    const listeners = new Set();
    let counter = 0;

    const read = () => {
      try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
    };
    const write = (t) => {
      try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) { console.warn('local db full', e); }
    };
    function getAt(t, path) {
      let n = t;
      for (const k of split(path)) {
        if (n == null || typeof n !== 'object') return null;
        n = n[k];
      }
      return n === undefined ? null : n;
    }
    function setAt(t, path, val) {
      const ks = split(path);
      let n = t;
      const stack = [];
      for (let i = 0; i < ks.length - 1; i++) {
        if (typeof n[ks[i]] !== 'object' || n[ks[i]] === null) n[ks[i]] = {};
        stack.push([n, ks[i]]);
        n = n[ks[i]];
      }
      const last = ks[ks.length - 1];
      const c = clean(val);
      if (c === null) delete n[last];
      else n[last] = c;
      for (let i = stack.length - 1; i >= 0; i--) {
        const [p, k] = stack[i];
        if (p[k] && typeof p[k] === 'object' && Object.keys(p[k]).length === 0) delete p[k];
        else break;
      }
    }
    function overlaps(a, b) {
      const A = split(a), B = split(b);
      const n = Math.min(A.length, B.length);
      for (let i = 0; i < n; i++) if (A[i] !== B[i]) return false;
      return true;
    }
    function notify(paths) {
      const tree = read();
      for (const l of listeners) {
        if (paths.some((p) => overlaps(p, l.path))) l.evaluate(tree);
      }
    }
    function commit(paths) {
      notify(paths);
      if (bc) bc.postMessage(paths);
    }
    if (bc) bc.onmessage = (e) => notify(e.data);

    // تنظيف الغرف القديمة
    (function cleanup() {
      const t = read();
      if (t.rooms) {
        const limit = Date.now() - 3 * 3600 * 1000;
        for (const [code, r] of Object.entries(t.rooms)) {
          if (!r || !r.meta || (r.meta.createdAt || 0) < limit) delete t.rooms[code];
        }
        write(t);
      }
    })();

    const api = {
      mode: 'local',
      get: (p) => Promise.resolve(getAt(read(), p)),
      set(p, v) { const t = read(); setAt(t, p, v); write(t); commit([p]); return Promise.resolve(); },
      update(p, obj) {
        const t = read(); const ps = [];
        for (const [k, v] of Object.entries(obj)) { const full = p + '/' + k; setAt(t, full, v); ps.push(full); }
        write(t); commit(ps); return Promise.resolve();
      },
      remove(p) { return api.set(p, null); },
      key() {
        counter = (counter + 1) % 1296;
        return Date.now().toString(36).padStart(9, '0') + counter.toString(36).padStart(2, '0') + randId(4);
      },
      push(p, v) { const k = api.key(); api.set(p + '/' + k, v); return k; },
      onValue(path, cb) {
        const l = {
          path, last: undefined,
          evaluate(tree) {
            const v = getAt(tree, path);
            const s = JSON.stringify(v);
            if (s !== l.last) { l.last = s; cb(v === null ? null : JSON.parse(s)); }
          }
        };
        listeners.add(l);
        setTimeout(() => listeners.has(l) && l.evaluate(read()), 0);
        return () => listeners.delete(l);
      },
      onChild(path, { added, removed }) {
        const known = new Set();
        const l = {
          path,
          evaluate(tree) {
            const obj = getAt(tree, path) || {};
            const keys = Object.keys(obj).sort();
            for (const k of [...known]) if (!(k in obj)) { known.delete(k); removed && removed(k); }
            for (const k of keys) if (!known.has(k)) { known.add(k); added && added(k, obj[k]); }
          }
        };
        listeners.add(l);
        setTimeout(() => listeners.has(l) && l.evaluate(read()), 0);
        return () => listeners.delete(l);
      },
      now: () => Date.now(),
      onlineTimeout: 75000,
      presence(path) {
        const beat = () => api.update(path, { online: true, seen: Date.now() });
        beat();
        const iv = setInterval(beat, 2500);
        const off = () => { const t = read(); if (getAt(t, path)) api.set(path + '/online', false); };
        window.addEventListener('pagehide', off);
        return (silent) => { clearInterval(iv); window.removeEventListener('pagehide', off); if (!silent) off(); };
      }
    };
    return api;
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
    ]);
  }

  /* ---------------- Firebase ---------------- */
  async function FirebaseAdapter(cfg) {
    const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
    if (!window.firebase) {
      await withTimeout(loadScript(base + 'firebase-app-compat.js'), 15000);
      await withTimeout(Promise.all([
        loadScript(base + 'firebase-auth-compat.js'),
        loadScript(base + 'firebase-database-compat.js')
      ]), 15000);
    }
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    const auth = firebase.auth();
    // المتصفحات الداخلية (ديسكورد، سناب، انستقرام…) ممكن تعلّق التخزين،
    // فنخلي تسجيل الدخول في الذاكرة بس عشان ما يعلق
    try { await withTimeout(auth.setPersistence(firebase.auth.Auth.Persistence.NONE), 4000); } catch (e) { /* ignore */ }
    await withTimeout(auth.signInAnonymously(), 12000);
    const db = firebase.database();
    let offset = 0;
    db.ref('.info/serverTimeOffset').on('value', (s) => { offset = s.val() || 0; });

    return {
      mode: 'firebase',
      get: (p) => db.ref(p).get().then((s) => s.val()),
      set: (p, v) => db.ref(p).set(v === undefined ? null : v),
      update: (p, o) => db.ref(p).update(o),
      remove: (p) => db.ref(p).remove(),
      key: () => db.ref('x').push().key,
      push(p, v) { const r = db.ref(p).push(); r.set(v); return r.key; },
      onValue(p, cb) {
        const r = db.ref(p);
        const h = (s) => cb(s.val());
        r.on('value', h);
        return () => r.off('value', h);
      },
      onChild(p, { added, removed }) {
        const r = db.ref(p);
        const ha = (s) => added && added(s.key, s.val());
        const hr = (s) => removed && removed(s.key);
        r.on('child_added', ha);
        r.on('child_removed', hr);
        return () => { r.off('child_added', ha); r.off('child_removed', hr); };
      },
      now: () => Date.now() + offset,
      onlineTimeout: 0,
      presence(p) {
        const r = db.ref(p + '/online');
        const c = db.ref('.info/connected');
        const h = (s) => {
          if (s.val() === true) { r.onDisconnect().set(false); r.set(true); }
        };
        c.on('value', h);
        return (silent) => { c.off('value', h); r.onDisconnect().cancel(); if (!silent) r.set(false); };
      }
    };
  }

  window.Net = {
    randId,
    async init() {
      const cfg = window.FIREBASE_CONFIG || {};
      if (cfg.apiKey && cfg.databaseURL) {
        // لو فشل الاتصال نرمي الخطأ عشان تطلع رسالة واضحة بدل التعليق
        return await FirebaseAdapter(cfg);
      }
      return LocalAdapter();
    }
  };
})();
