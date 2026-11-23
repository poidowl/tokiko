# BRIEFING — 2026-11-21T23:00:00Z

## Mission
Deeply inspect `kusanagi` in `/home/antigravity/poidowl/tsukinami` and design a concrete, bold, <=100-added-line implementation strategy for matching collected reference "cute voice" data above all else.

## 🔒 My Identity
- Archetype: explorer
- Roles: Kusanagi Architecture Explorer (read-only)
- Working directory: `/home/antigravity/poidowl/tsukinami`
- State folder: `/home/antigravity/poidowl/tsukinami/.agents/teamwork/explorer_survey_2`
- Original parent: `ad21f6bd4a586a7bb9224cb69d82fa20`
- Milestone: Step 0 Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT modify source code
- Write `progress.md` and `handoff.md` ONLY in `/home/antigravity/poidowl/tsukinami/.agents/teamwork/explorer_survey_2/`
- Strategy must strictly respect the user's 100 added lines of code stop condition (measured cleanly e.g. `git diff --numstat`)
- User priority: pursue "声の可愛さ" (voice cuteness) ONLY, by matching/resembling collected reference voice data above all else; user explicitly noted no need to verify errors/unexpected behavior

## Current Parent
- Conversation ID: `ad21f6bd4a586a7bb9224cb69d82fa20`
- Updated: not yet

## Investigation State
- **Explored paths**: `ORIGINAL_REQUEST.md`, `README.md` (main & kusanagi), `kusanagi.html`, `kusanagi_player.html`, `origin/kusanagi@b205f58`: `hitofude.mjs` (full 1,355 lines), `yomu.mjs` (full 245 lines), remote git branches (`git ls-remote`).
- **Key findings**:
  - `kusanagi` lives on `origin/kusanagi` (`b205f58`), pure ES Module JS (`hitofude.mjs` + `yomu.mjs`), NOT on `main`.
  - `tracksFromKana` (`hitofude.mjs:252`) already accepts custom `VT`/params, and `yomu.mjs:24` already forwards `...prm`.
  - Key bottlenecks for cute-voice data matching: `hiMix` saturates at 210Hz locking abrupt Bernoulli closure, uniform `fscale` couples F1–F5, `sigh>=0.25` disables `ACCENT_CUTE` (`:976`), and no post-tract LTAS spectral-envelope matching exists.
  - Designed ~89-line (<=100-line) bold upgrade: `PRESETS.kawaii` + `ACCENT_KAWAII`, decoupled `VT`/F2–F5/`bw_mul`, soft-OQ glottal door + HP voiced aspiration (`asp_vo`), and causal biquad LTAS-matching EQ bank (`applyEqBands`).
- **Unexplored areas**: None within Step 0 Kusanagi architecture scope.

## Key Decisions Made
- Recommended branching off `origin/kusanagi` (`b205f58`) and investing ~89 added lines in `hitofude.mjs` (+ optional 1 line in `yomu.mjs`) to stay strictly <= 100 added lines via `git diff --numstat`.

## Artifact Index
- `/home/antigravity/poidowl/tsukinami/.agents/teamwork/explorer_survey_2/DISPATCH.md` — dispatch log
- `/home/antigravity/poidowl/tsukinami/.agents/teamwork/explorer_survey_2/progress.md` — liveness heartbeat
- `/home/antigravity/poidowl/tsukinami/.agents/teamwork/explorer_survey_2/handoff.md` — final 5-component report
