# グラフィックテーマ画像の設置マニフェスト

配置ルート: `<リポジトリ直下>/assets/themes/<default|alt>/`
（`assets/` は Vite の publicDir。中身は配信URLの直下にマップされる → 例 `assets/themes/default/face/hannibal.png` は `/themes/default/face/hannibal.png` で配信）

2テーマ（`default` / `alt`）で**ファイル名・サイズを完全に統一**して配置する。
テーマ切り替えはパス `/themes/{themeId}/…` の差し替えのみで行うため、
名前が1文字でも違うと片方のテーマで画像が出ない（→色塗りフォールバックになる）。

## 必要ファイル一覧（default と alt の両方に同名で置く）

### face/ … 顔グラ（PNG透過・128×128 px・6枚）
| ファイル名 | 用途 |
| --- | --- |
| `hannibal.png` | ハンニバル（unit_hannibal） |
| `mago.png` | マゴ（unit_mago） |
| `infantry_a.png` | 味方一般兵A（id末尾の数値が偶数） |
| `infantry_b.png` | 味方一般兵B（id末尾の数値が奇数） |
| `spearman.png` | 敵一般兵 |
| `enemy_commander.png` | 敵ユニーク武将 |

### unit/ … 盤面ユニットスプライト（PNG透過・32×32 px・6枚）
`ally_infantry.png` / `ally_cavalry.png` / `ally_archer.png` / `ally_elite.png` / `enemy_infantry.png` / `enemy_cavalry.png`

### terrain/ … 地形マップチップ（PNG・60×60 px・10枚）
`plain.png` / `forest.png` / `mountain.png` / `desert.png` / `swamp.png` / `water.png` / `river.png` / `highland.png` / `moat.png` / `wall.png`

> 注意: 地形ID `highmount`（高山）に対応するファイル名は **`highland.png`** です（IDとファイル名が異なる唯一の例外）。

### bg/ … 戦場背景（PNG・600×360 px・1枚）
`battlefield.png`

## フォールバック
画像が無いファイルは、既存の色塗り描画（PixiJS Graphics / CSS）をそのまま使う。
片方のテーマだけ用意した状態でも正常動作する。
