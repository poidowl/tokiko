#!/usr/bin/env node
// Reproducible benchmark & regression suite comparing a baseline git ref (default: pinned nama revision)
// against the working tree kuda.mjs.
// Usage: node tools/bench_turbo.mjs [--base <ref>] [--warmup 8] [--runs 12]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const args = process.argv.slice(2);
let baseRef = "34bc0821224be9b918984c305414bc3276242d5f";
let warmup = 8;
let runs = 12;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--base" && args[i + 1]) baseRef = args[++i];
  else if (args[i] === "--warmup" && args[i + 1]) warmup = Math.max(1, Number(args[++i]) || 8);
  else if (args[i] === "--runs" && args[i + 1]) runs = Math.max(1, Number(args[++i]) || 12);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tokiko-bench-"));
const basePath = path.join(tmpDir, "kuda_base.mjs");
const baseSha = execSync(`git rev-parse --short ${baseRef}`, { cwd: ROOT, encoding: "utf8" }).trim();
const headSha = execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
fs.writeFileSync(basePath, execSync(`git show ${baseRef}:kuda.mjs`, { cwd: ROOT, encoding: "utf8" }), "utf8");

const baseMod = await import(pathToFileURL(basePath).href);
const curMod = await import(pathToFileURL(path.join(ROOT, "kuda.mjs")).href);

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length & 1 ? s[m] : 0.5 * (s[m - 1] + s[m]);
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sha256Short(u8) {
  return crypto.createHash("sha256").update(u8).digest("hex").slice(0, 12);
}

// 24-band Bark Log-Spectral Distance (512-pt Hann FFT, 50% overlap, active speech frames)
function barkLSD(a, b, sr = 24000) {
  const N = 512, hop = 256, K = N / 2;
  const len = Math.min(a.length, b.length);
  const hann = new Float64Array(N);
  for (let i = 0; i < N; i++) hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
  const hzToBark = (f) => 13 * Math.atan(0.00076 * f) + 3.5 * Math.atan((f / 7500) ** 2);
  const binBand = new Int32Array(K + 1);
  for (let k = 1; k <= K; k++) binBand[k] = Math.min(23, Math.max(0, Math.floor(hzToBark((k * sr) / N))));
  const rev = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    let r = 0, x = i;
    for (let b0 = 0; b0 < 9; b0++) { r = (r << 1) | (x & 1); x >>= 1; }
    rev[i] = r;
  }
  const cosT = new Float64Array(N / 2), sinT = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) {
    cosT[i] = Math.cos(-2 * Math.PI * i / N);
    sinT[i] = Math.sin(-2 * Math.PI * i / N);
  }
  function mag2(arr, off) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[rev[i]] = arr[off + i] * hann[i];
    for (let s = 2; s <= N; s <<= 1) {
      const half = s >> 1, step = N / s;
      for (let i = 0; i < N; i += s) {
        for (let j = 0; j < half; j++) {
          const wr = cosT[j * step], wi = sinT[j * step];
          const u = i + j, v = u + half;
          const tr = wr * re[v] - wi * im[v];
          const ti = wr * im[v] + wi * re[v];
          re[v] = re[u] - tr; im[v] = im[u] - ti;
          re[u] += tr; im[u] += ti;
        }
      }
    }
    const bands = new Float64Array(24);
    for (let k = 1; k <= K; k++) bands[binBand[k]] += re[k] * re[k] + im[k] * im[k];
    return bands;
  }
  let sumLSD = 0, frames = 0;
  for (let off = 0; off + N <= len; off += hop) {
    let e = 0;
    for (let i = 0; i < N; i++) e += a[off + i] * a[off + i];
    if (e / N < 1e-6) continue;
    const ba = mag2(a, off), bb = mag2(b, off);
    let d2 = 0, cnt = 0;
    for (let m = 0; m < 24; m++) {
      if (ba[m] <= 0 && bb[m] <= 0) continue;
      const da = 10 * Math.log10(ba[m] + 1e-12);
      const db = 10 * Math.log10(bb[m] + 1e-12);
      d2 += (da - db) ** 2;
      cnt++;
    }
    if (cnt > 0) { sumLSD += Math.sqrt(d2 / cnt); frames++; }
  }
  return frames > 0 ? sumLSD / frames : 0;
}

