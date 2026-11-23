#!/usr/bin/env node
/**
 * kuda.mjs — 0バイト純粋物理・分岐声道管デジタルウェーブガイド音声合成エンジン (管 / KUDA)
 *
 * 100% 純JS・ゼロ依存・0バイト重み・ゼロEQ・ゼロ別系統フォルマントバンクの物理声道管シンセサイザ。
 * 5極カスケードIIRの構造限界 (母音/子音分断・固定笛・高RQA停滞・低CPP・2kHz鼻声山) を
 * 真の分岐声道デジタルウェーブガイド (Kelly-Lochbaum) により根本から突破しつつ、
 * Dual-ASR (ReazonSpeech-k2-v2 + SenseVoice-Small) と 130本音響X線の両輪で調音物理を鍛え上げた版。
 *
 * 物理構造:
 *   1. M=31 若年女性主声道管 (L=12.4cm @ 88.2kHz 2倍速 Kelly-Lochbaum 散乱格子)
 *      - 解剖学的5母音断面積ペンタゴン (a/i/u/e/o 0.22〜5.9cm² 狭窄コントラスト) + 6種全身調音姿勢 (CPOST)
 *      - Titze & Story (1997) 動的軟粘膜喉頭管カラー (j=0..3)
 *      - Dang, Honda & Suzuki (1994) 4.0cm 閉端副鼻腔側枝 (MS=10 @ SIN_J=15, 現実的結合面積 0.18cm²)
 *      - 解剖学的鼻道管 (MN=23 @ VEL_J=14) + 連続軟口蓋ゲート (velGate: クリックゼロ)
 *      - 浅い若年梨状窩側枝 (MP=3 @ PIR_J=4) + Flanagan (1972) 円形ピストン放射インピーダンス × √(A_exit)
 *      - 非両唇子音時の口唇開離 (lipPart) ＋ 硬口蓋歯擦音舌下前腔 (sibPalCav: し/しゃ/しょ/ち/じ均等4.4kHz)
 *   2. Fant-LF 滑らか2段指数リターン相 + 複合 Bernoulli-OpenChink 声門流 + 粘膜弾性(ta1/tp/jit微小ゆらぎ):
 *      - Klatt & Klatt (1990) 3極温息・後部声門間隙気流 + 語頭生理的ソフトオンセット (偽/p/破裂ゼロ)
 *      - 物理4系統分離ダイポール乱流 (歯茎歯擦 6.5kHz / 若年女性口蓋歯擦 4.4kHz / 広帯域破裂 / 声門気息: 相互リークゼロ)
 *      - 2段三角 C¹ 平滑歯擦エンベロープ + 日本語本来の VOT 分離 (k/t/p, g/d/b, 有声摩擦 z/j) + 軟組織3D位相分散
 *      - 日本語音韻規則 (助詞「は」→ワ、長音「おう/えい」→ー、無声子音間のみの狭母音無声化)
 *   3. Butterworth アンチエイリアシング・リサンプラ (24kHz / 44.1kHz 等に対応)
 * 動作環境:
 *   Node.js / ブラウザ両対応の完全1ファイル独立 ESM (外部 import ゼロ)。
 *   - ESM: `import { synthKuda } from "./kuda.mjs"; const { wav, samples, sr } = synthKuda("こんにちは");`
 *   - CLI: `node kuda.mjs [--preset kawaii|amae|genki|sasayaki] [--sr 24000|44100] [--flat Hz] -o out.wav "テキスト"`
 */
export const SR = 44100;
const FP = 5.0;

export function makeRng(seed) {
  let a = (Math.trunc(seed) ^ 0x6d2b79f5) >>> 0;
  const random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296.0;
  };
  return { random, uniform: (lo, hi) => lo + (hi - lo) * random() };
}

// Mechanism 4: Seeded 5-octave Voss-McCartney 1/f pink noise + light Ornstein-Uhlenbeck memory (H ≈ 0.75, beta ≈ 1.0-1.6)
function makePinkGen(seed, nOct = 5, ouTauSec = 0.030, fpz = 0.005) {
  const r = makeRng(seed);
  const oct = new Float64Array(nOct);
  let sum = 0.0;
  for (let k = 0; k < nOct; k++) {
    oct[k] = r.random() + r.random() - 1.0;
    sum += oct[k];
  }
  const alpha = Math.exp(-fpz / Math.max(0.008, ouTauSec));
  const ouScale = Math.sqrt(Math.max(0.0, 1.0 - alpha * alpha));
  const invN = 1.0 / Math.sqrt(nOct);
  let ou = 0.0, step = 0;
  return () => {
    step++;
    let tz = 0, x = step;
    while ((x & 1) === 0 && tz < nOct - 1) { x >>= 1; tz++; }
    const nv = r.random() + r.random() - 1.0;
    sum += nv - oct[tz];
    oct[tz] = nv;
    const pink = sum * invN;
    ou = alpha * ou + ouScale * pink;
    return Math.tanh(0.84 * pink + 0.24 * ou);
  };
}

const ROMA3 = {
  sha: "シャ", shi: "シ", shu: "シュ", she: "シェ", sho: "ショ",
  cha: "チャ", chi: "チ", chu: "チュ", che: "チェ", cho: "チョ",
  tsu: "ツ", tsa: "ツァ", tsi: "ツィ", tse: "ツェ", tso: "ツォ",
  kya: "キャ", kyi: "キ", kyu: "キュ", kye: "キェ", kyo: "キョ",
  gya: "ギャ", gyi: "ギ", gyu: "ギュ", gye: "ギェ", gyo: "ギョ",
  sya: "シャ", syi: "シ", syu: "シュ", sye: "シェ", syo: "ショ",
  zya: "ジャ", zyi: "ジ", zyu: "ジュ", zye: "ジェ", zyo: "ジョ",
  jya: "ジャ", jyi: "ジ", jyu: "ジュ", jye: "ジェ", jyo: "ジョ",
  tya: "チャ", tyi: "チ", tyu: "チュ", tye: "チェ", tyo: "チョ",
  cya: "チャ", cyi: "チ", cyu: "チュ", cye: "チェ", cyo: "チョ",
  dya: "ヂャ", dyi: "ヂ", dyu: "ヂュ", dye: "ヂェ", dyo: "ヂョ",
  nya: "ニャ", nyi: "ニ", nyu: "ニュ", nye: "ニェ", nyo: "ニョ",
  hya: "ヒャ", hyi: "ヒ", hyu: "ヒュ", hye: "ヒェ", hyo: "ヒョ",
  bya: "ビャ", byi: "ビ", byu: "ビュ", bye: "ビェ", byo: "ビョ",
  pya: "ピャ", pyi: "ピ", pyu: "ピュ", pye: "ピェ", pyo: "ピョ",
  mya: "ミャ", myi: "ミ", myu: "ミュ", mye: "ミェ", myo: "ミョ",
  rya: "リャ", ryi: "リ", ryu: "リュ", rye: "リェ", ryo: "リョ",
  fya: "フャ", fyu: "フュ", fyo: "フョ", vya: "ヴャ", vyu: "ヴュ", vyo: "ヴョ",
  pha: "ファ", phi: "フィ", phu: "フ", phe: "フェ", pho: "フォ", phy: "フィ",
  thi: "ティ", dhi: "ディ", twu: "トゥ", dwu: "ドゥ", dzu: "ヅ", dzi: "ヂ",
  tha: "サ", thu: "ス", the: "ゼ", tho: "ソ",
  wha: "ワ", whi: "ウィ", whu: "ウ", whe: "ウェ", who: "ウォ",
  kwa: "クァ", gwa: "グァ", xtu: "ッ", xya: "ャ", xyu: "ュ", xyo: "ョ",
};
const ROMA2 = {
  ka: "カ", ki: "キ", ku: "ク", ke: "ケ", ko: "コ",
  sa: "サ", si: "シ", su: "ス", se: "セ", so: "ソ",
  ta: "タ", ti: "チ", tu: "ツ", te: "テ", to: "ト",
  na: "ナ", ni: "ニ", nu: "ヌ", ne: "ネ", no: "ノ",
  ha: "ハ", hi: "ヒ", hu: "フ", he: "ヘ", ho: "ホ",
  ma: "マ", mi: "ミ", mu: "ム", me: "メ", mo: "モ",
  ya: "ヤ", yi: "イ", yu: "ユ", ye: "イェ", yo: "ヨ",
  ra: "ラ", ri: "リ", ru: "ル", re: "レ", ro: "ロ",
  wa: "ワ", wi: "ウィ", wu: "ウ", we: "ウェ", wo: "ヲ",
  ga: "ガ", gi: "ギ", gu: "グ", ge: "ゲ", go: "ゴ",
  za: "ザ", zi: "ジ", zu: "ズ", ze: "ゼ", zo: "ゾ",
  da: "ダ", di: "ヂ", du: "ヅ", de: "デ", do: "ド",
  ba: "バ", bi: "ビ", bu: "ブ", be: "ベ", bo: "ボ",
  pa: "パ", pi: "ピ", pu: "プ", pe: "ペ", po: "ポ",
  ja: "ジャ", ji: "ジ", ju: "ジュ", je: "ジェ", jo: "ジョ",
  fa: "ファ", fi: "フィ", fu: "フ", fe: "フェ", fo: "フォ",
  va: "ヴァ", vi: "ヴィ", vu: "ヴ", ve: "ヴェ", vo: "ヴォ",
  ca: "カ", ci: "シ", cu: "ク", ce: "セ", co: "コ",
  qa: "クァ", qi: "クィ", qu: "ク", qe: "クェ", qo: "クォ",
  xa: "ァ", xi: "ィ", xu: "ゥ", xe: "ェ", xo: "ォ",
};
const ROMA1 = { a: "ア", i: "イ", u: "ウ", e: "エ", o: "オ" };
const CONS_FB = {
  t: "ト", d: "ド", k: "ク", c: "ク", g: "グ", s: "ス", z: "ズ",
  p: "プ", b: "ブ", v: "ブ", f: "フ", m: "ム", r: "ル", j: "ジ",
  w: "ウ", y: "イ", q: "ク", x: "クス",
};
const MACRON = { ā: "a-", ī: "i-", ū: "u-", ē: "e-", ō: "o-", â: "a-", î: "i-", û: "u-", ê: "e-", ô: "o-" };

export function romajiToKata(s) {
  let str = String(s || "");
  if (!/[A-Za-z-āīūēōĀĪŪĒŌâîûêôÂÎÛÊÔ]/.test(str)) return str;
  if (/[āīūēōĀĪŪĒŌâîûêôÂÎÛÊÔ]/.test(str)) str = str.replace(/[āīūēōĀĪŪĒŌâîûêôÂÎÛÊÔ]/g, (c) => MACRON[c.toLowerCase()] || c);
  const low = str.toLowerCase().replace(/l/g, "r");
  let out = "", i = 0;
  const n = str.length;
  while (i < n) {
    const ch = low[i];
    if (ch < "a" || ch > "z") {
      if (ch === "-" && out.length && !/[、。，．,.!！?？… 　/|]/.test(out[out.length - 1])) out += "ー";
      else out += str[i];
      i++;
      continue;
    }
    if (low.startsWith("xtsu", i)) { out += "ッ"; i += 4; continue; }
    if (ch === "n") {
      const nx = low[i + 1] || "", nx2 = low[i + 2] || "";
      if (nx === "n") { out += "ン"; i += /[aiueoy]/.test(nx2) ? 1 : 2; continue; }
      if ((nx === "'" || nx === "’") && /[aiueoy]/.test(nx2)) { out += "ン"; i += 2; continue; }
      if (!/[aiueoy]/.test(nx)) { out += "ン"; i++; continue; }
    }
    if (ch === "m" && (low[i + 1] === "b" || low[i + 1] === "p")) { out += "ン"; i++; continue; }
    if (low.startsWith("tch", i) || low.startsWith("ck", i)) { out += "ッ"; i++; continue; }
    if (ch === low[i + 1] && !/[aiueon]/.test(ch)) {
      if (ch === "r" || ch === "h" || ch === "w" || ch === "y") { i++; continue; }
      out += "ッ"; i++; continue;
    }
    const s3 = low.slice(i, i + 3);
    if (ROMA3[s3]) { out += ROMA3[s3]; i += 3; continue; }
    const s2 = low.slice(i, i + 2);
    if (ROMA2[s2]) { out += ROMA2[s2]; i += 2; continue; }
    if (ROMA1[ch]) { out += ROMA1[ch]; i++; continue; }
    if (s2 === "ch") { out += "チ"; i += 2; continue; }
    if (s2 === "sh") { out += "シュ"; i += 2; continue; }
    if (s2 === "ts") { out += "ツ"; i += 2; continue; }
    if (s2 === "th") { out += "ス"; i += 2; continue; }
    if (s2 === "ph") { out += "フ"; i += 2; continue; }
    if (ch === "h") { out += (out.length && /[ァ-ヶ]$/.test(out)) ? "ー" : "フ"; i++; continue; }
    if (CONS_FB[ch]) { out += CONS_FB[ch]; i++; continue; }
    i++;
  }
  return out;
}

export function toKata(s) {
  const src = romajiToKata(s);
  let out = "";
  for (const ch of src) {
    const code = ch.codePointAt(0);
    out += (code >= 0x3041 && code <= 0x3096) ? String.fromCodePoint(code + 0x60) : ch;
  }
  return out;
}

export function smooth1(x, ms) {
  const k = Math.max(1, Math.trunc(ms / FP)), n = x.length;
  if (k <= 1 || n === 0) return Array.from(x);
  const N = n + 2 * k, a = new Float64Array(N);
  for (let i = 0; i < k; i++) { a[i] = x[0]; a[k + n + i] = x[n - 1]; }
  for (let i = 0; i < n; i++) a[k + i] = x[i];
  const off = Math.floor((k - 1) / 2), out = new Array(n), inv = 1.0 / k;
  for (let i = 0; i < n; i++) {
    const j = i + k + off;
    let s = 0.0;
    for (let m = 0; m < k; m++) {
      const q = j - m;
      if (q >= 0 && q < N) s += a[q] * inv;
    }
    out[i] = s;
  }
  return out;
}

function minJerk(u) {
  if (!Number.isFinite(u) || u <= 0.0) return 0.0;
  const t = u >= 1.0 ? 1.0 : u;
  return t * t * t * (10.0 + t * (-15.0 + 6.0 * t));
}

// Unconditionally stable exact matrix-exponential ZOH 2nd-order Task Dynamics spring-damper:
// q'' + 2*zeta*omegaN*q' + omegaN^2*(q - x) = 0, with optional anticipatory motor-command lead (leadFrac in [0, 1]).
function taskDyn(x, omegaN, zeta, fpz, leadFrac = 1.0) {
  const n = x.length;
  if (n === 0) return [];
  const w = Number.isFinite(omegaN) ? Math.max(1e-3, Math.min(5000.0, omegaN)) : 140.0;
  const z = Number.isFinite(zeta) ? Math.max(1e-3, Math.min(10.0, zeta)) : 1.0;
  const dt = Number.isFinite(fpz) && fpz > 0.0 ? fpz : 0.005;
  let a11, a12, a21, a22;
  if (Math.abs(z - 1.0) < 1e-4) {
    const e = Math.exp(-w * dt);
    a11 = e * (1.0 + w * dt);
    a12 = e * dt;
    a21 = -e * w * w * dt;
    a22 = e * (1.0 - w * dt);
  } else if (z < 1.0) {
    const sq = Math.sqrt(1.0 - z * z);
    const wd = w * sq;
    const e = Math.exp(-z * w * dt);
    const c = Math.cos(wd * dt), s = Math.sin(wd * dt);
    const zs = (z / sq) * s;
    a11 = e * (c + zs);
    a12 = e * (s / wd);
    a21 = -e * (w / sq) * s;
    a22 = e * (c - zs);
  } else {
    const sq = Math.sqrt(z * z - 1.0);
    const alpha = w * sq;
    const e1 = Math.exp((-z * w + alpha) * dt);
    const e2 = Math.exp((-z * w - alpha) * dt);
    const ch = 0.5 * (e1 + e2), sh = 0.5 * (e1 - e2);
    const zs = (z / sq) * sh;
    a11 = ch + zs;
    a12 = sh / alpha;
    a21 = -(w / sq) * sh;
    a22 = ch - zs;
  }
  const b1 = 1.0 - a11;
  const b2 = -a21;
  const t50 = (0.822 + 0.692 * z + 0.164 * z * z) / w;
  const leadF = leadFrac > 0.0 ? Math.max(0.0, (leadFrac * t50) / dt - 0.5) : 0.0;
  const out = new Array(n);
  let q = x[0], v = 0.0;
  for (let t = 0; t < n; t++) {
    let u;
    if (leadF > 1e-6) {
      const p = t + leadF;
      const i0 = Math.min(n - 1, Math.floor(p));
      const i1 = Math.min(n - 1, i0 + 1);
      u = x[i0] + (x[i1] - x[i0]) * (p - i0);
    } else {
      u = x[t];
    }
    const qn = a11 * q + a12 * v + b1 * u;
    const vn = a21 * q + a22 * v + b2 * u;
    q = qn;
    v = vn;
    out[t] = q;
  }
  return out;
}

export function encodeWav(samples, sampleRate = SR) {
  const n = samples.length, buf = new ArrayBuffer(44 + n * 2), view = new DataView(buf);
  const writeAscii = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  writeAscii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) view.setInt16(44 + i * 2, Math.round(Math.max(-1.0, Math.min(1.0, samples[i])) * 32767.0), true);
  return new Uint8Array(buf);
}

const M = 31;
const MN = 23;
const MS = 10;
const MP = 3;
const VEL_J = 14;
const SIN_J = 15;
const PIR_J = 4;

export const KUDA_PRESETS = {
  kawaii:   { hz: 302.0, smile: 0.56, rd_base: 1.45, rd_tail: 2.28, bernS: 4.15, scoop: 1.72, asp: 0.049, aspMid: 0.200, rate: 1.00, tdZeta: 0.87, slLift: 0.115, hopf: 0.55 },
  amae:     { hz: 290.0, smile: 0.50, rd_base: 1.60, rd_tail: 2.62, bernS: 3.65, scoop: 2.05, asp: 0.068, aspMid: 0.275, rate: 1.09, tdZeta: 1.18, slLift: 0.08, hopf: 0.78 },
  genki:    { hz: 320.0, smile: 0.72, rd_base: 1.36, rd_tail: 2.12, bernS: 4.30, scoop: 1.55, asp: 0.044, aspMid: 0.175, rate: 0.93, tdZeta: 0.80, slLift: 0.13, hopf: 0.35 },
  sasayaki: { hz: 288.0, smile: 0.48, rd_base: 2.35, rd_tail: 3.25, bernS: 2.40, scoop: 1.40, asp: 0.165, aspMid: 0.620, rate: 1.10, tdZeta: 1.25, slLift: 0.06, hopf: 0.90 },
};

