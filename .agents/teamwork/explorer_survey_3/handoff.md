# Step 0 Survey Handoff — Voice Data & Reference Explorer (`explorer_survey_3`)

**Core Summary**: Neither `main` nor `kusanagi` currently stores any cute-voice audio datasets or reference acoustic profiles, but `kusanagi` (`hitofude.mjs`) already contains an exact, dependency-free acoustic meter (`hakaru()`) and orthogonal physical-model knobs (glottal door, 5-pole vocal tract, `VT` formants, `ACCENT_CUTE`). The environment has live internet access, `node` v24.22.3, `python3` 3.11.2 + `numpy`, and `ffmpeg`, allowing immediate collection of genuine open-license Japanese cute-voice WAV corpora (Tsukuyomi-chan Corpus Vol.1 + JVNV `F1`/`F2` happy speech) into scratch space, extraction of structured acoustic reference data into `data/` (non-code JSON/JSONL), and direct data-matching modifications to `kusanagi` strictly within the 100-line code addition budget.

---

## 1. Observation

### 1.1 Original Request Constraints
From `/home/antigravity/poidowl/tsukinami/.agents/teamwork/ORIGINAL_REQUEST.md` (line 4):
> 声の可愛さのみを追求するブランチを追加して。データも集めて。そしてデータに似せることだけを第一に。それだけを第一にkusanagiへ大胆に加筆して。しかしコード100行の追加で、いったん作業をストップしてほしい。あとエラーとか予期しない動作を検証しなくてよい

### 1.2 Repository & Branch Inventory
- Local checkout is on `main` (`5025d29`). Remote branches include `origin/kusanagi` (`b205f58ae2620fffec764d1bde3f858fcf294ac8`), `origin/idol-koe-master` (`8d4f650b`), and `origin/kiku-kusanagi` (`ec489081`).
- **Existing data on `main`**:
  - No audio corpora, no `wav/` directory, no `data/` directory, no `.npz`/`.pkl`/acoustic JSON reference profiles.
  - `assets/` contains only 3 images (`hitofude_square.jpg`, `kusanagi_square.jpg`, `social_preview.png`).
  - Legacy analysis scripts exist on `main` (`tehon.sh`, `featF.py`, `tani.py`, `uta_hakaru.py`, `suki3.py`, `mijikai_full.py`) designed for the Python `carve.py` pipeline, expecting external `wav/{SID}_*.wav` and `meta{SID}.json`, and importing `soundfile`, `pyworld`, `librosa` (none of which are currently installed).
  - `OO.txt` and `S.txt` are 1-line JSON parameter fragments for `carve.py` (`vf1x`, `vfloor`, `P.CDUR`, `hz: 330`).
- **Existing files on `origin/kusanagi` (`b205f58`)**:
  - `.gitignore` (`out/`, `node_modules/`, `.DS_Store`), `LICENSE`, `README.md` (9,733 B), `hitofude.mjs` (61,616 B, 1,355 lines), `yomu.mjs` (10,269 B, 245 lines), `tools/build_x_player.mjs`, `tools/test_pause.mjs`, `tools/test_sarasara.mjs`.
  - **No reference data files exist on `kusanagi`.**
  - `origin/idol-koe-master` is identical to `kusanagi` except for a 284-byte `idol-koe-master.html` containing a Python traceback.
