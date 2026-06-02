// ─── 地形の表示色（α16: Mod で差し替え可能）──────────────────────────
// 地形テーマ画像が無い場合のフォールバック色。Mod の terrainColors で id 単位に上書きできる。
// 可変オブジェクト（Mod が key 単位で Object.assign する）。

export const TERRAIN_COLOR: Record<string, string> = {
  plain: '#4a7a30', forest: '#1e5010', mountain: '#7a7060', desert: '#b8922a', swamp: '#3a5a3a',
  water: '#1f3a78', river: '#2f63c8', highmount: '#4a4038', moat: '#243a5e', wall: '#4a4a4a',
}
