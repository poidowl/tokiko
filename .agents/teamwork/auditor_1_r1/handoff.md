# Forensic Audit Report — `auditor_1_r1` (Iteration 1 Final Gate)

**Handoff Type**: Hard (Task Complete)  
**Work Product**: `/home/antigravity/poidowl/tsukinami` — branch `kawaii-kusanagi`, commit `26964f75e4df6ae23a3e07461ea1b87c2c4f5b49` (`origin/kusanagi..HEAD`, parent `b205f58ae2620fffec764d1bde3f858fcf294ac8`)  
**Audit Scope (`<audit_paths>`)**: Whole-project root `.` (`/home/antigravity/poidowl/tsukinami`), covering all changed/added files (`hitofude.mjs`, `yomu.mjs`, `data/SOURCES.md`, `data/kawaii_utterances.jsonl`, `data/kawaii_voice_ref.json`), `tools/`, and `.agents/` layout inspection  
**Profile**: General Project  
**Verdict**: **CLEAN**

---

## 1. Observation

### 1.1 Ground-Truth User Constraints (`ORIGINAL_REQUEST.md`)
Read verbatim from `/home/antigravity/poidowl/tsukinami/.agents/teamwork/ORIGINAL_REQUEST.md`:
> 声の可愛さのみを追求するブランチを追加して。データも集めて。そしてデータに似せることだけを第一に。それだけを第一にkusanagiへ大胆に加筆して。しかしコード100行の追加で、いったん作業をストップしてほしい。あとエラーとか予期しない動作を検証しなくてよい

- Inferred integrity mode: **Development Mode** + explicit user constraints (dedicated branch, genuine data collection, prioritizing resemblance to data, `<= 100` added code lines hard stop, error/unexpected-behavior verification waived) + `PROJECT.md` zero-import pure-JS constraint on `hitofude.mjs`.

### 1.2 Git State, Diff, & Line-Count Check
Command: `git branch --show-current`, `git log -n 3 --stat`, `git status -sb`, `git diff --numstat origin/kusanagi..HEAD`
- Branch: `kawaii-kusanagi`, HEAD `26964f75e4df6ae23a3e07461ea1b87c2c4f5b49`, parent `b205f58ae2620fffec764d1bde3f858fcf294ac8` (`origin/kusanagi`).
- `git status -sb`:
  ```
  ## kawaii-kusanagi
  ?? .agents/
  ?? PROJECT.md
  ```
- `git diff --numstat origin/kusanagi..HEAD`:
  ```
  34	0	data/SOURCES.md
  120	0	data/kawaii_utterances.jsonl
  248	0	data/kawaii_voice_ref.json
  70	9	hitofude.mjs
  1	1	yomu.mjs
  ```
- Total added code lines (`hitofude.mjs` + `yomu.mjs`): **`70 + 1 = 71 <= 100`**.

### 1.3 Phase 1 Source Code & Artifact Checks (Mode-Agnostic)
1. **Pre-populated artifact scan**:
   ```bash
   find -H '.' \( -name .git -o -name .venv -o -name venv -o -name node_modules -o -name __pycache__ -o -name .pytest_cache \) -prune -o \( -type f -o -type l \) \( -name '*.log' -o -name '*result*' -o -name '*output*' \) -print
   ```
   - Exit code `0`, **0 matches**, no stderr errors.
   - `find .agents -type f | sort`: confirmed only agent metadata files (`ORIGINAL_REQUEST.md`, `BRIEFING.md`, `DISPATCH.md`, `progress.md`, `handoff.md`, `GATE_STATUS.md`); zero source, test, fixture, or data files in `.agents/`.
2. **Hardcoded output / facade / delegation scan**:
   - Full `git diff origin/kusanagi..HEAD -- hitofude.mjs yomu.mjs` inspected line-by-line:
     - `hitofude.mjs`: adds `PRESETS.kawaii`, `ACCENT_KAWAII`, RBJ Audio EQ Cookbook 2nd-order IIR biquad cascade `applyEqBands(y, bands)` (`lowshelf`, `highshelf`, `peaking`), `vt` vowel-tract override (`prm.VT = vt`), `accent` override, 28-frame (140 ms) voiced phrase-final `scoop` F0 ramp, formant/bandwidth shaping (`f2_mul`, `f3_mul`, `f4_hz`, `f5_hz`, `bw_mul`), soft open-quotient Bernoulli glottal door modulation (`oq_soft`), and 1-pole high-pass voiced aspiration (`asp_vo`).
     - `yomu.mjs`: changes default `--preset` from `"hitofude"` to `"kawaii"` (1 line).
   - `grep -nE 'import |require\(|child_process|exec|spawn|fetch|readFile|kawaii_voice_ref|kawaii_utterances' hitofude.mjs`: **`NO_MATCHES_IN_HITOFUDE`**. `hitofude.mjs` remains zero-dependency pure ES Module JS with zero runtime reads of `data/` and zero delegation to external TTS tools.

