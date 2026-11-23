# Handoff Report — `explorer_survey_2` (Kusanagi Architecture Explorer)

**Handoff Type**: Hard (Step 0 Survey Complete)  
**Core Summary**: The real `kusanagi` engine lives on `origin/kusanagi` (`b205f58`, pure ES Module JS: `hitofude.mjs` 1,355 lines + `yomu.mjs` 245 lines), NOT on `main` (which holds Python `tsukinami` + built HTML demos). We analyzed all 5 synthesis stages of `hitofude.mjs` and designed a bold, data-matching-first implementation strategy capped strictly at **<= 100 added lines** (`git diff --numstat`) that adds (1) data-fitted vowel formants + independent F4/F5 + cute tract bandwidths, (2) soft open-quotient glottal door + silky high-band voiced aspiration, (3) a causal multi-band peaking/shelf biquad EQ bank fitted directly to the collected reference voices' LTAS delta, and (4) data-fitted cute prosody (`ACCENT_KAWAII`) + `PRESETS.kawaii`.

---

## 1. Observation

### 1.1 Original User Request (`/home/antigravity/poidowl/tsukinami/.agents/teamwork/ORIGINAL_REQUEST.md:4`)
> `声の可愛さのみを追求するブランチを追加して。データも集めて。そしてデータに似せることだけを第一に。それだけを第一にkusanagiへ大胆に加筆して。しかしコード100行の追加で、いったん作業をストップしてほしい。あとエラーとか予期しない動作を検証しなくてよい`

### 1.2 Git & Repository Structure
- Local checkout `/home/antigravity/poidowl/tsukinami` currently has only `main` (`5025d29`) fetched (`remote.origin.fetch=+refs/heads/main:refs/remotes/origin/main`).
- `git ls-remote --heads origin` confirmed `origin/kusanagi` at `b205f58ae2620fffec764d1bde3f858fcf294ac8` (v11.0).
- Runtime environment: Node.js `v24.22.3`, Python `3.11.2`.
- Files on `origin/kusanagi` (`b205f58`):
  - `hitofude.mjs` — 1,355 lines (61,616 B): zero-dependency pure JS synthesis engine (browser + Node).
  - `yomu.mjs` — 245 lines (10,269 B): Node CLI runner, `--preset`, `--measure`, `--compare`, `--recipe`.
  - `README.md` — 100 lines (9,733 B).
  - `tools/build_x_player.mjs`, `tools/test_pause.mjs`, `tools/test_sarasara.mjs`.
- Note: `main`'s `kusanagi_player.html` (`5025d29`) embeds the exact same v11.0 `hitofude.mjs` engine inline.

### 1.3 Complete Architecture of `hitofude.mjs` (`origin/kusanagi@b205f58`)

