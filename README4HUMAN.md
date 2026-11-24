# README4HUMAN — tokiko / KUDA の物理背景と参考文献

> [!NOTE]
> [`README.md`](./README.md) は、ローカル LLM が [`kuda.mjs`](./kuda.mjs) と一緒にそのままコンテキストへ読み込めるよう意図的にミニマルに保っています。  
> このファイルは、**人間が読むための**設計背景・声道物理とコードの対応表・参考文献リストです。

---

## これは何？（人間向けざっくり解説）

**tokiko**（エンジン名：**管 / KUDA**）は、録音サンプルもニューラルネットワークの重みも外部ライブラリも一切使わず、約 69 KB の単一 JavaScript ファイル（[`kuda.mjs`](./kuda.mjs)）だけで日本語を喋る **純 DSP 物理モデリング音声合成エンジン** です。

一般的な現代の TTS（ニューラル音声合成）が「大量の音声データから統計的パターンを学習する」のに対し、KUDA は **人間の声道の解剖学的構造と空気の波動方程式** を直接シミュレーションします。

- **発声器官（Organ）**：[`kuda.mjs`](./kuda.mjs) — 4 分岐デジタルウェーブガイド声道管 ＋ 声門流 ＋ 空力乱流 ＋ 日本語音韻規則
- **脳（Brain）**：コード全体を丸ごと読める LLM や人間が、物理パラメータ・調音ルールを直接設計・調整
- **耳（Ear）**：開発・検証時のみ外部の音声認識（Dual-ASR）や音響解析で明瞭度・自然さを測定（本体には一切非同梱）