- **`kusanagi` Engine (`hitofude.mjs`) Acoustic Architecture & Built-in Measurement**:
  - Sample rate `SR = 44100`, frame period `FP = 5.0` ms.
  - 7 presets (`hitofude` 326 Hz / `fscale=1.12`, `toiki` 292 Hz / `fscale=1.07` / `sigh=0.42`, `alto`, `sasayaki`, `chibi` 375 Hz / `fscale=1.20`, `ossan`, `robot`).
  - Vowel formant table `KOTOBA_PRM.VT`: `a: [850, 1400, 2800]`, `i: [330, 2750, 3300]`, `u: [380, 1300, 2650]`, `e: [520, 2350, 3000]`, `o: [650, 1050, 2850]`; scaled uniformly by `fscale`; `F5` derived from `F4 + 1100 * fs`.
  - Pitch accent presets: `ACCENT_NORMAL` (`reg: 340, rng: 6.2, jump: 2.8, fall: 3.8`) and `ACCENT_CUTE` (`reg: 410, rng: 10.0, jump: 5.6, fall: 6.0, sag: 1.2, decl: 1.0, fin: 2.0, qrise: 6.0, sm: 30.0`), selected automatically when `sigh < 0.25 && hz >= 200.0`.
  - Single causal DSP loop (asymmetric Bernoulli 2-lip mucosal door + 5-pole series vocal tract F1–F5 + lip radiation `yc[i] - radK * yc[i-1]`) exposes key internal physical constants: `hiMix`, `qSoft`, `rawAir`, `radK`, `bern`, `loGain`, `upGain`, `knee`, `closeMul`, `closedDecay`, `bwMinP`, `qDivP`, `dMulP`.
  - Built-in zero-dependency FFT analyzer `hakaru(samples, rInfo)` computes:
    - `dur_s`, `crest_db`, `band_1k_2k6_db` (1.0–2.6 kHz vs 120–1000 Hz), `band_2k6_5k6_db` (2.6–5.6 kHz vs 120–1000 Hz), `tani_core_db` (mean harmonic peak-to-valley depth across H1–H6 in final vowel core), `tani_tail_db` (same at 85% of final vowel).

### 1.3 Environment Capabilities (Verified)
- **Installed CLIs**: `python3` (3.11.2), `node` (v24.22.3), `npm`, `curl`, `wget`, `ffmpeg`, `gh`, `git`, `jq`, `pip3`, `uv`.
- **Installed Python packages**: `numpy`, stdlib (`wave`, `json`, `urllib`, `math`, etc.). Not installed: `scipy`, `librosa`, `soundfile`, `pyworld`, `parselmouth`, `torch`.
- **Network**: Live outbound HTTPS works via `curl` (`HTTP/2 200` on `huggingface.co` and `HTTP/1.1 200` on `tyc.rei-yumesaki.net`).

### 1.4 Verified Live Open-License Japanese Cute-Voice Data Sources
1. **JVNV Emotional Speech Corpus — Non-Verbal-Removed WAV Mirror (`litagin/jvnv_corpus_v1_no_nv`, HuggingFace, License: CC BY-SA 4.0)**:
   - Verified `F1/F1_happy_free_01.wav` .. `10.wav` (1.3–2.2 MB each) and `F2/F2_happy_free_01.wav` .. `10.wav` (1.2–1.9 MB each), plus `regular` happy utterances and `transcription_no_nv.csv`.
   - Direct `HEAD` check on `https://huggingface.co/datasets/litagin/jvnv_corpus_v1_no_nv/resolve/main/F1/F1_happy_free_01.wav` returned `HTTP/2 200`, `content-type: audio/wave`, `content-length: 1304592`.
   - Contains studio recordings of 2 professional Japanese female voice actresses (`F1`, `F2`) in bright/happy vocal style.
2. **Tsukuyomi-chan Corpus Vol.1 (つくよみちゃんコーパス Vol.1 声優統計コーパス / JVS準拠, CV. 夢前黎, Free for speech synthesis R&D / commercial & non-commercial use)**:
   - Direct `HEAD` check on `https://tyc.rei-yumesaki.net/files/voice/tyc-corpus1.zip` returned `HTTP/1.1 200 OK`, `content-type: application/zip`, `content-length: 516635952` (516.6 MB, 100 studio cute/anime female WAV utterances + transcripts).
3. **Peer-Reviewed Acoustic Literature Benchmarks (Cross-Check)**:
   - **Starr (2015)**, *"Sweet voice: The role of voice quality in a Japanese feminine style"*, *Language in Society* 44(1):1–34 — Japanese anime seiyuu "sweet voice" is characterized by **head register** (higher `H1-H2` = larger open quotient / softer glottal closure, higher `H1-A1` and `H1-A3` = warmer spectral tilt, higher HNR / cleaner periodicity than falsetto, lower harsh 2–4 kHz stridency), with female anime heroine pitch targets at **320–400 Hz** (Teshigawara 2003) and sweet-voice elder-sister targets around **263–308 Hz**.
   - **Super Kawaii Vocalics (2025)** (`arxiv.org/html/2507.06235v1`) — Higher F0 and higher F1–F3 formant frequencies (shorter perceived vocal tract / youthful, smiling articulation) directly increase perceived *kawaiiness* in Japanese computer voice.

