/* Yog — a calm meditation timer for ADHD minds.
 * Plain JavaScript, no dependencies. All sounds are synthesised with the Web Audio API,
 * so the app works offline and needs no audio files. */
(() => {
  'use strict';

  // ───────────────────────── Practices ─────────────────────────
  // Each phase: [label, seconds, kind]. kind: 'in' grows the orb, 'out' shrinks it, 'hold' keeps it.
  const PRACTICES = [
    {
      id: 'anapana',
      name: 'Breath Counting',
      sk: 'Ānāpāna · आनापान',
      desc: 'Count each breath from 1 to 10, then start again. Lost count? Just begin at 1. Best first choice for a busy mind.',
      intro: 'Breathe with the circle. Count each out-breath. Losing count is normal — simply start again at 1.',
      pattern: [['Breathe in', 4, 'in'], ['Breathe out', 6, 'out']],
      counter: 'breath10',
    },
    {
      id: 'sama',
      name: 'Box Breathing',
      sk: 'Sama Vṛtti · समवृत्ति',
      desc: 'Equal in, hold, out, hold. A steady rhythm that settles a racing mind.',
      intro: 'Four equal sides: in, hold, out, hold. Let the circle lead.',
      pattern: [['Breathe in', 4, 'in'], ['Hold', 4, 'hold'], ['Breathe out', 4, 'out'], ['Hold', 4, 'hold']],
      counter: 'round',
    },
    {
      id: 'bhramari',
      name: 'Humming Bee',
      sk: 'Bhrāmarī · भ्रामरी',
      desc: 'Breathe in, then hum softly like a bee as you breathe out. The vibration gives restless attention something to hold.',
      intro: 'Close your lips. Breathe in through the nose, then hum “mmm” all the way out. Feel the buzz in your head.',
      pattern: [['Breathe in', 4, 'in'], ['Hummm…', 8, 'out']],
      counter: 'round',
    },
    {
      id: 'nadi',
      name: 'Alternate Nostril',
      sk: 'Nāḍī Śodhana · नाड़ी शोधन',
      desc: 'Breathe through one nostril at a time, switching sides. Balancing and calming; keeps the hands and mind busy.',
      intro: 'Right thumb closes the right nostril, ring finger closes the left. Follow the side shown in the circle.',
      pattern: [['In · left', 4, 'in'], ['Out · right', 6, 'out'], ['In · right', 4, 'in'], ['Out · left', 6, 'out']],
      counter: 'round',
    },
    {
      id: 'om',
      name: 'Om Chanting',
      sk: 'Oṃ Japa · ॐ जप',
      desc: 'Breathe in, then chant a long “A-U-M” on the out-breath. Sound is an easy anchor when silence feels too loud.',
      intro: 'Breathe in deeply. On the out-breath chant “Aaa-Uuu-Mmm”, letting the M fade into silence.',
      pattern: [['Breathe in', 4, 'in'], ['Aaa-Uuu-Mmm', 9, 'out']],
      counter: 'round',
    },
    {
      id: 'trataka',
      name: 'Candle Gazing',
      sk: 'Trāṭaka · त्राटक',
      desc: 'Rest your eyes on a single steady flame. One point to look at, nothing else. Near the end, close your eyes.',
      intro: 'Soften your gaze on the flame. Blink whenever you need to. When the bell rings, close your eyes.',
      pattern: null,
      counter: null,
    },
  ];

  const DURATIONS = [1, 3, 5, 10, 15, 20]; // minutes
  const SETTLE_SECONDS = 5;
  const ORB_MIN = 0.55;
  const ORB_MAX = 1;
  const TRATAKA_EYES_CLOSED_AT = 0.7; // fraction of session

  const CHECKIN_CUES = [
    'Where is your attention right now? Gently come back to the breath.',
    'Notice. No judgement. Return.',
    'If you drifted, that’s okay. Coming back is the practice.',
    'Soften your jaw and shoulders. Back to the breath.',
    'Just this breath. Nothing else to do.',
  ];

  // ───────────────────────── Storage ─────────────────────────
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: ignore */ }
    },
  };

  const DEFAULTS = {
    practice: 'anapana', duration: 3, ambient: 'none', breathTone: true,
    checkin: 60, volume: 0.7, hideClock: false, vibrate: false,
  };
  const settings = Object.assign({}, DEFAULTS, store.get('yog.settings', {}));
  const saveSettings = () => store.set('yog.settings', settings);

  // ───────────────────────── Audio ─────────────────────────
  const sound = {
    ctx: null,
    master: null,
    ambient: null,     // { gain, stop() }
    tanpuraTimer: null,

    ensure() {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return false;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = settings.volume;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    },

    setVolume(v) {
      if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    },

    // Singing-bowl style bell: a few inharmonic partials, each a slightly detuned pair for shimmer.
    bell(delay = 0, base = 196, strength = 1) {
      if (!this.ensure()) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + delay;
      const partials = [[1, 1, 7], [2.01, 0.45, 5], [2.76, 0.35, 4], [4.07, 0.18, 2.5], [5.43, 0.1, 1.6]];
      for (const [ratio, amp, decay] of partials) {
        for (const detune of [-0.6, 0.6]) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = base * ratio + detune;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.11 * amp * strength, t + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
          osc.connect(g).connect(this.master);
          osc.start(t);
          osc.stop(t + decay + 0.05);
        }
      }
    },

    // Soft gliding tone that rises while breathing in and falls while breathing out.
    breath(kind, seconds) {
      if (kind === 'hold' || !this.ensure()) return;
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const [from, to] = kind === 'in' ? [174.6, 261.6] : [261.6, 174.6]; // F3 ↔ C4
      const fade = Math.min(0.8, seconds / 3);
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc2.type = 'triangle';
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.linearRampToValueAtTime(to, t + seconds);
      osc2.frequency.setValueAtTime(from / 2, t);
      osc2.frequency.linearRampToValueAtTime(to / 2, t + seconds);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06, t + fade);
      g.gain.setValueAtTime(0.06, t + seconds - fade);
      g.gain.linearRampToValueAtTime(0.0001, t + seconds);
      osc.connect(g);
      osc2.connect(g);
      g.connect(this.master);
      osc.start(t); osc2.start(t);
      osc.stop(t + seconds + 0.05); osc2.stop(t + seconds + 0.05);
    },

    startAmbient(type) {
      this.stopAmbient();
      if (type === 'none' || !this.ensure()) return;
      const ctx = this.ctx;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 3);
      gain.connect(this.master);

      if (type === 'brown') {
        const len = ctx.sampleRate * 4;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.5;
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const g = ctx.createGain();
        g.gain.value = 0.35;
        src.connect(g).connect(gain);
        src.start();
        this.ambient = { gain, stop: () => src.stop(ctx.currentTime + 2) };
        return;
      }

      // Tanpura: four strings plucked in the classic Pa – Sa – Sa – low Sa cycle.
      const SA = 130.81; // C3
      const strings = [SA * 0.75, SA, SA, SA / 2];
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 1400;
      lowpass.Q.value = 0.7;
      lowpass.connect(gain);
      let next = ctx.currentTime + 0.1;
      let i = 0;
      const pluck = (freq, at) => {
        for (const [mult, amp] of [[1, 0.05], [1.003, 0.035]]) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = freq * mult;
          g.gain.setValueAtTime(0.0001, at);
          g.gain.linearRampToValueAtTime(amp, at + 0.04);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 4.5);
          osc.connect(g).connect(lowpass);
          osc.start(at);
          osc.stop(at + 4.6);
        }
      };
      const schedule = () => {
        // Look ahead 2 s so throttled background timers never leave gaps.
        while (next < ctx.currentTime + 2) {
          pluck(strings[i % 4], next);
          next += i % 4 === 3 ? 1.6 : 1.1;
          i++;
        }
      };
      schedule();
      this.tanpuraTimer = setInterval(schedule, 400);
      this.ambient = { gain, stop: () => {} };
    },

    stopAmbient() {
      clearInterval(this.tanpuraTimer);
      this.tanpuraTimer = null;
      if (this.ambient && this.ctx) {
        const { gain, stop } = this.ambient;
        const t = this.ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0.0001, t + 1.5);
        stop();
        setTimeout(() => gain.disconnect(), 2500);
      }
      this.ambient = null;
    },

    pause() { if (this.ctx) this.ctx.suspend(); },
    resume() { if (this.ctx) this.ctx.resume(); },
  };

  // ───────────────────────── Helpers ─────────────────────────
  const $ = (id) => document.getElementById(id);
  const now = () => performance.now() / 1000;
  const ease = (p) => 0.5 - 0.5 * Math.cos(Math.PI * p); // smooth in/out
  const fmt = (s) => {
    s = Math.max(0, Math.ceil(s));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const vibrate = (ms) => { if (settings.vibrate && navigator.vibrate) navigator.vibrate(ms); };
  const practiceById = (id) => PRACTICES.find((p) => p.id === id) || PRACTICES[0];
  const dayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function show(screenId) {
    for (const el of document.querySelectorAll('.screen')) el.classList.toggle('active', el.id === screenId);
    window.scrollTo(0, 0);
  }

  // ───────────────────────── Wake lock ─────────────────────────
  let wakeLock = null;
  async function keepAwake() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch { /* not supported or denied: fine */ }
  }
  function releaseAwake() {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }

  // ───────────────────────── Home screen ─────────────────────────
  function radioGroup(container, items, isSelected, onPick) {
    container.innerHTML = '';
    const buttons = items.map((item) => {
      const b = item.render();
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => { onPick(item.value); update(); });
      container.appendChild(b);
      return [b, item.value];
    });
    const update = () => {
      for (const [b, v] of buttons) {
        const sel = isSelected(v);
        b.setAttribute('aria-checked', String(sel));
        b.tabIndex = sel ? 0 : -1;
      }
    };
    // Arrow-key navigation within the group.
    container.addEventListener('keydown', (e) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      const idx = buttons.findIndex(([, v]) => isSelected(v));
      const [b, v] = buttons[(idx + keys[e.key] + buttons.length) % buttons.length];
      onPick(v); update(); b.focus();
    });
    update();
  }

  function buildHome() {
    radioGroup(
      $('practices'),
      PRACTICES.map((p) => ({
        value: p.id,
        render: () => {
          const b = document.createElement('button');
          b.className = 'practice';
          b.innerHTML = `<span class="name"></span><span class="sk"></span><span class="desc"></span>`;
          b.querySelector('.name').textContent = p.name;
          b.querySelector('.sk').textContent = p.sk;
          b.querySelector('.desc').textContent = p.desc;
          return b;
        },
      })),
      (v) => settings.practice === v,
      (v) => { settings.practice = v; saveSettings(); },
    );

    radioGroup(
      $('durations'),
      DURATIONS.map((m) => ({
        value: m,
        render: () => {
          const b = document.createElement('button');
          b.className = 'chip';
          b.textContent = `${m} min`;
          return b;
        },
      })),
      (v) => settings.duration === v,
      (v) => { settings.duration = v; saveSettings(); },
    );

    const bindSetting = (id, key, parse = (v) => v, prop = 'value') => {
      const el = $(id);
      el[prop] = settings[key];
      el.addEventListener('change', () => {
        settings[key] = parse(el[prop]);
        saveSettings();
        if (key === 'volume') sound.setVolume(settings.volume);
      });
    };
    bindSetting('s-ambient', 'ambient');
    bindSetting('s-breathtone', 'breathTone', Boolean, 'checked');
    bindSetting('s-checkin', 'checkin', Number);
    bindSetting('s-volume', 'volume', Number);
    bindSetting('s-hideclock', 'hideClock', Boolean, 'checked');
    bindSetting('s-vibrate', 'vibrate', Boolean, 'checked');
    $('s-volume').addEventListener('input', (e) => {
      settings.volume = Number(e.target.value);
      sound.setVolume(settings.volume);
    });

    $('test-sound').addEventListener('click', () => sound.bell(0, 196, 0.9));
    $('begin').addEventListener('click', startSession);
    $('again').addEventListener('click', startSession);
    $('home-btn').addEventListener('click', () => { show('home'); renderStats(); $('begin').focus(); });

    renderStats();
  }

  // ───────────────────────── History & stats ─────────────────────────
  function recordSession(seconds, practiceId, returns) {
    const history = store.get('yog.history', []);
    history.push({ d: dayKey(), s: Math.round(seconds), p: practiceId, r: returns });
    store.set('yog.history', history.slice(-1000));
  }

  function streakDays(history) {
    const days = new Set(history.map((h) => h.d));
    const d = new Date();
    if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1); // streak still alive if you practised yesterday
    let streak = 0;
    while (days.has(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }

  function renderStats() {
    const history = store.get('yog.history', []);
    if (!history.length) { $('stats').textContent = ''; return; }
    const today = history.filter((h) => h.d === dayKey()).reduce((a, h) => a + h.s, 0);
    const streak = streakDays(history);
    const parts = [`Today: ${Math.round(today / 60)} min`];
    if (streak > 1) parts.push(`${streak}-day streak`);
    parts.push(`${history.length} session${history.length === 1 ? '' : 's'} total`);
    $('stats').textContent = parts.join(' · ');
  }

  // ───────────────────────── Session ─────────────────────────
  const el = {};
  let S = null; // current session state
  const RING_C = 2 * Math.PI * 94;

  function startSession() {
    const practice = practiceById(settings.practice);
    sound.ensure();
    sound.startAmbient(settings.ambient);
    keepAwake();

    S = {
      practice,
      total: settings.duration * 60,
      createdAt: now(),
      startAt: null,         // when the main timer began (after settling)
      pausedAt: null,
      pausedTotal: 0,
      phaseKey: '',
      lastCheckin: 0,
      returns: 0,
      eyesClosed: false,
      done: false,
      cycle: practice.pattern ? practice.pattern.reduce((a, p) => a + p[1], 0) : 0,
    };

    el.session.classList.toggle('trataka', !practice.pattern);
    el.session.classList.remove('paused');
    el.flame.style.opacity = '1';
    el.pause.textContent = 'Pause';
    el.phase.textContent = 'Settle';
    el.count.textContent = '';
    el.cue.textContent = practice.intro;
    el.cue.style.opacity = '1';
    el.clock.textContent = settings.hideClock ? '' : fmt(S.total);
    el.ring.style.strokeDasharray = `${RING_C}`;
    el.ring.style.strokeDashoffset = `${RING_C}`;
    el.orb.style.transform = `scale(${ORB_MIN})`;
    el.tapHint.classList.remove('hidden');
    showControls();

    show('session');
    el.session.focus({ preventScroll: true });

    clearInterval(S.timer);
    S.timer = setInterval(tick, 200);
    requestAnimationFrame(frame);
  }

  // Seconds of the main practice elapsed (excludes settling and pauses).
  function elapsed() {
    if (!S || S.startAt == null) return 0;
    const t = S.pausedAt ?? now();
    return t - S.startAt - S.pausedTotal;
  }

  function currentPhase(e) {
    const { pattern } = S.practice;
    const cycleIndex = Math.floor(e / S.cycle);
    let t = e - cycleIndex * S.cycle;
    for (let i = 0; i < pattern.length; i++) {
      const [label, secs, kind] = pattern[i];
      if (t < secs) return { i, label, secs, kind, p: t / secs, left: secs - t, cycleIndex };
      t -= secs;
    }
    const last = pattern.length - 1;
    return { i: last, label: pattern[last][0], secs: pattern[last][1], kind: pattern[last][2], p: 1, left: 0, cycleIndex };
  }

  // Orb size at a given point in the cycle: 'hold' keeps whatever size the previous phase ended at.
  function orbScale(ph) {
    const { pattern } = S.practice;
    const span = ORB_MAX - ORB_MIN;
    if (ph.kind === 'in') return ORB_MIN + span * ease(ph.p);
    if (ph.kind === 'out') return ORB_MAX - span * ease(ph.p);
    for (let k = 1; k <= pattern.length; k++) {
      const prev = pattern[(ph.i - k + pattern.length) % pattern.length][2];
      if (prev === 'in') return ORB_MAX;
      if (prev === 'out') return ORB_MIN;
    }
    return ORB_MIN;
  }

  function tick() {
    if (!S || S.done || S.pausedAt != null) return;
    const t = now();

    // Settling period before the opening bell.
    if (S.startAt == null) {
      const left = SETTLE_SECONDS - (t - S.createdAt);
      if (left > 0) {
        el.count.textContent = left <= 3 ? String(Math.ceil(left)) : '';
        return;
      }
      S.startAt = t;
      sound.bell(0, 196, 1);
      vibrate(60);
      el.count.textContent = '';
      setTimeout(() => { if (S && !S.done) fadeCue(); }, 12000);
      setTimeout(() => el.tapHint.classList.add('hidden'), 15000);
    }

    const e = elapsed();
    const left = S.total - e;
    if (left <= 0) { finish(true); return; }

    if (!settings.hideClock) el.clock.textContent = fmt(left);
    el.ring.style.strokeDashoffset = String(RING_C * (1 - e / S.total));

    if (S.practice.pattern) {
      const ph = currentPhase(e);
      const key = `${ph.cycleIndex}:${ph.i}`;
      if (key !== S.phaseKey) {
        S.phaseKey = key;
        el.phase.textContent = ph.label;
        if (S.practice.counter === 'breath10') el.count.textContent = String((ph.cycleIndex % 10) + 1);
        else if (S.practice.counter === 'round') el.count.textContent = `round ${ph.cycleIndex + 1}`;
        if (settings.breathTone) sound.breath(ph.kind, Math.min(ph.left, ph.secs));
        vibrate(ph.kind === 'hold' ? 15 : 35);
      }
    } else {
      // Trataka: gaze, then close eyes for the last part.
      const closed = e / S.total >= TRATAKA_EYES_CLOSED_AT;
      if (closed && !S.eyesClosed) {
        S.eyesClosed = true;
        sound.bell(0, 233, 0.6);
        vibrate(60);
        el.flame.style.transition = 'opacity 4s ease';
        el.flame.style.opacity = '0.08';
        showCue('Close your eyes. See the flame within, between the eyebrows.');
      }
      el.phase.textContent = S.eyesClosed ? 'Eyes closed' : 'Gaze softly';
    }

    // Gentle check-in bell to catch a drifting mind (skipped in the final 15 s).
    if (settings.checkin > 0 && left > 15) {
      const n = Math.floor(e / settings.checkin);
      if (n > S.lastCheckin) {
        S.lastCheckin = n;
        sound.bell(0, 293.7, 0.35);
        showCue(CHECKIN_CUES[(n - 1) % CHECKIN_CUES.length], 7000);
      }
    }
  }

  function frame() {
    if (!S || S.done) return;
    if (S.practice.pattern && S.startAt != null) {
      el.orb.style.transform = `scale(${orbScale(currentPhase(elapsed())).toFixed(4)})`;
    }
    requestAnimationFrame(frame);
  }

  let cueTimer = null;
  function showCue(text, ms) {
    clearTimeout(cueTimer);
    el.cue.textContent = text;
    el.cue.style.opacity = '1';
    if (ms) cueTimer = setTimeout(fadeCue, ms);
  }
  function fadeCue() { el.cue.style.opacity = '0'; }

  function togglePause() {
    if (!S || S.done) return;
    if (S.pausedAt == null) {
      S.pausedAt = now();
      sound.pause();
      el.session.classList.add('paused');
      el.pause.textContent = 'Resume';
      el.pause.setAttribute('aria-label', 'Resume');
      el.phase.textContent = 'Paused';
      S.phaseKey = ''; // re-announce the phase on resume
    } else {
      const pausedFor = now() - S.pausedAt;
      if (S.startAt != null) S.pausedTotal += pausedFor;
      else S.createdAt += pausedFor;
      S.pausedAt = null;
      sound.resume();
      el.session.classList.remove('paused');
      el.pause.textContent = 'Pause';
      el.pause.setAttribute('aria-label', 'Pause');
      if (S.startAt == null) el.phase.textContent = 'Settle';
    }
    showControls();
  }

  function finish(completed) {
    if (!S || S.done) return;
    const e = completed ? S.total : elapsed();
    S.done = true;
    clearInterval(S.timer);
    clearTimeout(cueTimer);
    if (S.pausedAt != null) sound.resume();
    sound.stopAmbient();
    releaseAwake();
    if (completed) { sound.bell(0, 196, 1); sound.bell(2.2, 196, 0.8); sound.bell(4.4, 196, 0.6); }

    if (e >= 20) recordSession(e, S.practice.id, S.returns);

    const mins = Math.floor(e / 60);
    const secs = Math.round(e % 60);
    const timeText = e < 60 ? `${secs} seconds` : secs ? `${mins} min ${secs} s` : `${mins} minute${mins === 1 ? '' : 's'}`;
    $('done-title').textContent = completed ? 'Well done' : 'Good effort';
    $('done-summary').textContent = `${timeText} of ${S.practice.name}.`;
    $('done-note').textContent = S.returns > 0
      ? `You noticed your mind wandering ${S.returns} time${S.returns === 1 ? '' : 's'} and came back every time. ` +
        'That noticing is the practice — each return is one rep for your attention.'
      : completed
        ? 'Busy mind or quiet mind, you showed up and stayed. That counts.'
        : 'Even a short pause is real practice. Come back whenever you’re ready.';

    show('done');
    renderStats();
    $('again').focus();
  }

  // Mark a "came back" moment: the core ADHD-friendly interaction.
  function markReturn(x, y) {
    if (!S || S.done || S.startAt == null || S.pausedAt != null) return;
    S.returns++;
    sound.bell(0, 587, 0.12);
    vibrate(20);
    const r = document.createElement('div');
    r.className = 'ripple';
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    el.ripples.appendChild(r);
    setTimeout(() => r.remove(), 1300);
  }

  let controlsTimer = null;
  function showControls() {
    el.controls.classList.remove('hidden');
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
      if (S && !S.done && S.pausedAt == null) el.controls.classList.add('hidden');
    }, 3500);
  }

  function bindSession() {
    Object.assign(el, {
      session: $('session'), orb: $('orb'), flame: $('flame'), ring: $('ring-fg'),
      phase: $('phase'), count: $('count'), cue: $('cue'), clock: $('clock'),
      controls: $('controls'), pause: $('pause'), tapHint: $('tap-hint'), ripples: $('ripple-layer'),
    });
    el.session.tabIndex = -1;

    el.pause.addEventListener('click', (e) => { e.stopPropagation(); togglePause(); });
    $('end').addEventListener('click', (e) => { e.stopPropagation(); finish(false); });
    el.controls.addEventListener('pointerdown', (e) => e.stopPropagation());

    el.session.addEventListener('pointerdown', (e) => {
      showControls();
      markReturn(e.clientX, e.clientY);
    });
    el.session.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') showControls(); });

    document.addEventListener('keydown', (e) => {
      if (!el.session.classList.contains('active') || !S || S.done) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (e.target.closest && e.target.closest('.controls')) return; // let buttons work
        e.preventDefault();
        const r = el.orb.getBoundingClientRect();
        markReturn(r.left + r.width / 2, r.top + r.height / 2);
      } else if (e.key === 'p' || e.key === 'P') {
        togglePause();
      } else if (e.key === 'Escape') {
        finish(false);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && S && !S.done) { keepAwake(); tick(); }
    });
  }

  // ───────────────────────── Boot ─────────────────────────
  buildHome();
  bindSession();

  // Offline support when served over http(s); harmless to skip when opened as a local file.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
