# Step 0 Survey Handoff — `explorer_survey_1`

**Summary:** The actual `kusanagi` pure-JS synthesizer (`hitofude.mjs`, 1,355 lines; `yomu.mjs`, 245 lines) lives on the remote **`kusanagi`** branch (`b205f58`, v11.0), NOT on `main` (which holds the Python `tsukinami` engine and static HTML demos). Local `.git/config` is configured with a single-branch refspec for `main` only, so the implementer must fetch `origin/kusanagi` first and branch **`kawaii-kusanagi`** from `origin/kusanagi`; the full task (branch creation + cute-voice data collection + bold data-matching edits to `hitofude.mjs` capped strictly at ≤ 100 added lines of code) fits cleanly in a single implementation cycle.

---

## 1. Observation

### 1.1 Original Request
From `/home/antigravity/poidowl/tsukinami/.agents/teamwork/ORIGINAL_REQUEST.md:4`:
> 声の可愛さのみを追求するブランチを追加して。データも集めて。そしてデータに似せることだけを第一に。それだけを第一にkusanagiへ大胆に加筆して。しかしコード100行の追加で、いったん作業をストップしてほしい。あとエラーとか予期しない動作を検証しなくてよい

Key constraints extracted verbatim:
1. Add a branch dedicated solely to pursuing cuteness of voice.
2. Collect data too.
3. Make resembling the collected data the sole #1 priority.
4. Boldly add to `kusanagi` with that as the sole priority.
5. **Hard stop at 100 added lines of code.**
6. **Do NOT verify errors or unexpected behavior.**

### 1.2 Local Repository & Git State (`/home/antigravity/poidowl/tsukinami`)
- `git status -sb`:
  - `## main...origin/main [ahead 43]`
  - `?? .agents/`
  - Working tree is otherwise clean.
- `git show-ref`:
  - `5025d29816dc7d46365638aaf18578c443b724b4 refs/heads/main`
  - `4f39d0b4ea44f95cbe95156abb738b1dd174b4fc refs/remotes/origin/main` (stale tracking ref; remote `refs/heads/main` is also at `5025d29816dc7d46365638aaf18578c443b724b4`).
- `.git/config`:
  ```ini
  [remote "origin"]
      url = https://github.com/poidowl/tsukinami.git
      fetch = +refs/heads/main:refs/remotes/origin/main
  ```
  Local clone only fetches `main`; `kusanagi` is not yet fetched locally.
- `git ls-remote --heads origin` (18 remote branches, all lowercase kebab-case):
  - `b205f58ae2620fffec764d1bde3f858fcf294ac8 refs/heads/kusanagi` (v11.0)
  - `5025d29816dc7d46365638aaf18578c443b724b4 refs/heads/main`
  - Sibling `kusanagi`-derived branches: `idol-koe-master` (branched directly off `b205f58`), `itako-kusanagi`, `kiku-kusanagi`, `kusanagi-choir-v101`, `pause-breath`, `sarasara`.
  - Other branches: `asr-playground`, `hibiki`, `hitofude`, `hodoki`, `itako-kafka-asr`, `kiku-ear`, `kiku-ear-obake-loop`, `kiku-ear-r3`, `kiku-ear-r4`, `readme-top`.

### 1.3 Environment Tooling
Verified via `which` / version checks:
- `node`: `/usr/local/bin/node` (`v24.22.3`)
- `python3`: `/usr/bin/python3` (`Python 3.11.2`)
- `ffmpeg`: `/usr/bin/ffmpeg`
- `gh`: `/opt/antigravity/bin/gh`
- `curl`: `/usr/bin/curl`, `jq`: `/usr/bin/jq`