もともとは [poidowl/tsukinami](https://github.com/poidowl/tsukinami)（`kuda` ブランチ）で 5 極カスケード IIR フォルマント合成の限界を超えるために生まれ、単体の **仮想発声器官（Virtual Vocal Organ）** として `poidowl/tokiko` に独立させました。

---

## 物理モデルと `kuda.mjs` コードの対応表

[`kuda.mjs`](./kuda.mjs) の各パーツが、どの音響物理・音声科学の知見に基づいているかの対応表です。

| 物理メカニズム | `kuda.mjs` 内の実装箇所・主な識別子 | 根拠となる主な文献 |
| --- | --- | --- |
| **1 次元音響管デジタルウェーブガイド** | 主声道管 `M = 31`（L = 12.4 cm @ 88.2 kHz 2 倍速散乱格子）、反射係数 `k[j] = (A[j] - A[j+1]) / (A[j] + A[j+1])` | Kelly & Lochbaum (1962) |
| **3 ポート分岐散乱ジャンクション** | 圧力保存式 `PJ = 2 * (Aa*pa + Ab*pb + Ac*pc) / (Aa + Ab + Ac)` で 3 つの生理学的側枝を結合 | Kelly & Lochbaum (1962) |
| **鼻腔側枝 ＋ 連続軟口蓋ゲート** | 鼻道管 `MN = 23`（`VEL_J = 14` で分岐）、連続開閉 `velGate = Math.min(1.0, velA / 0.12)` | Dang, Honda & Suzuki (1994) |
| **閉端副鼻腔側枝** | 4.0 cm 副鼻腔 `MS = 10`（`SIN_J = 15` で分岐、結合面積 `acSinus = 0.18` cm²、閉端反射 `0.90`） | Dang, Honda & Suzuki (1994) |
| **梨状窩（りじょうか）側枝** | 若年女性の浅い梨状窩 `MP = 3`（`PIR_J = 4` で分岐、4–5 kHz 帯の反共振谷を形成） | Dang & Honda (1997) |
| **声門流（LF モデル ＋ Rd 制御）** | 2 段指数リターン相 `ta1` / `ta2`、全体波形パラメータ `rd`（`rd_base` / `rd_tail`）→ `oq`, `rkp`, `tp`, `ta1` | Fant, Liljencrants & Lin (1985); Fant (1995) |
| **女性声質の息漏れ・後部声門間隙** | 後部間隙気流 `chinkAmp`、3 極温息フィルタ `asp` / `aspMid`、語尾息抜け `sigh` | Klatt & Klatt (1990) |
| **喉頭管カラー ＋ 音源–声道相互作用** | 軟粘膜喉頭管 `j = 0..3`（`epiLoss`）、声道反射圧フィードバック `pLoad = Math.tanh(L[0] * 1.3)` | Titze & Story (1997) |
| **口唇・鼻孔の放射インピーダンス** | 等価半径 `aLip = Math.sqrt(lipArea / Math.PI)`、遮断周波数 `fRad`、放射利得 `lipGain = Math.sqrt(lipArea / 3.0)` | Flanagan (1972) |
| **空力ダイポール乱流・調音結合** | 4 系統独立乱流（`sibAlvF`, `sibPalF`, `broadF`, `burstDrive`）、舌下前腔 `sibPalCav`、軟口蓋前後の共調音 `velA` / `vel` / `velF` | Stevens (1998) |
| **ゼロリンギング・アンチエイリアシング LPF** | `applyAntiAliasLpf`：4 次 Linkwitz-Riley LPF（`Q = 1/√2` 双二次フィルタ 2 段縦続、24 dB/oct @ 24 kHz 出力時） | Linkwitz (1976) |

---

## 参考文献（References）

### A. 声道導波管・分岐腔モデル（Vocal Tract Waveguide & Side Branches）

1. **Kelly, J. L., Jr., & Lochbaum, C. C. (1962).** "Speech synthesis." *Proceedings of the Fourth International Congress on Acoustics (ICA)*, Copenhagen, Paper G42.
   - 声道を等長の円筒管列で離散化し、進行波・後退波の散乱格子として時間領域で計算するケリー・ロックバウムモデルの原典。`kuda.mjs` の主声道管および 3 ポート分岐散乱の基盤です。
2. **Dang, J., Honda, K., & Suzuki, H. (1994).** "Morphological and acoustical analysis of the nasal and the paranasal cavities." *Journal of the Acoustical Society of America*, 96(4), 2088–2100.
   - MRI 計測に基づく鼻腔および副鼻腔（上顎洞など）の音響解析。鼻音・鼻母音の自然な響きを作る鼻道管（`MN=23`）と、閉端の副鼻腔側枝（`MS=10`, 結合面積 `0.18` cm²）の設計根拠です。
3. **Dang, J., & Honda, K. (1997).** "Acoustic characteristics of the piriform fossa in models and humans." *Journal of the Acoustical Society of America*, 101(1), 456–465.
   - 喉頭上部の梨状窩（piriform fossa）が 4–5 kHz 帯に反共振のスペクトル谷を生むことを示した研究。若年女性声の「抜け」と奥行きを担う `MP=3 @ PIR_J=4` の側枝に反映しています。

### B. 声門音源・声質・放射インピーダンス（Glottal Source, Voice Quality & Radiation）

4. **Fant, G., Liljencrants, J., & Lin, Q. (1985).** "A four-parameter model of glottal flow." *STL-QPSR (Speech Transmission Laboratory Quarterly Progress and Status Report)*, 26(4), 1–13.
   - 声門閉鎖時の急峻さと指数的リターン相をパラメータ化した LF モデルの原典。`kuda.mjs` の声門パルス形状（`tp`, `te`, `ta1` / `ta2`）の基礎です。
5. **Fant, G. (1995).** "The LF-model revisited. Transformations and frequency domain analysis." *STL-QPSR*, 36(2–3), 119–156.
   - LF モデルの各パラメータを単一の声質形状パラメータ `Rd` に統合した定式化。プリセット（`kawaii` / `amae` / `genki`）の `rd_base` / `rd_tail` から `oq`, `rkp`, `ta1` への写像に使っています。
6. **Klatt, D. H., & Klatt, L. C. (1990).** "Analysis, synthesis, and perception of voice quality variations among female and male talkers." *Journal of the Acoustical Society of America*, 87(2), 820–857.
   - 女性話者に特徴的な後部声門間隙（posterior glottal chink）からの漏れ気流と吸気性ノイズ・高域傾斜を分析した古典的研究。`chinkAmp`、3 極温息フィルタ（`asp`, `aspMid`）、語尾の息抜け（`sigh`）の設計根拠です。
7. **Titze, I. R., & Story, B. H. (1997).** "Acoustic interactions of the voice source with the lower vocal tract." *Journal of the Acoustical Society of America*, 101(4), 2234–2243.
   - 喉頭管（epilarynx tube）の狭まりと、声道側からの音圧フィードバックによる音源–フィルタ相互作用（source–tract interaction）の理論。`j=0..3` の `epiLoss` および `pLoad` による声門流変調に取り入れています。
8. **Flanagan, J. L. (1972).** *Speech Analysis Synthesis and Perception* (2nd ed.). Springer-Verlag, Berlin.
   - 音声音響学の標準的教科書。口唇・鼻孔開口端における円形ピストン近似の放射インピーダンスと開口面積依存の放射利得（`aLip`, `fRad`, `lipGain`）の根拠としています。

### C. 音響音声学・子音調音（Acoustic Phonetics & Consonants）

9. **Stevens, K. N. (1998).** *Acoustic Phonetics*. MIT Press, Cambridge, MA.
   - 狭窄部での空力乱流（ダイポール音源）、破裂音リリース時の口腔内圧解放と VOT、硬口蓋歯擦音における舌下前腔（sublingual cavity：`sibPalCav`）、後続母音による軟口蓋閉鎖位置の共調音（`velA` / `vel` / `velF`）など、子音生成全般の物理的裏付けです。

### D. DSP フィルタ設計（Digital Signal Processing）

10. **Linkwitz, S. H. (1976).** "Active Crossover Networks for Noncoincident Drivers." *Journal of the Audio Engineering Society (JAES)*, 24(1), 2–8.
    - 2 次 Butterworth フィルタ（`Q = 1/√2`）を 2 段縦続して 4 次（24 dB/oct）かつインパルス応答のオーバーシュート・リンギングを抑える Linkwitz-Riley 構成の原典。`v0.1.1` の `applyAntiAliasLpf` で、破裂音・歯擦音のトランジェントを濁さずに 44.1 kHz → 24 kHz へ折り返し雑音を抑圧するために採用しています。

### E. 外部評価系 — 開発時の「耳」（※ `kuda.mjs` 本体には非同梱）

`kuda.mjs` 本体は完全スタンドアロンの純物理 DSP であり、以下の音声認識モデルは実行時に一切使用・同梱していません。調音物理のブラッシュアップ時に客観的な明瞭度（CER）と退行検知を行う「外部の耳」として利用しました。

11. **Yin, Y., Mori, D., & Fujimoto, S. (2023).** "ReazonSpeech: A Free and Massive Corpus for Japanese ASR." *Proceedings of the 29th Annual Meeting of the Association for Natural Language Processing (NLP 2023)*, A5-3.
12. **Tongyi SpeechTeam (2024).** "FunAudioLLM: Voice Understanding and Generation Foundation Models for Natural Interaction Between Humans and LLMs." *arXiv:2407.04051*（SenseVoice-Small）.

---

## 関連リンク

- **ライブデモ（X 正方形プレイヤーカード）**：[https://poidowl.github.io/tokiko/](https://poidowl.github.io/tokiko/)
- **発生元リポジトリ**：[poidowl/tsukinami](https://github.com/poidowl/tsukinami)（`kuda` ブランチおよび音響計測スイート）
- **ライセンス**：[MIT License](./LICENSE)
