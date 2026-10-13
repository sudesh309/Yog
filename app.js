/* Yog — a calm meditation timer for ADHD minds.
 * Plain JavaScript, no dependencies. All sounds (bells, bowl, tanpura, sitar, bansuri flute)
 * are synthesised with the Web Audio API, so the app works offline and needs no audio files. */
(() => {
  'use strict';

  // ───────────────────────── Practices ─────────────────────────
  // mode 'breath': phases are [label, seconds, kind]; 'in' grows the orb, 'out' shrinks it, 'hold' keeps it.
  // mode 'gaze':   Trataka candle flame.  mode 'bowl': a singing bowl struck at a steady interval.
  const PRACTICES = [
    {
      id: 'anapana',
      mode: 'breath',
      name: 'Breath Counting',
      sk: 'Ānāpāna · आनापान',
      desc: 'Count each breath from 1 to 10, then start again. Lost count? Just begin at 1. Best first choice for a busy mind.',
      intro: 'Breathe with the circle. Count each out-breath. Losing count is normal — simply start again at 1.',
      pattern: [['Breathe in', 4, 'in'], ['Breathe out', 6, 'out']],
      counter: 'breath10',
    },
    {
      id: 'sama',
      mode: 'breath',
      name: 'Box Breathing',
      sk: 'Sama Vṛtti · समवृत्ति',
      desc: 'Equal in, hold, out, hold. A steady rhythm that settles a racing mind.',
      intro: 'Four equal sides: in, hold, out, hold. Let the circle lead.',
      pattern: [['Breathe in', 4, 'in'], ['Hold', 4, 'hold'], ['Breathe out', 4, 'out'], ['Hold', 4, 'hold']],
      counter: 'round',
    },
    {
      id: 'bhramari',
      mode: 'breath',
      name: 'Humming Bee',
      sk: 'Bhrāmarī · भ्रामरी',
      desc: 'Breathe in, then hum softly like a bee as you breathe out. The vibration gives restless attention something to hold.',
      intro: 'Close your lips. Breathe in through the nose, then hum “mmm” all the way out. Feel the buzz in your head.',
      pattern: [['Breathe in', 4, 'in'], ['Hummm…', 8, 'out']],
      counter: 'round',
    },
    {
      id: 'nadi',
      mode: 'breath',
      name: 'Alternate Nostril',
      sk: 'Nāḍī Śodhana · नाड़ी शोधन',
      desc: 'Breathe through one nostril at a time, switching sides. Balancing and calming; keeps the hands and mind busy.',
      intro: 'Right thumb closes the right nostril, ring finger closes the left. Follow the side shown in the circle.',
      pattern: [['In · left', 4, 'in'], ['Out · right', 6, 'out'], ['In · right', 4, 'in'], ['Out · left', 6, 'out']],
      counter: 'round',
    },
    {
      id: 'om',
      mode: 'breath',
      name: 'Om Chanting',
      sk: 'Oṃ Japa · ॐ जप',
      desc: 'Breathe in, then chant a long “A-U-M” on the out-breath. Sound is an easy anchor when silence feels too loud.',
      intro: 'Breathe in deeply. On the out-breath chant “Aaa-Uuu-Mmm”, letting the M fade into silence.',
      pattern: [['Breathe in', 4, 'in'], ['Aaa-Uuu-Mmm', 9, 'out']],
      counter: 'round',
    },
    {
      id: 'bowl',
      mode: 'bowl',
      name: 'Singing Bowl',
      sk: 'Nāda · नाद',
      desc: 'A Buddhist singing bowl rings at a steady pace. Follow each tone until it fully fades, feel its vibration, rest in the silence until the next one.',
      intro: 'Close your eyes if you like. Follow the bowl’s sound all the way into silence. Notice where you feel the vibration.',
      interval: 20,
    },
    {
      id: 'trataka',
      mode: 'gaze',
      name: 'Candle Gazing',
      sk: 'Trāṭaka · त्राटक',
      desc: 'Rest your eyes on a single steady flame. One point to look at, nothing else. Near the end, close your eyes.',
      intro: 'Soften your gaze on the flame. Blink whenever you need to. When the bell rings, close your eyes.',
      closedPct: 30,
    },
  ];

  const SOUNDS = [
    ['none', 'Silence'],
    ['tanpura', 'Tanpura'],
    ['sitar', 'Sitar'],
    ['flute', 'Bansuri flute'],
    ['duet', 'Sitar + flute'],
    ['brown', 'Brown noise'],
  ];

  const DURATIONS = [1, 3, 5, 10, 15, 20]; // minutes
  const DEFAULT_DURATION = 3;
  const SETTLE_SECONDS = 5;
  const ORB_MIN = 0.55;
  const ORB_MAX = 1;
  const LIMITS = { in: [2, 15], out: [2, 20], hold: [0, 15], interval: [8, 60], closedPct: [10, 60], minutes: [1, 120] };

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
    practice: 'anapana', ambient: 'none', breathTone: true,
    checkin: 60, volume: 0.7, hideClock: false, vibrate: false,
    custom: {}, // per practice: { duration, pattern: [secs…], interval, bowlVibrate, closedPct }
  };
  const settings = Object.assign({}, DEFAULTS, store.get('yog.settings', {}));
  if (typeof settings.custom !== 'object' || !settings.custom) settings.custom = {};
  const saveSettings = () => store.set('yog.settings', settings);

  const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
  const custom = (p) => settings.custom[p.id] || (settings.custom[p.id] = {});
  // settings.duration is the single global duration saved by older versions of the app.
  const durationFor = (p) => settings.custom[p.id]?.duration ?? settings.duration ?? DEFAULT_DURATION;
  const patternFor = (p) => p.pattern.map(([label, secs, kind], i) => [label, settings.custom[p.id]?.pattern?.[i] ?? secs, kind]);
  const intervalFor = (p) => settings.custom[p.id]?.interval ?? p.interval;
  const closedPctFor = (p) => settings.custom[p.id]?.closedPct ?? p.closedPct;
  const bowlVibrateFor = (p) => settings.custom[p.id]?.bowlVibrate ?? true;

  // ───────────────────────── Audio ─────────────────────────
  const RAAG = [0, 2, 4, 7, 9];          // Raag Bhupali: Sa Re Ga Pa Dha — calm, pentatonic
  const RESTING = [0, 2, 3];             // phrases settle on Sa, Ga or Pa
  const raagFreq = (sa, step) => {
    const oct = Math.floor(step / 5);
    return sa * Math.pow(2, oct + RAAG[step - oct * 5] / 12);
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const sound = {
    ctx: null,
    master: null,
    reverbIn: null,
    ambient: null,     // { gain, stop() }
    timers: [],
    ksCache: new Map(),

    ensure() {
      if (!this.ctx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return false;
        const ctx = this.ctx = new Ctx();
        this.master = ctx.createGain();
        this.master.gain.value = settings.volume;
        this.master.connect(ctx.destination);
        // Small hall reverb from a generated impulse response.
        const len = Math.floor(ctx.sampleRate * 3);
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
          const d = ir.getChannelData(c);
          for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        }
        const conv = ctx.createConvolver();
        conv.buffer = ir;
        this.reverbIn = ctx.createGain();
        this.reverbIn.gain.value = 0.35;
        this.reverbIn.connect(conv).connect(this.master);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    },

    setVolume(v) {
      if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    },

    noise() {
      if (!this.noiseBuf) {
        const len = this.ctx.sampleRate * 2;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      return this.noiseBuf;
    },

    // Singing-bowl style bell: a few inharmonic partials, each a slightly detuned pair for shimmer.
    bell(delay = 0, base = 196, strength = 1) {
      if (!this.ensure()) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + delay;
      const out = ctx.createGain();
      out.connect(this.master);
      out.connect(this.reverbIn);
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
          osc.connect(g).connect(out);
          osc.start(t);
          osc.stop(t + decay + 0.05);
        }
      }
    },

    // Tibetan / Buddhist singing bowl: low, long, beating partials spread left and right, plus a soft mallet knock.
    bowl(base = 174.6) {
      if (!this.ensure()) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + 0.02;
      const out = ctx.createGain();
      out.connect(this.master);
      out.connect(this.reverbIn);
      const partials = [[1, 1, 18], [2.71, 0.45, 12], [5.15, 0.22, 7], [8.17, 0.1, 4], [11.9, 0.05, 2.5]];
      for (const [ratio, amp, decay] of partials) {
        for (const [beat, pan] of [[-0.9, -0.7], [0.9, 0.7]]) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = base * ratio + beat * Math.sqrt(ratio);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.1 * amp, t + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
          osc.connect(g);
          if (ctx.createStereoPanner) {
            const p = ctx.createStereoPanner();
            p.pan.value = pan;
            g.connect(p).connect(out);
          } else {
            g.connect(out);
          }
          osc.start(t);
          osc.stop(t + decay + 0.05);
        }
      }
      const knock = ctx.createBufferSource();
      knock.buffer = this.noise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 2;
      const kg = ctx.createGain();
      kg.gain.setValueAtTime(0.18, t);
      kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      knock.connect(bp).connect(kg).connect(out);
      knock.start(t);
      knock.stop(t + 0.1);
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

    // Runs `fn` now and every 400 ms; callers schedule audio a couple of seconds ahead,
    // so throttled background timers never leave gaps.
    every(fn) {
      fn();
      this.timers.push(setInterval(fn, 400));
    },

    // Tanpura: four strings plucked in the classic Pa – Sa – Sa – low Sa cycle.
    tanpura(bus, level) {
      const ctx = this.ctx;
      const SA = 130.81; // C3
      const strings = [SA * 0.75, SA, SA, SA / 2];
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 1400;
      lowpass.Q.value = 0.7;
      const lvl = ctx.createGain();
      lvl.gain.value = level;
      lowpass.connect(lvl).connect(bus);
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
      this.every(() => {
        while (next < ctx.currentTime + 2) {
          pluck(strings[i % 4], next);
          next += i % 4 === 3 ? 1.6 : 1.1;
          i++;
        }
      });
    },

    // Karplus–Strong plucked string, cached per pitch.
    ksBuffer(freq) {
      const key = Math.round(freq * 10);
      if (this.ksCache.has(key)) return this.ksCache.get(key);
      const ctx = this.ctx;
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * 3.5);
      const N = Math.max(2, Math.round(sr / freq));
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
      d[N] = 0.997 * d[0];
      for (let i = N + 1; i < len; i++) d[i] = 0.4985 * (d[i - N] + d[i - N - 1]);
      this.ksCache.set(key, buf);
      return buf;
    },

    // Sitar voice: plucked string → buzzy "jawari" bridge → bright body resonance.
    sitarVoice(bus) {
      const ctx = this.ctx;
      const input = ctx.createGain();
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = Math.tanh(2.2 * x) * 0.75 + 0.2 * x * x;
      }
      shaper.curve = curve;
      const body = ctx.createBiquadFilter();
      body.type = 'peaking';
      body.frequency.value = 2400;
      body.gain.value = 6;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 90;
      const out = ctx.createGain();
      out.gain.value = 0.16;
      input.connect(shaper).connect(body).connect(hp).connect(out).connect(bus);
      let prev = null;
      return {
        lo: 0, hi: 10, sa: 130.81, min: 0.45, max: 1.3, rest: [2, 4.5],
        play: (freqs, durs, t0) => {
          let t = t0;
          freqs.forEach((f, k) => {
            const src = ctx.createBufferSource();
            src.buffer = this.ksBuffer(f);
            // Meend: sometimes slide into the note from the previous one.
            if (prev && Math.random() < 0.35) {
              src.playbackRate.setValueAtTime(prev / f, t);
              src.playbackRate.setTargetAtTime(1, t + 0.04, 0.09);
            }
            const g = ctx.createGain();
            g.gain.value = rand(0.7, 1);
            src.connect(g).connect(input);
            src.start(t);
            src.stop(t + 3.5);
            prev = f;
            t += durs[k];
          });
        },
      };
    },

    // Bansuri (bamboo flute) voice: soft sine with breath noise, gentle vibrato and glides between notes.
    fluteVoice(bus) {
      const ctx = this.ctx;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 3200;
      lp.connect(bus);
      let prev = null;
      return {
        lo: 0, hi: 8, sa: 261.63, min: 0.9, max: 2.1, rest: [3, 6],
        play: (freqs, durs, t0) => {
          const total = durs.reduce((a, b) => a + b, 0);
          const end = t0 + total;
          const osc = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          osc.type = 'sine';
          osc2.type = 'sine';
          const h2 = ctx.createGain();
          h2.gain.value = 0.12;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t0);
          // Vibrato that blooms after the attack.
          const lfo = ctx.createOscillator();
          lfo.frequency.value = rand(4.6, 5.4);
          const depth = ctx.createGain();
          depth.gain.setValueAtTime(0, t0);
          depth.gain.linearRampToValueAtTime(14, t0 + 0.9);
          lfo.connect(depth);
          depth.connect(osc.detune);
          depth.connect(osc2.detune);
          // Breath noise.
          const nz = ctx.createBufferSource();
          nz.buffer = this.noise();
          nz.loop = true;
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = freqs[0] * 2;
          bp.Q.value = 1.2;
          const ng = ctx.createGain();
          ng.gain.value = 0.18;
          nz.connect(bp).connect(ng).connect(g);

          let t = t0;
          freqs.forEach((f, k) => {
            if (k === 0) {
              const from = prev && Math.random() < 0.5 ? prev : f;
              osc.frequency.setValueAtTime(from, t);
              osc.frequency.setTargetAtTime(f, t + 0.02, 0.1);
              osc2.frequency.setValueAtTime(from * 2, t);
              osc2.frequency.setTargetAtTime(f * 2, t + 0.02, 0.1);
            } else {
              const glide = Math.random() < 0.3 ? 0.14 : 0.04;
              osc.frequency.setTargetAtTime(f, t, glide);
              osc2.frequency.setTargetAtTime(f * 2, t, glide);
              bp.frequency.setTargetAtTime(f * 2, t, glide);
            }
            const peak = 0.075 * rand(0.85, 1.1);
            g.gain.setTargetAtTime(peak, t, k === 0 ? 0.12 : 0.05);
            if (k < freqs.length - 1) g.gain.setTargetAtTime(peak * 0.7, t + durs[k] - 0.12, 0.04);
            t += durs[k];
          });
          g.gain.setTargetAtTime(0.0001, end - 0.3, 0.25);

          osc.connect(g);
          osc2.connect(h2).connect(g);
          g.connect(lp);
          for (const n of [osc, osc2, lfo, nz]) { n.start(t0); n.stop(end + 1.5); }
          prev = freqs[freqs.length - 1];
        },
      };
    },

    // Improvised phrases in Raag Bhupali; with several voices they take turns (call and response).
    music(voices, startIn) {
      const ctx = this.ctx;
      let next = ctx.currentTime + startIn;
      let turn = 0;
      const pos = voices.map((v) => Math.round((v.lo + v.hi) / 2));
      this.every(() => {
        while (next < ctx.currentTime + 3) {
          const vi = turn++ % voices.length;
          const v = voices[vi];
          const n = 3 + Math.floor(Math.random() * 4);
          const steps = [];
          let step = pos[vi];
          for (let k = 0; k < n; k++) {
            if (k > 0) step += pick([-2, -1, -1, 1, 1, 2]);
            step = Math.min(v.hi, Math.max(v.lo, step));
            steps.push(step);
          }
          let last = steps[n - 1];
          while (!RESTING.includes(((last % 5) + 5) % 5)) last -= 1;
          steps[n - 1] = Math.max(v.lo, last);
          pos[vi] = steps[n - 1];
          const durs = steps.map((_, k) => rand(v.min, v.max) * (k === n - 1 ? 2 : 1));
          v.play(steps.map((s) => raagFreq(v.sa, s)), durs, next);
          next += durs.reduce((a, b) => a + b, 0) + rand(...v.rest);
        }
      });
    },

    startAmbient(type, { preview = false } = {}) {
      this.stopAmbient();
      if (type === 'none' || !this.ensure()) return;
      const ctx = this.ctx;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + (preview ? 0.8 : 3));
      gain.connect(this.master);
      const wet = ctx.createGain();
      wet.gain.value = type === 'brown' ? 0 : 0.8;
      gain.connect(wet).connect(this.reverbIn);

      if (type === 'brown') {
        const len = ctx.sampleRate * 4;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
          last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
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

      this.tanpura(gain, type === 'tanpura' ? 1 : 0.45);
      const voices = [];
      if (type === 'sitar' || type === 'duet') voices.push(this.sitarVoice(gain));
      if (type === 'flute' || type === 'duet') voices.push(this.fluteVoice(gain));
      if (voices.length) this.music(voices, preview ? 0.4 : 4);
      this.ambient = { gain, stop: () => {} };
    },

    stopAmbient() {
      for (const id of this.timers) clearInterval(id);
      this.timers = [];
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
  const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
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
  // Builds a group of radio-style buttons; returns a function that refreshes their state.
  function radioGroup(container, items, isSelected, onPick) {
    container.innerHTML = '';
    const buttons = items.map((item) => {
      const b = item.render();
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => { onPick(item.value); update(); });
      container.appendChild(b);
      return [b, item];
    });
    const update = () => {
      for (const [b, item] of buttons) {
        const sel = isSelected(item.value);
        b.setAttribute('aria-checked', String(sel));
        b.tabIndex = sel ? 0 : -1;
        if (item.refresh) item.refresh(b);
      }
    };
    container.addEventListener('keydown', (e) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      const idx = Math.max(0, buttons.findIndex(([, item]) => isSelected(item.value)));
      const [b, item] = buttons[(idx + keys[e.key] + buttons.length) % buttons.length];
      onPick(item.value); update(); b.focus();
    });
    update();
    return update;
  }

  const current = () => practiceById(settings.practice);
  let customMode = false;      // the "Custom" duration chip is open
  let updateDurations = () => {};
  let previewTimer = null;

  function stepper(label, value, unit, onChange) {
    const row = document.createElement('div');
    row.className = 'stepper';
    row.innerHTML = '<span class="lbl"></span><button type="button" class="minus">−</button>' +
      '<span class="val" aria-live="polite"></span><button type="button" class="plus">+</button>';
    row.querySelector('.lbl').textContent = label;
    const val = row.querySelector('.val');
    const render = (v) => { val.textContent = `${v}${unit}`; };
    row.querySelector('.minus').setAttribute('aria-label', `Less: ${label}`);
    row.querySelector('.plus').setAttribute('aria-label', `More: ${label}`);
    row.querySelector('.minus').addEventListener('click', () => render(onChange(-1)));
    row.querySelector('.plus').addEventListener('click', () => render(onChange(1)));
    render(value);
    return row;
  }

  // The "Customise" panel: per-practice breath rhythm, bowl interval or gazing split.
  function buildTune() {
    const p = current();
    const body = $('tune-body');
    const c = custom(p);
    body.innerHTML = '';
    const foot = document.createElement('div');
    foot.className = 'tune-foot';
    const info = document.createElement('span');
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'link';
    reset.textContent = 'Reset to default';
    foot.append(info, reset);

    const changed = () => {
      saveSettings();
      if (p.mode === 'breath') {
        const secs = patternFor(p).map((ph) => ph[1]);
        info.textContent = `One breath = ${secs.reduce((a, b) => a + b, 0)} s`;
      } else {
        info.textContent = '';
      }
      const isCustom = Boolean(c.pattern || c.interval || c.closedPct || c.bowlVibrate === false);
      $('tune-summary').textContent = p.mode === 'breath' ? 'Customise breath rhythm' : 'Customise practice';
      if (isCustom) $('tune-summary').textContent += ' · custom';
    };

    if (p.mode === 'breath') {
      p.pattern.forEach(([label, , kind], i) => {
        let name = label;
        if (kind === 'hold') name = p.pattern[i - 1]?.[2] === 'in' ? 'Hold (lungs full)' : 'Hold (lungs empty)';
        body.appendChild(stepper(name, patternFor(p)[i][1], ' s', (d) => {
          const pat = patternFor(p).map((ph) => ph[1]);
          pat[i] = clamp(pat[i] + d, LIMITS[kind]);
          c.pattern = pat;
          changed();
          return pat[i];
        }));
      });
    } else if (p.mode === 'bowl') {
      body.appendChild(stepper('Time between bowl strikes', intervalFor(p), ' s', (d) => {
        c.interval = clamp(intervalFor(p) + d * 2, LIMITS.interval);
        changed();
        return c.interval;
      }));
      const row = document.createElement('label');
      row.className = 'tune-check';
      row.innerHTML = '<span>Vibrate the phone with each strike</span><input type="checkbox" role="switch">';
      const box = row.querySelector('input');
      box.checked = bowlVibrateFor(p);
      box.addEventListener('change', () => { c.bowlVibrate = box.checked; changed(); });
      body.appendChild(row);
    } else if (p.mode === 'gaze') {
      body.appendChild(stepper('Eyes closed for the last', closedPctFor(p), ' %', (d) => {
        c.closedPct = clamp(closedPctFor(p) + d * 10, LIMITS.closedPct);
        changed();
        return c.closedPct;
      }));
    }

    reset.addEventListener('click', () => {
      delete c.pattern; delete c.interval; delete c.closedPct; delete c.bowlVibrate;
      saveSettings();
      buildTune();
    });
    body.appendChild(foot);
    changed();
  }

  function onPracticeChange() {
    customMode = !DURATIONS.includes(durationFor(current()));
    updateDurations();
    syncCustomDuration();
    buildTune();
  }

  function syncCustomDuration() {
    const box = $('custom-dur');
    box.hidden = !customMode;
    $('custom-min').value = durationFor(current());
  }

  function buildHome() {
    radioGroup(
      $('practices'),
      PRACTICES.map((p) => ({
        value: p.id,
        render: () => {
          const b = document.createElement('button');
          b.className = 'practice';
          b.innerHTML = '<span class="name"></span><span class="sk"></span><span class="desc"></span>';
          b.querySelector('.name').textContent = p.name;
          b.querySelector('.sk').textContent = p.sk;
          b.querySelector('.desc').textContent = p.desc;
          return b;
        },
      })),
      (v) => settings.practice === v,
      (v) => { settings.practice = v; saveSettings(); onPracticeChange(); },
    );

    updateDurations = radioGroup(
      $('durations'),
      [...DURATIONS, 'custom'].map((m) => ({
        value: m,
        render: () => {
          const b = document.createElement('button');
          b.className = 'chip';
          b.textContent = m === 'custom' ? 'Custom' : `${m} min`;
          return b;
        },
        refresh: m === 'custom'
          ? (b) => {
            const d = durationFor(current());
            b.textContent = customMode && !DURATIONS.includes(d) ? `${d} min ✎` : 'Custom';
          }
          : null,
      })),
      (v) => (v === 'custom' ? customMode : !customMode && durationFor(current()) === v),
      (v) => {
        if (v === 'custom') {
          customMode = true;
          syncCustomDuration();
          $('custom-min').focus();
          $('custom-min').select();
          return;
        }
        customMode = false;
        custom(current()).duration = v;
        saveSettings();
        syncCustomDuration();
      },
    );
    $('custom-min').addEventListener('change', (e) => {
      const v = clamp(Math.round(Number(e.target.value) || DEFAULT_DURATION), LIMITS.minutes);
      e.target.value = v;
      custom(current()).duration = v;
      saveSettings();
      updateDurations();
    });

    radioGroup(
      $('sounds'),
      SOUNDS.map(([value, label]) => ({
        value,
        render: () => {
          const b = document.createElement('button');
          b.className = 'chip';
          b.textContent = label;
          return b;
        },
      })),
      (v) => settings.ambient === v,
      (v) => {
        settings.ambient = v;
        saveSettings();
        // Short preview so you know what you picked.
        clearTimeout(previewTimer);
        sound.startAmbient(v, { preview: true });
        previewTimer = setTimeout(() => sound.stopAmbient(), 9000);
      },
    );

    const bindSetting = (id, key, parse = (v) => v, prop = 'value') => {
      const input = $(id);
      input[prop] = settings[key];
      input.addEventListener('change', () => {
        settings[key] = parse(input[prop]);
        saveSettings();
        if (key === 'volume') sound.setVolume(settings.volume);
      });
    };
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

    onPracticeChange();
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
    const practice = current();
    clearTimeout(previewTimer);
    sound.ensure();
    sound.startAmbient(settings.ambient);
    keepAwake();

    const pattern = practice.mode === 'breath' ? patternFor(practice) : null;
    S = {
      practice,
      mode: practice.mode,
      pattern,
      cycle: pattern ? pattern.reduce((a, p) => a + p[1], 0) : 0,
      interval: practice.mode === 'bowl' ? intervalFor(practice) : 0,
      closedAt: practice.mode === 'gaze' ? 1 - closedPctFor(practice) / 100 : 1,
      bowlVibrate: bowlVibrateFor(practice),
      total: durationFor(practice) * 60,
      createdAt: now(),
      startAt: null,         // when the main timer began (after settling)
      pausedAt: null,
      pausedTotal: 0,
      phaseKey: '',
      lastCheckin: 0,
      strikes: 0,
      returns: 0,
      eyesClosed: false,
      done: false,
    };

    el.session.classList.toggle('trataka', S.mode === 'gaze');
    el.session.classList.remove('paused');
    el.flame.style.transition = '';
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
    const { pattern } = S;
    const cycleIndex = Math.floor(e / S.cycle);
    let t = e - cycleIndex * S.cycle;
    for (let i = 0; i < pattern.length; i++) {
      const [label, secs, kind] = pattern[i];
      if (t < secs) return { i, label, secs, kind, p: t / secs, left: secs - t, cycleIndex };
      t -= secs;
    }
    let last = pattern.length - 1;
    while (last > 0 && pattern[last][1] === 0) last--;
    return { i: last, label: pattern[last][0], secs: pattern[last][1], kind: pattern[last][2], p: 1, left: 0, cycleIndex };
  }

  // Orb size at a given point in the cycle: 'hold' keeps whatever size the previous phase ended at.
  function orbScale(ph) {
    const { pattern } = S;
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

  function strikeBowl() {
    sound.bowl();
    if (S.bowlVibrate && navigator.vibrate) navigator.vibrate([450, 140, 320, 170, 220, 210, 150, 250, 90, 300, 50]);
    if (reducedMotion.matches) return;
    // Sound waves rippling out from the bowl.
    const stage = el.stage.getBoundingClientRect();
    const size = stage.width;
    for (const delay of [0, 0.9, 1.8]) {
      const w = document.createElement('div');
      w.className = 'wave';
      Object.assign(w.style, {
        width: `${size}px`, height: `${size}px`,
        left: `${stage.left + stage.width / 2 - size / 2}px`,
        top: `${stage.top + stage.height / 2 - size / 2}px`,
        animationDelay: `${delay}s`,
      });
      el.ripples.appendChild(w);
      setTimeout(() => w.remove(), (5 + delay) * 1000 + 200);
    }
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
      if (S.mode !== 'bowl') sound.bell(0, 196, 1); // the bowl's own first strike opens a bowl session
      vibrate(60);
      el.count.textContent = '';
      const session = S; // these timers must not touch a later session
      setTimeout(() => { if (S === session && !session.done) fadeCue(); }, 12000);
      setTimeout(() => { if (S === session) el.tapHint.classList.add('hidden'); }, 15000);
    }

    const e = elapsed();
    const left = S.total - e;
    if (left <= 0) { finish(true); return; }

    if (!settings.hideClock) el.clock.textContent = fmt(left);
    el.ring.style.strokeDashoffset = String(RING_C * (1 - e / S.total));

    if (S.mode === 'breath') {
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
    } else if (S.mode === 'bowl') {
      const n = Math.floor(e / S.interval);
      if (n >= S.strikes) {
        S.strikes = n + 1;
        if (left > 6) strikeBowl(); // the closing bells follow soon anyway
      }
      const since = e - n * S.interval;
      el.phase.textContent = since < Math.min(12, S.interval * 0.7) ? 'Listen…' : 'Rest in silence';
      el.count.textContent = `bowl ${n + 1}`;
    } else {
      // Trataka: gaze, then close eyes for the last part.
      if (e / S.total >= S.closedAt && !S.eyesClosed) {
        S.eyesClosed = true;
        sound.bell(0, 233, 0.6);
        vibrate(60);
        el.flame.style.transition = 'opacity 4s ease';
        el.flame.style.opacity = '0.08';
        showCue('Close your eyes. See the flame within, between the eyebrows.');
      }
      el.phase.textContent = S.eyesClosed ? 'Eyes closed' : 'Gaze softly';
    }

    // Gentle check-in bell to catch a drifting mind (the bowl already does this; skipped in the final 15 s).
    if (settings.checkin > 0 && S.mode !== 'bowl' && left > 15) {
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
    if (S.startAt != null) {
      const e = elapsed();
      if (S.mode === 'breath') {
        el.orb.style.transform = `scale(${orbScale(currentPhase(e)).toFixed(4)})`;
      } else if (S.mode === 'bowl' && S.strikes > 0) {
        // The orb swells with each strike and shimmers as the sound decays.
        const since = Math.max(0, e - (S.strikes - 1) * S.interval);
        const env = Math.exp(-since / 5);
        const still = reducedMotion.matches;
        const scale = ORB_MIN + (ORB_MAX - ORB_MIN) * 0.85 * env * (still ? 1 : 1 + 0.03 * Math.sin(2 * Math.PI * 2.2 * since));
        const dx = still ? 0 : env * 1.6 * Math.sin(2 * Math.PI * 13 * since);
        el.orb.style.transform = `translateX(${dx.toFixed(2)}px) scale(${scale.toFixed(4)})`;
      }
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
      if (navigator.vibrate) navigator.vibrate(0);
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
    el.ripples.querySelectorAll('.wave').forEach((w) => w.remove());
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
      session: $('session'), stage: $('stage'), orb: $('orb'), flame: $('flame'), ring: $('ring-fg'),
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
