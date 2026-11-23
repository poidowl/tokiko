# Handoff Report — `challenger_2_r1` (Data Consistency & DSP Ablation Challenger, Iteration 1)

**Handoff Type**: Hard (Verification Complete)  
**Verdict**: **APPROVE** (Confirmed Correctness across Dataset Integrity, DSP Ablation, and Line-Count/Branch Constraints)  
**Target Reviewed**: Branch `kawaii-kusanagi` @ commit `26964f75e4df6ae23a3e07461ea1b87c2c4f5b49` (parent `origin/kusanagi` @ `b205f58ae2620fffec764d1bde3f858fcf294ac8`)

---

## 1. Observation

### 1.1 Line-Count, Branch & Working Tree Verification
Ran independently in `/home/antigravity/poidowl/tsukinami`:
- `git branch --show-current`: `kawaii-kusanagi`
- `git log -n 2 --stat`: HEAD `26964f75e4df6ae23a3e07461ea1b87c2c4f5b49` directly on top of `b205f58ae2620fffec764d1bde3f858fcf294ac8` (`origin/kusanagi`).
- `git diff --numstat origin/kusanagi -- '*.mjs' '*.js' '*.py' '*.sh'`:
  ```text
  70	9	hitofude.mjs
  1	1	yomu.mjs
  ```
  Total added code lines = **71** (`<= 100`).
- `grep -rn '^import ' hitofude.mjs`: no matches (`hitofude.mjs` remains zero-import pure ES Module JS).
- `git status -sb`:
  ```text
  ## kawaii-kusanagi
  ?? .agents/
  ?? PROJECT.md
  ```
  (Working tree unmodified; no stray temp probe directories remain.)

### 1.2 Dataset Statistical Integrity Probe (`data/kawaii_utterances.jsonl` vs `data/kawaii_voice_ref.json`)
Executed isolated Python probe from `mktemp -d -- "${TMPDIR:-/tmp}/teamwork_probe.XXXXXX"` (subsequently removed):
```text
JSONL non-empty line count: 120
Speaker counts: {'jvnv_f1_happy': 10, 'jvnv_f2_happy': 10, 'tsukuyomi': 100}
Unique (speaker, utt_id) count: 120
Internal consistency issues: 0
Max f0_range_st rounding diff: 0.0087 st
Max moras_per_sec rounding diff: 0.0261 m/s

Per-metric variance (pooled n=120):
  f0_median_hz      : min=  306.80 med=  344.60 max=  450.60 std=  25.67 uniq=117
  f0_p10_hz         : min=  222.40 med=  275.45 max=  381.90 std=  19.65 uniq=107
  f0_p90_hz         : min=  359.10 med=  421.45 max=  598.00 std=  48.90 uniq=112
  f0_range_st       : min=    3.00 med=    7.33 max=   16.28 std=   2.01 uniq=108
  f0_final_delta_st : min=   -9.15 med=    0.03 max=   10.71 std=   2.59 uniq=107
  crest_db          : min=   11.20 med=   14.15 max=   21.90 std=   1.76 uniq=55
  band_1k_2k6_db    : min=  -18.88 med=   -9.20 max=    0.99 std=   3.42 uniq=114
  band_2k6_5k6_db   : min=  -24.48 med=  -20.45 max=   -8.50 std=   3.48 uniq=116
  band_5k6_9k_db    : min=  -33.59 med=  -30.42 max=  -17.41 std=   3.35 uniq=109
  tani_core_db      : min=   18.40 med=   29.65 max=   64.40 std=   7.76 uniq=99
  tani_tail_db      : min=   16.30 med=   28.25 max=   45.70 std=   5.75 uniq=91
  h1_h2_db          : min=   -3.77 med=    8.25 max=   14.12 std=   3.28 uniq=110
  h1_a3_db          : min=    7.40 med=   31.33 max=   40.13 std=   6.92 uniq=117
  f4_hz             : min= 3662.00 med= 4039.00 max= 4217.00 std=  93.60 uniq=92
  f5_hz             : min= 4634.00 med= 4973.00 max= 5276.00 std= 115.88 uniq=108
  moras_per_sec     : min=    5.13 med=    6.83 max=    9.83 std=   0.74 uniq=97
Low-variance fields: []

Group [pooled] (n=120): max_median_diff=0.0000, mismatches=0
Group [jvnv_f1_happy] (n=10): max_median_diff=0.0000, mismatches=0
Group [jvnv_f2_happy] (n=10): max_median_diff=0.0000, mismatches=0
Group [tsukuyomi] (n=100): max_median_diff=0.0000, mismatches=0

TOTAL REF MISMATCHES: 0
```