| Stage | File & Exact Lines | Symbols & Verified Behavior |
|---|---|---|
| **Constants & Presets** | `hitofude.mjs:11-61` | `SR=44100`, `FP=5.0`, `KNOB_KEYS`, `PRESETS` (`hitofude` 326Hz/fscale 1.12, `toiki` 292Hz/1.07/sigh 0.42, `alto` 220Hz/1.02, `sasayaki` 295Hz/g_vo 0.68, `chibi` 375Hz/1.20, `ossan` 115Hz/0.85, `robot` shin=0). |
| **Articulation & Formants** | `hitofude.mjs:107-128`, `:251-545` | `KOTOBA_PRM` (`alpha: 1.15`, `alpha3: 1.3`, `VT: {a:[850,1400,2800], i:[330,2750,3300], u:[380,1300,2650], e:[520,2350,3000], o:[650,1050,2850]}`, `CDUR`, `VDUR`, `VL`, `CL`). `tracksFromKana` (`:252`) already executes `const P = Object.assign({}, KOTOBA_PRM, params || {});`, so custom `VT`/`alpha`/`alpha3`/`VDUR` can be passed via `prm` with zero edits inside `tracksFromKana`. |
| **Prosody / F0** | `hitofude.mjs:554-555`, `:648-746`, `:975-978` | `ACCENT_NORMAL` (`rng: 6.2, jump: 2.8, fall: 3.8, fin: 2.6`) and `ACCENT_CUTE` (`rng: 10.0, jump: 5.6, fall: 6.0, fin: 2.0`). **Key observation (`:976`)**: `const acc = (sigh >= 0.25 || hz < 200.0) ? ACCENT_NORMAL : ACCENT_CUTE;` — any breathy preset with `sigh >= 0.25` is forced into `ACCENT_NORMAL`, and `opts` cannot override accent parameters. |
| **Formant Scaling & F4/F5** | `hitofude.mjs:1011-1018`, `:1067-1068` | Uniform scalar `fscale` applied to `F1..F3`; `F4[t] = min(8600, F3[t] + 1150*fs)`; `F5 = min(8800, F4 + 1100*fs)` (when `fs >= 0.92`). |
| **Glottal Source & 2-Lip Door** | `hitofude.mjs:1061-1116` | `hiMix = clamp((hRef - 125)/85, 0, 1)` saturates at `1.0` for all `hz >= 210 Hz`. Thus all female/cute presets share identical door constants (`radK=0.90`, `bern=0.55`, `loGain=1.65`, `upGain=3.00`, `knee=0.18`, `closeMul=22.0`, `closedDecay=0.12`, `rawAir=0.05*rawAirMul`). Excitation `sig = (1-vo)*0.28*xClean[i] + vo*(uFlow*3.6)` (`:1109`). |
| **5-Pole Vocal Tract + Radiation** | `hitofude.mjs:1077-1080`, `:1117-1127` | Serial 5-pole resonator cascade (`F1..F5`) with fixed `bwMinP=[80, 110*qSoft, 150*qSoft, 220*qSoft, 260*qSoft]`, `qDivP=[8, 11/qSoft, ...]`, `dMulP=[150-60*hiMix, 50-20*hiMix, 30-15*hiMix, 0, 0]`, followed by lip differentiation `ycRad[i] = yc[i] - radK * yc[i-1]`. |
| **Consonant Mix, Leveling, Envelope** | `hitofude.mjs:1133-1205` | 2-pole zero-DC consonant BP `bpc`, mix `y[i] = vScale*G1S[i]*ycRad[i] + 0.40*FCW[i]*bpc[i]` (`:1143`), 1-scalar leveling `gLv` (`:1147-1164`), time envelope `env` (`:1166-1174`), pause breath floor `pau_iki` (`:1177-1203`), peak normalization to `0.891` (`:1204-1205`). |
| **Measurement & CLI** | `hitofude.mjs:1249-1355`, `yomu.mjs:23-30, 152, 172` | `fftRadix2` & `hakaru` (measures `dur_s`, `crest_db`, `band_1k_2k6_db`, `band_2k6_5k6_db`, `tani_core_db`, `tani_tail_db`). `yomu.mjs:23-30` already forwards `{ ...prm }` to `makeHitofude`, so any new preset/fields in `PRESETS` work via `node yomu.mjs --preset kawaii` with **zero** required changes to `yomu.mjs` (or 1 line if changing default preset). |

---

## 2. Logic Chain

1. **Branch origin**: Because `kusanagi` is a standalone pure-JS branch (`origin/kusanagi@b205f58`) completely distinct from `main`, the new cute-voice branch MUST branch off `origin/kusanagi` (not `main`), after fetching `origin/kusanagi`.
2. **Why existing knobs alone cannot match real cute reference voices**:
   - **Observation (`:1062, 1074-1079`)**: `hiMix` saturates at `210 Hz`, locking all female voices to the same abrupt Bernoulli glottal closure (`closeMul=22.0`, `bern=0.55`) and fixed formant bandwidths. Real cute Japanese female voices exhibit higher Open Quotient / gentler return phase (stronger H1–H2 warmth) and silky high-frequency voiced aspiration (2.5–6 kHz air), which cannot be reproduced by lowering `g_vo` (which introduces broadband low-frequency rumble/hoarseness).
   - **Observation (`:1011-1018, 1067`)**: Uniform `fscale` scales F1–F5 together, whereas cute/smiling female articulation ("笑顔声") shifts F2/F3 upward disproportionately and places F4/F5 at speaker-specific centroids (~3.6–4.3 kHz / ~4.7–5.4 kHz).
   - **Observation (`:1143-1205`)**: `hitofude.mjs` has no post-tract spectral envelope matching stage. Physical-model formant cascades typically deviate 6–15 dB from real reference voices' Long-Term Average Spectrum (LTAS) across low-warmth (200–500 Hz), nasal/boxy mid (800–1600 Hz), cute brightness/presence (2.4–4.2 kHz), and silky air (4.5–7.5 kHz).
   - **Observation (`:976`)**: `sigh >= 0.25` disables `ACCENT_CUTE`, preventing simultaneous breathy sweetness and expressive cute F0 contours.
