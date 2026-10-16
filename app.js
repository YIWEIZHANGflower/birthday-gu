(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const stages = { gift: $('gift'), wish: $('wish'), letter: $('letter') };
  const cards = [...document.querySelectorAll('.letter-card')];
  const dots = [...document.querySelectorAll('.page-dot')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let stage = 'gift', page = 0, wished = false, busy = false;
  let flameTweens = [], cardTimeline = null, signatureTimeline = null, audioNoticeTimer;
  const shareHash = '#From-YIWEI-ZHANG';
  const announce = (text) => { $('announcement').textContent = text; };
  const focus = (el) => { if (el) el.focus({ preventScroll: true }); };
  const saveHistory = (replace = false) => history[replace ? 'replaceState' : 'pushState'](
    { birthdayCard: 1, stage, page, wished }, '', `${location.pathname}${shareHash}`
  );

  function tween(target, vars) {
    if (window.gsap) return gsap.to(target, { ...vars, duration: reducedMotion.matches ? 0 : vars.duration });
    const { onComplete, ...rest } = vars;
    const elements = typeof target === 'string' ? [...document.querySelectorAll(target)] : target instanceof Element ? [target] : target;
    for (const el of elements) {
      if ('autoAlpha' in rest) { el.style.opacity = String(rest.autoAlpha); el.style.visibility = rest.autoAlpha ? 'visible' : 'hidden'; }
      if ('opacity' in rest) el.style.opacity = String(rest.opacity);
    }
    onComplete?.();
    return { kill() {} };
  }

  function positionFlames() {
    const container = $('cake-visual');
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    const scale = Math.max(width / 1024, height / 1536);
    const offsetX = (width - 1024 * scale) / 2, offsetY = (height - 1536 * scale) / 2;
    [[418, 744, '.flame-two'], [500, 744, '.flame-zero']].forEach(([x, y, sel]) => {
      const flame = container.querySelector(sel);
      flame.style.left = `${x * scale + offsetX}px`;
      flame.style.top = `${y * scale + offsetY}px`;
      flame.style.width = `${Math.max(10, 24 * scale)}px`;
      flame.style.height = `${Math.max(24, 57 * scale)}px`;
    });
    const smoke = container.querySelector('.candle-smoke');
    smoke.style.left = `${460 * scale + offsetX}px`;
    smoke.style.top = `${744 * scale + offsetY - 25}px`;
  }

  function candleMotion() {
    flameTweens.forEach(t => t.kill()); flameTweens = [];
    if (stage !== 'wish' || wished || reducedMotion.matches || !window.gsap) return;
    // A short settling flicker, then a quiet static flame.
    flameTweens = [...document.querySelectorAll('.flame i')].map((el, i) => gsap.to(el, {
      scaleX: .8, scaleY: .92, rotation: i ? -5 : 6, duration: .45 + i * .08,
      repeat: 6, yoyo: true, ease: 'sine.inOut', clearProps: 'transform'
    }));
  }

  const music = (() => {
    const config = window.BIRTHDAY_MUSIC || {};
    const tracks = {};
    let selected = 'intro', enabled = true, generation = 0;
    for (const [key, options] of Object.entries(config)) {
      if (!options.src) continue;
      const audio = new Audio(options.src);
      audio.preload = key === 'intro' ? 'auto' : 'metadata';
      audio.loop = false; audio.volume = options.volume ?? .35;
      audio.addEventListener('ended', () => {
        audio.currentTime = Math.min(options.start || 0, Math.max(0, audio.duration - .2));
        if (enabled && selected === key) audio.play().catch(() => render(false));
      });
      audio.addEventListener('error', () => {
        if (selected === key) { render(false); $('sound-label').textContent = '开启音乐'; }
      });
      tracks[key] = audio;
    }
    function notice(message) {
      clearTimeout(audioNoticeTimer);
      $('audio-notice').textContent = message; $('audio-notice').hidden = false;
      audioNoticeTimer = setTimeout(() => { $('audio-notice').hidden = true; }, 3400);
    }
    function render(playing) {
      const button = $('sound-button');
      button.setAttribute('aria-pressed', String(playing));
      button.setAttribute('aria-label', playing ? '暂停音乐' : '开启音乐');
      $('sound-label').textContent = playing ? config[selected]?.title || '音乐播放中' : '开启音乐';
      button.title = playing ? `${config[selected]?.artist || ''}《${config[selected]?.title || ''}》` : '开启音乐';
    }
    function volume(audio, value, onComplete) {
      if (window.gsap) gsap.to(audio, { volume: value, duration: .8, overwrite: true, onComplete });
      else { audio.volume = value; onComplete?.(); }
    }
    async function play(key, explicit = false, restart = false) {
      const changed = selected !== key;
      selected = key;
      const request = ++generation;
      const audio = tracks[key], settings = config[key];
      for (const [id, other] of Object.entries(tracks)) {
        if (id !== key) volume(other, 0, () => other.pause());
      }
      if (!enabled) { render(false); return; }
      if (!audio) {
        render(false);
        if (explicit) notice('音乐暂时无法播放，你可以继续打开这份祝福。');
        return;
      }
      try {
        // Request audible playback directly inside the gesture. Starting at volume 0
        // can be allowed as silent autoplay, then blocked when the fade becomes audible.
        if (window.gsap) gsap.killTweensOf(audio);
        audio.volume = settings.volume ?? .35;
        if (restart || changed || audio.currentTime < (settings.start || 0)) {
          const seek = () => { audio.currentTime = Math.min(settings.start || 0, Number.isFinite(audio.duration) ? Math.max(0, audio.duration - .2) : settings.start || 0); };
          if (audio.readyState >= 1) seek();
          else audio.addEventListener('loadedmetadata', seek, { once: true });
        }
        const playing = audio.play();
        if (playing) await playing;
        if (!enabled || selected !== key) { audio.pause(); return; }
        if (request !== generation) return;
        volume(audio, settings.volume ?? .35); render(true);
      } catch {
        if (request !== generation || selected !== key) return;
        render(false);
        if (explicit) notice('轻点右上角的音乐按钮，即可再次尝试开启声音。');
      }
    }
    function select(key, restart = false) { return play(key, false, restart); }
    $('sound-button').addEventListener('click', () => {
      const audio = tracks[selected];
      if (audio && !audio.paused && enabled) {
        enabled = false; ++generation;
        Object.values(tracks).forEach(a => volume(a, 0, () => a.pause()));
        render(false);
      } else { enabled = true; play(selected, true); }
    });
    // Retry in the actual activation event: touchend on mobile and click for
    // mouse, keyboard or assistive technology. A touch pointerdown alone may
    // happen before the browser grants transient user activation.
    function retryOnGesture(event) {
      if (event.target.closest('#sound-button')) return;
      const audio = tracks[selected];
      if (enabled && audio?.paused) play(selected);
    }
    document.addEventListener('touchend', retryOnGesture, { passive: true });
    document.addEventListener('click', retryOnGesture);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) Object.values(tracks).forEach(a => a.pause());
      else if (enabled) play(selected);
    });
    return { select, render, hasAudio: () => Object.keys(tracks).length === 2 };
  })();

  const signatureStrokes = [...document.querySelectorAll('.signature-stroke')];
  const fromStrokes = [...document.querySelectorAll('.from-stroke')];
  const signatureFinish = document.querySelector('.signature-finish');
  const signatureParts = document.querySelector('.signature-parts');

  function finishSignature() {
    signatureTimeline?.kill(); signatureTimeline = null;
    [...fromStrokes, ...signatureStrokes].forEach(stroke => {
      stroke.style.strokeDashoffset = '0'; stroke.style.visibility = 'visible';
    });
    if (signatureFinish) signatureFinish.style.opacity = '1';
    if (signatureParts) signatureParts.style.opacity = '0';
  }

  function writeSignature(delay = 0) {
    finishSignature();
    if (!window.gsap || reducedMotion.matches || !signatureFinish) return;
    [...fromStrokes, ...signatureStrokes].forEach(stroke => {
      const length = stroke.getTotalLength();
      stroke.style.strokeDasharray = `${length} ${length}`;
      stroke.style.strokeDashoffset = String(length);
      stroke.style.visibility = 'hidden';
    });
    signatureFinish.style.opacity = '0';
    if (signatureParts) signatureParts.style.opacity = '1';
    signatureTimeline = gsap.timeline({ delay });
    function drawStroke(stroke, pause = 0) {
      const length = stroke.getTotalLength(), duration = Number(stroke.dataset.duration);
      signatureTimeline.set(stroke, { visibility: 'visible' }, `+=${pause}`);
      const pace = (stroke.dataset.pace || '0,0;1,1').split(';').map(pair => pair.split(',').map(Number));
      for (let i = 1; i < pace.length; i++) {
        signatureTimeline.to(stroke, {
          strokeDashoffset: length * (1 - pace[i][1]),
          duration: duration * (pace[i][0] - pace[i - 1][0]), ease: 'none'
        });
      }
    }
    fromStrokes.forEach(stroke => drawStroke(stroke));
    signatureStrokes.forEach((stroke, index) => {
      drawStroke(stroke, Number(stroke.dataset.delay || 0) + (index === 0 ? .25 : 0));
    });
    // Each mask only reveals its own original ink, so later strokes cannot
    // appear early at crossings. The completed silhouette remains identical.
    signatureTimeline.set(signatureFinish, { opacity: 1 });
    if (signatureParts) signatureTimeline.set(signatureParts, { opacity: 0 });
  }

  function showStage(next, { record = true, moveFocus = true } = {}) {
    if (!stages[next]) return;
    const previous = stages[stage];
    if (next !== stage && window.gsap) gsap.killTweensOf(previous);
    stage = next;
    for (const [name, el] of Object.entries(stages)) {
      const active = name === next;
      el.hidden = !active; el.inert = !active;
      if (active) { el.style.visibility = 'visible'; el.style.opacity = '1'; }
    }
    $('back-button').hidden = next === 'gift';
    $('before-wish').hidden = wished;
    $('after-wish').hidden = !wished;
    $('cake-visual').classList.toggle('is-out', wished);
    if (next === 'wish') { requestAnimationFrame(positionFlames); candleMotion(); }
    else { flameTweens.forEach(t => t.kill()); flameTweens = []; }
    if (next === 'letter') {
      renderPage(page); music.select('letter');
      if (page === cards.length - 1) writeSignature(.65);
    } else { finishSignature(); music.select('intro'); }
    if (record) saveHistory();
    if (window.gsap && !reducedMotion.matches) gsap.fromTo(stages[next], { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .65, ease: 'power2.out', clearProps: 'transform' });
    if (moveFocus) requestAnimationFrame(() => focus(next === 'gift' ? $('gift-heading') : next === 'wish' ? $('wish-heading') : cards[page].querySelector('h2')));
    busy = false;
  }

  function renderPage(index) {
    finishSignature();
    cards.forEach((card, i) => {
      const active = i === index;
      card.hidden = !active; card.inert = !active; card.classList.toggle('is-active', active);
      card.style.transform = ''; card.style.opacity = ''; card.style.visibility = ''; card.style.zIndex = '';
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle('is-current', i === index);
      if (i === index) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current');
    });
    $('previous-card').disabled = index === 0;
    $('next-card').disabled = index === cards.length - 1;
    $('swipe-hint').textContent = index === cards.length - 1 ? '这封信，读完啦' : '左右轻滑';
    $('read-again').hidden = index !== cards.length - 1;
  }

  function goToPage(index, { record = true, moveFocus = true } = {}) {
    const target = Math.min(cards.length - 1, Math.max(0, index));
    if (target === page || stage !== 'letter') return;
    cardTimeline?.kill();
    const oldIndex = page, oldCard = cards[oldIndex], newCard = cards[target];
    page = target;
    renderPage(page);
    if (record) saveHistory(true);
    if (window.gsap && !reducedMotion.matches) {
      const direction = target > oldIndex ? 1 : -1;
      oldCard.hidden = false; oldCard.inert = true;
      oldCard.style.zIndex = '3'; newCard.style.zIndex = '4';
      cardTimeline = gsap.timeline({ defaults: { duration: .46, ease: 'power2.inOut' } });
      cardTimeline.to(oldCard, { xPercent: -direction * 9, rotation: -direction * 2, autoAlpha: 0 }, 0)
        .fromTo(newCard, { xPercent: direction * 14, rotation: direction * 2, autoAlpha: 0 }, { xPercent: 0, rotation: 0, autoAlpha: 1 }, .06)
        .call(() => { oldCard.hidden = true; oldCard.style.zIndex = ''; newCard.style.zIndex = ''; });
    }
    if (page === cards.length - 1) writeSignature(.58);
    announce(`第 ${page + 1} 页，共六页。`);
    if (moveFocus) focus(newCard.querySelector('h2'));
  }

  function birthdaySparkles() {
    if (reducedMotion.matches || !window.gsap) return;
    const container = $('sparkles');
    for (let i = 0; i < 18; i++) {
      const particle = document.createElement('span'); particle.className = 'sparkle';
      particle.style.left = `${25 + Math.random() * 50}%`; particle.style.top = `${43 + Math.random() * 10}%`;
      container.append(particle);
      gsap.fromTo(particle, { autoAlpha: 0, scale: .3 }, {
        autoAlpha: 1, scale: .7 + Math.random(), x: (Math.random() - .5) * 150, y: -70 - Math.random() * 170,
        duration: 1.15 + Math.random() * .6, ease: 'power2.out', onComplete: () => particle.remove()
      });
    }
  }

  $('open-gift').addEventListener('click', () => {
    if (busy) return; busy = true;
    music.select('intro');
    if (window.gsap && !reducedMotion.matches) {
      const tl = gsap.timeline();
      tl.to('.intro-art', { scale: 1.045, duration: .65, ease: 'power2.inOut' }, 0)
        .to('.gift-copy, .gift-controls', { autoAlpha: 0, y: -10, duration: .35 }, 0)
        .call(() => { showStage('wish'); gsap.set('.intro-art, .gift-copy, .gift-controls', { clearProps: 'all' }); });
    } else showStage('wish');
  });

  $('make-wish').addEventListener('click', () => {
    if (wished || busy) return;
    wished = true; flameTweens.forEach(t => t.kill()); flameTweens = [];
    const done = () => {
      $('cake-visual').classList.add('is-out');
      $('before-wish').hidden = true; $('after-wish').hidden = false;
      if (window.gsap && !reducedMotion.matches) gsap.fromTo($('after-wish'), { autoAlpha: 0, y: 9 }, { autoAlpha: 1, y: 0, duration: .6, ease: 'power2.out' });
      birthdaySparkles(); announce('愿你今天许的愿，有一天都能实现。'); focus($('open-letter')); saveHistory(true);
    };
    if (window.gsap && !reducedMotion.matches) {
      gsap.timeline().to('.flame', { scaleX: .2, scaleY: .1, autoAlpha: 0, duration: .38, ease: 'power2.in' })
        .fromTo('.candle-smoke', { opacity: 0, y: 0 }, { opacity: .6, y: -16, duration: .3 }, .2)
        .to('.candle-smoke', { opacity: 0, y: -55, duration: .65 }, .5).call(done, [], .7);
    } else done();
  });

  $('open-letter').addEventListener('click', () => { page = 0; showStage('letter'); });
  $('previous-card').addEventListener('click', () => goToPage(page - 1));
  $('next-card').addEventListener('click', () => goToPage(page + 1));
  dots.forEach(dot => dot.addEventListener('click', () => goToPage(Number(dot.dataset.page))));
  $('read-again').addEventListener('click', () => goToPage(0));
  $('back-button').addEventListener('click', () => {
    if (stage === 'letter') showStage('wish');
    else showStage('gift');
  });

  let pointer = null;
  $('letter-deck').addEventListener('pointerdown', e => {
    if (!e.isPrimary || e.button !== 0 || window.getSelection()?.toString()) return;
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  $('letter-deck').addEventListener('pointerup', e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y; pointer = null;
    if (Math.abs(dx) >= 38 && Math.abs(dx) > Math.abs(dy) * 1.4) goToPage(page + (dx < 0 ? 1 : -1), { moveFocus: false });
  });
  $('letter-deck').addEventListener('pointercancel', () => { pointer = null; });
  document.addEventListener('keydown', e => {
    if (stage !== 'letter' || e.altKey || e.ctrlKey || e.metaKey || e.target.matches('input,textarea,select')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goToPage(page + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goToPage(page - 1); }
    if (e.key === 'Home') { e.preventDefault(); goToPage(0); }
    if (e.key === 'End') { e.preventDefault(); goToPage(5); }
  });
  function restore() {
    cardTimeline?.kill();
    const hash = location.hash;
    const match = hash.match(/^#letter-([1-6])$/);
    const saved = history.state;
    const savedVisit = hash === shareHash && saved?.birthdayCard === 1 &&
      Object.hasOwn(stages, saved.stage) && Number.isInteger(saved.page) &&
      saved.page >= 0 && saved.page < cards.length && typeof saved.wished === 'boolean';
    // The address stays shareable while browser history remembers the open page.
    // Existing gift/wish/letter links are still accepted and then normalized.
    wished = savedVisit ? saved.wished : hash === '#wish-done' || !!match;
    page = savedVisit ? saved.page : match ? Number(match[1]) - 1 : 0;
    const next = savedVisit ? saved.stage : match ? 'letter' : hash.startsWith('#wish') ? 'wish' : 'gift';
    showStage(next, { record: false, moveFocus: false });
    saveHistory(true);
    // Restore candle appearance if returning to an unlit visit through browser history.
    if (!wished && window.gsap) gsap.set('.flame', { clearProps: 'opacity,visibility,transform' });
  }
  window.addEventListener('popstate', restore);
  window.addEventListener('resize', positionFlames, { passive: true });
  reducedMotion.addEventListener?.('change', candleMotion);
  reducedMotion.addEventListener?.('change', () => { if (reducedMotion.matches) finishSignature(); });
  $('cake-art').addEventListener('load', positionFlames);
  restore();
  // Expose only non-sensitive state for local QA and audio configuration checks.
  window.birthdayState = () => ({ stage, page: page + 1, wished, audioConfigured: music.hasAudio() });
})();