### 1.4 `main` vs `kusanagi` Branch Layout
- **`main` branch** (`5025d29`):
  - Python `tsukinami` TTS (`carve.py`, `kotoba.py`, `accent.py`, `yomu.py`, `mcp_server.py`, `uta_hakaru.py`, etc.) + GitHub Pages HTML demos (`kusanagi.html`, `kusanagi_player.html`, `kusanagi_choir.html`, `kusanagi_choir_player.html`, `kusanagi_shiin.html`, `kusanagi_shiin_player.html`, `toybox.html`, `index.html`, etc.) + `assets/` (3 images). No `.gitignore` on `main`.
  - `README.md:17-25` explicitly states:
    > `git clone -b kusanagi --single-branch https://github.com/poidowl/tsukinami.git`
    > `node yomu.mjs --preset toiki "わたし、にほんご、ちょっとしゃべれます"`
    > **草薙（枝 `kusanagi`）** — 純JavaScript 約72KB。
- **`kusanagi` branch** (`b205f58`, inspected via `gh api`):
  - `.gitignore` (29 B):
    ```
    out/
    node_modules/
    .DS_Store
    ```
  - `LICENSE` (1,064 B)
  - `README.md` (9,733 B): architecture, parameter table, CLI usage, LLM modification notes.
  - `hitofude.mjs` (61,616 B, **1,355 lines**): pure ES module with **zero imports** (works in Node 18+ and browsers).
    - `L11–14`: `SR = 44100`, `FP = 5.0`, `KNOB_KEYS`
    - `L16–61`: `PRESETS` (`hitofude`, `toiki`, `alto`, `sasayaki`, `chibi`, `ossan`, `robot`)
    - `L64–73`: `makeRng` (Mulberry32)
    - `L78–128`: `K2V`, `PLACE`, `MANNER`, `KOTOBA_PRM` (`VT` vowel formants at `L110`, `LE` locus eq at `L111`, `CDUR` at `L118`, `VDUR` at `L119`, `VL` at `L120`, `CL` at `L121–125`)
    - `L251–545`: `tracksFromKana(text, pre, post, params)` (kana → 5ms formant/gain/loudness/consonant tracks)
    - `L554–555`: `ACCENT_NORMAL` & `ACCENT_CUTE` (`reg: 410.0, rng: 10.0, jump: 5.6, fall: 6.0, ...`)
    - `L648–746`: `f0Rule(moras, n, opts)`
    - `L896–1223`: `makeHitofude(text, opts = {})` — single causal loop:
      - `L897–920`: destructured options (`seed`, `hz`, `fscale`, `rate`, `g_vo`, `tilt_w`, `sigh`, `jitter`, `wander_st`, `damp`, `shin`, `level_k`, `combG`, `rawAirMul`, `pau_s`, `pau_iki`, etc.)
      - `L976–977`: accent selection (`ACCENT_NORMAL` vs `ACCENT_CUTE`)
      - `L981–1008`: phrase-final breath/sigh trajectory (`sigh_fr`)
      - `L1011–1018`: F1–F4 formant scaling (`r.F1[t] * fs`, `F4 = F3 + 1150 * fs`)
      - `L1060–1124`: **Single causal loop** — asymmetric Bernoulli 2-lip mucosal door (`bern`, `loGain`, `upGain`, `knee`, `closeMul`, `closedDecay`, `rawAir`, `combGx`) × 5-pole vocal tract (`F1..F5`, `bwMinP`, `qDivP`, `dMulP`)
      - `L1127`: lip radiation differentiation `ycRad[i] = yc[i] - radK * yc[i - 1]`
      - `L1133–1143`: consonant/H-row 2-pole zero-DC bandpass `bpc` mixed with `vScale * G1S[i] * ycRad[i]`
      - `L1147–1205`: single-scalar leveling `level_k`, envelope `env`, pause breath floor `pau_iki`, peak normalization
    - `L1228–1245`: `encodeWav(samples, sampleRate)`
    - `L1287–1355`: `hakaru(samples, rInfo)` (built-in FFT acoustic metrics)
  - `yomu.mjs` (10,269 B, **245 lines**): Node stdlib-only CLI driver.
    - `L23–30`: `synth(text, prm, utaHz)` passes `...prm` directly into `makeHitofude`, so any new preset or option added in `hitofude.mjs` is automatically honored by `yomu.mjs` without editing `yomu.mjs`.
  - `tools/build_x_player.mjs` (44,131 B): builds `kusanagi.html` / `kusanagi_player.html`.
  - `tools/test_pause.mjs` (7,887 B), `tools/test_sarasara.mjs` (4,919 B): golden-hash regression tests.