const K2V = {};
for (const [row, cons] of [
  ["アイウエオ", ""], ["カキクケコ", "k"], ["サシスセソ", "s"], ["タチツテト", "t"], ["ナニヌネノ", "n"], ["ハヒフヘホ", "h"],
  ["マミムメモ", "m"], ["ヤ・ユ・ヨ", "y"], ["ラリルレロ", "r"], ["ワ・・・ヲ", "w"], ["ガギグゲゴ", "g"], ["ザジズゼゾ", "z"],
  ["ダヂヅデド", "d"], ["バビブベボ", "b"], ["パピプペポ", "p"],
]) {
  const chars = Array.from(row);
  const vs = ["a", "i", "u", "e", "o"];
  for (let i = 0; i < 5; i++) if (chars[i] !== "・") K2V[chars[i]] = [cons, vs[i]];
}
Object.assign(K2V, {
  "シ": ["sh", "i"], "チ": ["ch", "i"], "ツ": ["ts", "u"], "ジ": ["j", "i"], "ヂ": ["j", "i"], "ヅ": ["z", "u"],
  "フ": ["f", "u"], "ヴ": ["b", "u"], "ヲ": ["", "o"],
});
const SMALL = { "ャ": "a", "ュ": "u", "ョ": "o", "ァ": "a", "ィ": "i", "ゥ": "u", "ェ": "e", "ォ": "o" };
const PALC = { s: "sh", z: "j", t: "ch", d: "j" };
const PAUSE = new Set(Array.from("、。，．,.!！?？…‥ 　"));
const PLACE = {
  p: "lab", b: "lab", m: "lab", f: "lab", w: "lab",
  t: "alv", d: "alv", n: "alv", s: "alv", z: "alv", ts: "alv", r: "alv",
  sh: "pal", ch: "apal", j: "apal", y: "pal",
  k: "vel", g: "vel", h: "glot", "": null,
};
const MANNER = {
  p: "stop", b: "stop", t: "stop", d: "stop", k: "stop", g: "stop",
  m: "nas", n: "nas",
  s: "fric", z: "fric", sh: "fric", j: "fric", f: "fric",
  ch: "affr", ts: "affr", h: "h", r: "tap", y: "glide", w: "glide", "": null,
};
const VOICELESS = new Set(["k", "s", "sh", "t", "ch", "ts", "h", "f", "p"]);
const VOICED_OBS = new Set(["g", "d", "b", "z", "j"]);
const ALV_SIB = new Set(["s", "z", "ts"]);
const PAL_SIB = new Set(["sh", "j", "ch"]);
const SPECIAL = new Set(["ン", "ッ", "ー", "〜"]);
const PART = new Set(Array.from("モニガヲデヘテ"));
const LONGV = { a: "ア", i: "イ", u: "ウ", e: "エイ", o: "オウ" };
const HA_LEXICAL_END = new Set(["ハハ", "チチハハ", "コノハ", "ソノハ", "アノハ", "ドノハ", "イロハ", "アロハ", "ヤマハ", "ナハ"]);
const NO_TO_MO_U_RE = /^(?:ウエ(?![ンイ])|ウチ|ウシロ|ウラ|ウミ|ウタ(?![ンイ])|ウン|ウワサ|ウワギ|ウゴキ|ウサギ|ウナギ)/;
const NO_ONLY_U_RE = /^(?:ウデ|ウソ|ウマ|ウシ)/;

export const ACCENT_KAWAII = {
  reg: 335.0, rng: 10.2, jump: 5.2, fall: 5.3, sag: 1.0, lag: 1.0, rlag: 0.5,
  ds: 1.5, ds_h: 0.35, reset: 0.78, decl: 0.75, fin: 0.34, qrise: 6.2, sm: 30.0,
};

function splitMarked(text) {
  const out = [];
  const src = toKata(text)
    .replace(/([アカサタナハマヤラワガザダバパ])ァ/g, "$1ー").replace(/([イキシチニヒミリギジヂビピ])ィ/g, "$1ー")
    .replace(/([ウクスツヌフムユルグズヅブプ])ゥ/g, "$1ー").replace(/([エケセテネヘメレゲゼデベペ])ェ/g, "$1ー")
    .replace(/([オコソトノホモヨロゴゾドボポ])ォ/g, "$1ー")
    .replace(/[～~]/g, "〜");
  const isBreak = (x) => x === "/" || x === "、" || x === "?" || x === "!" || x === "…";
  for (const ch of src) {
    if (ch === "'" || ch === "’") out.push("'");
    else if (ch === " " || ch === "/" || ch === "|") {
      if (out.length && !isBreak(out[out.length - 1])) out.push("/");
    } else if (ch === "?" || ch === "？") {
      if (out.length && isBreak(out[out.length - 1])) out[out.length - 1] = "?";
      else if (out.length) out.push("?");
    } else if (ch === "!" || ch === "！") {
      if (out.length && isBreak(out[out.length - 1])) { if (out[out.length - 1] !== "?") out[out.length - 1] = "!"; }
      else if (out.length) out.push("!");
    } else if (ch === "…" || ch === "‥") {
      if (out.length && isBreak(out[out.length - 1])) { if (out[out.length - 1] === "/" || out[out.length - 1] === "、") out[out.length - 1] = "…"; }
      else if (out.length) out.push("…");
    } else if (PAUSE.has(ch)) {
      if (out.length && out[out.length - 1] === "/") out[out.length - 1] = "、";
      else if (out.length && !isBreak(out[out.length - 1])) out.push("、");
    } else if (SMALL[ch] && out.length && !["、", "ッ", "ン", "ー", "〜", "'", "/", "?", "!", "…"].includes(out[out.length - 1])) {
      out[out.length - 1] += ch;
    } else if (K2V[ch] || ch === "ッ" || ch === "ン" || ch === "ー" || ch === "〜" || ch === "#") {
      out.push(ch);
    }
  }
  while (out.length && (out[out.length - 1] === "、" || out[out.length - 1] === "/")) out.pop();
  return out;
}

export function annotate(text) {
  const toks = splitMarked(String(text || "").replace(/0/g, "#"));
  const clean = [], phr = [];
  let cur = null, k = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === "、" || t === "/" || t === "?" || t === "!" || t === "…") {
      const mood = t === "?" ? 1 : (t === "!" ? 2 : (t === "…" ? 3 : 0));
      if (mood && cur !== null) cur[3] = mood;
      if (t === "、" || (mood && i + 1 < toks.length)) clean.push("、");
      cur = null;
      continue;
    }
    if (t === "#") { if (cur !== null && cur[2] === null) cur[2] = 0; continue; }
    if (t === "'") { if (cur !== null) cur[2] = k - cur[0]; continue; }
    if (cur === null) { cur = [k, 0, null, 0]; phr.push(cur); }
    cur[1] += 1;
    clean.push(t);
    k += 1;
  }
  return [clean.join(""), phr];
}

function guessPhrases(moras) {
  const chunks = [], qs = [];
  let cur = [];
  for (const m of moras) {
    const t = typeof m === "object" ? m.t : m;
    if (t === "'" || t === "/") continue;
    if (t === "、" || t === "?" || t === "!" || t === "…") {
      const md = t === "?" ? 1 : (t === "!" ? 2 : (t === "…" ? 3 : 0));
      if (cur.length) { chunks.push(cur); qs.push(md); cur = []; }
      else if (md && qs.length) qs[qs.length - 1] = md;
    } else cur.push(t);
  }
  if (cur.length) { chunks.push(cur); qs.push(0); }
  const phr = [];
  let k = 0;
  for (let ci = 0; ci < chunks.length; ci++) {
    const seg = chunks[ci], L = seg.length;
    const W = L - ((PART.has(seg[L - 1]) && L > 2) ? 1 : 0);
    let acc = W >= 3 ? Math.max(1, W - 2) : 1;
    while (acc > 1 && SPECIAL.has(seg[acc - 1])) acc--;
    phr.push([k, L, acc, qs[ci] || 0]);
    k += L;
  }
  return phr;
}

function heavy(m1, m2) {
  return SPECIAL.has(m2.t) || (m1.v != null && (LONGV[m1.v] || "").includes(m2.t));
}

function smoothTri(x, k) {
  if (k <= 1 || !x.length) return x.slice();
  let cur = x.slice();
  for (let p = 0; p < 2; p++) {
    const hl = p === 0 ? Math.floor(k / 2) : (k - 1 - Math.floor(k / 2));
    const hr = k - 1 - hl, n = cur.length;
    const pad = new Float64Array(hl + n + hr), c = new Float64Array(pad.length + 1);
    for (let i = 0; i < hl; i++) pad[i] = cur[0];
    for (let i = 0; i < n; i++) pad[hl + i] = cur[i];
    for (let i = 0; i < hr; i++) pad[hl + n + i] = cur[n - 1];
    for (let i = 0; i < pad.length; i++) c[i + 1] = c[i] + pad[i];
    const nx = new Array(n);
    for (let i = 0; i < n; i++) nx[i] = (c[i + k] - c[i]) / k;
    cur = nx;
  }
  return cur;
}

export function f0Rule(moras, n, opts = {}) {
  const {
    phrases: inPhr = null, question = false, reg = 340.0, rng = 8.0, jump = 4.0, fall = 5.0,
    sag = 1.0, lag = 1.0, rlag = 0.5, ds = 2.0, ds_h = 0.5, reset = 0.6, decl = 1.2, fin = 2.5, qrise = 5.0,
    sm = 35.0, fp_ms = 5.0, fit_range = true,
  } = opts;
  const ml = moras.slice();
  let phrases;
  if (!inPhr) {
    phrases = guessPhrases(ml);
  } else {
    const nonPau = ml.filter((m) => m.kind !== "pau").map((m) => m.t);
    phrases = inPhr.map((p) => (p[2] != null ? p.slice() : [p[0], p[1], guessPhrases(nonPau.slice(p[0], p[0] + p[1]))[0][2], ...p.slice(3)]));
  }
  const idx = [];
  for (let j = 0; j < ml.length; j++) if (ml[j].kind !== "pau") idx.push(j);
  const lv = new Array(ml.length).fill(null);
  if (idx.length && phrases.length) {
    let top = 0.0;
    for (let pi = 0; pi < phrases.length; pi++) {
      const [s, L, acc, qf] = phrases[pi];
      if (pi > 0) {
        const [ps, pL, pacc] = phrases[pi - 1];
        const prevEnd = idx[ps + pL - 1], thisStart = idx[s];
        top -= pacc ? ds : ds_h;
        let hasPau = false;
        for (let j = prevEnd + 1; j < thisStart; j++) if (ml[j].kind === "pau") { hasPau = true; break; }
        if (hasPau) top *= (1 - reset);
      }
      const exLift = qf === 2 ? 0.9 : (qf === 3 ? -0.45 : 0.0);
      const H = top + exLift, Lo = top - jump + exLift * 0.4;
      const weak = L > 1 && heavy(ml[idx[s]], ml[idx[s + 1]]);
      for (let q = 0; q < L; q++) {
        const j = idx[s + q], pos = q + 1;
        let a, b;
        if (acc === 1 && pos === 1) { a = b = H; }
        else if (acc && pos > acc) {
          const d = fall + sag * (pos - acc - 1);
          a = b = H - d;
          if (pos === acc + 1) a = H - fall * (1 - lag);
        } else if (pos === 1) {
          a = b = weak ? (H - jump * 0.45) : Lo;
          if (L === 1) a = b = H - 1.0;
        } else {
          a = b = H;
          if (pos === 2 && !weak) a = H - jump * rlag;
        }
        lv[j] = [a, b];
      }
      const lastJ = idx[s + L - 1];
      if (qf === 1) {
        lv[lastJ][1] = lv[lastJ][0] + qrise;
      } else if (qf === 2) {
        lv[lastJ][1] = lv[lastJ][0] + 1.85;
      } else if (qf === 3) {
        lv[lastJ][1] = lv[lastJ][0] - 1.15;
      }
    }
    const last = idx[idx.length - 1];
    const lastMood = phrases[phrases.length - 1][3] || 0;
    if (question) lv[last][1] = lv[last][0] + qrise;
    else if (!lastMood) {
      lv[last][1] = lv[last][0] - fin;
      if (idx.length > 1) lv[idx[idx.length - 2]][1] -= fin * 0.25;
    }
  }
  const kt = [], kv = [];
  for (let i = 0; i < ml.length; i++) {
    if (lv[i] === null) continue;
    let b = ml[i].b, e = ml[i].e;
    if (e - b < 0.02) b = ml[i].a;
    kt.push(b, e);
    kv.push(lv[i][0], lv[i][1]);
  }
  if (!kt.length) return new Array(n).fill(0.0);
  const t0 = kt[0];
  for (let i = 0; i < kv.length; i++) kv[i] -= decl * (kt[i] - t0);
  const fp = fp_ms / 1000.0;
  let st = new Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = i * fp;
    if (t <= kt[0]) { st[i] = kv[0]; continue; }
    if (t >= kt[kt.length - 1]) { st[i] = kv[kv.length - 1]; continue; }
    while (kt[j + 1] < t) j++;
    const a = kt[j], b = kt[j + 1];
    const w = b <= a ? 0.0 : (t - a) / (b - a);
    st[i] = kv[j] + w * (kv[j + 1] - kv[j]);
  }
  st = smoothTri(st, Math.max(1, Math.trunc(sm / fp_ms)));
  const vs = st.slice().sort((a, b) => a - b);
  if (fit_range && rng) {
    const lo = vs[Math.trunc(0.05 * (vs.length - 1))];
    const hi = vs[Math.trunc(0.95 * (vs.length - 1))];
    const k = (hi - lo > 1e-6) ? (rng / (hi - lo)) : 1.0;
    for (let i = 0; i < n; i++) st[i] *= k;
    for (let i = 0; i < vs.length; i++) vs[i] *= k;
  }
  let sum = 0.0;
  for (let i = 0; i < vs.length; i++) sum += vs[i];
  const mu = sum / vs.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = reg * Math.pow(2.0, (st[i] - mu) / 12.0);
  return out;
}

function parseMoras(text) {
  const s = toKata(String(text || ""))
    .replace(/([アカサタナハマヤラワガザダバパ])ァ/g, "$1ー").replace(/([イキシチニヒミリギジヂビピ])ィ/g, "$1ー")
    .replace(/([ウクスツヌフムユルグズヅブプ])ゥ/g, "$1ー").replace(/([エケセテネヘメレゲゼデベペ])ェ/g, "$1ー")
    .replace(/([オコソトノホモヨロゴゾドボポ])ォ/g, "$1ー")
    .replace(/[～~]/g, "〜");
  const ms = [];
  const cuts = new Set();
  let mOrd = 0;
  for (const ch of s) {
    if (ch === "'" || ch === "’" || ch === "0" || ch === "#") continue;
    if (ch === "/" || ch === "|") { if (mOrd > 0) cuts.add(mOrd); continue; }
    if (PAUSE.has(ch)) {
      if (ms.length && ms[ms.length - 1] !== "、") ms.push("、");
    } else if (SMALL[ch] && ms.length && !["、", "ッ", "ン", "ー", "〜"].includes(ms[ms.length - 1])) {
      ms[ms.length - 1] += ch;
    } else if (K2V[ch] || ch === "ッ" || ch === "ン" || ch === "ー" || ch === "〜") {
      ms.push(ch);
      mOrd++;
    }
  }
  while (ms.length && ms[0] === "、") ms.shift();
  while (ms.length && ms[ms.length - 1] === "、") ms.pop();

  const chunks = [];
  let cur = [], ord = 0;
  for (let i = 0; i < ms.length; i++) {
    if (ms[i] === "、") { if (cur.length) { chunks.push(cur); cur = []; } continue; }
    if (cuts.has(ord) && cur.length) { chunks.push(cur); cur = []; }
    cur.push(i); ord++;
  }
  if (cur.length) chunks.push(cur);
  for (const idxs of chunks) {
    if (idxs.length >= 2 && ms[idxs[idxs.length - 1]] === "ハ") {
      const prev = ms[idxs[idxs.length - 2]];
      const chunkStr = idxs.map((i) => ms[i]).join("");
      if (prev !== "ッ" && !HA_LEXICAL_END.has(chunkStr)) ms[idxs[idxs.length - 1]] = "ワ";
    }
    let pv = null;
    for (let k = 0; k < idxs.length; k++) {
      const idx = idxs[k], t = ms[idx];
      if (t === "ウ" && pv === "o") {
        const prev = k > 0 ? ms[idxs[k - 1]] : "", prev2 = k > 1 ? ms[idxs[k - 2]] : "";
        const tail = idxs.slice(k).map((i) => ms[i]).join("");
        const blocked = prev === "ヲ" || (k >= 2 && (
          (prev === "ノ" && (NO_TO_MO_U_RE.test(tail) || NO_ONLY_U_RE.test(tail))) ||
          (prev2 !== "ン" && (prev === "ト" || prev === "モ") && NO_TO_MO_U_RE.test(tail))
        ));
        if (!blocked) ms[idx] = "ー";
      } else if (t === "イ" && pv === "e") {
        ms[idx] = "ー";
      }
      const d = decodeMora(ms[idx]);
      pv = (d.kind === "Q" || d.kind === "N") ? null : (d.v || pv);
    }
  }
  return ms;
}

function decodeMora(m) {
  if (m === "、") return { kind: "pau", c: "", v: null, pal: false };
  if (m === "ッ") return { kind: "Q", c: "", v: null, pal: false };
  if (m === "ン") return { kind: "N", c: "", v: null, pal: false };
  if (m === "ー") return { kind: "long", c: "", v: null, pal: false, tilde: false };
  if (m === "〜") return { kind: "long", c: "", v: null, pal: false, tilde: true };
  if (m.length === 2 && SMALL[m[1]] && K2V[m[0]]) {
    const [c0] = K2V[m[0]];
    const v = SMALL[m[1]];
    if (c0 === "sh" || c0 === "ch" || c0 === "j") return { kind: "CV", c: c0, v, pal: false };
    if ("ャュョ".includes(m[1])) {
      if (PALC[c0]) return { kind: "CV", c: PALC[c0], v, pal: false };
      return { kind: "CV", c: c0, v, pal: true };
    }
    return { kind: "CV", c: c0 || (m[0] === "イ" ? "y" : "w"), v, pal: false };
  }
  const [c, v] = K2V[m] || ["", "a"];
  return { kind: "CV", c, v, pal: false };
}