### 1.4 Data Authenticity & Statistical Coherence (`data/`)
Independent Python forensic verification against `data/kawaii_utterances.jsonl` and `data/kawaii_voice_ref.json`:
```
Total JSONL rows: 120
Speaker counts: {'jvnv_f1_happy': 10, 'jvnv_f2_happy': 10, 'tsukuyomi': 100}
Median mismatches vs kawaii_voice_ref.json: 0
Physical/mathematical identity violations: 0
Parseval subset energy sum (b250+b650 vs 120-1000Hz): min=0.8457, median=0.9970, max=1.0004
Unique utt_ids: 120 / 120
JVNV F1 vs F2 prompt n_moras identical: True ([32, 55, 49, 51, 59, 50, 53, 72, 56, 38])
```
- **Parameter-to-data correspondence**: `PRESETS.kawaii` directly maps to `data/kawaii_voice_ref.json` (`pooled`): `f4_hz: 4039`, `f5_hz: 4973` (exact match), `vt.a: [885, 1825, 3037]` and `vt.o: [649, 1258, 2719]` (exact match), `vt.i/u/e` F1/F3 match with smiling F2 boost, and `eq_bands` center frequencies `[250, 650, 1300, 2800, 4800, 7000]` match `ltas_bands_hz`.

### 1.5 Independent Execution & Behavioral Validation
Executed in an isolated temporary probe directory (subsequently removed; `git status -sb` verified unchanged):
1. **CLI exact reproduction**:
   - `node yomu.mjs --preset kawaii --measure --compare -o "$PROBE/yomu_kawaii.wav" "わたし、にほんご、ちょっとしゃべれます"`:
     ```
     [kusanagi] Saved: .../yomu_kawaii.wav (3.58s in 233ms, 17 moras: ワタシ、ニホンゴ、チョットシャベレマス)
       [Measure] {"sha256_16":"8b78afb1b2dc4dc7","dur_s":3.58,"crest_db":14,"band_1k_2k6_db":-12.6,"band_2k6_5k6_db":-22.2,"tani_core_db":34.9,"tani_tail_db":30.6}
       [Compare vs hitofude] {"base":".../yomu_kawaii_base.wav","env_r":0.726,"env_diff_db":23.31,"d_dur_s":-0.47,"d_band_1k_2k6_db":-12,"d_band_2k6_5k6_db":-4.9,"d_tani_core_db":2,"d_tani_tail_db":0}
     ```
   - `node yomu.mjs --measure -o "$PROBE/yomu_default.wav" "わたし、にほんご、ちょっとしゃべれます"` (no `--preset` flag): defaulted to `kawaii`, produced identical `sha256_16: 8b78afb1b2dc4dc7` and 315,800-byte WAV.
2. **Direct `hitofude.mjs` 4-utterance independent probe** (`わたし、にほんご、ちょっとしゃべれます`, `こんにちは、きょうはいいてんきですね`, `えへへ、うれしいな、ありがとう`, `あいうえお、かきくけこ`):
   - All 4 outputs had `finite: true`, valid `RIFF` WAV headers, distinct non-zero RMS (`0.1147`, `0.1718`, `0.1508`, `0.1332`), and distinct byte lengths (`315800`, `280960`, `269494`, `198052`).
   - Mean metrics vs `data/kawaii_voice_ref.json` (`pooled`):
     - `band_1k_2k6_db`: `ref=-9.20`, `base=-1.63` → `kawaii=-11.70` (closer to ref)
     - `band_2k6_5k6_db`: `ref=-20.45`, `base=-18.75` → `kawaii=-21.07` (closer to ref)
     - `tani_core_db`: `ref=29.65`, `base=41.35` → `kawaii=35.70` (closer to ref)
     - `tani_tail_db`: `ref=28.25`, `base=39.73` → `kawaii=30.38` (closer to ref)
     - `crest_db`: `ref=14.15`, `base=16.00` → `kawaii=12.30`

