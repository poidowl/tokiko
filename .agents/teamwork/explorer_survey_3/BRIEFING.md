# BRIEFING — 2026-11-21T23:01:00Z

## Mission
Survey `/home/antigravity/poidowl/tsukinami` for existing voice data/formats and environment tools/resources, and design a concrete data collection + data-matching plan for "声の可愛さ" (cute voice) for `kusanagi`.

## 🔒 My Identity
- Archetype: Explorer (Voice Data & Reference Explorer)
- Roles: explorer_survey_3 (Step 0 Survey)
- Working directory: /home/antigravity/poidowl/tsukinami
- State folder: /home/antigravity/poidowl/tsukinami/.agents/teamwork/explorer_survey_3
- Original parent: ad21f6bd4a586a7bb9224cb69d82fa20
- Milestone: Step 0 Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify repository files or download large files into the repo
- Write `progress.md` and `handoff.md` ONLY in `/home/antigravity/poidowl/tsukinami/.agents/teamwork/explorer_survey_3/`
- Must read `ORIGINAL_REQUEST.md` verbatim first

## Current Parent
- Conversation ID: ad21f6bd4a586a7bb9224cb69d82fa20
- Updated: 2026-11-21T23:01:00Z

## Investigation State
- **Explored paths**:
  - `/home/antigravity/poidowl/tsukinami/` (`main`: `kusanagi.html`, `README_EN.md`, `featF.py`, `tani.py`, `tehon.sh`, `OO.txt`, `S.txt`, `assets/`)
  - Remote branches via `gh api`: `kusanagi` (`b205f58`: `hitofude.mjs`, `yomu.mjs`, `README.md`, `.gitignore`), `idol-koe-master`, `kiku-kusanagi`
  - Environment runtimes/packages & live HuggingFace/web endpoints
- **Key findings**:
  - Repo has NO bundled WAV datasets or cute-voice acoustic reference data on `main` or `kusanagi`.
  - `kusanagi` (`hitofude.mjs`) is a 1,355-line pure-JS physical model with built-in FFT acoustic measurement `hakaru()` (`dur_s`, `crest_db`, `band_1k_2k6_db`, `band_2k6_5k6_db`, `tani_core_db`, `tani_tail_db`), vowel formant table `KOTOBA_PRM.VT`, `ACCENT_CUTE`, and asymmetric Bernoulli 2-lip door + 5-pole vocal tract.
  - Verified live open-license Japanese cute-voice WAV sources: (1) Tsukuyomi-chan Corpus Vol.1 (`https://tyc.rei-yumesaki.net/files/voice/tyc-corpus1.zip`, 516.6 MB, HTTP 200), (2) JVNV Corpus `litagin/jvnv_corpus_v1_no_nv` `F1_happy_*` & `F2_happy_*` WAVs (CC BY-SA 4.0, ~1.3–1.8 MB/file, HTTP 200), plus literature anchors (Starr 2015 "Sweet Voice"; Super Kawaii Vocalics 2025).
  - Environment has `python3` 3.11.2 + `numpy`, `node` v24.22.3, `ffmpeg`, `curl`, `gh`, `jq`, `pip3`/`uv`, and full internet access.
- **Unexplored areas**: None blocking Step 0; actual downloading and acoustic extraction belong to the implementation step.

## Key Decisions Made
- Recommend collecting real WAVs in scratch space (deleting raw WAVs before commit), committing extracted structured JSON/JSONL acoustic reference data under `data/` (zero code-line count, zero binary bloat), and optimizing/modifying `kusanagi` (`hitofude.mjs` + `yomu.mjs`, strictly ≤100 added code lines) to directly minimize acoustic distance to the collected dataset.

## Artifact Index
- `/home/antigravity/poidowl/tsukinami/.agents/teamwork/explorer_survey_3/DISPATCH.md` — dispatch log
- `/home/antigravity/poidowl/tsukinami/.agents/teamwork/explorer_survey_3/BRIEFING.md` — working memory
- `/home/antigravity/poidowl/tsukinami/.agents/teamwork/explorer_survey_3/progress.md` — liveness/progress
- `/home/antigravity/poidowl/tsukinami/.agents/teamwork/explorer_survey_3/handoff.md` — final Step 0 Survey report
