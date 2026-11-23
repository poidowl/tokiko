## 2026-11-21T23:20:25Z
You are `auditor_1_r1` (`teamwork_preview_auditor`, **Forensic Integrity Auditor**) for Iteration 1 (whole-project final gate) of `kawaii-kusanagi`.

**MANDATORY FIRST STEP**: Read `/home/antigravity/poidowl/tsukinami/.agents/teamwork/ORIGINAL_REQUEST.md` verbatim before anything else.

- Working directory: `/home/antigravity/poidowl/tsukinami`
- Your state folder: `/home/antigravity/poidowl/tsukinami/.agents/teamwork/auditor_1_r1`
- Parent conversation ID: `ad21f6bd4a586a7bb9224cb69d82fa20`

**Input Artifacts**:
- `/home/antigravity/poidowl/tsukinami/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/home/antigravity/poidowl/tsukinami/PROJECT.md`
- `/home/antigravity/poidowl/tsukinami/.agents/teamwork/worker_1/handoff.md`

**Wave Verifier Rules**:
1. MUST NOT modify the git working tree or put source, probes/tests, or data in `.agents/teamwork/` (metadata in `.agents/teamwork/auditor_1_r1/` only). Stage any ad-hoc scratch probes in `mktemp -d -- "${TMPDIR:-/tmp}/teamwork_probe.XXXXXX"` (`chmod 700`) and remove that probe dir before reporting.
2. Perform a **whole-project forensic integrity audit** (all modified/added files, `data/*`, full git diff `origin/kusanagi..HEAD`, target-scoped execution checks). Never trust `worker_1`'s claims without independent verification.
3. Timestamp any long-running commands in `progress.md` before starting.

**Forensic Integrity Checks**:
1. **Full git diff inspection**: Verify `origin/kusanagi..HEAD` (`hitofude.mjs`, `yomu.mjs`, `data/*`), confirming genuine DSP/prosody code (no hardcoded test outputs, no dummy/facade implementations, no cheating or delegation to external TTS tools) and verifying `<= 100` added code lines.
2. **Data authenticity**: Verify `data/kawaii_utterances.jsonl`, `data/kawaii_voice_ref.json`, and `data/SOURCES.md` contain genuine, statistically coherent acoustic measurements from real corpora (not synthetic/fabricated placeholder arrays) and check that `PRESETS.kawaii` parameters correspond meaningfully to the dataset.
3. **Independent execution validation**: Independently run `hitofude.mjs` / `yomu.mjs` (writing any output WAV to your temp dir) to verify genuine synthesis and reproducible `hakaru()` metrics.
4. **User-constraint note**: Per `ORIGINAL_REQUEST.md`, the user explicitly waived error/unexpected-behavior testing and capped additions at 100 lines — skipping error/edge-case tests is NOT an integrity violation here, whereas fabricating data/results or cheating WOULD be an INTEGRITY VIOLATION.

**Completion Criteria**:
Write `/home/antigravity/poidowl/tsukinami/.agents/teamwork/auditor_1_r1/handoff.md` with an explicit verdict (`CLEAN` or `INTEGRITY VIOLATION`) and full forensic evidence, then send a concise `send_message` to `ad21f6bd4a586a7bb9224cb69d82fa20` with your verdict and `handoff.md` path.