### 1.3 DSP Mechanism Ablation Probe (`hitofude.mjs`)
Executed isolated Node ESM probe importing `makeHitofude`, `PRESETS`, `ACCENT_KAWAII`, `hakaru`, `SR` from `/home/antigravity/poidowl/tsukinami/hitofude.mjs` on `"わたし、にほんご、ちょっとしゃべれます"`, toggling each of the 11 new knobs individually off from `PRESETS.kawaii` (delta = `FULL - ABLATED`):

- **Full `PRESETS.kawaii`**: `len=157878`, `sha=18950692a6fad258`, `hakaru={dur_s:3.58, crest_db:14, band_1k_2k6_db:-12.6, band_2k6_5k6_db:-22.2, tani_core_db:34.9, tani_tail_db:30.6}`, `ltas={b250:-4.01, b650:-1.62, b1300:-8.58, b2800:-17.66, b4800:-22.64, b7000:-23.27, h1_h2_db:6.18}`, `f0={med:359.4, range_st:9.17, final_delta_st:-1.03}`.

| Ablated Knob | `rmsDiff` | `maxAbs` | Finite | Key Acoustic Delta (`ON - OFF`) | Physical Assessment |
|---|---:|---:|:---:|---|---|
| `oq_soft` (`0.68 -> 0.0`) | `0.05352` | `0.52430` | Yes | `h1_h2=+4.80 dB`, `b250=+1.86`, `b2800=-4.91`, `b4800=-4.66`, `crest=-2.1 dB` | Softer glottal closure increases spectral tilt & H1-H2 |
| `asp_vo` (`0.18 -> 0.0`) | `0.00162` | `0.03352` | Yes | `b2800=+0.12`, `b4800=+0.39`, `b2k6_5k6=+0.4 dB`, `b250/650/1300=0.00` | Strictly high-pass voiced aspiration energy |
| `eq_bands` (`6-band -> null`) | `0.08661` | `0.57696` | Yes | `b250=+1.79`, `b4800=-5.82`, `b7000=-2.62`, `h1_h2=+5.69`, `b2k6_5k6=-4.4 dB` | Matches shelf/peaking EQ signs and magnitudes |
| `vt` (`custom -> null`) | `0.02204` | `0.36838` | Yes | `b1300=-0.47`, `b2800=+2.42`, `b4800=+1.24`, `tani_core=-3.7 dB` | Wires into `prm.VT`, shifting vowel formants |
| `f2_mul` (`1.065 -> 1.0`) | `0.00778` | `0.09020` | Yes | `b1k_2k6=-0.6`, `b2k6_5k6=+1.7`, `b1300=-0.22`, `b2800=+0.37`, `b4800=+0.60` | Shifts F2 energy upward into 2.6–5.6 kHz |
| `f3_mul` (`1.04 -> 1.0`) | `0.00547` | `0.08355` | Yes | `b2800=-0.62`, `b4800=-0.73`, `b2k6_5k6=-1.2 dB` | Shifts F3 resonance upward |
| `f4_hz` (`4039 -> null`) | `0.00477` | `0.08157` | Yes | `b2800=+0.93`, `b4800=+2.01`, `b2k6_5k6=+3.3 dB` | Directly shapes 4 kHz vocal tract pole |
| `f5_hz` (`4973 -> null`) | `0.00274` | `0.03985` | Yes | `b4800=+1.18`, `b2k6_5k6=+1.6 dB`, `b250/650~0.00` | Directly shapes ~5 kHz upper vocal tract pole |
| `bw_mul` (`[1.18..1.0] -> null`) | `0.00650` | `0.06662` | Yes | `b250=+0.26`, `b4800=+0.27`, `tani_core=-0.7`, `tani_tail=-1.0 dB` | Modulates per-formant bandwidths (`bwMinP`/`qDivP`) |
| `accent` (`"kawaii" -> null`) | `0.10042` | `0.89217` | Yes | `f0.med=+18.0 Hz`, `f0.range=+3.15 st` | Applies `ACCENT_KAWAII` prosody curve |
| `scoop` (`4.0 -> 0.0`) | `0.03571` | `0.42908` | Yes | `f0.final_delta=+2.69 st` (`-1.03 st` ON vs `-3.72 st` OFF) | Smoothly lifts phrase-final F0 before pauses/end |