### 1.5 Voice / Data / Model Directories & Conventions
- Neither `main` nor `kusanagi` has any `data/`, `audio/`, `voices/`, or `models/` directory.
- On `kusanagi`, `.gitignore` only ignores `out/`, `node_modules/`, `.DS_Store`.
- Sibling branches store experiment data as JSON in root or `tools/` (e.g., `kiku-kusanagi` has `mimi_table.json` and `tools/kiku_corpus_itako.json`; `itako-kusanagi` has `tools/itako_items_run3.json`).
- Commit conventions on `kusanagi`: `feat(kusanagi): ...`, `fix(kusanagi): ...`, `docs(kusanagi): ...`, `refactor(kusanagi): ...`.

---

## 2. Logic Chain

1. **Where `kusanagi` lives**: Observation 1.4 proves `main` only has pre-built HTML demo cards synced from `kusanagi`, whereas the canonical `kusanagi` source (`hitofude.mjs`, `yomu.mjs`) is on `origin/kusanagi` (`b205f58`), and all sibling `kusanagi` experiments (`idol-koe-master`, `itako-kusanagi`, `kiku-kusanagi`) branch directly from `kusanagi`. Therefore, the new branch MUST be created from `origin/kusanagi`, after fetching it (since `.git/config` currently only fetches `main`, Observation 1.2).
2. **Branch naming**: All 18 remote branches use lowercase kebab-case, and `kusanagi`-derived experiment branches use `<topic>-kusanagi` (e.g., `itako-kusanagi`, `kiku-kusanagi`). Thus **`kawaii-kusanagi`** matches existing repo conventions unambiguously.
3. **Single-cycle feasibility under the 100-added-line hard stop**:
   - `hitofude.mjs` is a single 1,355-line file with all DSP, formants, prosody, and presets cleanly exposed (`PRESETS` L16–61, `KOTOBA_PRM` L107–128, `ACCENT_CUTE` L555, `makeHitofude` L896–1223), and `yomu.mjs` already forwards `...prm` (`yomu.mjs:24–29`).
   - Because the user explicitly asks to (a) stop at **100 added lines of code** and (b) **skip verifying errors/unexpected behavior**, we do not need multi-milestone refactoring, HTML player rebuilds, or regression test maintenance.
   - Therefore, **1 implementation cycle** (Step 1: fetch `origin/kusanagi` & checkout `kawaii-kusanagi`; Step 2: collect cute-voice reference audio data & extract acoustic target profile using Python/ffmpeg in scratch space, saving the collected data + extracted target JSON in `data/`; Step 3: boldly add ≤ 100 lines of code in `hitofude.mjs` to match the collected data's F0/prosody, F1–F5 formants/bandwidths, mucosal-door breathy-sweet source spectrum, and vocal-tract timbre; Step 4: verify `git diff --numstat` added code lines ≤ 100 and generate sample WAVs) covers the entire request cleanly.

---

## 3. Caveats

- **Network/dataset availability not yet tested**: We did not download any external voice dataset during this read-only survey. The data collection step should verify reachable open/public Japanese cute-voice sources (e.g., HuggingFace / GitHub public Japanese cute female speech samples such as JVNV, JVS, Tsukuyomi-chan, VOICEVOX sample WAVs, or CC0 cute voice clips) and document exact URLs/licenses in `data/`.
- **100-line counting scope**: "コード100行の追加" (100 added lines of code) should be tracked strictly on committed code files (`*.mjs`, `*.js`, `*.py`, `*.sh`) via `git diff origin/kusanagi --numstat` so total added lines of code stay `<= 100` (keep any data-analysis helper script in scratch space rather than committing it, or include it inside the 100-line budget if committed; JSON/data files in `data/` are collected data, not code).
- **Regression tests intentionally out of scope**: `tools/test_pause.mjs` and `tools/test_sarasara.mjs` assert byte-identical golden hashes for v10.8/v11.0 defaults. Bold edits to `hitofude.mjs` for data-first cuteness will naturally diverge from those golden hashes, which aligns with the user's explicit instruction ("それだけを第一にkusanagiへ大胆に加筆して ... あとエラーとか予期しない動作を検証しなくてよい").

---

## 4. Conclusion & Implementation Strategy

### Feature Inventory (Single Implementation Cycle)
1. **Git Branch Setup**: Fetch `origin/kusanagi` (`b205f58`) and create branch **`kawaii-kusanagi`** from `origin/kusanagi`.
2. **Cute-Voice Data Collection (`data/`)**: Download/collect a small, representative set of real Japanese cute female voice recordings (and/or publicly licensed cute-voice WAV clips) into `data/raw/` (or `data/samples/`), extract quantitative acoustic targets (F0 median/IQR/min/max/pitch-slope, F1–F5 vowel formant centroids & bandwidths, H1–H2 / spectral tilt / high-band air energy, shimmer/jitter, speaking rate/mora durations) into `data/cute_targets.json` + `data/manifest.json` (with source URLs and licenses).
3. **Bold Data-First Additions to `hitofude.mjs` (Hard Cap: ≤ 100 Added Code Lines)**:
   - **Preset & Mode (`hitofude.mjs:16–61`)** (~10 lines): Add `kawaii` preset (and/or tune default) parameterized directly from `data/cute_targets.json` (`hz`, `fscale`, `g_vo`, `damp`, `tilt_w`, `sigh`, `rate`, `combG`, `rawAirMul`, plus new cute-voice-specific DSP knobs).
   - **Data-Matched Formant & Vocal Tract Shaping (`hitofude.mjs:107–128, 1011–1018, 1067–1080`)** (~30 lines): Add cute-voice vowel formant overrides (`VT` higher F1/F2/F3/F4 clustering matching young/cute short vocal tract), narrower/brighter F2–F4 Q or cute formant warp, and sweeter lip-radiation / nasal-smile resonance (e.g., subtle F3/F4 singer/idol sparkle + warm F1 cushion).
   - **Data-Matched Glottal Source & Breathy-Sweet Mucosal Door (`hitofude.mjs:1071–1124`)** (~30 lines): Adjust asymmetric Bernoulli door open-quotient / soft-closure (`knee`, `upGain`, `loGain`, `bern`, `closeMul`), airy-sweet H1–H2 dominance / soft glottal breath mix, and subtle voice-sweetening spectral tilt matching the collected data's measured spectrum.
   - **Data-Matched Cute Prosody & Pitch Contour (`hitofude.mjs:554–555, 975–1008`)** (~20–25 lines): Tune `ACCENT_CUTE` and phrase-level pitch contour (brighter phrase-initial rise, bouncy mora-level pitch inflection, soft rising/cute phrase-final tail instead of flat drop, matched to the collected data's F0 stats).
   - Keep `yomu.mjs` untouched (0 added lines) since `yomu.mjs:23–30` already forwards `...prm`.
   - Total added code lines: **~85–100 lines** (strictly `<= 100`), then **STOP** immediately as requested.

---

## 5. Verification Method

To independently verify every observation in this report:
1. Local git state & remote branches:
   ```bash
   cd /home/antigravity/poidowl/tsukinami
   git status -sb
   cat .git/config
   git ls-remote --heads origin
   ```
2. `kusanagi` branch tree and `hitofude.mjs` / `yomu.mjs` line counts:
   ```bash
   gh api "repos/poidowl/tsukinami/git/trees/kusanagi?recursive=1" --jq '.tree[] | "\(.type)\t\(.size // 0)\t\(.path)"'
   gh api "repos/poidowl/tsukinami/contents/hitofude.mjs?ref=kusanagi" --jq .content | base64 -d | wc -l
   ```
3. Post-implementation line-count check (for the implementer to verify the 100-line stop rule):
   ```bash
   git diff origin/kusanagi --numstat -- '*.mjs' '*.js' '*.py' '*.sh'
   ```
   Invalidation condition: if `origin/kusanagi` advances past `b205f58ae2620fffec764d1bde3f858fcf294ac8`, re-check `hitofude.mjs` line numbers before editing.
