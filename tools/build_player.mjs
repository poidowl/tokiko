#!/usr/bin/env node
// tools/build_player.mjs — Builds square X Player Card (player.html) & share page (index.html) from ../kuda.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT_DIR = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
fs.mkdirSync(OUT_DIR, { recursive: true });

const VERSION = "v0.1.3";
const PLAYER_REV = "v0.1.3-bubble1";
const VERSION_NOTE = "20段の位相分散で声がなめらかに ＋ 約1.25倍速 ＋ CLIの不明オプションはエラーに・--seed追加";
const PAGES_BASE = "https://poidowl.github.io/tokiko";
const REPO_URL = "https://github.com/poidowl/tokiko";

let rawSrc = fs.readFileSync(path.join(ROOT, "kuda.mjs"), "utf8");
const bytes = (text) => Buffer.byteLength(text, "utf8");
const kb = (text) => (bytes(text) / 1000).toFixed(1) + " kB";
const exactSize = (text) => bytes(text).toLocaleString("en-US") + " B";

// Strip shebang, Node.js CLI footer (contains top-level await), and ES module `export ` keywords
let engineSrc = rawSrc
  .replace(/^#!.*\n/, "")
  .replace(/\n\/\/ CLI entrypoint[\s\S]*$/, "")
  .replace(/^export\s+(const|function)\s+/gm, "$1 ");

const compactEngine = engineSrc
  .split("\n")
  .map((line) => line.replace(/\s+$/, ""))
  .filter((line) => {
    const t = line.trim();
    return t !== "" && !t.startsWith("//");
  })
  .join("\n");

const playerHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="canonical" href="${PAGES_BASE}/">
<title>tokiko / KUDA ${VERSION} — 仮想発声器官 プレイヤー</title>
<style>
  :root {
    --bg: #ffdf92;
    --surface: #fff6db;
    --raised: #ffd178;
    --border: #997f75;
    --border-hi: #453449;
    --text: #30263c;
    --muted: #574958;
    --dim: #655664;
    --accent: #ff897d;
    --accent-hi: #ffa598;
    --brass: #79413e;
    --teal: #116e65;
    --teal-dim: rgba(44, 165, 141, 0.16);
    --brass-dim: rgba(217, 155, 56, 0.16);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 100%;
    height: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Noto Sans CJK JP", sans-serif;
    font-size: 12.5px;
    line-height: 1.35;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    width: 100%;
    height: 100%;
    max-width: 520px;
    margin: 0 auto;
    padding: 10px 11px 8px;
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-shrink: 0;
  }
  .brand {
    display: flex;
    align-items: baseline;
    gap: 7px;
    min-width: 0;
  }
  .brand h1 {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: var(--text);
  }
  .brand .tag {
    font-size: 11px;
    font-weight: 600;
    color: var(--brass);
    white-space: nowrap;
  }
  .meta-right {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10.5px;
    flex-shrink: 0;
  }
  .stat-chip {
    padding: 2px 7px;
    border-radius: 5px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }
  .gh-link {
    color: var(--teal);
    text-decoration: none;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 5px;
    border: 1px solid rgba(44, 165, 141, 0.35);
    transition: background 0.12s;
  }
  .gh-link:hover { background: var(--teal-dim); }

  .input-row {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }
  .kana-input {
    flex: 1 1 auto;
    min-width: 0;
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 7px 9px;
    font-size: 13px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.14s;
  }
  .kana-input:focus { border-color: var(--teal); }
  .play-btn {
    flex: 0 0 auto;
    background: var(--accent);
    color: #fffaf5;
    border: none;
    border-radius: 7px;
    padding: 0 13px;
    font-size: 12.5px;
    font-weight: 800;
    font-family: inherit;
    letter-spacing: 0.02em;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    white-space: nowrap;
    transition: background 0.12s, transform 0.08s;
  }
  .play-btn:hover { background: var(--accent-hi); }
  .play-btn:active { transform: scale(0.97); }
  .play-btn.playing {
    background: var(--teal);
    color: #061511;
  }

  .samples {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 5px;
    flex-shrink: 0;
  }
  .sample-btn {
    background: var(--surface);
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 5px;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.12s, border-color 0.12s, background 0.12s;
  }
  .sample-btn:hover { color: var(--text); border-color: var(--border-hi); }
  .sample-btn.active {
    color: var(--text);
    background: var(--raised);
    border-color: var(--brass);
  }

  .scope-box {
    position: relative;
    flex: 1 1 140px;
    min-height: 124px;
    background: #080b0e;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  #scope {
    width: 100%;
    height: 100%;
    display: block;
    cursor: pointer;
  }
  .scope-hud {
    position: absolute;
    top: 5px;
    left: 8px;
    right: 8px;
    display: flex;
    justify-content: space-between;
    pointer-events: none;
    font-size: 10px;
    color: var(--muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }
  .autoplay-pill {
    position: absolute;
    left: 50%;
    bottom: 9px;
    transform: translateX(-50%);
    background: rgba(232, 93, 63, 0.92);
    color: #fffaf5;
    border: 1px solid rgba(255, 250, 245, 0.25);
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.02em;
    pointer-events: none;
    white-space: nowrap;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
    animation: tokikoPulse 1.8s ease-in-out infinite;
  }
  .autoplay-pill[hidden] { display: none; }
  @keyframes tokikoPulse {
    0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.95; }
    50% { transform: translateX(-50%) scale(1.04); opacity: 1; }
  }

  .controls-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-shrink: 0;
  }
  .presets {
    display: flex;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 2px;
    gap: 2px;
  }
  .preset-btn {
    background: transparent;
    color: var(--muted);
    border: none;
    border-radius: 4px;
    padding: 4px 9px;
    font-size: 11px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .preset-btn:hover { color: var(--text); }
  .preset-btn.active {
    background: var(--raised);
    color: var(--brass);
  }
  .tools-right {
    display: flex;
    gap: 5px;
  }
  .mini-btn {
    background: var(--surface);
    color: var(--muted);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    font-variant-numeric: tabular-nums;
    transition: color 0.12s, border-color 0.12s;
  }
  .mini-btn:hover { color: var(--text); border-color: var(--border-hi); }

  .knobs {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 7px 9px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    flex-shrink: 0;
  }
  .knob {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .knob-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 10.5px;
    gap: 4px;
  }
  .knob-head span { color: var(--muted); }
  .knob-head strong {
    color: var(--text);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
  input[type="range"] {
    width: 100%;
    height: 4px;
    accent-color: var(--brass);
    cursor: pointer;
  }

  /* Compact version + changelog footer at the bottom of the square card */
  .ver-foot {
    flex-shrink: 0;
    padding-top: 6px;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ver-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    font-size: 10px;
    color: var(--dim);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }
  .ver-badge {
    color: var(--brass);
    font-weight: 700;
    background: var(--brass-dim);
    padding: 0 5px;
    border-radius: 4px;
  }
  .ver-note {
    font-size: 10px;
    color: var(--dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card { background: linear-gradient(155deg,#ffe9a8,#ffd27e); }
  .brand { align-items: center; }
  .brand h1 { font: 900 23px/1 system-ui,sans-serif; letter-spacing: -.075em; }
  .face { position: relative; width: 28px; height: 24px; flex: none; border: 2px solid #40344a; border-radius: 8px; background: #8ddbc7; transform: rotate(-7deg); }
  .face::before { content: ""; position: absolute; top: 5px; left: 5px; width: 3px; height: 4px; border-radius: 2px; background: #40344a; box-shadow: 10px 0 #40344a; }
  .face::after { content: ""; position: absolute; left: 8px; bottom: 4px; width: 8px; height: 4px; border-radius: 0 0 6px 6px; background: #40344a; }
  .card:has(.play-btn.playing) .face::after { height: 8px; border-radius: 50%; animation: chatter .24s ease-in-out infinite alternate; transform-origin: bottom; }
  @keyframes chatter { to { transform: scaleY(.45); } }
  .play-btn, .sample-btn { border: 1.5px solid #453449; box-shadow: 0 2px #453449; }
  .play-btn, .play-btn.playing { color: #30263c; }
  .play-btn.playing { background: #89dbc6; }
  .sample-btn.active { background: #ffd079; border-color: #453449; }
  .scope-box { border: 3px solid #453449; border-radius: 15px; box-shadow: 0 2px #8b6c64; }
  .scope-hud { color: #e2d6ea; }
  .presets { border-radius: 9px; background: #fff8e4; }
  .preset-btn.active { color: #30263c; box-shadow: inset 0 0 0 1px #453449; }
  [data-preset="kawaii"].active { background: #ffa9bf; }
  [data-preset="amae"].active { background: #cab6f5; }
  [data-preset="genki"].active { background: #8addbd; }
  .knobs { border-radius: 12px; }
  :focus-visible { outline: 3px solid #614898; outline-offset: 1px; }
  @media (max-width: 380px) { .brand .tag { display:none; } }
  @media (max-height: 390px) { body { overflow-y:auto; } .card { min-height:390px; } }
  @media (prefers-reduced-motion: reduce) { .autoplay-pill, .card:has(.play-btn.playing) .face::after { animation:none; } }
  .input-row { align-items:center; gap:9px; }
  .input-row .play-btn { align-self:stretch; }
  .bubble { position:relative; flex:1; min-width:0; border:2px solid #453449; border-radius:12px; background:#fff9e8; }
  .bubble::after { content:""; position:absolute; right:-5px; top:50%; width:7px; height:7px; background:#fff9e8; border:solid #453449; border-width:2px 2px 0 0; transform:translateY(-50%) rotate(45deg); }
  .bubble:focus-within { outline:2px solid #614898; }
  .bubble input { width:100%; background:transparent; border:0; outline:none; }
  .caption-window { display:none; position:absolute; inset:0 7px; overflow:hidden; pointer-events:none; }
  #captionText { position:absolute; left:100%; top:50%; white-space:pre; font-size:14px; font-weight:700; }
  @media (prefers-reduced-motion:no-preference) {
    .card:has(.playing) .caption-window { display:block; }
    .card:has(.playing) .bubble input { opacity:0; }
  }
</style>
</head>
<body>
<div class="card">
  <div class="topbar">
    <div class="brand">
      <h1>tokiko</h1>
      <span class="tag">KUDA · 仮想発声器官</span>
    </div>
    <div class="meta-right">
      <span class="stat-chip">ソース ${kb(rawSrc)}</span>
      <a class="gh-link" href="${REPO_URL}" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
    </div>
  </div>

  <div class="input-row">
    <button id="playBtn" class="play-btn" type="button">▶ しゃべる</button>
    <div class="bubble">
      <input id="kanaInput" class="kana-input" type="text" value="ジャバスクリプトで、しゃべってまーす！" placeholder="かな / Romaji OK (e.g. konnichiwa!)" spellcheck="false" aria-label="読み上げテキスト（ひらがな・カタカナ・ローマ字）">
      <div class="caption-window" aria-hidden="true"><span id="captionText"></span></div>
    </div>
    <span class="face" aria-hidden="true"></span>
  </div>

  <div class="samples">
    <button class="sample-btn active" type="button" data-text="ジャバスクリプトで、しゃべってまーす！">JSで喋る!</button>
    <button class="sample-btn" type="button" data-text="だいじょうぶ、きっと、うまく、いくよ">大丈夫</button>
    <button class="sample-btn" type="button" data-text="ありがとう、すごく、うれしかったよ">ありがとう</button>
    <button class="sample-btn" type="button" data-text="こんばんは、おつかれさま、ゆっくり、やすんでね">お疲れ様</button>
  </div>

  <div class="scope-box">
    <canvas id="scope"></canvas>
    <div class="scope-hud">
      <span id="tractHud">声道管 M=31+23+10+3</span>
      <span id="waveHud">波形 / FFT 0–6kHz</span>
    </div>
    <div id="autoPill" class="autoplay-pill" hidden>🔊 タップでしゃべる</div>
  </div>

  <div class="controls-bar">
    <div class="presets" role="group" aria-label="声プリセット">
      <button class="preset-btn active" type="button" data-preset="kawaii">kawaii</button>
      <button class="preset-btn" type="button" data-preset="amae">amae</button>
      <button class="preset-btn" type="button" data-preset="genki">genki</button>
    </div>
    <div class="tools-right">
      <button id="seedBtn" class="mini-btn" type="button" title="乱数シード切替">🎲 seed 2024</button>
    </div>
  </div>

  <div class="knobs">
    <label class="knob">
      <div class="knob-head"><span>高さ</span><strong id="hzVal">296Hz</strong></div>
      <input id="slHz" type="range" min="140" max="440" step="2" value="296">
    </label>
    <label class="knob">
      <div class="knob-head"><span>息もれ</span><strong id="breathVal">30%</strong></div>
      <input id="slBreath" type="range" min="0" max="100" step="1" value="30" aria-label="息もれ（0%張り声〜100%ウィスパー）">
    </label>
    <label class="knob">
      <div class="knob-head"><span>話速</span><strong id="rateVal">1.00x</strong></div>
      <input id="slRate" type="range" min="-1.00" max="1.00" step="0.01" value="0.00" aria-label="話速（左0.5倍〜右2.0倍）">
    </label>
  </div>

  <footer class="ver-foot">
    <div class="ver-top">
      <div><span class="ver-badge">${VERSION}</span> <span>Pure JS 4分岐ケリー・ロックバウム導波管</span></div>
      <span id="synthStat">待機中 · 24kHz</span>
    </div>
    <div class="ver-note" title="${VERSION_NOTE}">変更: ${VERSION_NOTE}</div>
  </footer>
</div>

<script>
(() => {
"use strict";
${compactEngine}

// --- Interactive Square Player UI ---
const elInput = document.getElementById("kanaInput");
const elPlay = document.getElementById("playBtn");
const elScope = document.getElementById("scope");
const elTractHud = document.getElementById("tractHud");
const elWaveHud = document.getElementById("waveHud");
const elAutoPill = document.getElementById("autoPill");
const elSynthStat = document.getElementById("synthStat");
const elSeed = document.getElementById("seedBtn");
const slHz = document.getElementById("slHz");
const slBreath = document.getElementById("slBreath");
const slRate = document.getElementById("slRate");
const hzVal = document.getElementById("hzVal");
const breathVal = document.getElementById("breathVal");
const rateVal = document.getElementById("rateVal");
const sampleBtns = Array.from(document.querySelectorAll(".sample-btn"));
const presetBtns = Array.from(document.querySelectorAll(".preset-btn"));

const BREATH_PRESET_PCT = { kawaii: 30, amae: 42, genki: 26 };

let curPreset = "kawaii";
let curSeed = 2024;
let audioCtx = null;
let analyser = null;
let liveFreq = new Float32Array(1024);
let curSource = null;
let rafId = 0;
let playStartAt = 0;
let playDur = 0;
let cachedKey = "";
let cached = null; // { res, sc, synthMs, trimStartSec, trimDurSec }
let autoPlayDone = false;
let awaitingUnlock = false;

function getSpeed() {
  return Math.pow(2, Number(slRate.value));
}

function getDurationRate() {
  const sp = getSpeed();
  const p = KUDA_PRESETS[curPreset];
  if (p && Math.abs(sp - (1.0 / p.rate)) < 0.012) return p.rate;
  return 1.0 / sp;
}

function getBreathOpts(pct) {
  const p = KUDA_PRESETS[curPreset] || KUDA_PRESETS.kawaii;
  const defPct = BREATH_PRESET_PCT[curPreset] ?? 30;
  if (Math.round(pct) === defPct) {
    return { rd_base: p.rd_base, rd_tail: p.rd_tail, asp: p.asp, aspMid: p.aspMid };
  }
  const t = Math.max(0, Math.min(1, pct / 100));
  if (t <= 0.30) {
    const u = t / 0.30;
    return {
      rd_base: 0.80 + (1.40 - 0.80) * u,
      rd_tail: 1.25 + (2.14 - 1.25) * u,
      asp:     0.005 + (0.044 - 0.005) * u,
      aspMid:  0.020 + (0.178 - 0.020) * u,
      bernS:   4.60 + (3.58 - 4.60) * u,
    };
  }
  const u = (t - 0.30) / 0.70;
  const curve = 0.4 * u + 0.6 * u * u;
  return {
    rd_base: 1.40 + (2.90 - 1.40) * u,
    rd_tail: 2.14 + (3.60 - 2.14) * u,
    asp:     0.044 + (0.280 - 0.044) * curve,
    aspMid:  0.178 + (1.050 - 0.178) * curve,
    bernS:   3.58 + (2.00 - 3.58) * u,
  };
}

function getOpts() {
  const breath = getBreathOpts(Number(slBreath.value));
  return Object.assign({
    preset: curPreset,
    hz: Number(slHz.value),
    rate: getDurationRate(),
    seed: curSeed,
    srOut: 24000,
  }, breath);
}

function updateKnobText() {
  hzVal.textContent = Math.round(Number(slHz.value)) + "Hz";
  breathVal.textContent = Math.round(Number(slBreath.value)) + "%";
  rateVal.textContent = getSpeed().toFixed(2) + "x";
}

function synthesizeIfNeeded() {
  const txt = (elInput.value || "").trim() || "こんにちは";
  const opts = getOpts();
  const key = JSON.stringify([txt, opts]);
  if (cached && cachedKey === key) return cached;

  const t0 = performance.now();
  const presetObj = KUDA_PRESETS[opts.preset] || KUDA_PRESETS.kawaii;
  const merged = Object.assign({}, presetObj, opts);
  const sc = buildScore(txt, merged);
  const res = synthKuda(txt, opts);
  const synthMs = Math.max(1, Math.round(performance.now() - t0));

  // Find active audio span for snappy playback & clean waveform display
  const x = res.samples;
  const sr = res.sr;
  let a = 0, b = x.length - 1;
  while (a < b && Math.abs(x[a]) < 0.004) a++;
  while (b > a && Math.abs(x[b]) < 0.004) b--;
  const pad = Math.round(sr * 0.04);
  a = Math.max(0, a - pad);
  b = Math.min(x.length, b + pad);
  const trimmed = x.subarray(a, b);

  cachedKey = key;
  cached = {
    res,
    trimmed,
    sc,
    synthMs,
    trimStartSec: a / sr,
    trimDurSec: trimmed.length / sr,
  };
  elSynthStat.textContent = "合成 " + synthMs + "ms · " + (trimmed.length / sr).toFixed(2) + "s · 24kHz";
  return cached;
}

function ensureAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.65;
    analyser.connect(audioCtx.destination);
  }
  return audioCtx;
}

function hideAutoPrompt() {
  awaitingUnlock = false;
  if (elAutoPill) elAutoPill.hidden = true;
}

function showAutoPrompt() {
  if (autoPlayDone) return;
  awaitingUnlock = true;
  if (elAutoPill) elAutoPill.hidden = false;
}

function stopPlay() {
  autoPlayDone = true;
  hideAutoPrompt();
  if (curSource) {
    try { curSource.stop(); } catch (_) {}
    try { curSource.disconnect(); } catch (_) {}
    curSource = null;
  }
  if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  elPlay.classList.remove("playing");
  elPlay.textContent = "▶ しゃべる";
  drawScope(-1);
}

function startPlay() {
  stopPlay();
  const data = synthesizeIfNeeded();
  const ctx = ensureAudio();
  if (!ctx) return;

  const buf = ctx.createBuffer(1, data.trimmed.length, data.res.sr);
  buf.getChannelData(0).set(data.trimmed);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(analyser);
  curSource = src;
  playStartAt = ctx.currentTime;
  playDur = buf.duration;

  if (ctx.state === "suspended") {
    ctx.resume().then(() => {
      if (curSource === src) playStartAt = ctx.currentTime;
    }).catch(() => {});
  }

  const caption = document.getElementById("captionText");
  caption.textContent = elInput.value.trim() || "こんにちは";
  caption.style.transform = "translate(0%, -50%)";
  elPlay.classList.add("playing");
  elPlay.textContent = "■ 停止";

  src.onended = () => {
    if (curSource === src) {
      curSource = null;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      elPlay.classList.remove("playing");
      elPlay.textContent = "▶ しゃべる";
      drawScope(-1);
    }
  };
  src.start();

  const tick = () => {
    if (!curSource) return;
    const elapsed = ctx.currentTime - playStartAt;
    const prog = Math.max(0, Math.min(1, elapsed / Math.max(0.01, playDur)));
    caption.style.transform = "translate(" + (-100 * prog) + "%, -50%)";
    drawScope(prog);
    if (prog < 1) rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function drawScope(progress) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = elScope.clientWidth || 458;
  const h = elScope.clientHeight || 150;
  if (elScope.width !== Math.round(w * dpr) || elScope.height !== Math.round(h * dpr)) {
    elScope.width = Math.round(w * dpr);
    elScope.height = Math.round(h * dpr);
  }
  const ctx = elScope.getContext("2d");
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#272235";
  ctx.fillRect(0, 0, w, h);

  const splitX = Math.round(w * 0.52);
  ctx.strokeStyle = "#443b54";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(splitX + 0.5, 8);
  ctx.lineTo(splitX + 0.5, h - 8);
  ctx.stroke();

  if (!cached) { ctx.restore(); return; }
  const { sc, trimmed, trimStartSec, trimDurSec } = cached;

  // --- LEFT: Real-time 4-Branch Kelly-Lochbaum Vocal Tract Cross-Section ---
  const tSec = progress >= 0
    ? (trimStartSec + progress * trimDurSec)
    : (trimStartSec + trimDurSec * 0.35);
  const fIdx = Math.max(0, Math.min(sc.n - 1, Math.floor(tSec / sc.fpz)));
  const A = sc.A_tr[fIdx];
  const vel = sc.velSm[fIdx] || 0;
  const fric = sc.fricSm[fIdx] || 0;
  const fJ = sc.fricJ_tr[fIdx] || 27;
  const f0 = sc.f0_fr[fIdx] || Number(slHz.value);
  const vo = sc.voSm[fIdx] || 0;

  const tx0 = 12, tx1 = splitX - 12, tw = tx1 - tx0;
  const mouthY = Math.round(h * 0.64);
  const nasalY = Math.round(h * 0.33);
  const scaleH = Math.min(22, h * 0.145);

  // Nasal branch (MN=23, branching at VEL_J=14 up and forward to nostrils)
  const velX = tx0 + (14 / 30) * tw;
  const velAlpha = Math.min(1, vel / 1.4);
  ctx.beginPath();
  ctx.moveTo(velX, mouthY - Math.sqrt(Math.max(0.05, A[14])) * scaleH * 0.45);
  ctx.quadraticCurveTo(velX + tw * 0.08, nasalY - 10, tx1 - 4, nasalY - 5);
  ctx.lineTo(tx1 - 4, nasalY + 5);
  ctx.quadraticCurveTo(velX + tw * 0.08, nasalY + 4, velX + 10, mouthY - Math.sqrt(Math.max(0.05, A[15])) * scaleH * 0.45);
  ctx.closePath();
  ctx.fillStyle = "rgba(44, 165, 141, " + (0.07 + 0.38 * velAlpha).toFixed(3) + ")";
  ctx.fill();
  ctx.strokeStyle = "rgba(44, 165, 141, " + (0.28 + 0.65 * velAlpha).toFixed(3) + ")";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  // Sinus closed side-branch stub at SIN_J=15 attached cleanly to nasal roof
  const sinX = velX + tw * 0.14;
  const sinY = nasalY - 7;
  ctx.strokeStyle = "rgba(44, 165, 141, " + (0.35 + 0.45 * velAlpha).toFixed(3) + ")";
  ctx.beginPath();
  ctx.moveTo(sinX, sinY);
  ctx.lineTo(sinX - 5, sinY - 10);
  ctx.stroke();

  // Piriform fossa stub at PIR_J=4 attached cleanly to pharyngeal wall
  const pirX = tx0 + (4 / 30) * tw;
  const pirY = mouthY + Math.sqrt(Math.max(0.02, A[4])) * scaleH * 0.56;
  ctx.strokeStyle = "rgba(217, 155, 56, 0.55)";
  ctx.beginPath();
  ctx.moveTo(pirX, pirY);
  ctx.lineTo(pirX - 4, pirY + 10);
  ctx.stroke();

  // Oral main vocal tract (M=31 sections, radius ~ sqrt(Area))
  ctx.beginPath();
  for (let j = 0; j < 31; j++) {
    const x = tx0 + (j / 30) * tw;
    const r = Math.sqrt(Math.max(0.02, A[j])) * scaleH * 0.56;
    if (j === 0) ctx.moveTo(x, mouthY - r);
    else ctx.lineTo(x, mouthY - r);
  }
  for (let j = 30; j >= 0; j--) {
    const x = tx0 + (j / 30) * tw;
    const r = Math.sqrt(Math.max(0.02, A[j])) * scaleH * 0.56;
    ctx.lineTo(x, mouthY + r);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(217, 155, 56, " + (0.14 + 0.16 * vo).toFixed(3) + ")";
  ctx.fill();
  ctx.strokeStyle = vo > 0.25 ? "#ffd278" : "#8f9ba8";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Glottal pulse indicator at j=0
  if (vo > 0.15) {
    ctx.fillStyle = "rgba(232, 93, 63, " + (0.35 + 0.55 * vo).toFixed(3) + ")";
    ctx.beginPath();
    ctx.arc(tx0 + 2, mouthY, 3 + 3.5 * vo, 0, Math.PI * 2);
    ctx.fill();
  }

  // Turbulence dipole indicator at fJ
  if (fric > 0.12 && fJ > 4) {
    const fx = tx0 + (Math.min(30, fJ) / 30) * tw;
    ctx.fillStyle = "rgba(44, 165, 141, " + Math.min(0.9, fric * 0.75).toFixed(3) + ")";
    ctx.beginPath();
    ctx.arc(fx, mouthY, 3 + Math.min(7, fric * 5.5), 0, Math.PI * 2);
    ctx.fill();
  }

  // Tract labels
  ctx.fillStyle = "#c0afc9";
  ctx.font = "9.5px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("声門", tx0, h - 6);
  ctx.fillText("鼻腔", tx1 - 24, nasalY - 9);
  ctx.fillText("唇", tx1 - 12, h - 6);
  elTractHud.textContent = progress >= 0
    ? ("声道管 · F0 " + Math.round(f0) + "Hz" + (vel > 0.4 ? " · 鼻" : fric > 0.25 ? " · 乱流" : ""))
    : "声道管 M=31+23+10+3";

  // --- RIGHT TOP: Waveform + Playhead ---
  const rx0 = splitX + 10, rw = Math.max(24, w - rx0 - 10);
  const wy0 = 22, wh = Math.round((h - 32) * 0.46), wcy = wy0 + wh * 0.5;
  ctx.strokeStyle = "#443b54";
  ctx.beginPath();
  ctx.moveTo(rx0, wcy);
  ctx.lineTo(rx0 + rw, wcy);
  ctx.stroke();

  const step = Math.max(1, Math.floor(trimmed.length / rw));
  ctx.strokeStyle = "#79e2c6";
  ctx.lineWidth = 1.05;
  ctx.beginPath();
  for (let c = 0; c < rw; c++) {
    const s0 = c * step, s1 = Math.min(trimmed.length, s0 + step);
    let mn = 0, mx = 0;
    for (let i = s0; i < s1; i++) {
      const v = trimmed[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    ctx.moveTo(rx0 + c + 0.5, wcy - mx * (wh * 0.48));
    ctx.lineTo(rx0 + c + 0.5, wcy - mn * (wh * 0.48));
  }
  ctx.stroke();

  if (progress >= 0) {
    const px = rx0 + progress * rw;
    ctx.strokeStyle = "#ff99ad";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px, wy0);
    ctx.lineTo(px, wy0 + wh);
    ctx.stroke();
  }

  // --- RIGHT BOTTOM: Live FFT Spectrum 0–6kHz ---
  const sy0 = wy0 + wh + 10, sy1 = h - 14, sh = Math.max(20, sy1 - sy0);
  const srAct = audioCtx ? audioCtx.sampleRate : 24000;
  const maxBin = Math.min(liveFreq.length - 1, Math.round((6000 / srAct) * 2048));
  ctx.beginPath();
  let hasLive = false;
  if (progress >= 0 && analyser && curSource) {
    analyser.getFloatFrequencyData(liveFreq);
    let pk = -120;
    for (let k = 2; k < maxBin; k++) if (liveFreq[k] > pk) pk = liveFreq[k];
    if (pk > -92) {
      hasLive = true;
      for (let c = 0; c < rw; c++) {
        const k = Math.max(1, Math.min(maxBin - 1, Math.round((c / rw) * maxBin)));
        const rel = Math.max(-52, Math.min(0, liveFreq[k] - pk));
        const yy = sy0 + ((-rel) / 52) * sh;
        if (c === 0) ctx.moveTo(rx0 + c, yy); else ctx.lineTo(rx0 + c, yy);
      }
    }
  }
  if (!hasLive) {
    // Draw quiet acoustic baseline when idle
    ctx.moveTo(rx0, sy1 - 2);
    ctx.lineTo(rx0 + rw, sy1 - 2);
  }
  ctx.strokeStyle = hasLive ? "#ffd278" : "#2b3644";
  ctx.lineWidth = 1.25;
  ctx.stroke();
  if (hasLive) {
    ctx.lineTo(rx0 + rw, sy1);
    ctx.lineTo(rx0, sy1);
    ctx.closePath();
    ctx.fillStyle = "rgba(217, 155, 56, 0.16)";
    ctx.fill();
  }

  ctx.fillStyle = "#c0afc9";
  ctx.font = "9.5px ui-monospace, SFMono-Regular, Menlo, monospace";
  for (const [hzT, lbl] of [[1000, "1k"], [3000, "3k"], [5500, "5.5k"]]) {
    const lx = rx0 + (hzT / 6000) * rw;
    if (lx < rx0 + rw - 16) ctx.fillText(lbl, lx - 6, h - 3);
  }
  elWaveHud.textContent = hasLive ? "LIVE FFT 0–6kHz" : "波形 / FFT 0–6kHz";
  ctx.restore();
}

// Wire events
elPlay.addEventListener("click", () => {
  if (curSource) stopPlay(); else startPlay();
});
elInput.addEventListener("pointerdown", () => { if (curSource) stopPlay(); });
elInput.addEventListener("input", () => { if (curSource) stopPlay(); });
elInput.addEventListener("focus", () => { if (curSource) stopPlay(); });
elInput.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.isComposing) { ev.preventDefault(); startPlay(); }
});
elScope.addEventListener("click", () => startPlay());

sampleBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    sampleBtns.forEach((b) => b.classList.toggle("active", b === btn));
    elInput.value = btn.dataset.text;
    startPlay();
  });
});

presetBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    curPreset = btn.dataset.preset;
    presetBtns.forEach((b) => b.classList.toggle("active", b === btn));
    const p = KUDA_PRESETS[curPreset];
    if (p) {
      slHz.value = String(Math.round(p.hz));
      slBreath.value = String(BREATH_PRESET_PCT[curPreset] ?? 30);
      const logSp = Math.max(-1, Math.min(1, Math.log2(1.0 / p.rate)));
      slRate.value = logSp.toFixed(2);
      updateKnobText();
    }
    startPlay();
  });
});

for (const sl of [slHz, slBreath, slRate]) {
  sl.addEventListener("input", updateKnobText);
  sl.addEventListener("change", () => startPlay());
}

elSeed.addEventListener("click", () => {
  curSeed = curSeed >= 2039 ? 2024 : curSeed + 1;
  elSeed.textContent = "🎲 seed " + curSeed;
  startPlay();
});

// Expose synthesized WAV to the outer share page (index.html) outside X's sandboxed iframe
window.addEventListener("message", (ev) => {
  if (!ev.data || ev.data.type !== "tokiko:getWav" || !ev.source) return;
  const data = synthesizeIfNeeded();
  const targetOrigin = (ev.origin && ev.origin !== "null") ? ev.origin : "*";
  ev.source.postMessage({
    type: "tokiko:wav",
    wav: data.res.wav,
    filename: "tokiko_" + curPreset + "_" + curSeed + ".wav",
  }, targetOrigin);
});

window.addEventListener("resize", () => drawScope(-1));

// Fallback unlock: if browser autoplay policy holds AudioContext suspended, speak on first tap anywhere
const onFirstGesture = (ev) => {
  if (!awaitingUnlock || autoPlayDone) return;
  const t = ev.target;
  const isInteractive = t && t.closest && t.closest("button, input, a, label, #scope");
  if (isInteractive) {
    autoPlayDone = true;
    hideAutoPrompt();
    return;
  }
  startPlay();
};
window.addEventListener("pointerdown", onFirstGesture, { capture: true });
window.addEventListener("keydown", onFirstGesture, { capture: true });

// Boot: immediately synthesize & attempt auto-speak on open (with clean autoplay-policy fallback)
updateKnobText();
(() => {
  const params = new URLSearchParams(window.location.search || "");
  const wantAuto = params.get("autoplay") !== "0";
  const ctx = wantAuto ? ensureAudio() : null;
  const resumeP = (ctx && ctx.state === "suspended")
    ? ctx.resume().catch(() => {})
    : Promise.resolve();

  synthesizeIfNeeded();
  drawScope(-1);

  if (!wantAuto || !ctx) return;

  const launchIfReady = () => {
    if (!autoPlayDone && ctx.state === "running") {
      startPlay();
      return true;
    }
    return false;
  };

  if (launchIfReady()) return;

  ctx.addEventListener("statechange", () => {
    launchIfReady();
  });
  resumeP.then(() => {
    if (!launchIfReady() && !autoPlayDone) showAutoPrompt();
  });
  setTimeout(() => {
    if (!autoPlayDone && !launchIfReady()) showAutoPrompt();
  }, 180);
})();
})();
</script>
</body>
</html>
`;

const shareHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="tokiko (KUDA ${VERSION}) — ソース ${kb(rawSrc)}・重み0B・依存ゼロの純JS 4分岐ケリー・ロックバウム物理声道管シンセサイザ。Xの正方形カード上でそのまま日本語を喋ります。">
<meta name="twitter:card" content="player">
<meta name="twitter:title" content="tokiko / KUDA ${VERSION} — ソース ${kb(rawSrc)}・重み0Bの仮想発声器官（純JS）">
<meta name="twitter:description" content="録音0Byte・学習モデルなし。4分岐ケリー・ロックバウム声道導波管（口31+鼻23+副鼻腔10+梨状窩3）だけで日本語を喋る純JS仮想発声器官。カード上でそのまま声道を動かして聴けます。">
<meta name="twitter:image" content="${PAGES_BASE}/assets/tokiko_square.jpg">
<meta name="twitter:player" content="${PAGES_BASE}/player.html?v=${PLAYER_REV}">
<meta name="twitter:player:width" content="480">
<meta name="twitter:player:height" content="480">
<meta property="og:type" content="website">
<meta property="og:url" content="${PAGES_BASE}/">
<meta property="og:title" content="tokiko / KUDA ${VERSION} — ソース ${kb(rawSrc)}・重み0Bの仮想発声器官（純JS）">
<meta property="og:description" content="録音0Byte・学習モデルなし。4分岐声道導波管だけで日本語を喋る純JS仮想発声器官。">
<meta property="og:image" content="${PAGES_BASE}/assets/tokiko_square.jpg">
<meta property="og:image:width" content="1024">
<meta property="og:image:height" content="1024">
<title>tokiko / KUDA ${VERSION} — 仮想発声器官 | poidowl/tokiko</title>
<style>
  :root {
    --bg: #080a0d;
    --surface: #12171e;
    --border: #232c37;
    --text: #f2ede4;
    --muted: #8f9ba8;
    --dim: #667280;
    --accent: #e85d3f;
    --brass: #d99b38;
    --teal: #2ca58d;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px 14px 36px;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", sans-serif;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .wrap {
    max-width: 480px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .frame-shell {
    width: 100%;
    aspect-ratio: 1 / 1;
    max-width: 480px;
    max-height: 480px;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid var(--border);
    background: #0c0f12;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.52);
  }
  .frame-shell iframe {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  .btn {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 7px 12px;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.12s, color 0.12s;
  }
  .btn:hover { border-color: var(--teal); color: var(--teal); }
  .btn.primary {
    background: var(--accent);
    color: #fffaf5;
    border-color: var(--accent);
  }
  .btn.primary:hover { opacity: 0.92; color: #fffaf5; }
  .ver-panel {
    padding: 9px 11px;
    border-radius: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    font-size: 11px;
    color: var(--muted);
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .ver-panel .vh {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: var(--dim);
  }
  .ver-panel strong { color: var(--brass); }
  @media (max-width: 500px) {
    body { padding: 12px 8px 24px; }
    .frame-shell { aspect-ratio: auto; height: 480px; }
  }
  .details { min-width: 0; display: grid; gap: 16px; align-content: start; }
  .details h1 { margin: 0; font-size: 30px; line-height: 1.1; }
  .details small { color: var(--muted); font-size: 14px; }
  .sizes { border-block: 1px solid var(--border); padding: 14px 0; }
  .sizes h2 { font-size: 15px; margin: 0 0 12px; }
  .sizes dl { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin: 0; font-size: 13px; }
  .sizes code, .sizes p { color: var(--muted); font-size: 12px; }
  .sizes dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
  .sizes p { margin: 14px 0 0; }
  .details a { color: var(--text); }
  @media (min-width: 840px) {
    .wrap { max-width: 900px; display: grid; grid-template-columns: 480px 1fr; align-items: start; gap: 28px; margin-top: 5vh; }
    .details { padding-top: 8px; }
  }

  :root { --bg:#fbf3de; --surface:#fffcf0; --text:#382e40; --muted:#655665; --dim:#665766; --border:#b4a09b; --brass:#854237; --teal:#14685e; }
  body { background: radial-gradient(#d8cbb6 1px,transparent 1px) 0 0 / 16px 16px, var(--bg); }
  .frame-shell { border: 2px solid #443547; border-radius: 20px; box-shadow: 0 5px #443547; }
  .details { background: var(--surface); padding:18px; border:1px solid var(--border); border-radius:16px; }
  .details h1 { letter-spacing:-.07em; } .details small { letter-spacing:0; }
  .btn.primary { color:#34283a; background:#ff9988; border-color:#443547; box-shadow:0 2px #443547; }
  .btn.primary:hover { color:#34283a; }
</style>
</head>
<body>
<main class="wrap">
  <div class="frame-shell">
    <iframe id="playerFrame" src="./player.html?v=${PLAYER_REV}" title="tokiko / KUDA ${VERSION} 正方形ライブプレイヤー"
      allow="autoplay"
      sandbox="allow-popups allow-same-origin allow-scripts allow-presentation"></iframe>
  </div>

  <aside class="details">
  <h1>tokiko <small>/ KUDA</small></h1>
  <div class="actions">
    <button id="wavOutBtn" class="btn primary" type="button">↓ WAV保存</button>
    <button id="copyUrlBtn" class="btn" type="button">URLをコピー</button>

  </div>

  <section class="sizes">
    <h2>コード容量</h2>
    <dl>
      <dt>エンジン原本 <code>kuda.mjs</code></dt><dd>${exactSize(rawSrc)}</dd>
      <dt>埋め込みエンジン</dt><dd>${exactSize(compactEngine)}</dd>
      <dt>プレイヤー全体 <code>player.html</code></dt><dd>${exactSize(playerHtml)}</dd>
      <dt>学習済みモデルの重み</dt><dd>0 B</dd>
    </dl>
    <p>圧縮前の UTF-8 容量。原本にはコメントと CLI を含みます。プレイヤー全体には埋め込みエンジンと操作画面を含みます。</p>
  </section>
  <section class="ver-panel" aria-label="バージョン情報">
    <div class="vh">
      <span><strong>${VERSION}</strong> · Virtual Vocal Organ KUDA</span>
      <span><a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">GitHub ↗</a> · MIT</span>
    </div>
    <div>変更内容: ${VERSION_NOTE}</div>
  </section>
  </aside>
</main>
<script>
const playerFrame = document.getElementById("playerFrame");
const wavOutBtn = document.getElementById("wavOutBtn");

window.addEventListener("message", function (ev) {
  if (!ev.data || ev.data.type !== "tokiko:wav" || !ev.data.wav) return;
  if (playerFrame && ev.source !== playerFrame.contentWindow) return;
  const blob = new Blob([ev.data.wav], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ev.data.filename || "tokiko.wav";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  wavOutBtn.textContent = "✓ WAV保存しました";
  setTimeout(() => { wavOutBtn.textContent = "↓ WAV保存"; }, 1800);
});

wavOutBtn.addEventListener("click", function () {
  if (playerFrame && playerFrame.contentWindow) {
    playerFrame.contentWindow.postMessage({ type: "tokiko:getWav" }, "*");
  }
});

document.getElementById("copyUrlBtn").addEventListener("click", function () {
  const url = "${PAGES_BASE}/";
  const btn = this;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      btn.textContent = "✓ コピーしました";
      setTimeout(() => { btn.textContent = "URLをコピー"; }, 2000);
    });
  }
});
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(OUT_DIR, "player.html"), playerHtml, "utf8");
fs.writeFileSync(path.join(OUT_DIR, "index.html"), shareHtml, "utf8");

console.log(`Built ${VERSION} -> player.html (${kb(playerHtml)}), index.html (${kb(shareHtml)})`);
