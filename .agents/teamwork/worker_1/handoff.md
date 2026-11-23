# Handoff Report — `worker_1` (Milestone 1: `kawaii-kusanagi`)

**Handoff Type**: Hard (Task Complete)  
**Branch**: `kawaii-kusanagi` (branched from `origin/kusanagi` @ `b205f58ae2620fffec764d1bde3f858fcf294ac8`)  
**Commit**: `26964f75e4df6ae23a3e07461ea1b87c2c4f5b49` (`feat(kusanagi): add kawaii-kusanagi voice-cuteness dataset and <=100-line data-fitted DSP upgrades`)

---

## 1. Observation

### 1.1 Git Branch & Line-Count Verification
- `git branch --show-current`: `kawaii-kusanagi`
- `git log -n 2 --stat`:
  - `26964f75e4df6ae23a3e07461ea1b87c2c4f5b49`: `data/SOURCES.md` (+34), `data/kawaii_utterances.jsonl` (+120), `data/kawaii_voice_ref.json` (+248), `hitofude.mjs` (+70/-9), `yomu.mjs` (+1/-1).
  - Parent: `b205f58ae2620fffec764d1bde3f858fcf294ac8` (`origin/kusanagi`).
- `git status -sb`:
  ```
  ## kawaii-kusanagi
  ?? .agents/
  ?? PROJECT.md
  ```
  (`.agents/` and `PROJECT.md` remained untouched and untracked; nothing was pushed to remote.)
- `git diff --numstat origin/kusanagi -- '*.mjs' '*.js' '*.py' '*.sh'`:
  ```
  70	9	hitofude.mjs
  1	1	yomu.mjs
  ```
  **Total added code lines across all code files: `71` (strictly `<= 100`).**

### 1.2 Collected Cute-Voice Reference Data (`data/`)
Downloaded and analyzed **120 genuine open-license Japanese cute/happy female studio WAVs** at 44.1 kHz mono in temporary scratch space (subsequently deleted):
- **Tsukuyomi-chan Corpus Vol.1** (`https://tyc.rei-yumesaki.net/files/voice/tyc-corpus1.zip`, Tsukuyomi-chan Corpus License): **100 utterances** (`01 WAV/VOICEACTRESS100_001.wav`–`100.wav`, speaker `tsukuyomi`).
- **JVNV Emotional Speech Corpus (`litagin/jvnv_corpus_v1_no_nv`, CC BY-SA 4.0)**: **20 utterances** (10 `F1_happy_free_01..10.wav` + 10 `F2_happy_free_01..10.wav`, speakers `jvnv_f1_happy`, `jvnv_f2_happy`).

Key pooled median acoustic targets written to `data/kawaii_voice_ref.json` (and per-utterance records in `data/kawaii_utterances.jsonl`, provenance in `data/SOURCES.md`):
- `f0_median_hz`: `344.6 Hz` (`f0_p10_hz`: `275.45`, `f0_p90_hz`: `421.45`, `f0_range_st`: `7.33 st`, `f0_final_delta_st`: `+0.03 st`)
- `moras_per_sec`: `6.83`
- `crest_db`: `14.15 dB`
- `band_1k_2k6_db`: `-9.20 dB`, `band_2k6_5k6_db`: `-20.45 dB`, `band_5k6_9k_db`: `-30.42 dB`
- `ltas_db` (vs 120–1000 Hz): `b250=-4.14`, `b650=-2.13`, `b1300=-9.81`, `b2800=-16.49`, `b4800=-24.06`, `b7000=-31.14`
- `h1_h2_db`: `+8.25 dB`, `h1_a3_db`: `+31.33 dB`
- `tani_core_db`: `29.65 dB`, `tani_tail_db`: `28.25 dB`
- `f4_hz`: `4039 Hz`, `f5_hz`: `4973 Hz`
- `vowel_formants_hz`: `a:[885,1825,3037]`, `i:[406,1672,2858]`, `u:[418,1099,2768]`, `e:[571,1972,3103]`, `o:[649,1258,2719]`

### 1.3 Synthesis & Acoustic Comparison (Before vs. After)
1. **CLI Verification**:
   ```
   node yomu.mjs --preset kawaii --measure --compare "わたし、にほんご、ちょっとしゃべれます"
   ```
   Output:
   ```
   [kusanagi] Saved: /home/antigravity/poidowl/tsukinami/out/yomu_002_kawaii.wav (3.58s in 235ms, 17 moras: ワタシ、ニホンゴ、チョットシャベレマス)
     [Measure] {"sha256_16":"8b78afb1b2dc4dc7","dur_s":3.58,"crest_db":14,"band_1k_2k6_db":-12.6,"band_2k6_5k6_db":-22.2,"tani_core_db":34.9,"tani_tail_db":30.6}
     [Compare vs hitofude] {"base":"/home/antigravity/poidowl/tsukinami/out/yomu_002_kawaii_base.wav","env_r":0.726,"env_diff_db":23.31,"d_dur_s":-0.47,"d_band_1k_2k6_db":-12,"d_band_2k6_5k6_db":-4.9,"d_tani_core_db":2,"d_tani_tail_db":0}
   ```
2. **4-Utterance Benchmark Comparison Against `data/kawaii_voice_ref.json` (`pooled`)**:

| Metric | Reference (`data/kawaii_voice_ref.json`) | Baseline (`hitofude`) | New (`kawaii`) |
|---|---:|---:|---:|
| `f0_median_hz` | 344.60 Hz | 344.66 Hz | **348.19 Hz** |
| `f0_range_st` | 7.33 st | 6.73 st | **7.38 st** |
| `f0_final_delta_st` | +0.03 st | -3.28 st | **-2.02 st** |
| `moras_per_sec` | 6.83 | 5.63 | **6.77** |
| `crest_db` | 14.15 dB | 17.50 dB | **12.98 dB** |
| `band_1k_2k6_db` | -9.20 dB | -0.25 dB | **-9.23 dB** |
| `band_2k6_5k6_db` | -20.45 dB | -18.78 dB | **-21.06 dB** |
| `band_5k6_9k_db` | -30.42 dB | -27.85 dB | **-30.71 dB** |
| `ltas b250` | -4.14 dB | -7.08 dB | **-3.79 dB** |
| `ltas b650` | -2.13 dB | -1.73 dB | **-2.83 dB** |
| `ltas b1300` | -9.81 dB | +0.03 dB | **-9.55 dB** |
| `ltas b2800` | -16.49 dB | -14.16 dB | **-16.60 dB** |
| `ltas b4800` | -24.06 dB | -23.12 dB | **-24.32 dB** |
| `ltas b7000` | -31.14 dB | -28.80 dB | **-31.42 dB** |
| `h1_h2_db` | +8.25 dB | -0.23 dB | **+5.35 dB** |
| `h1_a3_db` | +31.33 dB | +22.15 dB | **+28.13 dB** |
| `tani_core_db` | 29.65 dB | 41.38 dB | **36.28 dB** |
| `tani_tail_db` | 28.25 dB | 37.33 dB | **28.33 dB** |
| **Weighted Acoustic Loss** | **0.00** | **783.41** | **52.26 (15.0× reduction)** |

---

## 2. Logic Chain

1. **Empirical diagnosis of baseline `hitofude` vs. real cute Japanese female voices (Observation 1.2 & 1.3)**:
   - Baseline `hitofude` had a +9.84 dB excess in `b1300` (`+0.03` vs `-9.81 dB`), -8.48 dB deficit in `h1_h2_db` (`-0.23` vs `+8.25 dB`), -9.18 dB deficit in `h1_a3_db` (`+22.15` vs `+31.33 dB`), excessive harmonic valley depth (`tani_core_db`: `41.38` vs `29.65 dB`), slower rate (`5.63` vs `6.83` moras/sec), and steep phrase-final pitch drop (`-3.28` vs `+0.03 st`).
2. **Targeted <=100-line physical-model & EQ additions in `hitofude.mjs` (+70 lines) + `yomu.mjs` (+1 line)**:
   - `ACCENT_KAWAII` + `PRESETS.kawaii` + explicit `accent` override (fixing `sigh >= 0.25` forcing `ACCENT_NORMAL`) + smooth 140ms voiced phrase-final `scoop` aligned `f0_range_st` (`7.38` vs `7.33`), `moras_per_sec` (`6.77` vs `6.83`), and lifted phrase endings.
   - Decoupled smiling/cute formants (`vt` via `prm.VT`, `f2_mul`, `f3_mul`, independent `f4_hz=4039`, `f5_hz=4973`, per-formant `bw_mul`) shaped the upper tract directly to the measured centroids.
   - Soft open-quotient glottal door (`oq_soft=0.68`) and single-wire high-pass voiced aspiration (`asp_vo=0.18`) raised `h1_h2_db` by `+5.58 dB` and `h1_a3_db` by `+5.98 dB` while bringing `tani_tail_db` (`28.33` vs `28.25 dB`) directly onto the real data.
   - Causal 6-band Audio EQ Cookbook biquad cascade (`applyEqBands`) fitted iteratively to `LTAS_ref - LTAS_kusanagi` closed every single LTAS band to within `0.11–0.70 dB` of the 120-utterance corpus median, cutting total weighted acoustic loss from `783.41` to `52.26` (`15.0×` closer).
   - `hitofude.mjs` remains zero-import pure ES Module JS; total code additions stopped strictly at `71 <= 100` lines.

---

## 3. Caveats

- Error/edge-case verification and legacy golden-hash regression tests (`tools/test_pause.mjs`, `tools/test_sarasara.mjs`) were intentionally skipped per user request (`あとエラーとか予期しない動作を検証しなくてよい`).
- All raw downloaded WAVs and offline Python/Node fitting scripts were deleted from scratch space prior to handoff; `out/` was also cleaned up.
- No unexplored modules encountered.

---

## 4. Conclusion

Milestone 1 of `kawaii-kusanagi` is complete and committed locally at `26964f75e4df6ae23a3e07461ea1b87c2c4f5b49` on branch `kawaii-kusanagi` (off `origin/kusanagi@b205f58`), with 120 real studio cute-voice utterances measured into `data/`, bold data-fitted DSP/prosody upgrades in `hitofude.mjs` + default preset in `yomu.mjs` totaling **71 added code lines (`<= 100`)**, and a **15.0× reduction** in weighted acoustic distance to the collected cute-voice dataset.

---

## 5. Verification Method

Run from `/home/antigravity/poidowl/tsukinami`:
```bash
git branch --show-current
git log -n 2 --stat
git status -sb
git diff --numstat origin/kusanagi -- '*.mjs' '*.js' '*.py' '*.sh'
node yomu.mjs --preset kawaii --measure --compare "わたし、にほんご、ちょっとしゃべれます"
wc -l data/kawaii_utterances.jsonl
```
Expected:
- Branch `kawaii-kusanagi`, HEAD `26964f75e4df6ae23a3e07461ea1b87c2c4f5b49`, parent `b205f58`.
- `git diff --numstat` reports `70 9 hitofude.mjs` and `1 1 yomu.mjs` (sum of added lines = `71 <= 100`).
- `data/kawaii_utterances.jsonl` has `120` lines; `yomu.mjs` synthesizes cleanly with `--preset kawaii`.