3. **Maximizing data resemblance within strictly <= 100 added lines**:
   - Because `tracksFromKana` (`:252`) already accepts overrides via `prm`, and `yomu.mjs` (`:24`) already forwards `...prm`, we spend **zero lines** on plumbing and invest almost the entire 100-line budget into **4 high-leverage acoustic mechanisms + 1 data-fitted preset (`PRESETS.kawaii`)** directly inside `hitofude.mjs`.
   - Every parameter in `PRESETS.kawaii` is populated directly from acoustic measurements of the collected cute-voice reference dataset (F0 distribution, vowel F1–F3, F4–F5, spectral tilt / multi-band LTAS delta, HNR/breathiness, speaking rate).

---

## 3. Concrete <= 100-Added-Line Bold Edit Strategy for `kusanagi`

### Line-Count Accounting Rule (Stop Condition)
- Measure strictly with:
  ```bash
  git diff --numstat origin/kusanagi -- hitofude.mjs yomu.mjs
  ```
- **Hard cap**: Sum of column 1 (added lines) across all modified/added code files (`.mjs`) **MUST be `<= 100`** (target **88–98 added lines** so there is zero accidental overrun).
- Avoid reformatting or touching unrelated existing lines (since modifying an existing line counts as +1 added line in `git diff --numstat`).
- Keep collected reference audio/analysis scripts out of the tracked code diff (or in a separate non-code data folder if requested — confirm with orchestrator whether data files are committed separately or excluded from the 100-line code budget; embedding the final compact fitted numbers inside `PRESETS.kawaii` keeps `hitofude.mjs` 100% self-contained within the 100-line cap).

### Exact Edit Plan in `hitofude.mjs` (~92 added lines total)

#### Block 1: `PRESETS.kawaii` + `ACCENT_KAWAII` (~16 added lines)
- **Target**: `hitofude.mjs:60` (inside `PRESETS`, right after `robot`) and `hitofude.mjs:555` (right after `ACCENT_CUTE`).
- **Design**:
  - Add `ACCENT_KAWAII` fitted to the reference dataset's F0 statistics (`reg`, `rng`, `jump`, `fall`, `sag`, `decl`, `fin`, `qrise`, `sm`) — e.g. wider lively range, buoyant/less-dropping phrase endings (`fin` smaller or slightly lifted), and faster/crisper transitions.
  - Add `PRESETS.kawaii` populated with the empirically fitted values from the collected cute-voice data:
    - `hz`, `fscale`, `rate`, `g_vo`, `damp`, `shin: 1.0`, `tilt_w`, `sigh`, `jitter`, `wander_st`, `combG`, `rawAirMul`, `pau_iki`
    - New data-driven cute voice fields:
      - `vt`: data-fitted 5-vowel `[F1, F2, F3]` table (passed straight to `tracksFromKana` via `prm.VT`!)
      - `f2_mul`, `f3_mul`, `f4_hz`, `f5_hz`: independent upper-tract & smile-cavity targets
      - `bw_mul`: `[b1, b2, b3, b4, b5]` formant bandwidth multipliers (wider softer F1, crisp F3/F4)
      - `oq_soft`: glottal softness / open-quotient factor (reduces `closeMul` & `bern`, raises `knee` for rounder H1-rich glottal pulse)
      - `asp_vo`: high-pass voiced aspiration gain (silky breathiness through F3–F5 during vowels)
      - `eq_bands`: `[[fc, Q, gainDb], ...]` (4–5 peaking/shelf biquad bands fitted directly to `LTAS_ref - LTAS_kusanagi`!)
      - `accent`: `ACCENT_KAWAII` (or custom object)
      - `scoop`: subtle phrase-initial / accent-peak pitch lift & cute phrase-final buoying