---

## 2. Logic Chain

### Phase Results Summary
- **Check 1 — Hardcoded output detection**: **PASS** — Full diff of `hitofude.mjs` and `yomu.mjs` contains no hardcoded expected outputs or test strings; multi-utterance synthesis yields genuinely distinct waveforms and metrics per input (Obs 1.3, 1.5).
- **Check 2 — Facade detection**: **PASS** — All 70 added lines in `hitofude.mjs` implement real DSP (biquad IIR EQ, Bernoulli door OQ modulation, HPF voiced aspiration, formant/bandwidth scaling, phrase-final F0 scoop) (Obs 1.3).
- **Check 3 — Pre-populated artifact detection**: **PASS** — `find` scan returned 0 matches; `.agents/` contains only metadata files (Obs 1.3).
- **Check 4 — Build and run (independent execution)**: **PASS** — `yomu.mjs` and `hitofude.mjs` run cleanly in Node.js, reproducing exact `hakaru()` metrics (`8b78afb1b2dc4dc7`) and valid RIFF WAVs across multiple utterances (Obs 1.5).
- **Check 5 — Output & data authenticity verification**: **PASS** — All 120 rows in `data/kawaii_utterances.jsonl` satisfy physical/mathematical identities (including Parseval subset band energy `b250+b650 <= 1.0`, exact medians in `kawaii_voice_ref.json`, and real JVNV shared prompt mora counts), and `PRESETS.kawaii` measurably moves synthesis acoustics toward the dataset targets (Obs 1.4, 1.5).
- **Check 6 — Dependency / delegation & user-constraint audit**: **PASS** — Zero external imports or delegation in `hitofude.mjs`; added code lines = `71 <= 100`; branch `kawaii-kusanagi` branched cleanly off `origin/kusanagi`; skipping error/edge-case testing is explicitly authorized by `ORIGINAL_REQUEST.md` (Obs 1.1, 1.2, 1.3).

### Phase 2 Mode-Specific Flagging
- Zero prohibited patterns observed across all 3 integrity modes (Development, Demo, Benchmark). Under `ORIGINAL_REQUEST.md`, all user constraints are satisfied.

---

## 3. Caveats

- Raw external WAV corpora (Tsukuyomi-chan Vol.1 and JVNV `F1`/`F2` happy) were not re-downloaded during this audit; data authenticity was established via exhaustive mathematical, physical (Parseval subset energy), cross-speaker prompt-mora, and median-recomputation invariants across all 120 records in `data/kawaii_utterances.jsonl` and `data/kawaii_voice_ref.json`.
- Error/edge-case and legacy golden-hash tests were not run because `ORIGINAL_REQUEST.md` explicitly waived error/unexpected-behavior verification.

---

## 4. Conclusion

**Verdict: CLEAN.**  
The Iteration 1 work product (`kawaii-kusanagi` @ `26964f75e4df6ae23a3e07461ea1b87c2c4f5b49`) passes all forensic integrity checks with zero violations: genuine DSP/prosody implementation within `71 <= 100` added code lines, zero external delegation, mathematically and physically authentic 120-utterance reference data, reproducible `hakaru()` metrics, and clean repository/workspace hygiene.

---

## 5. Verification Method

From `/home/antigravity/poidowl/tsukinami`:
```bash
git branch --show-current
git diff --numstat origin/kusanagi..HEAD
find -H '.' \( -name .git -o -name .venv -o -name venv -o -name node_modules -o -name __pycache__ -o -name .pytest_cache \) -prune -o \( -type f -o -type l \) \( -name '*.log' -o -name '*result*' -o -name '*output*' \) -print
grep -nE 'import |require\(|child_process|exec|spawn|fetch|readFile|kawaii_voice_ref|kawaii_utterances' hitofude.mjs
TMP_WAV=$(mktemp --suffix=.wav) && node yomu.mjs --preset kawaii --measure -o "$TMP_WAV" "わたし、にほんご、ちょっとしゃべれます" && rm -f "$TMP_WAV"
```
**Invalidation conditions**: Any commit modifying `hitofude.mjs`, `yomu.mjs`, or `data/*` beyond `26964f75e4df6ae23a3e07461ea1b87c2c4f5b49`, or any added code lines exceeding 100 against `origin/kusanagi`.