---

## 2. Logic Chain

1. **Why real WAV collection → extracted JSON data (not committed WAVs) is essential**:
   - The user explicitly requires both *"データも集めて"* (collect real data) and *"コード100行の追加で、いったん作業をストップ"* (stop after +100 lines of code), while `kusanagi`'s core identity is a zero-recording pure-JS engine.
   - Committing 500+ MB of raw WAV files to git would bloat the repository and is unnecessary for a physical-model synth. Instead, downloading real cute-voice WAVs into scratch space (`<appDataDir>/scratch/teamwork_tmp/<conv-id>`), measuring their exact acoustic features with a reproducible script, and committing the resulting **structured acoustic reference data** under `data/` satisfies *"データも集めて"* with genuine empirical measurements while keeping the repo lightweight and keeping data files cleanly separated from `.mjs` code lines.
2. **Why JVNV (`F1`/`F2` happy) + Tsukuyomi-chan Vol.1 is the optimal dataset pair**:
   - **Tsukuyomi-chan Vol.1** is the gold-standard open Japanese *cute/anime* female voice corpus (100 phonetically balanced JVS sentences, clear cute timbre).
   - **JVNV `F1_happy` + `F2_happy`** adds 2 distinct professional Japanese female voice actresses in cheerful/bright emotional speech (~20–30 MB for 20 WAVs, downloadable in seconds) so the reference profile captures **generalizable cute-voice acoustics** rather than a single speaker's quirks.
   - Even if time/bandwidth favors starting fast, 20–30 JVNV happy WAVs (~30 MB) + Tsukuyomi-chan Vol.1 (516 MB, ~10–20s download) can both be processed in <1 minute using `python3` + `numpy` + `ffmpeg` (already installed, zero pip installs needed!).
3. **Why aligning extracted features directly to `hitofude.mjs`'s `hakaru()` + physical knobs maximizes data-matching fidelity within ≤100 code lines**:
   - `hitofude.mjs` already computes `band_1k_2k6_db`, `band_2k6_5k6_db`, `tani_core_db`, `tani_tail_db`, `crest_db`.
   - If we extract those **exact same metrics** PLUS `F0` distribution (`median`, `p10`, `p90`, `range_st`), `H1-H2` (open quotient / head-voice sweetness), `H1-A3` (spectral tilt), and per-vowel `F1–F3` (+ `F4/F5` upper resonance) from the real WAVs, we get an **apples-to-apples target vector** `T_kawaii`.
   - We can then numerically fit `kusanagi`'s parameters + bold physical-model additions (smile/cute vowel formant targets, head-voice glottal open-quotient/soft-closure shaping, expressive cute pitch/intonation contour, subtle sweet-voice breathy tail) directly against `T_kawaii` by minimizing weighted L1/L2 acoustic distance — making *"データに似せることだけを第一に"* quantitatively true, not guesswork.

---

## 3. Concrete Data-Collection & Data-Matching Plan

### Phase A: Data Collection & Acoustic Extraction (in Scratch Space → Commit to `data/`)
1. **Download real WAVs to scratch space** (`<appDataDir>/scratch/teamwork_tmp/<conv-id>/raw_wavs/`, deleted before handoff):
   - **Corpus 1 (Primary Cute Anime Voice)**: Download `https://tyc.rei-yumesaki.net/files/voice/tyc-corpus1.zip` (516.6 MB) and unzip 100 WAVs + `transcript_utf8.txt`.
   - **Corpus 2 (Multi-Speaker Happy Female Seiyuu)**: Download 10 `F1_happy_free_*.wav` + 10 `F2_happy_free_*.wav` + `transcription_no_nv.csv` from `https://huggingface.co/datasets/litagin/jvnv_corpus_v1_no_nv/resolve/main/...` (~33 MB total).