#### Block 2: Destructure New Options & Wire `VT` / `ACCENT_KAWAII` (~12 added lines)
- **Target**: `hitofude.mjs:919` (destructuring in `makeHitofude`), `:931` (`prm`), `:976` (`acc` selection).
- **Design**:
  - Destructure `vt = null, f2_mul = 1.0, f3_mul = 1.0, f4_hz = null, f5_hz = null, bw_mul = null, oq_soft = 0.0, asp_vo = 0.0, eq_bands = null, accent = null, scoop = 0.0` (2–3 compact lines).
  - Pass `if (vt) prm.VT = vt;` into `tracksFromKana` (`:932`).
  - At `:976`, replace/override `acc` so `accent` takes precedence:
    ```js
    const acc = accent || ((sigh >= 0.25 || hz < 200.0) ? ACCENT_NORMAL : ACCENT_CUTE);
    ```
  - Optional cute micro-prosody (`scoop > 0`, ~6 lines after `:977`): apply gentle upward pitch scoop on phrase-final voiced vowel tails and slight high-pitch brightness lift matched to reference F0 contour stats.

#### Block 3: Independent Formants & Cute Tract Bandwidths (~12 added lines)
- **Target**: `hitofude.mjs:1014-1018`, `:1067`, `:1077-1079`.
- **Design**:
  - Apply `f2_mul` and `f3_mul` to `F2[t]` and `F3[t]` (`:1015-1016`) so smiling/anterior-cavity shift is decoupled from `F1`.
  - Allow data-fitted `f4_hz` / `f5_hz` targets (`:1017`, `:1067`) blended smoothly with `F3` (e.g. `f4_hz ? Math.max(F3[t] + 450, f4_hz) : ...`).
  - Scale `bwMinP[k]` and `qDivP[k]` by `bw_mul[k]` when `bw_mul` is provided (`:1077-1078`) so F1 can be softer/breathier while F3–F4 match reference peak sharpness.

#### Block 4: Soft Open-Quotient Glottal Door & Silky High-Band Voiced Aspiration (~18 added lines)
- **Target**: `hitofude.mjs:1074-1075`, `:1081`, `:1108-1109`.
- **Design**:
  - Modulate glottal closure constants by `oq_soft` (`0..1`):
    - Gentler Bernoulli suction: `bern = 0.55 * hiMix * (1.0 - 0.55 * oq_soft)`
    - Smoother/rounder return phase: `closeMul = (8.20 + 13.80 * hiMix) * (1.0 - 0.45 * oq_soft)`
    - Softer knee: `knee = (0.22 - 0.04 * hiMix) * (1.0 + 0.80 * oq_soft)`
    - Slightly warmer radiation tilt: `radK = (coupled ? (0.42 + 0.48 * hiMix) : 0.70) * (1.0 - 0.18 * oq_soft)`
  - Inside the sample loop (`:1109`), compute a 1-pole high-pass of the SAME single wire `xClean[i]` (`hpAir = 0.65 * (hpAir + xClean[i] - xPrev); xPrev = xClean[i];`) and inject `vo * asp_vo * (0.35 + 0.65 * door) * hpAir` into `sig` before the 5-pole vocal tract. This preserves kusanagi's single-wire principle while giving real glottal-chink breathiness through F3–F5 without low-end mud!

#### Block 5: Reference-Data LTAS Spectral-Envelope Matching Cascade (Causal Biquad Peaking/Shelf Bank) (~30 added lines)
- **Target**: `hitofude.mjs:1144` (immediately after `y` mix, before leveling/envelope) or helper function right before `makeHitofude`.
- **Design**:
  - Implement a compact, exact Audio EQ Cookbook peaking/shelf biquad cascade `applyEqBands(y, bands)` (~24 lines):
    - For each `[fc, Q, gainDb]` (or `[fc, Q, gainDb, type]` supporting `"peaking"`, `"lowshelf"`, `"highshelf"`):
      - Compute `A = 10^(gainDb/40)`, `w0 = 2*pi*fc/SR`, `alpha = sin(w0)/(2*Q)`, standard normalized `(b0, b1, b2, a1, a2)`.
      - Filter `y` in-place (100% causal, zero extra buffers, ~0.5 ms runtime).
  - Call `if (eq_bands && eq_bands.length) applyEqBands(y, eq_bands);` right after `:1143`.
  - **Why this is the decisive weapon for "データに似せることだけを第一に"**:
    - Once the Worker collects reference cute-voice WAVs and measures their average voiced spectrum across bands (e.g. 250 Hz, 650 Hz, 1300 Hz, 2800 Hz, 4800 Hz, 7000 Hz) vs. `kusanagi`'s baseline output, the Worker fits `eq_bands` directly to close the spectral gap to `< 1–2 dB` across the entire audible vocal range!