export function buildVowelArea(v, smile = 0.52) {
  const A = new Float64Array(M);
  const g = (j, c, w) => Math.exp(-0.5 * Math.pow((j - c) / w, 2));
  const sm = Math.max(0, Math.min(1.5, smile));
  const epiScale = v === "a" ? 0.88 : v === "e" ? 0.92 : v === "i" ? 0.95 : v === "u" ? 1.04 : v === "o" ? 1.04 : 1.0;
  for (let j = 0; j < M; j++) {
    let a = 2.40;
    if (j <= 3) {
      a = (0.33 + 0.054 * j) * epiScale;
    } else if (j === 4) {
      a = 1.82 * (0.62 + 0.38 * epiScale);
    } else {
      if (v === "a") {
        a = 2.50 - 2.12 * g(j, 9.6, 3.6) + 3.05 * g(j, 21.5, 4.5) + (0.72 + 0.25 * sm) * g(j, 30.0, 2.2);
      } else if (v === "i") {
        a = 2.60 + 3.15 * g(j, 10.5, 4.2) - 2.38 * g(j, 23.0, 3.6) + (1.45 + 0.24 * sm) * g(j, 30.2, 1.8);
      } else if (v === "u") {
        a = 2.40 + 2.80 * g(j, 8.6, 3.5) - 2.24 * g(j, 16.2, 3.1) + 1.75 * g(j, 24.0, 2.8) - (2.10 - 0.18 * sm) * g(j, 29.8, 2.5);
      } else if (v === "e") {
        a = 2.30 + 1.80 * g(j, 11.0, 4.0) - 1.48 * g(j, 19.2, 3.2) + (0.62 + 0.24 * sm) * g(j, 29.8, 2.2);
      } else if (v === "o") {
        a = 2.50 - 2.08 * g(j, 12.0, 3.3) + 3.45 * g(j, 22.5, 3.4) - (1.98 - 0.15 * sm) * g(j, 29.6, 2.3);
      } else {
        a = 2.35;
      }
    }
    A[j] = Math.max(0.22, a);
  }
  return A;
}

// Mechanisms 1 & 5: Lossless Sturm-Liouville transfer-matrix eigenmodes & Fant-Pauli (1975) sensitivity projection
const SL_C_SND = 35000.0;
const SL_DX = SL_C_SND / (2.0 * SR);

function slBoundary(A, freqHz) {
  const k = (2.0 * Math.PI * freqHz) / SL_C_SND;
  const kdx = k * SL_DX;
  const c = Math.cos(kdx), s = Math.sin(kdx);
  let p = 1.0, q = 0.0;
  for (let j = 0; j < M; j++) {
    const Aj = Math.max(0.15, A[j]);
    const pn = c * p - (s / Aj) * q;
    const qn = (Aj * s) * p + c * q;
    p = pn; q = qn;
  }
  const aLip = Math.max(0.15, A[M - 1]);
  const dL = (8.0 / (3.0 * Math.PI)) * Math.sqrt(aLip / Math.PI);
  return p - (k * dL / aLip) * q;
}

function computeTractModes(A, nModes = 4) {
  const modes = [];
  let prevF = 160.0, prevV = slBoundary(A, prevF);
  for (let f = 180.0; f <= 7400.0 && modes.length < nModes; f += 20.0) {
    const v = slBoundary(A, f);
    if (prevV === 0.0 || (prevV < 0.0 && v > 0.0) || (prevV > 0.0 && v < 0.0)) {
      let lo = prevF, hi = f, vlo = prevV;
      for (let it = 0; it < 22; it++) {
        const mid = 0.5 * (lo + hi);
        const vm = slBoundary(A, mid);
        if ((vlo <= 0.0 && vm <= 0.0) || (vlo >= 0.0 && vm >= 0.0)) { lo = mid; vlo = vm; }
        else hi = mid;
      }
      modes.push(0.5 * (lo + hi));
    }
    prevF = f; prevV = v;
  }
  return modes;
}

function computeSensitivity(A, freqHz) {
  const k = (2.0 * Math.PI * freqHz) / SL_C_SND;
  const kdx = k * SL_DX;
  const c = Math.cos(kdx), s = Math.sin(kdx);
  const cH = Math.cos(0.5 * kdx), sH = Math.sin(0.5 * kdx);
  let p = 1.0, q = 0.0, tot = 0.0;
  const num = new Float64Array(M);
  for (let j = 0; j < M; j++) {
    const Aj = Math.max(0.15, A[j]);
    const pm = cH * p - (sH / Aj) * q;
    const qm = (Aj * sH) * p + cH * q;
    const ke = (qm * qm) / Aj;
    const pe = Aj * pm * pm;
    num[j] = ke - pe;
    tot += ke + pe;
    const pn = c * p - (s / Aj) * q;
    const qn = (Aj * s) * p + c * q;
    p = pn; q = qn;
  }
  const S = new Float64Array(M);
  const inv = 1.0 / (tot + 1e-12);
  for (let j = 0; j < M; j++) S[j] = num[j] * inv;
  return S;
}

function buildSturmLiouvilleBasis(A) {
  const modes = computeTractModes(A, 4);
  const dShimmer = new Float64Array(M);
  const dJaw = new Float64Array(M);
  if (modes.length < 4) return { modes, dShimmer, dJaw };
  const S1 = computeSensitivity(A, modes[0]);
  const S2 = computeSensitivity(A, modes[1]);
  const S3 = computeSensitivity(A, modes[2]);
  const S4 = computeSensitivity(A, modes[3]);
  const dot = (u, v) => { let s = 0.0; for (let j = 5; j < M; j++) s += u[j] * v[j]; return s; };
  // Orthonormalize {S1, S2} -> {e1, e2} on mutable oral-pharyngeal sections j=5..30
  const e1 = new Float64Array(M), e2 = new Float64Array(M);
  const n1 = Math.sqrt(dot(S1, S1)) + 1e-12;
  for (let j = 5; j < M; j++) e1[j] = S1[j] / n1;
  const d12 = dot(S2, e1);
  for (let j = 5; j < M; j++) e2[j] = S2[j] - d12 * e1[j];
  const n2 = Math.sqrt(dot(e2, e2)) + 1e-12;
  for (let j = 5; j < M; j++) e2[j] /= n2;
  // Mechanism 1: Lift F3 & F4 girlish shimmer orthogonal to {F1, F2} (<0.3% F1/F2 drift, zero 3850 Hz whistle)
  let maxS = 1e-12;
  for (let j = 5; j < M; j++) dShimmer[j] = 0.45 * S3[j] + 0.75 * S4[j];
  const p1 = dot(dShimmer, e1), p2 = dot(dShimmer, e2);
  for (let j = 5; j < M; j++) {
    dShimmer[j] -= p1 * e1[j] + p2 * e2[j];
    const ab = Math.abs(dShimmer[j]);
    if (ab > maxS) maxS = ab;
  }
  for (let j = 5; j < M; j++) dShimmer[j] /= maxS;
  // Mechanism 5: F2-invariant jaw-opening direction S1 perp S2 for high-F0 F1-F0 tracking
  const e2o = new Float64Array(M);
  const n2o = Math.sqrt(dot(S2, S2)) + 1e-12;
  for (let j = 5; j < M; j++) e2o[j] = S2[j] / n2o;
  const p12 = dot(S1, e2o);
  let maxJ = 1e-12;
  for (let j = 5; j < M; j++) {
    dJaw[j] = S1[j] - p12 * e2o[j];
    const ab = Math.abs(dJaw[j]);
    if (ab > maxJ) maxJ = ab;
  }
  for (let j = 5; j < M; j++) dJaw[j] /= maxJ;
  return { modes, dShimmer, dJaw };
}

function buildConsPostures() {
  const g = (j, c, w) => Math.exp(-0.5 * Math.pow((j - c) / w, 2));
  const out = {};
  for (const pl of ["lab", "alv", "pal", "apal", "vel", "velA", "velF", "r"]) {
    const A = new Float64Array(M);
    for (let j = 0; j < M; j++) {
      if (j <= 3) A[j] = 0.36 + 0.055 * j;
      else if (j === 4) A[j] = 1.82;
      else if (pl === "lab") {
        A[j] = Math.max(0.24, 2.50 - 2.08 * g(j, 12.0, 3.3) + 3.45 * g(j, 22.5, 3.4) - 2.60 * g(j, 29.6, 2.3));
      } else if (pl === "alv") {
        A[j] = Math.max(0.55, 2.35 + 0.35 * g(j, 12.0, 4.0) - 1.15 * g(j, 26.5, 2.0) + 0.65 * g(j, 30.2, 1.8));
      } else if (pl === "pal") {
        A[j] = Math.max(0.26, 2.55 + 2.95 * g(j, 10.5, 4.2) - 2.30 * g(j, 22.8, 3.5) + 1.25 * g(j, 30.2, 1.8));
      } else if (pl === "apal") {
        A[j] = Math.max(0.32, 2.50 + 2.50 * g(j, 11.0, 4.2) - 2.10 * g(j, 24.8, 2.8) + 1.15 * g(j, 30.2, 1.8));
      } else if (pl === "vel") {
        A[j] = Math.max(0.30, 2.40 + 2.05 * g(j, 8.8, 3.2) - 2.05 * g(j, 15.8, 2.8) + 1.45 * g(j, 23.5, 3.0) - 1.32 * g(j, 29.8, 2.2));
      } else if (pl === "velA") {
        A[j] = Math.max(0.30, 2.35 + 1.20 * g(j, 9.5, 3.4) - 1.95 * g(j, 17.8, 2.6) + 1.65 * g(j, 24.8, 3.0) + 0.45 * g(j, 30.0, 2.0));
      } else if (pl === "velF") {
        A[j] = Math.max(0.32, 2.40 + 1.85 * g(j, 10.5, 4.0) - 1.75 * g(j, 20.0, 3.2) + 0.85 * g(j, 29.8, 2.2));
      } else if (pl === "r") {
        A[j] = Math.max(0.30, 2.20 + 0.50 * g(j, 10.0, 3.5) + 2.10 * g(j, 20.5, 2.8) - 2.05 * g(j, 26.8, 1.8) + 1.10 * g(j, 30.2, 1.5));
      }
    }
    out[pl] = A;
  }
  return out;
}

const CONS_LOC = {
  lab:  { c: 28.9, w: 0.95, inj: 29 },
  alv:  { c: 26.5, w: 1.10, inj: 27 },
  pal:  { c: 23.0, w: 1.35, inj: 24 },
  apal: { c: 25.2, w: 1.15, inj: 26 },
  velF: { c: 19.8, w: 1.55, inj: 20 },
  velA: { c: 17.8, w: 1.55, inj: 18 },
  vel:  { c: 16.4, w: 1.65, inj: 17 },
  uvl:  { c: 14.5, w: 1.75, inj: 15 },
};

function effPlace(c, v, pal) {
  const pl = PLACE[c];
  if (pl === "vel" && (v === "i" || v === "e" || pal)) return "velF";
  if (pl === "vel" && v === "a") return "velA";
  if (c === "h" && (v === "i" || pal)) return "pal";
  return pl;
}

