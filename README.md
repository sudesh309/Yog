# Yog · Calm Focus

A lightweight, distraction-free Indian yoga **meditation timer** with a breath guide and gentle tones. It is built for **ADHD minds**: sessions are short, there is one thing to look at, and wandering attention is treated as part of the practice, not a failure.

No install, no account, no tracking, no dependencies. It's plain HTML/CSS/JS, and every sound is synthesised in the browser, so there are no audio files to download.

## Practices

| Practice | Sanskrit | What you do |
|---|---|---|
| Breath Counting | Ānāpāna · आनापान | Count breaths 1 → 10, then start again (4 s in / 6 s out) |
| Box Breathing | Sama Vṛtti · समवृत्ति | In 4 · hold 4 · out 4 · hold 4 |
| Humming Bee | Bhrāmarī · भ्रामरी | Breathe in, hum on a long out-breath |
| Alternate Nostril | Nāḍī Śodhana · नाड़ी शोधन | Left / right nostril cues, round by round |
| Om Chanting | Oṃ Japa · ॐ जप | Breathe in, chant A-U-M on the out-breath |
| Singing Bowl | Nāda · नाद | A Buddhist singing bowl rings every 20 s. Follow each tone into silence, feel its vibration (the phone vibrates too) |
| Candle Gazing | Trāṭaka · त्राटक | Gaze at a steady flame, then close your eyes for the last part |

Durations: 1, 3, 5, 10, 15 or 20 minutes, or a custom 1–120 minutes.

**Customise each practice.** Each practice remembers its own length. Open *Customise* to change it:
- every breath phase (in / hold / out / hold) for the breathing practices
- the time between strikes, and whether the phone vibrates, for Singing Bowl
- how long your eyes stay closed at the end of Candle Gazing

The meditation screen looks the same whatever you choose.

## Built for ADHD

- **"I drifted" tap.** Tap anywhere (or press Space) when you notice your mind wandered. You get a soft chime and a ripple, and at the end you see how many times you *came back*. Each return counts as a rep for your attention.
- **Gentle check-in bell** (every 30 s, 1 min or 2 min) with a short, non-judgemental prompt, to catch you before a long drift.
- **One visual anchor.** A breathing circle (or a flame) and nothing else. Controls fade away after a few seconds.
- **Short sessions first.** It defaults to 3 minutes, and a progress ring shows how far along you are.
- **Hide the clock** if clock-watching distracts you.
- **Background sound** (Silence by default; only one plays at a time): tanpura drone, sitar, bansuri flute, or brown noise (which many people with ADHD find helps them focus). The sitar and flute improvise slow phrases in the calm Raag Bhupali. The sitar stays in a low, warm register with soft plucks and gentle slides between notes. The bansuri plays like a slow alaap: low, breathy notes held for several seconds, slow slides, and long silences. Both are synthesised live, so the music never loops. Tap a sound on the home screen to hear a preview.
- **Breath guide tone** (optional, off by default): a soft hum that rises while you breathe in and falls while you breathe out, so you can keep your eyes closed.
- **Vibration cues** on phones (optional).
- A 5-second settle-in, singing-bowl bells at the start and end, and the screen stays awake (Wake Lock).
- Remembers your choices, and shows today's minutes and your streak. Everything is stored only in your browser.

Keyboard: `Space` = I'm back · `P` = pause/resume · `Esc` = end.

## Run it

- **Locally:** open `index.html` in any modern browser. That's all.
- **GitHub Pages:** in the repo, go to *Settings → Pages → Build and deployment*, choose *Deploy from a branch*, pick the branch and `/ (root)`, then save. The app will be at `https://<user>.github.io/<repo>/`.
- **Phone:** open the Pages URL. You can optionally use *Add to Home Screen* to get a full-screen app that also works offline.

Tip: on iPhone, turn off silent mode, or Web Audio sounds may be muted.

## Files

```
index.html            markup for the three screens (home, session, done)
style.css             calm theme with automatic light/dark
app.js                practices, timer, breath engine, Web Audio tones
sw.js                 offline cache (used only when served over http/https)
manifest.webmanifest  add-to-home-screen metadata
icon.svg, icon-*.png  app icons
```
