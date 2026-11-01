/* =========================================================
   الإعلانات — Google H5 Games Ads (Ad Placement API)
   Ads.interstitial(name)  ← إعلان بين المراحل (قبل وبعد القيم)
   Ads.reward(name)        ← إعلان بمكافأة، يرجع true لو شافه كامل
   ========================================================= */
(function () {
  'use strict';
  const cfg = window.ADS_CONFIG || {};
  let real = false;
  let pauseCb = null, resumeCb = null;

  function init() {
    if (cfg.publisherId && /^ca-pub-\d{10,20}$/.test(cfg.publisherId)) {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };
      const s = document.createElement('script');
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + cfg.publisherId;
      if (cfg.testMode) s.setAttribute('data-adbreak-test', 'on');
      s.setAttribute('data-ad-frequency-hint', cfg.frequencyHint || '30s');
      document.head.appendChild(s);
      window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
      real = true;
    }
  }

  /* إعلان تجريبي وهمي يوضح لك مكان الإعلان قبل ما تفعّل AdSense */
  function fakeAd(label, seconds) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'fake-ad';
      el.innerHTML = `<div class="fake-ad-box">
          <div class="fake-ad-tag">إعلان تجريبي</div>
          <div class="fake-ad-emoji">📺</div>
          <h3>${label}</h3>
          <p>هنا بيطلع إعلان جوجل الحقيقي لما تحط رقم الناشر في config.js</p>
          <div class="fake-ad-count">${seconds}</div>
          <button class="btn btn-outline fake-ad-skip" hidden>إغلاق ✕</button>
        </div>`;
      document.body.appendChild(el);
      let n = seconds;
      const countEl = el.querySelector('.fake-ad-count');
      const skip = el.querySelector('.fake-ad-skip');
      const iv = setInterval(() => {
        n--;
        countEl.textContent = n > 0 ? n : '✓';
        if (n <= 0) { clearInterval(iv); skip.hidden = false; }
      }, 1000);
      let dismissedEarly = false;
      el.addEventListener('click', (e) => { if (e.target === el && n > 0) dismissedEarly = true; });
      skip.onclick = () => { el.remove(); resolve(!dismissedEarly); };
    });
  }

  function interstitial(name, type) {
    if (real) {
      return new Promise((resolve) => {
        window.adBreak({
          type: type || 'next',
          name: name,
          beforeAd: () => pauseCb && pauseCb(),
          afterAd: () => resumeCb && resumeCb(),
          adBreakDone: (info) => resolve(info)
        });
      });
    }
    if (cfg.simulate !== false) return fakeAd('إعلان بين المراحل', 3);
    return Promise.resolve(null);
  }

  /* يرجع { granted: true/false, available: true/false } */
  function reward(name) {
    if (real) {
      return new Promise((resolve) => {
        let granted = false, available = false;
        window.adBreak({
          type: 'reward',
          name: name,
          beforeAd: () => pauseCb && pauseCb(),
          afterAd: () => resumeCb && resumeCb(),
          beforeReward: (showAdFn) => { available = true; showAdFn(); },
          adDismissed: () => { granted = false; },
          adViewed: () => { granted = true; },
          adBreakDone: () => resolve({ granted, available })
        });
      });
    }
    if (cfg.simulate !== false) return fakeAd('إعلان بمكافأة', 5).then((ok) => ({ granted: ok, available: true }));
    return Promise.resolve({ granted: false, available: false });
  }

  window.Ads = {
    init,
    interstitial,
    reward,
    get isReal() { return real; },
    onPause(fn) { pauseCb = fn; },
    onResume(fn) { resumeCb = fn; }
  };
})();