function buildScore(text, opts = {}) {
  const {
    rate: rawRate = 1.0,
    pau_s: rawPauS = 0.24,
    flatHz: rawFlatHz = null,
    uta_hz = null,
    hz: rawHz = 302.0,
    smile = 0.56,
    rd_base = 1.42,
    rd_tail = 2.28,
    scoop = 1.65,
    flatTiming = false,
    seed: rawSeed = 2024,
    asp = 0.049,
    aspMid = 0.200,
    nama = true,
    lungCap = 1.0,
    inhale = 1.0,
    tdZeta = 0.96,
    slLift: rawSlLift = 0.11,
    tractScale = "auto",
  } = opts;
  const rate = Number.isFinite(rawRate) ? Math.max(0.25, Math.min(3.0, rawRate)) : 1.0;
  const pau_s = Number.isFinite(rawPauS) ? Math.max(0.0, Math.min(2.0, rawPauS)) : 0.24;
  const hz = Number.isFinite(rawHz) ? Math.max(60.0, Math.min(800.0, rawHz)) : 302.0;
  const flatHz = (rawFlatHz !== null && Number.isFinite(rawFlatHz) && rawFlatHz > 0.0) ? Math.max(60.0, Math.min(800.0, rawFlatHz)) : null;
  const seed = Number.isFinite(rawSeed) ? rawSeed : 2024;
  const slLift = Number.isFinite(rawSlLift) ? Math.max(-0.22, Math.min(0.22, rawSlLift)) : 0.11;

  const rawMs = parseMoras(text);
  const dec = rawMs.map((m, idx) => ({ raw: m, ...decodeMora(m), idx }));
  const [, annPhrases] = annotate(text);

  // Map each non-pause mora ordinal to its phrase mood (0=normal, 1=?, 2=!, 3=...) & position from phrase end
  const moraMood = new Int8Array(dec.length);
  const moraFromEnd = new Int32Array(dec.length);
  let hasExclaim = false;
  {
    let ord = 0;
    const ordToDec = [];
    for (let i = 0; i < dec.length; i++) if (dec[i].kind !== "pau") ordToDec.push(i);
    for (const p of annPhrases) {
      const [s, L, , md] = p;
      if (md === 2) hasExclaim = true;
      for (let q = 0; q < L && s + q < ordToDec.length; q++) {
        const di = ordToDec[s + q];
        moraMood[di] = md || 0;
        moraFromEnd[di] = L - 1 - q;
      }
      ord += L;
    }
  }

  const CDUR = { "": 0, k: 0.072, g: 0.054, s: 0.106, z: 0.096, sh: 0.106, j: 0.088, t: 0.061, d: 0.055, ch: 0.104, ts: 0.102, n: 0.056, h: 0.074, f: 0.072, m: 0.058, y: 0.038, r: 0.032, w: 0.036, b: 0.048, p: 0.070 };
  const VDUR = { a: 0.094, e: 0.090, i: 0.086, o: 0.096, u: 0.086 };

  const phraseLen = new Int32Array(dec.length);
  for (let i = 0; i < dec.length; ) {
    if (dec[i].kind === "pau") { i++; continue; }
    let j = i;
    while (j < dec.length && dec[j].kind !== "pau") j++;
    for (let q = i; q < j; q++) phraseLen[q] = j - i;
    i = j;
  }

  const pre = 0.42, post = 0.36;
  let curT = pre;
  const events = [];

  for (let i = 0; i < dec.length; i++) {
    const d = dec[i];
    const prev = dec[i - 1];
    const nxt = dec[i + 1];
    const nxt2 = dec[i + 2];
    const isPhraseStart = !prev || prev.kind === "pau";
    const isPhraseEnd = !nxt || nxt.kind === "pau";
    const isUttEnd = i === dec.length - 1;
    const pLen = phraseLen[i];
    const mood = moraMood[i] || 0;
    const fromEnd = moraFromEnd[i] || 0;
    const moodRate = flatTiming ? 1.0 : (mood === 2 ? 0.95 : (mood === 3 && fromEnd <= 1 ? 1.18 : 1.0));

    if (d.kind === "pau") {
      const prevLen = i > 0 ? phraseLen[i - 1] : 3;
      const nextLen = i + 1 < dec.length ? phraseLen[i + 1] : 3;
      const prevMood = i > 0 ? (moraMood[i - 1] || 0) : 0;
      let dur = (prevLen <= 1 && nextLen <= 1) ? 0.17 : ((prevLen <= 1 || nextLen <= 1) ? 0.16 : pau_s);
      if (prevMood === 3) dur *= 1.35;
      events.push({ ...d, a: curT, cEnd: curT, e: curT + dur, pLen: 0, mood: 0, fromEnd: 0, isPhraseStart: false, isPhraseEnd: false, isUttEnd: false });
      curT += dur;
      continue;
    }
    if (d.kind === "Q") {
      const isGlottalStop = !nxt || nxt.kind === "pau";
      const dur = (isGlottalStop ? 0.058 : 0.084) * rate;
      const nextPlace = (!isGlottalStop && nxt) ? effPlace(nxt.c, nxt.v, nxt.pal) : null;
      events.push({ ...d, a: curT, cEnd: curT + dur, e: curT + dur, pLen, mood, fromEnd, nextPlace: nextPlace || (isGlottalStop ? null : "alv"), glottalStop: isGlottalStop, isPhraseStart: false, isPhraseEnd, isUttEnd });
      curT += dur;
      continue;
    }
    if (d.kind === "N") {
      const dur = (flatTiming ? 0.098 : (isPhraseEnd && pLen >= 2 ? 0.118 : 0.096)) * rate * moodRate;
      const nextPlace = nxt && nxt.kind === "CV" ? effPlace(nxt.c, nxt.v, nxt.pal) : null;
      const nPlace = (nextPlace === "lab" || nextPlace === "alv" || nextPlace === "pal" || nextPlace === "vel" || nextPlace === "velA" || nextPlace === "velF") ? nextPlace : "uvl";
      events.push({ ...d, a: curT, cEnd: curT, e: curT + dur, pLen, mood, fromEnd, nPlace, isPhraseStart, isPhraseEnd, isUttEnd });
      curT += dur;
      continue;
    }
    if (d.kind === "long") {
      const prevV = [...events].reverse().find(e => e.v)?.v || "a";
      const baseDur = d.tilde ? 0.148 : 0.100;
      const dur = (flatTiming ? 0.098 : baseDur) * rate * moodRate;
      events.push({ ...d, v: prevV, a: curT, cEnd: curT, e: curT + dur, pLen, mood, fromEnd, isPhraseStart, isPhraseEnd, isUttEnd });
      curT += dur;
      continue;
    }

    const cd = (flatTiming ? (d.c ? 0.072 : 0.0) : (CDUR[d.c] || 0.0)) * rate * (mood === 2 ? 0.96 : 1.0);
    let vd = (flatTiming ? 0.092 : (VDUR[d.v] || 0.088)) * rate * moodRate;
    const beforeFinalQ = nxt && nxt.kind === "Q" && (!nxt2 || nxt2.kind === "pau");
    const beforeFinalDevSu = !flatTiming && nxt && (i + 1 === dec.length - 1) && nxt.kind === "CV" && (nxt.c === "s" || nxt.c === "sh") && (nxt.v === "u" || nxt.v === "i");
    if (!flatTiming && isPhraseStart && pLen >= 2) vd *= 0.94;
    if (beforeFinalQ) vd *= 0.84;
    else if (isUttEnd) vd *= 1.48;
    else if (beforeFinalDevSu) vd *= 1.24;
    else if (isPhraseEnd && pLen >= 2) vd *= 1.28;
    else if (isPhraseEnd && pLen === 1) vd *= 2.05;

    // True Japanese devoicing: only before voiceless obstruent or geminate+voiceless (NOT すっぞ!)
    const nextVL = nxt && (
      (nxt.kind === "CV" && VOICELESS.has(nxt.c)) ||
      (nxt.kind === "Q" && nxt2 && nxt2.kind === "CV" && VOICELESS.has(nxt2.c))
    );
    const prevDev = events.length > 0 && events[events.length - 1].devoiced;
    const isFinalSu = isUttEnd && (d.c === "s" || d.c === "sh") && (d.v === "u" || d.v === "i");
    const devoiced = !flatTiming && !prevDev && (d.v === "i" || d.v === "u") && VOICELESS.has(d.c) && (isFinalSu || nextVL);
    if (devoiced) vd = Math.min(vd, 0.044 * rate);

    events.push({ ...d, a: curT, cEnd: curT + cd, e: curT + cd + vd, pLen, mood, fromEnd, beforeFinalQ: !!beforeFinalQ, devoiced, isPhraseStart, isPhraseEnd, isUttEnd });
    curT += cd + vd;
  }

  const totalT = curT + post;
  const fpz = FP / 1000.0;
  const n = Math.max(1, Math.ceil(totalT / fpz));

  const VAREA = {};
  const SL_BASIS = {};
  const effSmile = smile + (hasExclaim ? 0.14 : 0.0);
  const effSlLift = nama ? Math.max(-0.22, Math.min(0.22, slLift + (hasExclaim && slLift > 0.0 ? 0.025 : 0.0))) : 0.0;
  for (const v of ["a", "i", "u", "e", "o", ""]) {
    const baseA = buildVowelArea(v, effSmile);
    if (v) {
      const basis = buildSturmLiouvilleBasis(baseA);
      SL_BASIS[v] = basis;
      if (Math.abs(effSlLift) > 1e-6 && basis.modes.length >= 4) {
        for (let j = 5; j < M; j++) {
          baseA[j] = Math.max(0.22, Math.min(8.5, baseA[j] * Math.exp(effSlLift * basis.dShimmer[j])));
        }
      }
    }
    VAREA[v] = baseA;
  }
  const CPOST = buildConsPostures();

  const A_tr = Array.from({ length: n }, () => new Float64Array(M));
  const vel_tr = new Float64Array(n);
  const vo_tr = new Float64Array(n);
  const rd_tr = new Float64Array(n);
  const chink_tr = new Float64Array(n);
  const breathDyn_tr = new Float64Array(n).fill(1.0);
  const pLung_tr = new Float64Array(n);
  const fric_tr = new Float64Array(n);
  const sibAlvFric_tr = new Float64Array(n);
  const sibPalFric_tr = new Float64Array(n);
  const vSibAlv_tr = new Float64Array(n);
  const vSibPal_tr = new Float64Array(n);
  const vFricJ_tr = new Float64Array(n);
  const vFricZ_tr = new Float64Array(n);
  const vStop_tr = new Float64Array(n);
  const broadFric_tr = new Float64Array(n);
  const glotFric_tr = new Float64Array(n);
  const burst_tr = new Float64Array(n);
  const labPop_tr = new Float64Array(n);
  const fricJ_tr = new Int32Array(n).fill(-1);
  const stop_tr = new Float64Array(n);
  const affrStop_tr = new Float64Array(n);
  const vAffrSeal_tr = new Float64Array(n);
  const bareStart_tr = new Float64Array(n);
  const sigh_tr = new Float64Array(n);
  const scoop_tr = new Float64Array(n);
  const lipPart_tr = new Float64Array(n);
  const sibPalCav_tr = new Float64Array(n);
  const voicedBool = new Array(n).fill(false);

  // Precompute O(N + E) frame-to-event index and nearest-vowel lookups (eliminates O(N*E) scans)
  const nEv = events.length;
  const evIdx = new Int32Array(n).fill(-1);
  const nextVFrom = new Array(nEv + 1).fill(null);
  const prevVUpTo = new Array(nEv + 1).fill(null);
  for (let i = nEv - 1; i >= 0; i--) nextVFrom[i] = events[i].v ? events[i].v : nextVFrom[i + 1];
  for (let i = 0; i < nEv; i++) prevVUpTo[i + 1] = events[i].v ? events[i].v : prevVUpTo[i];
  const nextStartIdx = new Int32Array(n);
  {
    let ei = 0;
    for (let t = 0; t < n; t++) {
      const sec = (t + 0.5) * fpz;
      while (ei < nEv && events[ei].e <= sec) ei++;
      evIdx[t] = (ei < nEv && sec >= events[ei].a) ? ei : -1;
      nextStartIdx[t] = ei;
    }
  }

  const rawA = Array.from({ length: M }, () => new Float64Array(n));
  const vTrack = new Array(n);
  for (let t = 0; t < n; t++) {
    const sec = (t + 0.5) * fpz;
    const ei = evIdx[t];
    const ev = ei >= 0 ? events[ei] : null;
    let v = "a";
    let cPostKey = null;
    let cPostW = 0.0;
    let palW = 0.0;

    if (ev) {
      if (ev.v) v = ev.v;
      else if (ev.kind === "Q" || ev.kind === "N") {
        const nxt = events[ei + 1];
        const prv = events[ei - 1];
        v = nxt?.v || prv?.v || "a";
        if (ev.kind === "N" && ev.nPlace && CPOST[ev.nPlace]) {
          cPostKey = ev.nPlace;
          cPostW = 0.72;
        }
      } else {
        v = nextVFrom[ei + 1] || prevVUpTo[ei] || "a";
      }

      if (ev.kind === "CV" && ev.c) {
        const pl = effPlace(ev.c, ev.v, ev.pal);
        const mn = MANNER[ev.c];
        if (ev.c === "y") {
          cPostKey = "pal";
          cPostW = sec < ev.cEnd ? 0.90 : Math.max(0, 0.90 * (1.0 - (sec - ev.cEnd) / 0.034));
        } else if (ev.c === "w") {
          cPostKey = "lab";
          cPostW = sec < ev.cEnd ? 0.65 : Math.max(0, 0.65 * (1.0 - (sec - ev.cEnd) / 0.032));
        } else if (mn === "tap") {
          cPostKey = "r";
          cPostW = sec < ev.cEnd ? 0.85 : Math.max(0, 0.78 * Math.pow(Math.max(0, 1.0 - (sec - ev.cEnd) / 0.032), 1.3));
        } else if (pl && pl !== "glot" && CPOST[pl]) {
          cPostKey = pl;
          const isAlv = pl === "alv";
          const transDur = isAlv ? 0.026 : ((mn === "stop" || mn === "nas") ? 0.036 : 0.028);
          const peakW = isAlv ? 0.55 : ((mn === "stop" || mn === "nas") ? 0.76 : 0.62);
          if (sec < ev.cEnd) {
            cPostW = peakW;
          } else {
            const u = (sec - ev.cEnd) / transDur;
            cPostW = u < 1.0 ? peakW * Math.pow(1.0 - u, 1.35) : 0.0;
          }
        }
        if (ev.pal) {
          const alreadyPal = pl === "pal";
          const isBack = ev.v === "u" || ev.v === "o";
          if (sec < ev.cEnd) palW = (ev.c === "r") ? 0.28 : (alreadyPal && isBack ? 0.65 : 0.86);
          else {
            const pDur = alreadyPal ? (isBack ? 0.026 : 0.048) : 0.034;
            const pPeak = alreadyPal ? (isBack ? 0.50 : 0.88) : 0.82;
            const u = (sec - ev.cEnd) / pDur;
            palW = u < 1.0 ? pPeak * Math.pow(1.0 - u, 1.25) : 0.0;
          }
        }
      }
    } else {
      const ni = nextStartIdx[t];
      v = nextVFrom[ni] || prevVUpTo[ni] || "a";
    }

    vTrack[t] = v;
    const base = VAREA[v];
    const cp = cPostKey ? CPOST[cPostKey] : null;
    for (let j = 0; j < M; j++) {
      let val = base[j];
      if (cp && cPostW > 0.001) val = val * (1.0 - cPostW) + cp[j] * cPostW;
      if (palW > 0.001) val = val * (1.0 - palW) + VAREA.i[j] * palW;
      rawA[j][t] = val;
    }
  }

  const fastAmt = nama ? Math.max(0.0, Math.min(1.0, (0.85 - rate) / 0.35)) : 0.0;
  const effZeta = nama ? Math.max(0.75, Math.min(1.40, Number.isFinite(tdZeta) ? tdZeta : 0.96)) : 1.00;
  // Mechanism 4 Channel 3: Coherent 1/f pink/OU lip-smile & epilaryngeal micro-breathing (replaces rigid 0.65 Hz sine!)
  const pinkTract1 = new Float64Array(n);
  const pinkTract2 = new Float64Array(n);
  if (nama) {
    const pgA = makePinkGen(seed + 14923, 5, 0.24, fpz);
    const pgB = makePinkGen(seed + 19381, 5, 0.20, fpz);
    for (let t = 0; t < n; t++) { pinkTract1[t] = pgA(); pinkTract2[t] = pgB(); }
  }
  for (let j = 0; j < M; j++) {
    // Anatomical Task Dynamics stiffness gradient (Saltzman-Munhall):
    // epilarynx j<=4 (strictly zeta>=1.0), heavy pharynx/root j=5..14, tongue body j=15..24, agile tip/lips j=25..30.
    // fastAmt softens omegaN at fast speech (rate < 0.85) for natural undershoot; leadFrac=1.0 preserves exact CV phase!
    let sm;
    if (nama) {
      const omegaN = j <= 4 ? 140.0
        : (j <= 14 ? 130.0 - 30.0 * fastAmt
          : (j <= 24 ? 150.0 - 30.0 * fastAmt : 175.0 - 25.0 * fastAmt));
      const secZeta = j <= 4 ? Math.max(1.0, effZeta) : effZeta;
      sm = taskDyn(rawA[j], omegaN, secZeta, fpz, 1.0);
    } else {
      sm = smooth1(rawA[j], 18);
    }
    const c1 = Math.cos(0.14 * j), s1 = Math.sin(0.14 * j);
    for (let t = 0; t < n; t++) {
      let sway;
      if (nama) {
        const pMix = c1 * pinkTract1[t] + s1 * pinkTract2[t];
        sway = 1.0 + (j <= 4 ? 0.080 : 0.032) * pMix;
      } else {
        const sec = t * fpz;
        sway = 1.0 + (j <= 4 ? 0.095 : 0.030) * Math.sin(2 * Math.PI * (0.65 + 0.032 * j) * sec + j * 0.72);
      }
      A_tr[t][j] = Math.max(0.20, sm[t] * sway);
    }
  }

  const consKeys = Object.keys(CONS_LOC);
  const consAmt = {};
  const consMinA = {};
  for (const k of consKeys) {
    consAmt[k] = new Array(n).fill(0);
    consMinA[k] = new Array(n).fill(2.0);
  }

  // Keep open /a/ cleanly loudest so RQA LAM bestT stays on open /a/ (LAM <= 8%)!
  const V_PLUNG = { a: 1.12, o: 1.02, u: 1.06, i: 1.02, e: 1.08 };

  rd_tr.fill(rd_base);
  chink_tr.fill(0.36);
  for (let t = 0; t < n; t++) {
    const sec = (t + 0.5) * fpz;
    const ei = evIdx[t];
    const ev = ei >= 0 ? events[ei] : null;
    if (!ev || ev.kind === "pau") {
      vo_tr[t] = 0.0;
      pLung_tr[t] = 0.02;
      rd_tr[t] = rd_tail;
      // Pre-phonatory vocal-fold adduction before bare vowels (utterance-initial AND post-pause),
      // keeping preceding phrase tails untouched (pastPrev > 25ms) so 26ms rdSm starts cleanly at rd_base!
      let ni = ev ? (ei + 1) : nextStartIdx[t];
      while (ni < nEv && events[ni].kind === "pau") ni++;
      const nextEv = ni < nEv ? events[ni] : null;
      const nextBare = !!(nextEv && nextEv.isPhraseStart && nextEv.kind === "CV" && !nextEv.c && !nextEv.devoiced);
      if (nextBare) {
        const rem = nextEv.a - sec;
        const pastPrev = !ev || (sec - ev.a) > Math.min(0.025, Math.max(0.0, (ev.e - ev.a) * 0.25));
        if (pastPrev && rem >= 0.0 && rem < 0.032) {
          const preU = minJerk((0.032 - rem) / 0.020);
          rd_tr[t] = rd_tail + (rd_base - rd_tail) * preU;
          chink_tr[t] = 0.36 + (0.30 - 0.36) * preU;
        }
      } else if (nextEv && nextEv.isPhraseStart && nextEv.kind === "CV" && (nextEv.c === "z" || nextEv.c === "j" || nextEv.c === "d" || nextEv.c === "g" || nextEv.c === "b")) {
        // Silent articulatory pre-closure anticipation (Browman & Goldstein 1992): seal oral constriction 18ms before phonation starts so zero open-tract vowel leaks!
        const rem = nextEv.a - sec;
        const pastPrev = !ev || (sec - ev.a) > Math.min(0.035, Math.max(0.0, (ev.e - ev.a) * 0.35));
        if (pastPrev && rem >= 0.0 && rem < 0.018) {
          const npl = effPlace(nextEv.c, nextEv.v, nextEv.pal);
          if (npl && CONS_LOC[npl]) {
            consAmt[npl][t] = 1.0;
            consMinA[npl][t] = 0.006;
            stop_tr[t] = 1.0;
          }
        }
      }
      continue;
    }

    pLung_tr[t] = 0.95 + 0.05 * Math.sin(2 * Math.PI * 0.9 * sec);

    if (ev.kind === "Q") {
      vo_tr[t] = 0.0;
      if (ev.glottalStop) {
        // Phrase-final cute glottal check ("えっ!", "かわいいっ!"): crisp vocal-fold stop + tiny air release
        const uQ = (sec - ev.a) / Math.max(0.005, ev.e - ev.a);
        stop_tr[t] = uQ < 0.72 ? 0.90 : 0.0;
        pLung_tr[t] *= uQ < 0.35 ? 0.45 : 0.12;
        if (uQ > 0.65) glotFric_tr[t] = 0.16 * Math.sin(Math.PI * (uQ - 0.65) / 0.35);
        fricJ_tr[t] = 2;
      } else {
        stop_tr[t] = 1.0;
        const pl = ev.nextPlace;
        if (pl && CONS_LOC[pl]) {
          consAmt[pl][t] = 1.0;
          consMinA[pl][t] = 0.010;
          fricJ_tr[t] = CONS_LOC[pl].inj;
          if (pl !== "lab") lipPart_tr[t] = 1.0;
        } else {
          fricJ_tr[t] = 2;
        }
      }
      continue;
    }

    if (ev.kind === "N") {
      vo_tr[t] = 0.84;
      voicedBool[t] = true;
      vel_tr[t] = 1.85;
      const npl = ev.nPlace || "uvl";
      consAmt[npl][t] = 1.0;
      consMinA[npl][t] = 0.010;
      if (npl === "alv") lipPart_tr[t] = 0.8;
      rd_tr[t] = rd_base + 0.14;
      pLung_tr[t] *= 1.14;
      continue;
    }

    const inCons = sec < ev.cEnd;
    const pl = effPlace(ev.c, ev.v, ev.pal);
    const mn = MANNER[ev.c];
    const isAlvSib = ALV_SIB.has(ev.c);
    const isPalSib = PAL_SIB.has(ev.c);

    if (inCons && pl) {
      const u = (sec - ev.a) / Math.max(0.005, ev.cEnd - ev.a);
      if (isPalSib && mn !== "affr") sibPalCav_tr[t] = 1.0;
      if (pl !== "lab" && pl !== "glot") lipPart_tr[t] = 1.0;

      if (pl === "glot") {
        vo_tr[t] = u > 0.78 ? (u - 0.78) / 0.22 : 0.0;
        rd_tr[t] = 2.35;
        const hf = 0.90 * Math.pow(Math.sin(Math.PI * Math.min(1, u)), 1.55);
        fric_tr[t] = hf;
        glotFric_tr[t] = hf;
        fricJ_tr[t] = 2;
      } else if (ev.c === "h" && pl === "pal") {
        vo_tr[t] = u > 0.72 ? Math.pow((u - 0.72) / 0.28, 1.35) : 0.0;
        consAmt.pal[t] = 0.36 * Math.sin(Math.PI * Math.min(1, u));
        consMinA.pal[t] = 0.50;
        const hf = 0.56 * Math.pow(Math.sin(Math.PI * Math.min(1, u)), 1.85);
        fric_tr[t] = hf;
        sibPalFric_tr[t] = hf * 0.45;
        glotFric_tr[t] = hf * 0.65;
        sibPalCav_tr[t] = 0.45;
        fricJ_tr[t] = CONS_LOC.pal.inj;
      } else if (mn === "stop") {
        const isVL = VOICELESS.has(ev.c);
        const isVel = pl === "vel" || pl === "velA" || pl === "velF";
        const holdEnd = isVL ? (isVel ? 0.50 : 0.56) : 0.56;
        if (u < holdEnd) {
          vo_tr[t] = isVL ? 0.0 : 0.42;
          if (!isVL) { voicedBool[t] = true; pLung_tr[t] *= 0.85; rd_tr[t] = Math.min(2.05, rd_base + 0.22); }
          consAmt[pl][t] = 1.0;
          consMinA[pl][t] = 0.005;
          stop_tr[t] = 1.0;
          fricJ_tr[t] = CONS_LOC[pl].inj;
        } else {
          const rel = (u - holdEnd) / (1.0 - holdEnd);
          const vlStart = isVel ? 0.70 : 0.65;
          const vdWait = 0.12;
          vo_tr[t] = isVL
            ? (rel > vlStart ? (rel - vlStart) / (1.0 - vlStart) : 0.0)
            : (rel < vdWait ? 0.36 : (0.36 + 0.64 * Math.min(1.0, (rel - vdWait) / (1.0 - vdWait))));
          if (!isVL || rel > vlStart) voicedBool[t] = true;
          consAmt[pl][t] = Math.max(0.0, 1.0 - 1.85 * rel);
          consMinA[pl][t] = 0.18 + 0.68 * rel;
          const bEnv = Math.sin(Math.PI * Math.min(1.0, rel * 1.18));
          if (pl === "lab") {
            lipPart_tr[t] = Math.min(0.70, rel * 1.18);
            // Crisp bilabial release transient paired with voiced closure bar on /b/ and VOT aspiration on /p/
            labPop_tr[t] = 0.44 * bEnv;
            if (isVL && rel < vlStart) glotFric_tr[t] = 0.38 * bEnv;
          } else {
            // Cavity-gain-compensated bursts: velar injects behind a +12 dB front cavity, alveolar at 0 dB near teeth
            const bAmp = isVL ? (pl === "alv" ? 0.96 : 0.70) : (pl === "alv" ? 0.88 : 0.52);
            burst_tr[t] = bAmp * bEnv;
          }
          fricJ_tr[t] = CONS_LOC[pl].inj;
        }
      } else if (mn === "affr") {
        vo_tr[t] = 0.0;
        const holdEnd = isAlvSib ? 0.39 : 0.30;
        if (u < holdEnd) {
          consAmt[pl][t] = 1.0;
          consMinA[pl][t] = 0.005;
          stop_tr[t] = 1.0;
          affrStop_tr[t] = 1.0;
        } else {
          const fr = (u - holdEnd) / (1.0 - holdEnd);
          // Sublingual palatal cavity opens smoothly after the coronal release burst so the burst stays naturally broadband while frication resonates at 4.4 kHz!
          if (isPalSib && fr >= 0.14) sibPalCav_tr[t] = minJerk((fr - 0.14) / 0.24);
          consAmt[pl][t] = Math.max(0.76, 1.0 - 0.32 * fr);
          consMinA[pl][t] = 0.06 + 0.06 * fr;
          if (fr < 0.36) {
            const bEnv = Math.sin(Math.PI * Math.min(1.0, fr / 0.36));
            burst_tr[t] = (isAlvSib ? 0.93 : 0.88) * bEnv;
          }
          const af = 0.96 * Math.pow(Math.sin(Math.PI * Math.min(1, fr)), 1.45);
          fric_tr[t] = af;
          if (isAlvSib) sibAlvFric_tr[t] = af;
          else sibPalFric_tr[t] = af;
        }
        fricJ_tr[t] = CONS_LOC[pl].inj;
      } else if (mn === "fric") {
        const isVL = VOICELESS.has(ev.c);
        const prevEv = ei > 0 ? events[ei - 1] : undefined;
        const isWordInit = !prevEv || prevEv.kind === "pau" || prevEv.kind === "N";
        // Japanese /z,j/ (Vance 2008): voiced affricates [dz]/[dʑ] word-initially & after /N/, compact voiced pre-stop intervocalically
        const isAffrStart = !isVL && (ev.c === "j" || ev.c === "z");
        const affrCut = (ev.c === "j") ? (isWordInit ? 0.28 : 0.22) : (isWordInit ? 0.30 : 0.22);
        if (isAffrStart && u < affrCut) {
          vo_tr[t] = isWordInit ? 0.76 : 0.70;
          pLung_tr[t] *= 0.96;
          rd_tr[t] = 1.90;
          voicedBool[t] = true;
          consAmt[pl][t] = 1.0;
          consMinA[pl][t] = 0.006;
          stop_tr[t] = 1.0;
          vAffrSeal_tr[t] = 1.0;
          // Sealed oral closure + strong <400Hz neck-wall voice bar -> unmistakable voiced [d] onset before sibilant release (zero roughness!)
          vStop_tr[t] = 0.0;
          fricJ_tr[t] = CONS_LOC[pl].inj;
        } else {
          const fu = isAffrStart ? (u - affrCut) / (1.0 - affrCut) : u;
          vo_tr[t] = isVL ? 0.0 : (ev.c === "j" ? 0.50 : 0.48);
          if (!isVL) {
            voicedBool[t] = true;
            rd_tr[t] = 2.06;
            pLung_tr[t] *= (ev.c === "j") ? 0.91 : 0.93;
            if (ev.c === "j") vFricJ_tr[t] = 1.0;
            else vFricZ_tr[t] = 1.0;
            // Subtle voiced coronal release transient word-initially (intervocalic stays softly voiced so 400Hz /j/ never becomes voiceless /ch/!)
            if (isAffrStart && fu < 0.20) {
              const bEnv = Math.sin(Math.PI * Math.min(1.0, fu / 0.20));
              const bG = isWordInit ? (ev.c === "j" ? 0.28 : 0.26) : (ev.c === "j" ? 0.10 : 0.0);
              if (bG > 0.0) burst_tr[t] = bG * bEnv;
            }
          }
          // Energy-matched C2 minJerk for voiceless fricatives; compact C2 window (ends cleanly at fu=0.76) so voiced [dz]/[dʑ] never bleeds into following vowel!
          const mjF = fu < 0.50 ? minJerk(fu * 2.0) : minJerk((1.0 - fu) * 2.0);
          const envF = isVL
            ? Math.pow(mjF, 0.86)
            : (minJerk(fu / 0.20) * minJerk((0.76 - fu) / 0.24));
          consAmt[pl][t] = 0.96;
          consMinA[pl][t] = (ev.c === "f") ? 0.16 : (isVL ? 0.08 : 0.068);
          const fv = (isVL ? (ev.c === "f" ? 0.70 : 0.94) : (ev.c === "j" ? 0.86 : 0.86)) * envF;
          fric_tr[t] = fv;
          if (ev.c === "f") {
            lipPart_tr[t] = 0.45;
            labPop_tr[t] = 0.18 * envF;
            broadFric_tr[t] = fv;
          } else if (isVL && isAlvSib) {
            sibAlvFric_tr[t] = fv;
          } else if (isVL && isPalSib) {
            sibPalFric_tr[t] = fv;
          } else if (!isVL && isAlvSib) {
            vSibAlv_tr[t] = fv;
          } else if (!isVL && isPalSib) {
            vSibPal_tr[t] = fv;
            vSibAlv_tr[t] = fv * 0.10;
          } else {
            broadFric_tr[t] = fv;
          }
          fricJ_tr[t] = CONS_LOC[pl].inj;
        }
      } else if (mn === "nas") {
        const soft = ev.isPhraseStart ? (0.45 + 0.55 * minJerk((sec - ev.a) / 0.016)) : 1.0;
        vo_tr[t] = 0.84 * soft;
        voicedBool[t] = true;
        vel_tr[t] = 1.85;
        consAmt[pl][t] = 1.0;
        consMinA[pl][t] = 0.010;
        rd_tr[t] = rd_base + 0.14;
        pLung_tr[t] *= 1.14;
      } else if (mn === "tap") {
        const flap = Math.sin(Math.PI * u);
        const soft = ev.isPhraseStart ? (0.35 + 0.65 * minJerk((sec - ev.a) / 0.022)) : 1.0;
        vo_tr[t] = (0.92 - 0.44 * flap) * soft;
        pLung_tr[t] *= (1.00 - 0.38 * flap) * soft;
        voicedBool[t] = true;
        consAmt[pl][t] = Math.min(1.0, flap * 1.04);
        consMinA[pl][t] = 0.060;
      } else if (mn === "glide") {
        const soft = ev.isPhraseStart ? (0.28 + 0.72 * minJerk((sec - ev.a) / 0.028)) : 1.0;
        vo_tr[t] = 0.92 * soft;
        pLung_tr[t] *= 0.94 * soft;
        voicedBool[t] = true;
      }
    } else {
      const vU = (sec - ev.cEnd) / Math.max(0.01, ev.e - ev.cEnd);
      if (ev.devoiced) {
        vo_tr[t] = 0.0;
        if (ev.isUttEnd || ev.isPhraseEnd) {
          // Hold preceding vowel's scoop value so 16ms scoopSm never pulls the phrase-final scoop peak back down!
          scoop_tr[t] = t > 0 ? scoop_tr[t - 1] : 0.0;
        }
        if (isPalSib) sibPalCav_tr[t] = 0.90;
        if (pl !== "lab" && pl !== "glot") lipPart_tr[t] = 0.85;
        const df = ((isAlvSib || isPalSib) ? 0.74 : 0.55) * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * vU)), 1.7);
        fric_tr[t] = df;
        if (isAlvSib) sibAlvFric_tr[t] = df;
        else if (isPalSib) sibPalFric_tr[t] = df;
        else glotFric_tr[t] = df;
        fricJ_tr[t] = (pl && CONS_LOC[pl]) ? CONS_LOC[pl].inj : 2;
        rd_tr[t] = 2.25;
      } else {
        const bareStart = ev.isPhraseStart && !ev.c;
        const softOn = 1.0;
        if (bareStart && (sec - ev.a) < 0.024) {
          bareStart_tr[t] = 1.0 - minJerk((sec - ev.a) / 0.024);
        }
        vo_tr[t] = bareStart ? (0.14 + 0.86 * minJerk((sec - ev.a) / 0.011)) : 1.0;
        if (ev.beforeFinalQ && vU > 0.82) {
          vo_tr[t] *= 1.0 - 0.85 * minJerk((vU - 0.82) / 0.18);
        }
        voicedBool[t] = true;
        const nxtEv = ei + 1 < nEv ? events[ei + 1] : null;
        const isVoicedUttEnd = ev.isUttEnd || !!(nxtEv && nxtEv.devoiced && nxtEv.isUttEnd);
        const isVoicedPhrEnd = ev.isPhraseEnd || !!(nxtEv && nxtEv.devoiced && nxtEv.isPhraseEnd);
        const longEnd = !ev.beforeFinalQ && (isVoicedUttEnd || (isVoicedPhrEnd && ev.pLen >= 2));
        const sTailStart = hz > 360.0 ? 0.64 : 0.50;
        let sTail = 0.0;
        if (longEnd && vU > sTailStart) {
          sTail = minJerk((vU - sTailStart) / (1.0 - sTailStart)) * (isVoicedUttEnd ? 1.0 : 0.52);
        }
        if (ev.tilde) sTail = Math.min(1.0, sTail + 0.34 * minJerk(vU));
        if (ev.mood === 3 && ev.fromEnd <= 1) sTail = Math.min(1.0, sTail + 0.32 * (ev.fromEnd === 0 ? 1.0 : 0.45));

        // Organic phrase-final cute scoop on the actual last voiced vowel (blended minJerk + scU^2 keeps zero-velocity entry AND non-flat end momentum so RQA LAM stays <= 6%!)
        const scWin = (isVoicedUttEnd && !ev.isUttEnd) ? 0.095 : 0.112;
        if (longEnd && (ev.e - sec) < scWin) {
          const scU = 1.0 - Math.max(0, ev.e - sec) / scWin;
          const moodBoost = ev.mood === 2 ? 1.25 : (ev.mood === 3 ? 0.35 : 1.0);
          const preDevBoost = (isVoicedUttEnd && !ev.isUttEnd) ? 2.22 : (isVoicedUttEnd ? 1.25 : 0.90);
          scoop_tr[t] = (0.45 * minJerk(scU) + 0.55 * scU * scU) * preDevBoost * moodBoost;
        }
        const edge = 0.16 * minJerk(1.0 - vU * 4.5) + 0.18 * minJerk((vU - 0.82) / 0.18);
        sigh_tr[t] = sTail;
        rd_tr[t] = rd_base + (rd_tail - rd_base) * sTail + 0.18 * edge + (ev.tilde ? 0.28 : 0.0) + (ev.mood === 3 && ev.fromEnd === 0 ? 0.36 : 0.0);

        const afterVL = VOICELESS.has(ev.c);
        const afterSoftC = ev.c === "h" || ev.c === "f";
        const afterGlide = ev.c === "w" || ev.c === "y";
        const onsetRamp = afterSoftC ? Math.min(1.0, 0.45 + 1.45 * vU) : (afterVL ? Math.min(1.0, 0.66 + 1.40 * vU) : (afterGlide && ev.isPhraseStart ? Math.min(1.0, 0.90 + 0.25 * vU) : Math.min(1.0, 0.90 + 0.30 * vU)));
        const nucShape = Math.sin(Math.PI * Math.pow(Math.max(0, Math.min(1, vU)), 0.80));
        const moodGain = ev.mood === 2 ? 1.07 : (ev.mood === 3 && ev.fromEnd <= 1 ? (ev.fromEnd === 0 ? 0.72 : 0.86) : 1.0);
        pLung_tr[t] *= softOn * onsetRamp * (0.87 + 0.19 * nucShape) * (V_PLUNG[ev.v] || 1.06) * moodGain;

        // Posterior glottal chink (Starr 2015 Sweet Voice): silky H1-H2 without blunting anterior closing snap; smooth onset ramp on bareStart & /a/!
        const chinkTgt = ev.v === "a" ? 0.45 : 0.51;
        const chinkRamp = (bareStart || ev.v === "a") ? minJerk((sec - ev.cEnd) / 0.020) : 1.0;
        chink_tr[t] = 0.30 + (chinkTgt - 0.30) * chinkRamp;
        if (ev.tilde) chink_tr[t] += 0.06;
        // Dynamic breath profile centered at 0.96 on vowel cores and blooming organically on edges/tails
        breathDyn_tr[t] = 0.96 + 0.52 * sTail + 0.22 * edge + (ev.tilde ? 0.22 : 0.0);
        if (longEnd && vU > 0.58) {
          pLung_tr[t] *= 1.0 - (isVoicedUttEnd ? 0.42 : 0.22) * minJerk((vU - 0.58) / 0.42);
        }
      }
    }
  }

  // Mechanism 4 Channel 2: Seeded 1/f pink/OU dynamic modulation of posterior chink & breath jet
  if (nama) {
    const pgBreath = makePinkGen(seed + 11003, 5, 0.18, fpz);
    for (let t = 0; t < n; t++) {
      const pb = pgBreath();
      if (voicedBool[t]) {
        const bareShield = 1.0 - bareStart_tr[t];
        chink_tr[t] = Math.max(0.22, Math.min(0.62, chink_tr[t] + 0.065 * pb * bareShield));
        breathDyn_tr[t] = Math.max(0.45, Math.min(1.65, breathDyn_tr[t] * (1.0 + 0.28 * pb * bareShield)));
      }
    }
  }

  const lipPartSm = smooth1(Array.from(lipPart_tr), 14);
  const sibPalCavSm = smooth1(Array.from(sibPalCav_tr), 14);
  for (let t = 0; t < n; t++) {
    const lp = lipPartSm[t];
    if (lp > 0.01) {
      for (let j = 27; j < M; j++) {
        const target = Math.max(A_tr[t][j], 2.15);
        A_tr[t][j] = A_tr[t][j] * (1.0 - lp) + target * lp;
      }
    }
    const scv = sibPalCavSm[t];
    if (scv > 0.01) {
      // Young-female anatomical sublingual cavity (1.85 cm²): uniform 4.2-4.6 kHz across し/しゃ/しゅ/しょ/ち/ちょ/じ!
      for (let j = 25; j <= 27; j++) A_tr[t][j] = A_tr[t][j] * (1.0 - scv) + 1.85 * scv;
      for (let j = 28; j < M; j++) A_tr[t][j] = A_tr[t][j] * (1.0 - scv) + 2.15 * scv;
    }
  }

  const maxConsSm = new Float64Array(n);
  for (const pl of consKeys) {
    const smAmt = smooth1(consAmt[pl], 10);
    const loc = CONS_LOC[pl];
    for (let t = 0; t < n; t++) {
      const a = smAmt[t];
      if (a > maxConsSm[t]) maxConsSm[t] = a;
      if (a <= 0.005) continue;
      const targetMin = consMinA[pl][t];
      for (let j = 5; j < M; j++) {
        const g = Math.exp(-0.5 * Math.pow((j - loc.c) / loc.w, 2));
        const w = Math.min(1.0, a * g);
        if (w > 0.001) A_tr[t][j] = A_tr[t][j] * (1.0 - w) + targetMin * w;
      }
    }
  }

  const velSm = smooth1(Array.from(vel_tr), 16);
  const voSm = smooth1(Array.from(vo_tr), 12);
  const rdSm = smooth1(Array.from(rd_tr), 26);
  const chinkSm = smooth1(Array.from(chink_tr), 26);
  const breathDynSm = smooth1(Array.from(breathDyn_tr), 24);
  const bareStartSm = smooth1(Array.from(bareStart_tr), 10);
  const pLungSm = smooth1(Array.from(pLung_tr), 16);
  // Nearest-neighbor fill for fricJ_tr so smooth 46ms sibilant ramps always inject at the exact constriction!
  {
    const filled = new Int32Array(fricJ_tr);
    for (let t = 0; t < n; t++) {
      if (filled[t] >= 0) continue;
      let best = 27, bestD = 9999;
      for (let d = 1; d <= 12; d++) {
        if (t + d < n && fricJ_tr[t + d] >= 0) { best = fricJ_tr[t + d]; bestD = d; break; }
        if (t - d >= 0 && fricJ_tr[t - d] >= 0) { best = fricJ_tr[t - d]; bestD = d; break; }
      }
      filled[t] = bestD < 9999 ? best : 27;
    }
    for (let t = 0; t < n; t++) fricJ_tr[t] = filled[t];
  }

  const fricSm = smooth1(Array.from(fric_tr), 46);
  const sibAlvFricSm = smooth1(smooth1(Array.from(sibAlvFric_tr), 36), 36);
  const sibPalFricSm = smooth1(smooth1(Array.from(sibPalFric_tr), 36), 36);
  const vSibAlvSm = smooth1(smooth1(Array.from(vSibAlv_tr), 16), 16);
  const vSibPalSm = smooth1(smooth1(Array.from(vSibPal_tr), 16), 16);
  const vFricJSm = smooth1(Array.from(vFricJ_tr), 18);
  const vFricZSm = smooth1(Array.from(vFricZ_tr), 18);
  const vStopSm = smooth1(Array.from(vStop_tr), 14);
  {
    // Causal airflow seal during [d] pre-stop closure of voiced affricates [dz]/[dʑ] (prevents sibilant bleed into preceding vowel!)
    let vOpen = 4;
    for (let t = 0; t < n; t++) {
      if (vAffrSeal_tr[t] > 0.5) {
        vOpen = 0;
        vSibAlvSm[t] = 0.0;
        vSibPalSm[t] = 0.0;
      } else if (vOpen < 4) {
        vOpen++;
        const s = Math.pow(minJerk(vOpen / 4.0), 0.45);
        vSibAlvSm[t] *= s;
        vSibPalSm[t] *= s;
      }
    }
  }
  const broadFricSm = smooth1(Array.from(broadFric_tr), 36);
  const glotFricSm = smooth1(Array.from(glotFric_tr), 38);
  const burstSm = smooth1(Array.from(burst_tr), 14);
  const labPopSm = smooth1(Array.from(labPop_tr), 14);
  const stopSm = smooth1(Array.from(stop_tr), 10);
  // Power-domain C2 minimum-jerk causal airflow seal strictly for affricate holds (ts & ch, NEVER geminate Q!):
  // Keeps stop gap 100% silent, lets coronal release burst lead cleanly, then opens sibilant smoothly in power domain!
  {
    const sealFrames = Math.max(5, Math.min(7, Math.round(6.0 * Math.min(1.15, Math.max(0.75, rate)))));
    let openFrames = sealFrames;
    for (let t = 0; t < n; t++) {
      if (affrStop_tr[t] > 0.5) {
        openFrames = 0;
        sibAlvFricSm[t] = 0.0;
        sibPalFricSm[t] = 0.0;
      } else if (openFrames < sealFrames) {
        openFrames++;
        const s = Math.pow(minJerk(openFrames / sealFrames), 0.38);
        sibAlvFricSm[t] *= s;
        sibPalFricSm[t] *= s;
      }
    }
  }
  const sighSm = smooth1(Array.from(sigh_tr), 30);
  // Hold phrase-end scoop peak across trailing unvoiced/pause boundary so 16ms smoothing never drags the scoop peak back down!
  for (let t = 1; t < n; t++) {
    if (scoop_tr[t] === 0.0 && !voicedBool[t] && scoop_tr[t - 1] > 0.25) {
      scoop_tr[t] = scoop_tr[t - 1] * 0.96;
    }
  }
  const scoopSm = smooth1(Array.from(scoop_tr), 16);

  let f0_fr;
  const morasForRule = events.map(e => ({ t: e.raw, kind: e.kind, c: e.c || "", v: e.v, a: e.a, b: e.cEnd, e: e.e }));
  if (flatHz) {
    f0_fr = new Array(n).fill(flatHz);
  } else if (uta_hz && uta_hz.length) {
    f0_fr = new Array(n).fill(uta_hz[0]);
    const nonPau = events.filter(e => e.kind !== "pau");
    for (let t = 0; t < n; t++) {
      const sec = (t + 0.5) * fpz;
      let val = uta_hz[0];
      for (let i = 0; i < nonPau.length; i++) {
        if (sec >= nonPau[i].a && sec <= nonPau[i].e) { val = uta_hz[Math.min(i, uta_hz.length - 1)]; break; }
        if (sec > nonPau[i].e) val = uta_hz[Math.min(i, uta_hz.length - 1)];
      }
      f0_fr[t] = val;
    }
    f0_fr = smooth1(f0_fr, 45);
  } else {
    const accentKw = { phrases: annPhrases, question: /[?？]$/.test(String(text || "").trim()) };
    f0_fr = f0Rule(morasForRule, n, Object.assign({}, ACCENT_KAWAII, { reg: hz }, accentKw));
  }

  {
    const rngF0 = makeRng(seed + 7919);
    const pgF0 = makePinkGen(seed + 7919, 5, 0.028, fpz);
    const cf0OnArr = new Float64Array(n);
    const cf0ObsArr = new Float64Array(n);
    const vibArr = new Float64Array(n);
    let cf0On = 0.0, cf0Obs = 0.0, mu1 = 0.0, mu2 = 0.0, vibPh = 0.4;
    const decay = Math.exp(-fpz / 0.030);
    for (let t = 0; t < n; t++) {
      const vNow = voicedBool[t] ? 1 : 0;
      const vPrev = t > 0 && voicedBool[t - 1] ? 1 : 0;
      const sec = (t + 0.5) * fpz;
      const ei = evIdx[t];
      const ev = ei >= 0 ? events[ei] : null;
      // Aerodynamic transglottal pressure drop during voiced sibilants (smooth entry + critically damped taskDyn removes 1-frame pitch cliff while preserving post-stop onset cues!)
      if (ev && ev.kind === "CV" && (ev.c === "j" || ev.c === "z") && sec < ev.cEnd) {
        cf0Obs = cf0Obs * 0.55 + (ev.c === "j" ? -1.5 : -0.6) * 0.45;
        cf0On *= decay;
      } else {
        cf0Obs *= decay;
        if (vNow && !vPrev) {
          if (ev && ev.isPhraseStart) cf0On = flatHz ? -0.30 : -0.50;
          else cf0On = (ev && VOICED_OBS.has(ev.c)) ? -1.15 : (flatHz ? 0.35 : 1.25);
        } else {
          cf0On *= decay;
        }
      }
      const g = (rngF0.random() + rngF0.random() + rngF0.random() - 1.5) * 0.82;
      const muNew = 0.80 * mu1 - 0.28 * mu2 + 0.31 * g;
      mu2 = mu1; mu1 = muNew;
      const pink = pgF0();
      // Mechanism 4 Channel 1: 1/f pink/OU neural micro-dynamics (H ≈ 0.75) + tail/tilde-only FM-jittered blooming vibrato
      const tailVibW = ev
        ? ((ev.tilde ? 1.0 : 0.0) + (ev.kind === "long" ? 0.65 : 0.0) + ((ev.isUttEnd || (ev.isPhraseEnd && ev.pLen >= 2)) ? 0.75 : 0.0))
        : 0.0;
      vibPh += 2.0 * Math.PI * (5.3 + 0.85 * pink) * fpz;
      const vibAmp = flatHz ? 0.0 : (0.24 + 0.22 * Math.min(1.0, tailVibW));
      const tildeSwell = (ev && ev.tilde) ? 0.65 * Math.sin(Math.PI * Math.max(0, Math.min(1, (sec - ev.a) / Math.max(0.01, ev.e - ev.a)))) : 0.0;
      const hiF0Calm = nama && f0_fr[t] > 432.0 ? Math.min(1.0, (f0_fr[t] - 432.0) / 80.0) : 0.0;
      const pinkGain = (flatHz ? 0.42 : 0.46) * (1.0 - 0.18 * hiF0Calm);
      const muGain = flatHz ? 0.55 : (1.32 - 0.26 * hiF0Calm);
      const microVib = nama
        ? (vibAmp * Math.sin(vibPh) + pinkGain * pink + muGain * mu1)
        : ((0.38 + 0.14 * Math.min(1.0, tailVibW)) * Math.sin(2 * Math.PI * 5.4 * sec + 0.4) + 1.38 * mu1);
      const scLift = (flatHz ? 0.18 : 1.0) * scoop * scoopSm[t];
      cf0OnArr[t] = cf0On;
      cf0ObsArr[t] = cf0Obs;
      vibArr[t] = microVib + scLift + tildeSwell;
    }
    const cf0ObsSm = taskDyn(cf0ObsArr, 110.0, 1.0, fpz, 0.90);
    const cf0Sm = new Float64Array(n);
    for (let t = 0; t < n; t++) cf0Sm[t] = cf0OnArr[t] + cf0ObsSm[t];
    for (let t = 0; t < n; t++) f0_fr[t] *= Math.pow(2.0, (cf0Sm[t] + vibArr[t]) / 12.0);
  }

  const airTr = new Float64Array(n).fill(1.0);
  let breathExcess = 0.0;
  let lowPitchFactor = 0.0;

  if (nama) {
    breathExcess = Math.max(0.0, (aspMid - 0.22) / 0.83) * 0.65 + Math.max(0.0, (rd_base - 1.55) / 1.35) * 0.35;
    lowPitchFactor = Math.max(0.0, Math.min(1.0, (240.0 - hz) / 110.0));

    // 1) Finite-lung air reservoir (V_lung) + crisp breathy soft-onset ramp (~45-55ms max so first mora stays sharp)
    const cap = Math.max(0.3, lungCap);
    const baseDrain = 0.032 / cap;
    const leakDrain = (0.42 * breathExcess) / cap;
    const inhaleRate = 1.75;
    const softAttackSec = 0.010 + 0.032 * breathExcess + 0.015 * breathExcess * lowPitchFactor;

    const onsetEnv = new Float64Array(n);
    const isSpeakingArr = new Uint8Array(n);
    let air = 1.0;
    let activeRunSec = 0.0;
    let silentRunSec = 0.5;

    for (let t = 0; t < n; t++) {
      const flowAct = Math.max(voSm[t], 0.7 * fricSm[t], 0.4 * burstSm[t]);
      const isSp = Math.max(voSm[t], fricSm[t], stopSm[t], burstSm[t], labPopSm[t]) > 0.05;
      isSpeakingArr[t] = isSp ? 1 : 0;
      if (isSp) {
        if (flowAct > 0.05) {
          const flow = baseDrain * flowAct + leakDrain * (0.40 * flowAct + 0.60 * voSm[t]) * (1.0 + 0.55 * sighSm[t]);
          air = Math.max(0.22, air - flow * fpz);
        }
        if (silentRunSec > 0.08) activeRunSec = 0.0;
        activeRunSec += fpz;
        silentRunSec = 0.0;
      } else {
        air = Math.min(1.0, air + inhaleRate * (1.0 - air * 0.30) * fpz);
        silentRunSec += fpz;
        if (silentRunSec > 0.08) activeRunSec = 0.0;
      }
      airTr[t] = air;

      if (breathExcess > 0.02 && isSp && activeRunSec < softAttackSec) {
        const u = activeRunSec / softAttackSec;
        const baseOn = 0.32 + 0.68 * minJerk(u);
        // Do not stack breathy onsetEnv on bareStart vowels (already shaped by bareStart C2 minJerk onset!)
        onsetEnv[t] = baseOn + (1.0 - baseOn) * Math.min(1.0, bareStart_tr[t] * 1.4);
      } else {
        onsetEnv[t] = 1.0;
      }
    }

    // Smooth high-register head-voice / falsetto envelope over 26ms laryngeal time constant (zero 1-frame rdSm cliffs!)
    const falsRaw = new Float64Array(n);
    for (let t = 0; t < n; t++) {
      if (f0_fr[t] > 365.0) {
        const obsAmt = Math.min(1.0, Math.max(vFricJSm[t], vFricZSm[t], vStopSm[t], stopSm[t] * Math.min(1.0, voSm[t] * 2.5)));
        const obsKeep = 1.0 - 0.85 * minJerk(obsAmt);
        const bareHold = 1.0 - 0.72 * bareStart_tr[t];
        falsRaw[t] = Math.min(1.0, (f0_fr[t] - 365.0) / 125.0) * obsKeep * bareHold;
      }
    }
    const falsSm = smooth1(Array.from(falsRaw), 26);

    // Apply elastic lung pressure taper, soft onset (voiced phrase starts only!), consonant lung-pressure coupling, dF0/dP_sub, and high-register falsetto
    for (let t = 0; t < n; t++) {
      const a = airTr[t];
      const lowAir = Math.max(0.0, (0.88 - a) / 0.66);
      const lungPresScale = 1.0 - (0.05 + 0.34 * breathExcess) * Math.pow(lowAir, 1.15);

      const openCap = breathExcess > 0.05 && pLungSm[t] > 1.0
        ? (1.0 + (pLungSm[t] - 1.0) * (1.0 - 0.65 * breathExcess))
        : pLungSm[t];
      pLungSm[t] = openCap * lungPresScale * onsetEnv[t];

      const sibScale = lungPresScale * (1.0 - 0.24 * lowPitchFactor);
      if (sibScale < 0.999) {
        sibAlvFricSm[t] *= sibScale;
        sibPalFricSm[t] *= sibScale;
        vSibAlvSm[t] *= sibScale;
        vSibPalSm[t] *= sibScale;
      }
      if (lungPresScale < 0.999) {
        broadFricSm[t]  *= lungPresScale;
        glotFricSm[t]   *= lungPresScale;
        burstSm[t]      *= lungPresScale;
        labPopSm[t]     *= lungPresScale;
      }

      if (breathExcess > 0.05 && lowAir > 0.05) {
        rdSm[t] = Math.min(3.7, rdSm[t] + 0.38 * breathExcess * lowAir);
      }

      // Subglottal pressure -> F0 physiological coupling (dF0 / dP_sub)
      if (!flatHz && !(uta_hz && uta_hz.length) && lowAir > 0.02) {
        const dropSt = 0.52 * (0.22 + 0.78 * breathExcess) * Math.pow(lowAir, 1.2);
        f0_fr[t] *= Math.pow(2.0, -dropSt / 12.0);
      }

      const falsAmt = falsSm[t];
      if (falsAmt > 1e-4) {
        rdSm[t] = Math.min(3.7, rdSm[t] + 0.52 * falsAmt);
        chinkSm[t] = Math.min(0.62, chinkSm[t] + 0.11 * falsAmt);
        sighSm[t] = Math.min(1.0, sighSm[t] + 0.14 * falsAmt);
      }
    }

    // 2) Natural mid-utterance inhale sound ("su...") strictly inside true pauses, ending 35ms before next consonant
    if (inhale > 0.01) {
      let lastSp = -1, firstSp = -1;
      for (let t = 0; t < n; t++) {
        if (isSpeakingArr[t]) {
          if (firstSp < 0) firstSp = t;
          lastSp = t;
        }
      }
      if (firstSp >= 0 && lastSp > firstSp) {
        let t = firstSp;
        while (t < lastSp) {
          if (isSpeakingArr[t]) { t++; continue; }
          const p0 = t;
          while (t < lastSp && !isSpeakingArr[t]) t++;
          const p1 = t;
          const pauDur = (p1 - p0) * fpz;
          const airBefore = p0 > 0 ? airTr[p0 - 1] : 1.0;
          if (pauDur >= 0.13 && airBefore < 0.91) {
            const depth = Math.min(1.0, (0.91 - airBefore) / 0.55);
            const inhDur = Math.min(0.135, (pauDur - 0.045) * 0.72);
            const inhFrames = Math.max(4, Math.floor(inhDur / fpz));
            const iEnd = Math.max(p0 + 2, p1 - 7);
            const iStart = Math.max(p0 + 2, iEnd - inhFrames);
            if (iEnd > iStart + 2) {
              const peakAmp = (0.036 + 0.145 * depth) * Math.min(2.0, inhale);
              for (let k = iStart; k < iEnd; k++) {
                const u = (k - iStart) / Math.max(1, iEnd - iStart - 1);
                const env = Math.pow(Math.sin(Math.PI * u), 1.8);
                glotFricSm[k] = Math.max(glotFricSm[k], peakAmp * env);
                velSm[k] = Math.max(velSm[k], 0.14 * env);
              }
            }
          }
        }
      }
    }

    // 3) Mechanism 5: Formant-Harmonic F1-F0 Jaw-Opening Tracking at High F0 (Sundberg 1975; Joliveau et al. 2004)
    // Pure vocal-tract geometry along S1 perp S2: lifts F1 above F0 on high-pitch narrow vowels (/i/, /u/) while locking F2 & masking consonants!
    {
      const refHzEst = flatHz !== null ? flatHz : hz;
      let scEst = 1.0;
      if (typeof tractScale === "number" && Number.isFinite(tractScale)) {
        scEst = Math.max(0.82, Math.min(1.35, tractScale));
      } else {
        if (refHzEst < 250.0) scEst = 1.0 + 0.20 * Math.min(1.0, (250.0 - refHzEst) / 115.0);
        else if (refHzEst > 360.0) scEst = 1.0 - 0.06 * Math.min(1.0, (refHzEst - 360.0) / 100.0);
        if (effSmile > 0.56) scEst *= 1.0 - 0.025 * Math.min(0.65, effSmile - 0.56);
        else if (effSmile < 0.56) scEst *= 1.0 + 0.045 * Math.min(0.56, 0.56 - effSmile);
      }
      const jawAlphaRaw = new Float64Array(n);
      let anyJaw = false;
      for (let t = 0; t < n; t++) {
        const f0 = f0_fr[t];
        if (f0 <= 345.0 || voSm[t] <= 0.05) continue;
        const b = SL_BASIS[vTrack[t]];
        if (!b || b.modes.length < 2) continue;
        const estF1 = b.modes[0] / scEst;
        const targetF1 = 1.22 * f0;
        if (estF1 >= targetF1) continue;
        const hiW = minJerk((f0 - 345.0) / 35.0);
        const wVowel = voSm[t] * Math.max(0.0, 1.0 - maxConsSm[t] * 1.45) * hiW;
        if (wVowel <= 1e-4) continue;
        const need = (targetF1 - estF1) / Math.max(200.0, estF1);
        jawAlphaRaw[t] = Math.min(0.88, need * 2.55) * wVowel;
        anyJaw = true;
      }
      if (anyJaw) {
        const jawAlphaSm = smooth1(Array.from(jawAlphaRaw), 16);
        for (let t = 0; t < n; t++) {
          // Strictly zero M5 jaw opening inside consonants even after 16ms smoothing, and NEVER widen an existing constriction!
          const cGuard = Math.max(0.0, 1.0 - maxConsSm[t] * 1.70) * Math.min(1.0, voSm[t] * 1.4);
          const al = jawAlphaSm[t] * cGuard;
          if (al <= 1e-4) continue;
          const b = SL_BASIS[vTrack[t]];
          if (!b) continue;
          const dJ = b.dJaw;
          const At = A_tr[t];
          for (let j = 5; j < M; j++) {
            const minA = At[j] < 0.22 ? At[j] : 0.22;
            At[j] = Math.max(minA, Math.min(8.5, At[j] * Math.exp(al * dJ[j])));
          }
        }
      }
    }
  }

  return { n, fpz, A_tr, velSm, voSm, rdSm, chinkSm, breathDynSm, bareStartSm, pLungSm, fricSm, sibAlvFricSm, sibPalFricSm, vSibAlvSm, vSibPalSm, vFricJSm, vFricZSm, vStopSm, broadFricSm, glotFricSm, burstSm, labPopSm, fricJ_tr, stopSm, sighSm, f0_fr, voicedBool, events, airTr, breathExcess, lowPitchFactor, effSmile };
}

