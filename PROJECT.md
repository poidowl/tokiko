# Project: kawaii-kusanagi (Voice-Cuteness-Only Branch for Kusanagi)

## Architecture
- **Base Engine**: `origin/kusanagi` (`b205f58ae2620fffec764d1bde3f858fcf294ac8`, v11.0) — zero-dependency pure ES Module Japanese speech synthesizer:
  - `hitofude.mjs` (1,355 lines): kana→5ms tracks (`tracksFromKana`), pitch accent (`f0Rule`, `ACCENT_NORMAL`/`ACCENT_CUTE`), single causal DSP loop (asymmetric Bernoulli 2-lip mucosal door + 5-pole vocal tract F1–F5 + lip radiation), consonant mix, leveling/envelope, WAV encoder (`encodeWav`), and built-in FFT acoustic meter (`hakaru`).
  - `yomu.mjs` (245 lines): Node.js CLI driver forwarding `...prm` directly into `makeHitofude`.
- **New Branch**: `kawaii-kusanagi` branched directly off `origin/kusanagi` (`b205f58`).
- **Data-First Pipeline**:
  1. Collect real open-license Japanese cute female voice WAVs (Tsukuyomi-chan Corpus Vol.1 + JVNV `F1_happy` / `F2_happy`) into temporary scratch space (deleted before commit).
  2. Extract quantitative acoustic profiles (`hakaru()`-aligned spectral bands & harmonic valleys, F0 distribution/contour, H1–H2 / H1–A3 voice quality, multi-band LTAS, vowel formants F1–F5, speaking rate) into `data/kawaii_voice_ref.json`, `data/kawaii_utterances.jsonl`, and `data/SOURCES.md`.
  3. Boldly extend `hitofude.mjs` (and set default preset in `yomu.mjs`) strictly within **<= 100 added lines of code** (`git diff --numstat origin/kusanagi -- '*.mjs'`), prioritizing acoustic resemblance to `data/kawaii_voice_ref.json` above all else, then stop immediately at <= 100 added lines.

## Feature Inventory
Every Survey feature assigned a milestone (single-cycle scope: M1).

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Dedicated Cute-Voice Branch | Fetch `origin/kusanagi` (`b205f58`) and create branch `kawaii-kusanagi` | M1 | survey (1, 2, 3) |
| 2 | Cute-Voice Reference Data Collection | Download open-license Japanese cute-voice WAVs (Tsukuyomi-chan Vol.1 + JVNV `F1`/`F2` happy) in scratch space, extract acoustic profiles into `data/kawaii_voice_ref.json`, `data/kawaii_utterances.jsonl`, `data/SOURCES.md` | M1 | survey (1, 3) |
| 3 | Data-Fitted `PRESETS.kawaii` & `ACCENT_KAWAII` | Add `ACCENT_KAWAII` + `PRESETS.kawaii` in `hitofude.mjs` (and default preset in `yomu.mjs`), fixing `hitofude.mjs:976` so breathy cute voices can use cute prosody + cute phrase-final `scoop` | M1 | survey (2, 3) |
| 4 | Cute/Smiling Formant & Tract Shaping | Decoupled `vt` override, `f2_mul`/`f3_mul`, independent `f4_hz`/`f5_hz`, and per-formant `bw_mul` in `hitofude.mjs` | M1 | survey (2, 3) |
| 5 | Soft Open-Quotient Glottal Door & Silky Aspiration | `oq_soft` modulation of Bernoulli 2-lip door + single-wire high-pass voiced aspiration (`asp_vo`) in `hitofude.mjs` | M1 | survey (2, 3) |
| 6 | Causal LTAS-Matching Biquad EQ Cascade | `applyEqBands(y, eq_bands)` fitted directly to `LTAS_ref - LTAS_kusanagi` of the collected cute-voice data | M1 | survey (2) |
| 7 | Offline Numerical Fitting & <=100-Line Hard Stop | Fit `PRESETS.kawaii` parameters offline in scratch space against `data/kawaii_voice_ref.json`, bake fitted values into `hitofude.mjs`, verify `git diff --numstat origin/kusanagi -- '*.mjs'` added lines <= 100, and stop | M1 | survey (1, 2, 3) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|--------------|--------|
| 1 | `kawaii-kusanagi` Data Collection & <=100-Line Bold Upgrade | Features 1–7 (single cycle; error/edge-case verification explicitly waived by user) | none | DONE (`26964f75`, +71 code lines <= 100, 120 WAVs -> `data/`, 5/5 gate PASS) |

## Interface Contracts
### `hitofude.mjs` ↔ `yomu.mjs`
- `PRESETS.kawaii`: exported preset object consumed by `yomu.mjs` via `PRESETS[preset]` and spread into `makeHitofude(text, { ...prm })`.
- `makeHitofude(text, opts)`: preserves existing signature and return shape (`{ samples, sr, info }`), adding optional cute-voice parameters (`vt`, `f2_mul`, `f3_mul`, `f4_hz`, `f5_hz`, `bw_mul`, `oq_soft`, `asp_vo`, `eq_bands`, `accent`, `scoop`) with backwards-compatible defaults.
- Pure JS zero-dependency constraint: `hitofude.mjs` must remain zero-import pure ES Module JS.

### `data/` Reference Artifacts
- `data/kawaii_voice_ref.json`: aggregated + per-speaker empirical acoustic targets (`f0`, `hakaru` bands & `tani`, `H1-H2`/`H1-A3`, multi-band `ltas_db`, vowel formants `F1-F5`, speaking rate).
- `data/kawaii_utterances.jsonl`: per-utterance measured acoustic records.
- `data/SOURCES.md`: exact dataset URLs, licenses, utterance counts, and metric definitions.

## Code Layout
- `hitofude.mjs` — Core pure-JS synthesizer (Worker-owned; target ~88–99 added lines)
- `yomu.mjs` — Node.js CLI runner (Worker-owned; 0–1 added line for default `kawaii` preset)
- `data/kawaii_voice_ref.json`, `data/kawaii_utterances.jsonl`, `data/SOURCES.md` — Collected non-code reference dataset artifacts (Worker-owned)
- `.agents/` and `PROJECT.md` — Orchestration metadata; MUST NOT be committed to git.