- **`sigh >= 0.25` Accent Override Check**:
  With `sigh: 0.30`: `accent: null` fell back to `ACCENT_NORMAL` (`med=317.2 Hz, range_st=3.06`), whereas `accent: "kawaii"` retained `ACCENT_KAWAII` (`med=359.4 Hz, range_st=9.17`, `rmsDiff=0.08981`).
- **Dead knobs**: `NONE (all 11 knobs active)`.

---

## 2. Logic Chain

1. **Dataset integrity is mathematically exact**: Every one of the 120 rows in `data/kawaii_utterances.jsonl` is valid JSON, unique across `(speaker, utt_id)`, internally consistent (`f0_p10 <= f0_median <= f0_p90`, `f0_range_st` within `0.0087 st` of `12*log2(p90/p10)`, `moras_per_sec` within `0.0261` of `n_moras/active_dur_s`, `f4_hz < f5_hz`), exhibits realistic per-utterance variance (55–117 unique values per metric across 120 rows), and recomputes to an exact `0.0000` maximum difference against every pooled and per-speaker median in `data/kawaii_voice_ref.json` (Observation 1.2).
2. **All 11 new DSP/prosody mechanisms are live and physically grounded**: Toggling each knob individually off produces non-zero waveform and spectral/F0 deltas in the expected physical direction, with zero dead parameters and zero non-finite samples; the `sigh >= 0.25` override fix also behaves as designed (Observation 1.3).
3. **Hard constraints satisfied**: Branch `kawaii-kusanagi` sits directly on `origin/kusanagi@b205f58`, `hitofude.mjs` remains zero-import pure ESM, and `git diff --numstat origin/kusanagi -- '*.mjs' '*.js' '*.py' '*.sh'` totals `71` added lines (`<= 100`) (Observation 1.1).

---

## 3. Caveats & Unchallenged Areas

## Unchallenged Areas
- **Raw WAV re-extraction & `vowel_formants_hz` recomputation**: The 120 source WAVs were processed offline and deleted per project policy, and `vowel_formants_hz` is a frame-level k-means aggregate not stored per utterance in `data/kawaii_utterances.jsonl`; therefore raw-audio-to-JSONL extraction and `vowel_formants_hz` medians could not be independently recomputed from `data/kawaii_utterances.jsonl` alone.
- **Error handling, malformed inputs & legacy golden-hash regressions**: Explicitly waived by `ORIGINAL_REQUEST.md` (`あとエラーとか予期しない動作を検証しなくてよい`) and therefore not challenged.

---

## 4. Conclusion

**APPROVE.** Iteration 1 of `kawaii-kusanagi` (`26964f75e4df6ae23a3e07461ea1b87c2c4f5b49`) passes all empirical checks for dataset statistical consistency, individual DSP mechanism ablation (11/11 active and physically sensible), zero-import ESM compliance, and the strict `<= 100` added code lines budget (`71` lines).

---

## 5. Verification Method

From `/home/antigravity/poidowl/tsukinami`:
1. Line-count & branch check:
   ```bash
   git branch --show-current
   git diff --numstat origin/kusanagi -- '*.mjs' '*.js' '*.py' '*.sh'
   ```
   Expected: `kawaii-kusanagi`, `70 9 hitofude.mjs` and `1 1 yomu.mjs` (sum = `71 <= 100`).
2. Dataset & DSP probes: Re-run the Python JSONL-vs-JSON median recomputation script (checking `TOTAL REF MISMATCHES: 0` across `pooled` and all 3 speakers) and the Node ablation script importing `makeHitofude`, `PRESETS`, `hakaru` from `./hitofude.mjs` (checking `DEAD KNOBS: NONE` and `finite=true` across all 11 knobs).