function applyAntiAliasLpf(buf, srIn, cutoffHz) {
  // 4th-order zero-ringing Linkwitz-Riley LPF (24 dB/oct, 2 cascaded Q=1/sqrt(2) biquads)
  const w0 = 2.0 * Math.PI * cutoffHz / srIn;
  const cosW = Math.cos(w0), sinW = Math.sin(w0);
  const alpha = sinW / Math.SQRT2;
  const b0 = (1 - cosW) * 0.5, b1 = 1 - cosW, b2 = b0;
  const a0 = 1 + alpha, a1 = -2 * cosW, a2 = 1 - alpha;
  const nb0 = b0 / a0, nb1 = b1 / a0, nb2 = b2 / a0, na1 = a1 / a0, na2 = a2 / a0;
  let src = buf;
  for (let stage = 0; stage < 2; stage++) {
    const out = new Float32Array(src.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < src.length; i++) {
      const x0 = src[i];
      const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
      x2 = x1; x1 = x0; y2 = y1; y1 = y0;
      out[i] = y0;
    }
    src = out;
  }
  return src;
}

export function synthKuda(text, opts = {}) {
  const presetObj = KUDA_PRESETS[opts.preset || "kawaii"] || KUDA_PRESETS.kawaii;
  const merged = Object.assign({}, presetObj, opts);
  const {
    seed: rawSeed = 2024,
    asp = 0.049,
    aspMid = 0.200,
    bernS = 4.10,
    srOut: rawSrOut = 24000,
    hz: rawHz = 302.0,
    nama = true,
    tractScale = "auto",
    hopf: rawHopf = 0.55,
  } = merged;
  const seed = Number.isFinite(rawSeed) ? rawSeed : 2024;
  const srOut = Number.isFinite(rawSrOut) ? Math.max(8000, Math.min(96000, rawSrOut)) : 24000;
  const hz = Number.isFinite(rawHz) ? Math.max(60.0, Math.min(800.0, rawHz)) : 302.0;
  const hopfAmt = nama && Number.isFinite(rawHopf) ? Math.max(0.0, Math.min(1.2, rawHopf)) : 0.0;

  const sc = buildScore(text, merged);
  const { n, fpz, A_tr, velSm, voSm, rdSm, chinkSm, breathDynSm, bareStartSm, pLungSm, fricSm, sibAlvFricSm, sibPalFricSm, vSibAlvSm, vSibPalSm, vFricJSm, vFricZSm, vStopSm, broadFricSm, glotFricSm, burstSm, labPopSm, fricJ_tr, stopSm, sighSm, f0_fr, voicedBool, airTr, breathExcess, lowPitchFactor, effSmile } = sc;

  const refHz = (typeof merged.flatHz === "number" && Number.isFinite(merged.flatHz) && merged.flatHz > 0)
    ? Math.max(60.0, Math.min(800.0, merged.flatHz))
    : hz;
  // Anatomical vocal-tract length scaling across all 4 branches:
  // Normal kawaii stays at calibrated 1.00x (zero formant drift); bright high-smile (genki / !) shortens tract up to -2.7%!
  let effTractScale = 1.0;
  if (nama) {
    if (typeof tractScale === "number" && Number.isFinite(tractScale)) {
      effTractScale = Math.max(0.82, Math.min(1.35, tractScale));
    } else {
      if (refHz < 250.0) effTractScale = 1.0 + 0.20 * Math.min(1.0, (250.0 - refHz) / 115.0);
      else if (refHz > 360.0) effTractScale = 1.0 - 0.06 * Math.min(1.0, (refHz - 360.0) / 100.0);
      // Tartter (1980) lip-retraction / protrusion tract-length physics centered at calibrated kawaii smile=0.56:
      if (effSmile > 0.56) {
        effTractScale *= 1.0 - 0.025 * Math.min(0.65, effSmile - 0.56);
      } else if (effSmile < 0.56) {
        effTractScale *= 1.0 + 0.045 * Math.min(0.56, 0.56 - effSmile);
      }
    }
  }
  const srWg = SR / effTractScale;
  const N = Math.max(1, Math.trunc(n * fpz * srWg));
  const rng = makeRng(seed);
  const rngHopf = makeRng(seed + 31337);

  // Radiated voiced energy drops at low F0 (+6 dB/oct lip radiation); match high-aspiration jet so deep breathy voices stay silky
  const effAsp = nama ? asp * (1.0 - 0.35 * breathExcess * lowPitchFactor) : asp;
  const effAspMid = nama ? aspMid * (1.0 - 0.52 * breathExcess * lowPitchFactor) : aspMid;

  const R = new Float64Array(M), L = new Float64Array(M);
  const Rn = new Float64Array(M), Ln = new Float64Array(M);
  const nR = new Float64Array(MN), nL = new Float64Array(MN);
  const nRn = new Float64Array(MN), nLn = new Float64Array(MN);
  const sR = new Float64Array(MS), sL = new Float64Array(MS);
  const pR = new Float64Array(MP), pL = new Float64Array(MP);

  const nA = new Float64Array(MN);
  for (let q = 0; q < MN; q++) nA[q] = q < 4 ? 1.3 : q < 11 ? 2.4 : q < 17 ? 1.8 : 0.55;
  const nK = new Float64Array(MN - 1);
  for (let q = 0; q < MN - 1; q++) nK[q] = (nA[q] - nA[q + 1]) / (nA[q] + nA[q + 1]);

  const A = new Float64Array(M);
  const k = new Float64Array(M - 1);
  const rawOut = new Float32Array(N);

  let ph = 0.0, lpRet1 = 0.0, lpRet2 = 0.0;
  let hopfR = 0.0, hopfXi = 0.0;
  let cycJit = 0.0, cycShim = 0.0, cycMuc = 0.0, cycTp = 0.0, cycParity = 1.0;
  let radLipState = 0.0, radNosState = 0.0, viscLp1 = 0.0, viscLp2 = 0.0;
  let hp1 = 0.0, hp2 = 0.0, lpA1 = 0.0, lpA2 = 0.0, wPrev = 0.0, hp1Prev = 0.0;
  let mHp = 0.0, mWPrev = 0.0, mLp1 = 0.0, mLp2 = 0.0, mLp3 = 0.0;
  let pOral = 0.0;
  let sH1 = 0.0, sH2 = 0.0, sH3 = 0.0, sW0 = 0.0, sW1 = 0.0, sW2 = 0.0, sL1 = 0.0, sL2 = 0.0;
  let pH1 = 0.0, pH2 = 0.0, pH3 = 0.0, pW0 = 0.0, pW1 = 0.0, pW2 = 0.0, pL1 = 0.0, pL2 = 0.0;
  let bHp = 0.0, bWPrev = 0.0, bLp1 = 0.0, bLp2 = 0.0, bLp3 = 0.0;
  let wallLp1 = 0.0, wallLp2 = 0.0, vWall1 = 0.0, vWall2 = 0.0;
  let roomLp1 = 0.0, roomLp2 = 0.0;

  const wallLoss = 0.9980;
  const cheekLoss = 0.9970;
  const epiLoss = 0.9972;
  const nasalLoss = 0.9920;
  const wgSR = 2 * srWg;
  const frameStepSamples = fpz * srWg;

  for (let i = 0; i < N; i++) {
    const fPos = i / frameStepSamples;
    const f0Idx = Math.min(n - 1, Math.floor(fPos));
    const f1Idx = Math.min(n - 1, f0Idx + 1);
    const frac = fPos - f0Idx;

    const A0 = A_tr[f0Idx], A1 = A_tr[f1Idx];
    for (let j = 0; j < M; j++) A[j] = A0[j] + (A1[j] - A0[j]) * frac;
    for (let j = 0; j < M - 1; j++) k[j] = (A[j] - A[j + 1]) / (A[j] + A[j + 1]);

    const f0 = f0_fr[f0Idx] + (f0_fr[f1Idx] - f0_fr[f0Idx]) * frac;
    const vo = voSm[f0Idx] + (voSm[f1Idx] - voSm[f0Idx]) * frac;
    const rd = rdSm[f0Idx] + (rdSm[f1Idx] - rdSm[f0Idx]) * frac;
    const chinkAmp = chinkSm[f0Idx] + (chinkSm[f1Idx] - chinkSm[f0Idx]) * frac;
    const breathDyn = breathDynSm[f0Idx] + (breathDynSm[f1Idx] - breathDynSm[f0Idx]) * frac;
    const bareHold = bareStartSm[f0Idx] + (bareStartSm[f1Idx] - bareStartSm[f0Idx]) * frac;
    const pLung = pLungSm[f0Idx] + (pLungSm[f1Idx] - pLungSm[f0Idx]) * frac;
    const velA = velSm[f0Idx] + (velSm[f1Idx] - velSm[f0Idx]) * frac;
    const sibAlvF = sibAlvFricSm[f0Idx] + (sibAlvFricSm[f1Idx] - sibAlvFricSm[f0Idx]) * frac;
    const sibPalF = sibPalFricSm[f0Idx] + (sibPalFricSm[f1Idx] - sibPalFricSm[f0Idx]) * frac;
    const vSibAlvF = vSibAlvSm[f0Idx] + (vSibAlvSm[f1Idx] - vSibAlvSm[f0Idx]) * frac;
    const vSibPalF = vSibPalSm[f0Idx] + (vSibPalSm[f1Idx] - vSibPalSm[f0Idx]) * frac;
    const vFricJW = vFricJSm[f0Idx] + (vFricJSm[f1Idx] - vFricJSm[f0Idx]) * frac;
    const vFricZW = vFricZSm[f0Idx] + (vFricZSm[f1Idx] - vFricZSm[f0Idx]) * frac;
    const vStopW = vStopSm[f0Idx] + (vStopSm[f1Idx] - vStopSm[f0Idx]) * frac;
    const broadF  = broadFricSm[f0Idx] + (broadFricSm[f1Idx] - broadFricSm[f0Idx]) * frac;
    const glotF   = glotFricSm[f0Idx] + (glotFricSm[f1Idx] - glotFricSm[f0Idx]) * frac;
    const burst = burstSm[f0Idx] + (burstSm[f1Idx] - burstSm[f0Idx]) * frac;
    const labPop = labPopSm[f0Idx] + (labPopSm[f1Idx] - labPopSm[f0Idx]) * frac;
    const stopW = stopSm[f0Idx] + (stopSm[f1Idx] - stopSm[f0Idx]) * frac;
    const sigh = sighSm[f0Idx] + (sighSm[f1Idx] - sighSm[f0Idx]) * frac;
    const fJ = fricJ_tr[f0Idx];

    pOral = pOral * (1.0 - 0.008 * stopW - 0.025 * (1.0 - stopW)) + 0.008 * stopW * Math.min(1.0, pLung);
    const burstDrive = burst * 0.48 + (1.0 - stopW) * pOral * 0.06;

    // Low-register lax vocal fold hint (< 175 Hz) and high-register head-voice coupling (0 on 302 Hz speech!)
    const fryAmt = nama && f0 < 175.0 ? Math.min(1.0, (175.0 - f0) / 75.0) : 0.0;
    const hiReg = nama && refHz > 355.0 ? Math.min(1.0, (refHz - 355.0) / 60.0) : 0.0;
    const hiF0 = nama && f0 > 390.0 ? Math.min(1.0, (f0 - 390.0) / 90.0) : 0.0;
    const hiDamp = Math.max(hiReg, hiF0);

    // Subtract high-F0 falsetto sigh floor so 400 Hz mid-word/short-final vowels (へるつ/あじ) never bifurcate prematurely!
    const tailSigh = Math.max(0.0, sigh - 0.16 * hiDamp);
    const tailAct = Math.min(1.0, tailSigh * 1.15 + 0.30 * breathExcess * Math.max(0.0, (rd - 2.00) / 1.2));
    const tailBif = Math.max(0.0, (tailAct - 0.30) / 0.70);
    const hiReg4 = hiReg > 0.0 ? hiDamp : 0.0;
    const rdEff = Math.max(1.0, rd - 0.03 * hiReg4);
    const oq = Math.max(0.66, Math.min(0.86, 0.49 + 0.16 * rdEff));
    const rkp = Math.max(0.32, Math.min(0.55, (22.0 + 13.0 * rdEff) * 0.01));
    const tp = Math.max(0.28, Math.min(oq - 0.08, (oq / (1.0 + rkp)) * (1.0 + 0.11 * cycTp)));
    const te = oq;
    const vFricBack = Math.max(vFricJW, vFricZW);
    const obsBackP = Math.max(vFricBack, vStopW);
    const ta1 = Math.max(0.0086, Math.min(0.054, (0.0094 + 0.0092 * Math.max(0, rdEff - 1.1) + 0.022 * sigh + 0.020 * vFricBack + 0.004 * vStopW) * (1.0 + 0.36 * cycMuc)));
    const ta2 = 0.0049;

    const lipArea = Math.max(0.015, A[M - 1]);
    const aLip = Math.sqrt(lipArea / Math.PI);
    // Frequency-selective lip radiation resistance (R_rad ~ f^2): damps 3.85 kHz vowel whistle in high register while keeping voiceless sibilants crisp!
    const vlSibMask = Math.min(1.0, sibAlvF + sibPalF);
    const fRad = Math.min(18000.0, (4100.0 - 2050.0 * hiDamp * (1.0 - 0.40 * vlSibMask)) / Math.max(0.24, aLip));
    const lipGain = Math.sqrt(lipArea / 3.0);
    const aR = Math.exp(-2.0 * Math.PI * fRad / wgSR);
    const aNos = Math.exp(-2.0 * Math.PI * 5600.0 / wgSR);

    const acSinus = 0.18;
    const velGate = Math.min(1.0, velA / 0.12);

    const effBernS = (bernS - 0.05 * hiReg4) * (1.0 - 0.14 * hiDamp) * (1.0 - 0.50 * vFricBack - 0.22 * vStopW);
    // Keep full low-frequency voicing on both /z/ and /j/ across 302-420 Hz (prevents ざじずぜぞ -> さしすせそ devoicing!)
    const effVo = vo;
    const drive = effVo * pLung;

    let sampleOut = 0.0;

    for (let sub = 0; sub < 2; sub++) {
      const pLoad = Math.tanh(L[0] * 1.3);

      // Mechanism 2: Supercritical Hopf Bifurcation (semi-implicit polar Stuart-Landau ODE + critical fluctuations near phrase tails/.../high-F0)
      let hopfAmp = drive;
      let hopfDetune = 0.0;
      let hopfChinkAdd = 0.0;
      let hopfBreathAdd = 0.0;
      let hopfAirTail = 0.0;
      let hopfFluct = 0.0;
      if (hopfAmt > 1e-4) {
        hopfXi = 0.985 * hopfXi + 0.015 * (rngHopf.random() + rngHopf.random() - 1.0) * 6.0;
        // True open-chink turbulent transition on wide-abduction breathy tails (rdEff > 2.48 on …/〜/amae/sasayaki)
        const abductBif = rdEff > 2.48 ? Math.min(1.0, (rdEff - 2.48) / 0.14) : 0.0;
        const hopfEff = hopfAmt;
        const pTh = hopfEff * (1.0 - 0.50 * hiDamp) * ((0.40 - 0.07 * abductBif) * tailBif + (0.12 - 0.02 * abductBif) * Math.max(0.0, rdEff - 2.00) * tailAct);
        const mu = drive * drive - pTh;
        const muPos = mu > 0.0 ? mu : 0.0;
        const muNeg = mu < 0.0 ? -mu : 0.0;
        const superBoost = Math.max(0.0, 1.0 - tailBif * 10.0);
        const whLow = 260.0 * (1.0 - 0.55 * tailBif) + 940.0 * superBoost;
        const whHi = 1400.0 * (1.0 - 0.82 * tailBif);
        const hiW = Math.min(1.0, hiReg4 * 1.5);
        const wh = whLow * (1.0 - hiW) + whHi * hiW;
        const dtWh = wh / wgSR;
        const rSeed = (tailBif < 0.05 && drive > 0.005) ? 0.012 * drive : 0.0;
        hopfR = Math.max(0.0, Math.min(1.35,
          (hopfR + dtWh * (muPos * hopfR + rSeed + 0.030 * hopfXi * (0.15 + hopfR) * (0.20 + 0.80 * tailAct) + 0.014 * pLoad * hopfR))
          / (1.0 + dtWh * (muNeg + hopfR * hopfR))
        ));
        const obsShield = 1.0 - Math.min(1.0, obsBackP);
        const hiCoreW = 0.12 * hiReg4;
        const hopfW = Math.min(1.0, hopfEff * (hiCoreW + (1.0 - hiCoreW) * tailBif) * (1.0 - bareHold) * obsShield * (1.0 - 0.45 * hiDamp));
        hopfAmp = (1.0 - hopfW) * drive + hopfW * hopfR;
        const diss = hopfW * Math.max(0.0, drive - hopfR);
        hopfFluct = hopfEff * tailAct * obsShield;
        hopfDetune = Math.max(-0.035, Math.min(0.035,
          hopfEff * Math.max(tailAct, 0.35 * hiReg4) * obsShield * (0.012 * (hopfR * hopfR - muPos) + 0.012 * pLoad + 0.028 * hopfXi)
        ));
        const deepThr = 0.30 - 0.05 * abductBif;
        const deepTail = tailBif > deepThr ? (tailBif - deepThr) / (1.0 - deepThr) : 0.0;
        hopfChinkAdd = Math.min(0.18, hopfEff * obsShield * (0.20 * diss * (1.0 - (0.80 + 0.05 * abductBif) * deepTail) + 0.08 * tailBif * (1.0 - deepTail) * Math.max(0.0, 0.75 - hopfR)));
        hopfBreathAdd = hopfEff * obsShield * (3.4 * diss + 1.45 * tailBif * Math.max(0.0, 1.0 - hopfR / (drive + 0.08)));
        // Crisp high-band glottal jet turbulence during deep sub-threshold tail dissolution (breaks laminar tail periodicity!)
        hopfAirTail = deepTail > 0.0 ? hopfEff * obsShield * deepTail * ((3.6 + 0.6 * abductBif) * diss + (1.80 + 0.30 * abductBif) * tailBif * Math.max(0.0, 1.0 - hopfR / (drive + 0.08))) : 0.0;
      }

      const jitScale = (1.0 + 0.45 * fryAmt) * (1.0 + 1.85 * hopfFluct);
      const fryPer = 1.0 + 0.028 * fryAmt * cycParity;
      const periodTicks = (wgSR / Math.max(70.0, f0 * (1.0 + 0.020 * jitScale * cycJit + hopfDetune))) * fryPer;
      ph += 1.0 / periodTicks;
      if (ph >= 1.0) {
        ph -= 1.0;
        cycParity = -cycParity;
        const gRand = (rng.random() + rng.random() + rng.random() - 1.5) * 0.85;
        const mRand = (rng.random() + rng.random() + rng.random() - 1.5) * 0.85;
        const tRand = (rng.random() + rng.random() + rng.random() - 1.5) * 0.85;
        cycJit = 0.40 * cycJit + 0.91 * gRand;
        cycMuc = 0.30 * cycMuc + 0.95 * mRand;
        cycTp  = 0.30 * cycTp  + 0.95 * tRand;
        cycShim = 0.46 * cycShim + 0.88 * (rng.random() - 0.5) * 0.072;
      }

      let gp = 0.0;
      if (ph < te) {
        let bern = 0.0;
        if (ph < tp) {
          bern = 0.5 * (1.0 - Math.cos(Math.PI * ph / tp));
        } else {
          const u = (ph - tp) / Math.max(1e-6, te - tp);
          bern = 1.0 - Math.pow(u, effBernS);
        }
        const chink = (chinkAmp + hopfChinkAdd) * Math.sin(Math.PI * ph / te);
        gp = bern + chink;
      }
      const aTa1 = Math.exp(-1.0 / (ta1 * periodTicks));
      const aTa2 = Math.exp(-1.0 / (ta2 * periodTicks));
      lpRet1 = (1.0 - aTa1) * gp + aTa1 * lpRet1;
      lpRet2 = (1.0 - aTa2) * lpRet1 + aTa2 * lpRet2;

      const fryAmp = 1.0 + 0.075 * fryAmt * cycParity;
      const shimScale = 1.0 + 1.50 * hopfFluct;
      const uGlot = hopfAmp * (1.0 + cycShim * shimScale) * fryAmp * lpRet2 * (1.0 - 0.08 * pLoad);

      const w = rng.uniform(-1.0, 1.0);
      const h1 = 0.72 * (hp1 + w - wPrev); wPrev = w; hp1 = h1;
      const h2 = 0.72 * (hp2 + h1 - hp1Prev); hp1Prev = h1; hp2 = h2;
      lpA1 = 0.14 * h2 + 0.86 * lpA1;
      lpA2 = 0.14 * lpA1 + 0.86 * lpA2;

      const wm = rng.uniform(-1.0, 1.0);
      const mh = 0.92 * (mHp + wm - mWPrev); mWPrev = wm; mHp = mh;
      mLp1 = 0.14 * mh + 0.86 * mLp1;
      mLp2 = 0.14 * mLp1 + 0.86 * mLp2;
      mLp3 = 0.14 * mLp2 + 0.86 * mLp3;

      const openMod = 0.26 + 0.74 * Math.min(1.4, lpRet2);
      // Aerodynamic glottal-jet turbulence saturates smoothly under high breathiness (sasayaki + 〜… never clips or spikes!)
      const breathMultRaw = (1.0 + 2.1 * sigh + 0.34 * Math.max(0, rd - 1.45) + hopfBreathAdd) * breathDyn;
      const breathMult = breathExcess > 0.35
        ? (1.0 + 2.2 * Math.tanh(Math.max(0.0, breathMultRaw - 1.0) / 2.2))
        : breathMultRaw;
      const glotH = (1.0 - vo) * glotF * 1.50 * (0.72 * mLp3 + 0.28 * lpA2);
      const airAbduct = rdEff > 2.48 ? Math.min(1.0, (rdEff - 2.48) / 0.14) : 0.0;
      const h2Mix = 0.16 + 0.49 * airAbduct;
      const hopfAir = vo * pLung * hopfAirTail * Math.min(0.055, effAsp) * (1.0 - 0.35 * hiDamp) * ((1.0 - h2Mix) * lpA2 + h2Mix * h2) * (3.4 + 0.4 * airAbduct);
      const glotJet = (vo * pLung * openMod * breathMult * (effAsp * (1.0 - 0.55 * hiDamp) * lpA2 * 0.44 + effAspMid * (1.0 - 0.22 * hiDamp) * mLp3 * 0.78) + hopfAir + glotH);

      const rg = (0.920 - 0.05 * hiDamp) - 0.130 * vo * Math.min(1.2, lpRet2);
      Rn[0] = (uGlot + glotJet) + rg * L[0];

      // Calibrated young-female 16kHz-safe aerodynamic turbulence:
      // 1) s/z/ts @ 6.4-6.8 kHz (sH=0.67, sL=0.26 -> <5% 3kHz leak)
      const tw = rng.uniform(-1.0, 1.0);
      const sy1 = 0.67 * (sH1 + tw - sW0); sW0 = tw; sH1 = sy1;
      const sy2 = 0.67 * (sH2 + sy1 - sW1); sW1 = sy1; sH2 = sy2;
      const sy3 = 0.67 * (sH3 + sy2 - sW2); sW2 = sy2; sH3 = sy3;
      sL1 = 0.26 * sy3 + 0.74 * sL1;
      sL2 = 0.26 * sL1 + 0.74 * sL2;

      // 2) Young-female sh/ch/j @ 4.35-4.55 kHz (pH=0.75, pL=0.20 -> zero <2.5kHz leak!)
      const py1 = 0.75 * (pH1 + tw - pW0); pW0 = tw; pH1 = py1;
      const py2 = 0.75 * (pH2 + py1 - pW1); pW1 = py1; pH2 = py2;
      const py3 = 0.75 * (pH3 + py2 - pW2); pW2 = py2; pH3 = py3;
      pL1 = 0.20 * py3 + 0.80 * pL1;
      pL2 = 0.20 * pL1 + 0.80 * pL2;

      // 3) Warm broadband plosive release transient (NEVER leaks into sibilants!)
      const bh = 0.94 * (bHp + tw - bWPrev); bWPrev = tw; bHp = bh;
      bLp1 = 0.11 * bh + 0.89 * bLp1;
      bLp2 = 0.15 * bLp1 + 0.85 * bLp2;
      bLp3 = 0.055 * bLp2 + 0.945 * bLp3;

      // Oral cavity compliance behind the constriction smooths glottal pressure ripple (zero glottal-closing impulse!)
      const voicedFricMod = 1.0;
      const sibDip = 0.50 * (sibAlvF * (sL2 * 1.08) + sibPalF * (pL2 * 1.26) + voicedFricMod * (vSibAlvF * (sL2 * 0.74) + vSibPalF * (pL2 * 0.90)));
      const burstNoise = (fJ === 27)
        ? (bLp2 * 0.88 + pL2 * 0.24 + sL2 * 0.14)
        : (fJ === 26 ? (bLp3 * 2.1 + bLp2 * 0.22) : (bLp2 * 1.22));
      const brdDip = 0.50 * (broadF * (bLp2 * 1.85) + burstDrive * burstNoise);
      const turbDipole = (fJ > 4) ? (sibDip + brdDip) : 0.0;
      const fwdFrac = (sibAlvF + sibPalF + vSibAlvF + vSibPalF) > 0.15 ? 0.95 : 0.72;

      const epiHiDrop = 0.008 * hiDamp;
      for (let j = 0; j < M - 1; j++) {
        const wL = j <= 3 ? (epiLoss - epiHiDrop) : (j >= 10 && j <= 24 ? cheekLoss : wallLoss);
        if (j === PIR_J) {
          const Aa = A[j], Ab = A[j + 1], Ac = 0.25;
          const pa = R[j], pb = L[j + 1], pc = pL[0];
          const PJ = 2.0 * (Aa * pa + Ab * pb + Ac * pc) / (Aa + Ab + Ac);
          Ln[j] = (PJ - pa) * wallLoss;
          Rn[j + 1] = (PJ - pb) * wallLoss;
          const pIn = (PJ - pc) * 0.95;
          for (let q = MP - 1; q > 0; q--) pR[q] = pR[q - 1] * 0.95;
          pR[0] = pIn;
          for (let q = 0; q < MP - 1; q++) pL[q] = pL[q + 1] * 0.95;
          pL[MP - 1] = pR[MP - 1] * 0.85;
        } else if (j === VEL_J) {
          const Aa = A[j], Ab = A[j + 1], Ac = Math.max(0.0, velA);
          const pa = R[j], pb = L[j + 1], pc = nL[0];
          const PJ = 2.0 * (Aa * pa + Ab * pb + Ac * pc) / (Aa + Ab + Ac);
          Ln[j] = (PJ - pa) * cheekLoss;
          Rn[j + 1] = (PJ - pb) * cheekLoss;
          nRn[0] = velGate * (PJ - pc) * nasalLoss;
        } else if (j === SIN_J) {
          const Aa = A[j], Ab = A[j + 1], Ac = acSinus;
          const pa = R[j], pb = L[j + 1], pc = sL[0];
          const PJ = 2.0 * (Aa * pa + Ab * pb + Ac * pc) / (Aa + Ab + Ac);
          Ln[j] = (PJ - pa) * cheekLoss;
          Rn[j + 1] = (PJ - pb) * cheekLoss;
          const sIn = (PJ - pc) * 0.992;
          for (let q = MS - 1; q > 0; q--) sR[q] = sR[q - 1] * 0.992;
          sR[0] = sIn;
          for (let q = 0; q < MS - 1; q++) sL[q] = sL[q + 1] * 0.992;
          sL[MS - 1] = sR[MS - 1] * 0.90;
        } else {
          const wS = k[j] * (R[j] - L[j + 1]);
          Rn[j + 1] = (R[j] + wS) * wL;
          Ln[j] = (L[j + 1] + wS) * wL;
        }
        if (j === fJ && turbDipole !== 0.0) {
          Rn[j + 1] += fwdFrac * turbDipole;
          Ln[j] -= (1.0 - fwdFrac) * turbDipole;
        }
      }

      for (let q = 0; q < MN - 1; q++) {
        const wn = nK[q] * (nR[q] - nL[q + 1]);
        nRn[q + 1] = (nR[q] + wn) * nasalLoss;
        nLn[q] = (nL[q + 1] + wn) * nasalLoss;
      }
      const nInc = nR[MN - 1];
      radNosState = (1.0 - aNos) * nInc + aNos * radNosState;
      const nRefl = -0.988 * radNosState;
      nLn[MN - 1] = nRefl;
      const pRadNos = (nInc + nRefl) * Math.sqrt(nA[MN - 1] / 3.0) * 1.15;

      const pInc = R[M - 1];
      radLipState = (1.0 - aR) * pInc + aR * radLipState;
      const pRefl = -0.992 * radLipState;
      Ln[M - 1] = pRefl;
      const pRadLip = (pInc + pRefl) * lipGain + labPop * bLp2 * 0.30;

      const pPhar = 0.5 * (R[5] + L[5]);
      wallLp1 = 0.034 * pPhar + 0.966 * wallLp1;
      wallLp2 = 0.034 * wallLp1 + 0.966 * wallLp2;
      // Wideband (~470 Hz) neck-wall voice-bar radiation strictly for voiced sibilants j/z
      vWall1 = 0.052 * pPhar + 0.948 * vWall1;
      vWall2 = 0.052 * vWall1 + 0.948 * vWall2;
      // Compensate +6 dB/oct vowel lip-radiation tilt for sealed stops; keep voiced-sibilant wall bar gently capped so 400Hz /j,z/ never booms nasal!
      const wallPitchScale = Math.min(2.4, Math.max(0.24, Math.pow(f0 / 255.0, 1.55)));
      const wallRadG = 0.048 * wallPitchScale;
      const vSibWallScale = Math.min(1.35, wallPitchScale);
      const pWall = Math.max(0.0, stopW - vStopW) * vo * wallLp2 * wallRadG
        + (vStopW * 0.014 + vFricJW * 0.014 + vFricZW * 0.022 * vSibWallScale) * effVo * vWall2;

      for (let j = 0; j < M; j++) { R[j] = Rn[j]; L[j] = Ln[j]; }
      for (let q = 0; q < MN; q++) { nR[q] = nRn[q]; nL[q] = nLn[q]; }

      const pTot = pRadLip + pRadNos + pWall;
      viscLp1 = 0.50 * pTot + 0.50 * viscLp1;
      viscLp2 = 0.50 * viscLp1 + 0.50 * viscLp2;
      sampleOut += 0.5 * viscLp2;
    }

    rawOut[i] = sampleOut;
  }

  let dcX = 0, dcY = 0;
  for (let i = 0; i < N; i++) {
    const y = rawOut[i] - dcX + 0.993 * dcY;
    dcX = rawOut[i]; dcY = y; rawOut[i] = y;
  }

  for (const [apBase, apMod, fMod, ph0] of [[0.46, 0.25, 5.1, 0.3], [-0.40, 0.22, 7.3, 1.8], [0.28, 0.18, 9.7, 3.1]]) {
    let ax1 = 0.0, ay1 = 0.0;
    for (let i = 0; i < N; i++) {
      const fIdx = Math.min(n - 1, Math.floor(i / frameStepSamples));
      const sec = i / srWg;
      const ap = Math.max(-0.78, Math.min(0.78, apBase + 0.08 * Math.tanh((A_tr[fIdx][24] - 2.4) * 0.5) + apMod * Math.sin(2 * Math.PI * fMod * sec + ph0)));
      const xi = rawOut[i], yi = ap * xi + ax1 - ap * ay1;
      ax1 = xi; ay1 = yi; rawOut[i] = yi;
    }
  }

  {
    const win = Math.trunc(0.065 * srWg);
    const rmsArr = new Float64Array(N);
    let sqSum = 0.0;
    for (let i = 0; i < N; i++) {
      sqSum += rawOut[i] * rawOut[i];
      if (i >= win) sqSum -= rawOut[i - win] * rawOut[i - win];
      rmsArr[i] = Math.sqrt(Math.max(0, sqSum) / Math.min(i + 1, win));
    }
    const vRmsList = [];
    for (let t = 0; t < n; t++) {
      if (voicedBool[t] && sighSm[t] < 0.2) vRmsList.push(rmsArr[Math.min(N - 1, Math.trunc((t + 0.5) * fpz * srWg))]);
    }
    vRmsList.sort((a, b) => a - b);
    const refRms = vRmsList.length ? vRmsList[Math.floor(vRmsList.length * 0.65)] : 0.1;
    let gSm = 1.0;
    let activeWin = 0.0;
    const actRise = 1.0 / (0.085 * srWg);
    const actFall = 1.0 / (0.030 * srWg);
    for (let i = 0; i < N; i++) {
      const fIdx = Math.min(n - 1, Math.floor(i / frameStepSamples));
      const active = Math.min(1.0, voSm[fIdx] + 0.85 * fricSm[fIdx]) * (1.0 - 0.72 * sighSm[fIdx]);
      let ratio = Math.min(1.65, Math.max(0.76, refRms / (rmsArr[i] + 0.24 * refRms)));
      if (nama) {
        if (active > 0.15) activeWin = Math.min(1.0, activeWin + actRise);
        else activeWin = Math.max(0.0, activeWin - actFall);
        if (ratio > 1.0) {
          const lungRespect = 1.0 - 0.75 * breathExcess * Math.max(0.0, 1.0 - airTr[fIdx]);
          ratio = 1.0 + (ratio - 1.0) * activeWin * lungRespect;
        }
      }
      const targetG = 1.0 + 0.26 * active * (ratio - 1.0);
      gSm = 0.9985 * gSm + 0.0015 * targetG;
      rawOut[i] *= gSm;
    }
  }

  const out44 = new Float32Array(N);
  let pk = 0, sq = 0;
  for (let i = 0; i < N; i++) { const a = Math.abs(rawOut[i]); if (a > pk) pk = a; sq += rawOut[i] * rawOut[i]; }
  const rawRms = Math.sqrt(sq / N);
  const gNorm = pk > 1e-9 ? Math.min(0.85 / pk, 0.082 / Math.max(1e-6, rawRms)) : 0.0;
  const edgeFade = Math.min(Math.trunc(0.15 * srWg), Math.floor(N / 4));
  for (let i = 0; i < N; i++) {
    const rn = rng.uniform(-1.0, 1.0);
    roomLp1 = 0.90 * roomLp1 + 0.10 * rn;
    roomLp2 = 0.82 * roomLp2 + 0.18 * roomLp1;
    const wRoom = i < edgeFade ? (i / edgeFade) : (N - 1 - i < edgeFade ? ((N - 1 - i) / edgeFade) : 1.0);
    out44[i] = rawOut[i] * gNorm + 0.0018 * wRoom * roomLp2;
  }

  let samples = out44;
  if (Math.abs(srOut - srWg) > 0.5) {
    const src = srOut < srWg ? applyAntiAliasLpf(out44, srWg, srOut * 0.46) : out44;
    const nOut = Math.max(1, Math.round(N * srOut / srWg));
    samples = new Float32Array(nOut);
    const ratio = srWg / srOut;
    for (let i = 0; i < nOut; i++) {
      const p = i * ratio;
      const k0 = Math.min(N - 1, Math.floor(p)), f = p - k0;
      samples[i] = src[k0] * (1 - f) + src[Math.min(N - 1, k0 + 1)] * f;
    }
  }

  return { samples, sr: srOut, wav: encodeWav(samples, srOut) };
}