function diffMetrics(a, b) {
  let eSig = 0, eDiff = 0, maxAbs = 0, nans = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const va = a[i], vb = b[i];
    if (!Number.isFinite(vb)) nans++;
    if (Math.abs(vb) > maxAbs) maxAbs = Math.abs(vb);
    eSig += va * va;
    eDiff += (va - vb) * (va - vb);
  }
  return {
    rmsDb: 10 * Math.log10((eDiff + 1e-20) / (eSig + 1e-20)),
    sigRmsDb: 10 * Math.log10((eSig / Math.max(1, len)) + 1e-20),
    maxAbs,
    nans,
  };
}

const CASES = [
  { name: "1_kawaii_jp", text: "こんにちは、わたしはときこです。きょうも、たのしく、おはなししましょうね！", opts: { preset: "kawaii", srOut: 24000, seed: 2024 } },
  { name: "2_amae_nasal", text: "ねむいなあ、あんまりむりしないで、みんないっしょにのんびりしようね。", opts: { preset: "amae", srOut: 24000, seed: 2024 } },
  { name: "3_genki_sib_stop", text: "さしすせそ、たちつてと、ぱぴぷぺぽ、ぴょんぴょんはねて、すっごくげんき！", opts: { preset: "genki", srOut: 24000, seed: 2024 } },
  { name: "4_romaji_mix", text: "konnichiwa, sekai! Tōkyō! JavaScriptで、しゃべってまーす！", opts: { preset: "kawaii", srOut: 24000, seed: 2024 } },
  { name: "5_whisper_breath", text: "ひそひそ、ふふふ、はあ、しずかなよるに、ほしがきらきらひかるよ。", opts: { preset: "kawaii", asp: 0.088, aspMid: 0.35, srOut: 24000, seed: 2024 } },
  { name: "6_default_short", text: "わたし、にほんご、ちょっとしゃべれます", opts: { preset: "kawaii", srOut: 24000, seed: 2024 } },
];

const EDGE_CASES = [
  { name: "edge_bernS_neg", text: "あいうえお", opts: { bernS: -0.1, srOut: 24000, seed: 2024 } },
  { name: "edge_bernS_zero", text: "あいうえお", opts: { bernS: 0.0, srOut: 24000, seed: 2024 } },
  { name: "edge_bernS_tiny", text: "あいうえお", opts: { bernS: 0.2, srOut: 24000, seed: 2024 } },
  { name: "edge_bernS_huge", text: "あいうえお", opts: { bernS: 64.0, srOut: 24000, seed: 2024 } },
];

// Static import check
const curSrc = fs.readFileSync(path.join(ROOT, "kuda.mjs"), "utf8");
const staticImports = curSrc.match(/^\s*import\s+/gm) || [];
if (staticImports.length !== 0) {
  throw new Error(`Unexpected static import(s) in kuda.mjs: ${staticImports.length}`);
}

console.log(`tokiko benchmark | base=${baseRef} (${baseSha}) vs worktree (${branch}@${headSha})`);
console.log(`env: Node ${process.version} | ${process.platform}/${process.arch} | ${os.cpus()[0]?.model || "unknown CPU"} | warmup=${warmup}, runs=${runs}`);
console.log(`static imports in kuda.mjs: ${staticImports.length}\n`);

for (let w = 0; w < warmup; w++) {
  baseMod.synthKuda(CASES[0].text, CASES[0].opts);
  curMod.synthKuda(CASES[0].text, CASES[0].opts);
}

