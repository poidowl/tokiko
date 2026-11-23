# tokiko

**Virtual Vocal Organ — KUDA (`kuda.mjs`)**

学習済み重み 0 バイト・外部依存 0・静的 `import` 0 の、単一ファイル純 JavaScript（約 61 KB）による **4 分岐ケリー・ロックバウム物理声道管** 日本語音声合成エンジンです。

Node.js / ブラウザの両方でそのまま動作し、発声器官の全ソースコードをローカル LLM のコンテキストに丸ごと収容できるサイズに保っています。

- **ライブデモ（X 正方形プレイヤーカード）**：[https://poidowl.github.io/tokiko/](https://poidowl.github.io/tokiko/) （再生成: `node tools/build_player.mjs`）

## 特徴

- **0 バイト重み・0 依存・0 EQ**：録音サンプルもニューラル重みも持たず、物理モデルのみから波形を生成
- **4 分岐声道デジタルウェーブガイド**（88.2 kHz 2 倍速散乱格子）
  - 主声道管 `M=31`（L = 12.4 cm）
  - 鼻腔管 `MN=23` ＋ 連続軟口蓋ゲート
  - 閉端副鼻腔側枝 `MS=10`
  - 梨状窩側枝 `MP=3`
- **声門音源・空力乱流・日本語音韻規則**
  - 声門流（Fant-LF 滑らかリターン相 ＋ 粘膜揺らぎ ＋ 後部声門間隙気息）
  - 4 系統分離ダイポール乱流（歯茎歯擦・硬口蓋歯擦・場所別破裂音・声門気息）
  - 日本語アクセント規則・助詞「は」→ワ・長音・狭母音無声化・決定論シード (`seed`)

## クイックスタート

### CLI（Node.js）

```bash
node kuda.mjs -o out.wav "わたし、にほんご、ちょっとしゃべれます"
node kuda.mjs --preset genki -o genki.wav "しじゅほ'ーしょー、げ'っと/す'っぞ！"
node kuda.mjs --preset amae --sr 44100 -o amae.wav "おはよう、きょうは、いいてんきだね"
```

### ESM（Node.js / ブラウザ共通）

```js
import { synthKuda, KUDA_PRESETS } from "./kuda.mjs";

const { wav, samples, sr } = synthKuda("だいじょうぶ、きっと、うまく、いくよ", {
  preset: "kawaii", // "kawaii" | "amae" | "genki"
  srOut: 24000,     // 24000 | 44100
  seed: 2024,       // 同一テキスト＋同一シードでビット単位に再現
});
```

入力テキストはひらがな・カタカナを受け付けます。`'` でアクセント核、`/` で句境界、読点 `、` で小休止を指定できます。

## ライセンス

[MIT License](./LICENSE)