// CLI entrypoint (Node.js only; completely skipped in browsers):
// node kuda.mjs [--preset kawaii|amae|genki|sasayaki] [--hz 302] [--no-nama] [--sr 24000|44100] [--flat 305] -o out.wav "テキスト"
if (typeof process !== "undefined" && process.versions?.node && process.argv?.[1]) {
  const { pathToFileURL } = await import("node:url");
  if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const fs = await import("node:fs");
    const args = process.argv.slice(2);
    let outPath = "kuda_out.wav", preset = "kawaii", srOut = 24000, flatHz = null, hz = undefined, nama = true, textParts = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if ((a === "-o" || a === "--out") && args[i + 1]) { outPath = args[++i]; }
      else if (a === "--preset" && args[i + 1]) { preset = args[++i]; }
      else if (a === "--sr" && args[i + 1]) { srOut = Number(args[++i]) || 24000; }
      else if (a === "--flat" && args[i + 1]) { flatHz = Number(args[++i]) || null; }
      else if (a === "--hz" && args[i + 1]) { hz = Number(args[++i]) || undefined; }
      else if (a === "--no-nama") { nama = false; }
      else if (a === "-h" || a === "--help") {
        console.log("使い方: node kuda.mjs [--preset kawaii|amae|genki|sasayaki] [--hz 302] [--no-nama] [--sr 24000|44100] [--flat Hz] -o out.wav \"テキスト\"");
        process.exit(0);
      } else {
        textParts.push(a);
      }
    }
    const text = textParts.join(" ") || "わたし、にほんご、ちょっとしゃべれます";
    const opts = { preset, srOut, flatHz, nama };
    if (hz !== undefined) opts.hz = hz;
    const res = synthKuda(text, opts);
    fs.writeFileSync(outPath, res.wav);
    console.log(`KUDA (${preset}${nama ? ", nama" : ""}, ${res.sr}Hz): wrote ${outPath} (${res.wav.byteLength} bytes, ${(res.samples.length / res.sr).toFixed(2)}s)`);
  }
}