console.log("| Case | Dur(s) | base med(ms) | base(xRT) | cur med(ms) | cur(xRT) | Speedup(med) | Bark-LSD(dB) | RMSdiff(dB) | MaxAbs | NaNs |");
console.log("|------|--------|--------------|-----------|-------------|----------|--------------|--------------|-------------|--------|------|");

let totDur = 0, totBaseMed = 0, totCurMed = 0, maxLSD = 0;

for (const c of CASES) {
  const bTimes = [], cTimes = [];
  let rBase, rCur;
  for (let r = 0; r < runs; r++) {
    let t0 = performance.now();
    rBase = baseMod.synthKuda(c.text, c.opts);
    bTimes.push(performance.now() - t0);
    t0 = performance.now();
    rCur = curMod.synthKuda(c.text, c.opts);
    cTimes.push(performance.now() - t0);
  }

  // Determinism check
  const rCur2 = curMod.synthKuda(c.text, c.opts);
  if (sha256Short(rCur.wav) !== sha256Short(rCur2.wav)) {
    throw new Error(`Determinism mismatch on ${c.name}`);
  }

  const dur = rCur.samples.length / rCur.sr;
  const bMed = median(bTimes), cMed = median(cTimes);
  const bRT = (dur * 1000) / bMed, cRT = (dur * 1000) / cMed;
  const spd = bMed / cMed;
  const lsd = barkLSD(rBase.samples, rCur.samples, rCur.sr);
  const dm = diffMetrics(rBase.samples, rCur.samples);

  totDur += dur; totBaseMed += bMed; totCurMed += cMed;
  if (lsd > maxLSD) maxLSD = lsd;

  console.log(`| ${c.name} | ${dur.toFixed(2)} | ${bMed.toFixed(1)} | ${bRT.toFixed(1)}x | ${cMed.toFixed(1)} | ${cRT.toFixed(1)}x | ${spd.toFixed(2)}x | ${lsd.toFixed(3)} | ${dm.rmsDb.toFixed(1)} | ${dm.maxAbs.toFixed(3)} | ${dm.nans} |`);
  if (dm.nans > 0 || dm.maxAbs > 1.001) throw new Error(`Invalid output on ${c.name}`);
}

console.log(`\nSummary (median sum): dur=${totDur.toFixed(2)}s | base=${totBaseMed.toFixed(1)}ms (${((totDur * 1000) / totBaseMed).toFixed(1)}x RT) | cur=${totCurMed.toFixed(1)}ms (${((totDur * 1000) / totCurMed).toFixed(1)}x RT) | speedup=${(totBaseMed / totCurMed).toFixed(2)}x | maxBarkLSD=${maxLSD.toFixed(3)} dB`);

console.log("\nCustom option edge-case parity checks:");
for (const e of EDGE_CASES) {
  const rBase = baseMod.synthKuda(e.text, e.opts);
  const rCur = curMod.synthKuda(e.text, e.opts);
  const dm = diffMetrics(rBase.samples, rCur.samples);
  const lsd = barkLSD(rBase.samples, rCur.samples, rCur.sr);
  let curRms = 0;
  for (let i = 0; i < rCur.samples.length; i++) curRms += rCur.samples[i] * rCur.samples[i];
  const curRmsDb = 10 * Math.log10(curRms / Math.max(1, rCur.samples.length) + 1e-20);
  console.log(`  ${e.name.padEnd(18)} nans=${dm.nans} maxAbs=${dm.maxAbs.toFixed(3)} curRms=${curRmsDb.toFixed(1)}dB Bark-LSD=${lsd.toFixed(3)}dB RMSdiff=${dm.rmsDb.toFixed(1)}dB`);
  if (dm.nans > 0 || !Number.isFinite(curRmsDb) || curRmsDb < -45) {
    throw new Error(`Edge-case regression on ${e.name}: nans=${dm.nans}, curRmsDb=${curRmsDb}`);
  }
}

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log("\nALL CHECKS PASSED.");