#### Optional Block 6: `yomu.mjs` Default Preset (1 added line)
- **Target**: `yomu.mjs:152`
- Change `default: "hitofude"` → `default: "kawaii"` on this dedicated branch so `node yomu.mjs "..."` immediately speaks in the data-matched cute voice!

### Line Budget Summary
| Component | File | Est. Added Lines |
|---|---|---:|
| `PRESETS.kawaii` + `ACCENT_KAWAII` | `hitofude.mjs` | ~16 |
| Option destructuring + `VT`/`accent` wiring + cute `scoop` | `hitofude.mjs` | ~12 |
| Decoupled `f2_mul`/`f3_mul`/`f4_hz`/`f5_hz`/`bw_mul` | `hitofude.mjs` | ~12 |
| Soft OQ glottal door (`oq_soft`) + HP voiced aspiration (`asp_vo`) | `hitofude.mjs` | ~18 |
| Causal LTAS-matching biquad EQ bank (`applyEqBands`) | `hitofude.mjs` | ~30 |
| Default `--preset kawaii` (optional) | `yomu.mjs` | ~1 |
| **Total** | | **~89 lines (strictly <= 100)** |

---

## 4. Caveats

1. **Data collection dependency**: The exact numeric values inside `PRESETS.kawaii` (`hz`, `vt`, `f4_hz`, `f5_hz`, `bw_mul`, `oq_soft`, `asp_vo`, `eq_bands`, `ACCENT_KAWAII`) MUST be fitted to the actual reference cute-voice audio collected in the data-collection step — NOT guessed abstractly.
2. **Existing `git diff --numstat` semantics**: Modifying an existing line counts as `+1` addition. The Worker should prefer clean insertions and minimal in-place line replacements, checking `git diff --numstat origin/kusanagi -- hitofude.mjs yomu.mjs` before stopping at <= 100 added lines.
3. **Browser / zero-dependency compatibility**: All proposed additions in `hitofude.mjs` use pure JS `Math.*` and `Float64Array` only (no Node `import`s), preserving `hitofude.mjs`'s browser compatibility and single-wire noise design.
4. **Verification scope**: Per `ORIGINAL_REQUEST.md:4` (`あとエラーとか予期しない動作を検証しなくてよい`), the user explicitly waived error/edge-case verification; focus effort on collecting reference data, fitting acoustic targets tightly to that data, and landing the bold <=100-line addition cleanly.

---

## 5. Conclusion

1. Fetch `origin/kusanagi` (`b205f58`) and branch the new cute-voice branch directly off `origin/kusanagi`.
2. Collect genuine cute Japanese voice reference data and extract its empirical acoustic fingerprint: F0 mean/range/contour stats, per-vowel F1–F3, F4–F5 centroids, H1–H2 / tilt, high-band breathiness/HNR, speaking rate, and multi-band voiced LTAS.
3. Implement the 5-block bold upgrade in `hitofude.mjs` (+ optional 1-line default in `yomu.mjs`) totaling **~89–98 added lines** (strictly `<= 100` added lines via `git diff --numstat`), prioritizing acoustic resemblance to the collected data above everything else, then stop immediately at the 100-line mark as instructed.

---

## 6. Verification Method

1. **Verify branch base & source files**:
   ```bash
   git fetch origin kusanagi:refs/remotes/origin/kusanagi
   git show origin/kusanagi:hitofude.mjs | wc -l   # expects 1355
   git show origin/kusanagi:yomu.mjs | wc -l       # expects 245
   ```
2. **Verify strict <= 100 added lines cap after implementation**:
   ```bash
   git diff --numstat origin/kusanagi -- hitofude.mjs yomu.mjs
   # Sum of column 1 (added lines) MUST be <= 100
   ```
3. **Verify synthesis & acoustic match against reference data**:
   ```bash
   node yomu.mjs --preset kawaii --measure --compare "わたし、にほんご、ちょっとしゃべれます"
   ```
   Compare the synthesized WAV's F0 mean/range, band energy (`band_1k_2k6_db`, `band_2k6_5k6_db`), harmonic valley (`tani_core_db`, `tani_tail_db`), and multi-band LTAS directly against the collected reference voice data.