2. **Extract exact acoustic features** using a temporary Python script (`numpy` + `wave`/`ffmpeg`, resampled to 44.1 kHz mono to match `kusanagi`'s `SR = 44100` exactly):
   - **Pitch (F0)** via autocorrelation/YIN on 25 ms frames (150–650 Hz): `f0_median_hz`, `f0_p10_hz`, `f0_p90_hz`, `f0_range_st`, phrase-initial rise & phrase-final movement.
   - **Spectral balance (identical to `hakaru()`)**: 2048-pt Hann FFT over voiced frames → `band_1k_2k6_db`, `band_2k6_5k6_db`, plus `band_5k6_9k_db` (air/sparkle band).
   - **Harmonicity / Breathiness (identical to `hakaru().taniAt`)**: `tani_core_db` (vowel core H1–H6 peak-minus-valley), `tani_tail_db` (utterance-final voiced tail).
   - **Voice quality (Starr 2015)**: `H1-H2` (dB, open quotient / head-voice lightness), `H1-A3` (dB, spectral tilt), `crest_db`.
   - **Vocal tract / Formants**: LPC (order 12–16 at 16 kHz) / spectral peak clustering for `F1, F2, F3, F4, F5` medians & Japanese 5-vowel `/a, i, u, e, o/` formant targets (for Tsukuyomi-chan utterances using transcript alignment or vowel-cluster centroids).
   - **Speaking rate**: moras/sec from Japanese kana transcript length ÷ active speech duration.
3. **Commit extracted data under `data/`** (non-code data artifacts — does NOT count toward the 100-line JS code addition limit):
   - `data/kawaii_voice_ref.json` — Pooled + per-speaker (`tsukuyomi`, `jvnv_f1_happy`, `jvnv_f2_happy`) target acoustic summary + fitted `kusanagi` target vector + literature cross-check (Starr 2015; Super Kawaii Vocalics 2025).
   - `data/kawaii_utterances.jsonl` — Per-utterance measured acoustic rows (120 real utterances: 100 Tsukuyomi-chan + 20 JVNV happy).
   - `data/SOURCES.md` — Provenance, exact URLs, licenses (Tsukuyomi-chan Corpus / CC BY-SA 4.0), and extraction definitions.

### Phase B: Direct Data-Matching Additions to `kusanagi` (Strictly ≤100 Added Lines of Code)
Branch off `origin/kusanagi` (`b205f58`) onto a new branch (e.g., `kawaii-voice` or `kusanagi-kawaii`). Budget **~85–95 added lines** across `hitofude.mjs` + `yomu.mjs` (strictly ≤100 lines total added, leaving safety margin):

1. **`hitofude.mjs` (~75–85 added lines) — Bold Acoustic & Prosodic Modeling to Match `data/kawaii_voice_ref.json`**:
   - **Data-matched `kawaii` preset** in `PRESETS` (~8 lines): `hz`, `fscale`, `rate`, `g_vo`, `damp`, `tilt_w`, `sigh`, `jitter`, `wander_st`, `combG`, `rawAirMul`, `kawaii: 1.0` initialized directly from the fitted target vector.
   - **Cute/Smiling Non-Uniform Formant Targets (`VT_KAWAII` + F4/F5 sparkle + F0-linked brightening)** (~20 lines): Blend/override `KOTOBA_PRM.VT` when `kawaii > 0` to match the measured Japanese cute-voice `F1–F3` (higher F2/F3 lip-spread "smile" shift + softer/rounder F1) and tune `F4`/`F5` + pole Q/bandwidth (`bwMinP`, `qDivP`) to match the measured `band_1k_2k6_db` and `band_2k6_5k6_db`.
   - **Head-Voice / Sweet-Voice Glottal Door Shaping** (~20 lines): When `kawaii > 0`, reshape the asymmetric Bernoulli 2-lip door (`upGain`, `loGain`, `knee`, `closeMul`, `radK`, `rawAir`) to increase glottal open quotient (`H1-H2`↑) and smooth closing transients (`H1-A3`↑, eliminating harsh buzzy upper harmonics while preserving clean periodicity `tani_core_db` and soft breathy phrase tails `tani_tail_db` matching the collected data).
   - **Data-Fitted Cute Prosody (`ACCENT_KAWAII` + expressive phrase-end buoyancy)** (~20 lines): Dedicated prosody table (`reg`, `rng`, `jump`, `fall`, `sag`, `decl`, `fin`, `qrise`, `sm`) + subtle bouncy onset/tail pitch contour fitted directly to the measured F0 median, 10–90th percentile span, and phrase-final movement of the collected corpora.
2. **`yomu.mjs` (~10–15 added lines)**:
   - Support `--kawaii <0..1>` knob / default `kawaii` preset option and optional `--target-data data/kawaii_voice_ref.json` comparison readout alongside `--measure` so the exact delta vs. the collected real-voice dataset is printed on every synthesis run.
3. **Parameter Fitting Loop (Offline in Scratch Space)**:
   - Run a fast coordinate-descent / Nelder-Mead search script in scratch space calling `node yomu.mjs --preset kawaii --measure` (or importing `hitofude.mjs` directly in Node!) to numerically minimize the weighted acoustic distance to `data/kawaii_voice_ref.json` across `hz`, `fscale`, `g_vo`, `damp`, `tilt_w`, `sigh`, `combG`, `rawAirMul`, and the new `kawaii` physical coefficients, then bake the exact data-fitted values into `hitofude.mjs`.

---

## 4. Caveats
- **Data vs. Code Line Count**: `data/*.json`, `data/*.jsonl`, and `data/SOURCES.md` are data/documentation files, not code. All extraction/optimization scripts should be run from scratch space (and removed before finishing) so that `git diff --stat` on code files (`*.mjs`) is unambiguously ≤100 added lines.
- **Formant Estimation Accuracy on High-F0 Cute Voices**: At F0 = 300–400 Hz, harmonics are widely spaced, which makes automated LPC F1/F2 estimation noisier than on low-F0 male speech. Using median aggregation across 120 utterances + spectral-envelope cepstral smoothing + cross-checking against `hakaru()` band ratios (`band_1k_2k6_db`, `band_2k6_5k6_db`) and published Japanese female/child formant tables mitigates individual-frame LPC error.
- **Tsukuyomi-chan ZIP Size**: `tyc-corpus1.zip` is 516.6 MB; ensure scratch space has >1.5 GB free before unzipping, and delete it after extracting `data/kawaii_utterances.jsonl` and `data/kawaii_voice_ref.json`.
- **No Error/Edge-Case Verification Requested**: Per `ORIGINAL_REQUEST.md` ("あとエラーとか予期しない動作を検証しなくてよい"), focus 100% of effort on data collection and acoustic fidelity to the collected cute-voice data rather than defensive validation or edge-case testing.

---

## 5. Conclusion
A fully grounded, reproducible, zero-bloat data-first workflow is ready for immediate execution:
1. Branch from `origin/kusanagi` (`b205f58`).
2. Collect genuine Japanese cute-voice WAVs in scratch space from **Tsukuyomi-chan Corpus Vol.1** (100 utterances) and **JVNV `F1`/`F2` happy** (20 utterances), extract `hakaru()`-compatible + Starr (2015) acoustic features via `python3` + `numpy`, and commit the extracted reference dataset to `data/kawaii_voice_ref.json`, `data/kawaii_utterances.jsonl`, and `data/SOURCES.md`.
3. Add ≤100 lines of bold, data-fitted code to `hitofude.mjs` (+ minimal CLI glue in `yomu.mjs`) implementing cute/smiling formant shaping, head-voice glottal door shaping, expressive cute prosody, and a `kawaii` preset numerically fitted to minimize acoustic distance to `data/kawaii_voice_ref.json`.

---

## 6. Verification Method
- Verify remote `kusanagi` branch commit & files:
  `gh api repos/poidowl/tsukinami/git/trees/kusanagi?recursive=1 --jq '.tree[].path'`
- Verify live dataset URLs are reachable:
  `curl -sIL https://tyc.rei-yumesaki.net/files/voice/tyc-corpus1.zip | head -n 5`
  `curl -sIL https://huggingface.co/datasets/litagin/jvnv_corpus_v1_no_nv/resolve/main/F1/F1_happy_free_01.wav | head -n 5`
- After implementation, verify code addition budget (`<= 100` added lines in `*.mjs`):
  `git diff --numstat origin/kusanagi -- '*.mjs'`
- Verify data-matching closeness by comparing `node yomu.mjs --preset kawaii --measure` output against `data/kawaii_voice_ref.json` target medians.
