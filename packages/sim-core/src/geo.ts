// ─── 座標・地形・移動計算のプリミティブ ─────────────────────────────────
// 他の sim-core ファイルはここから Vec2 / TerrainType を import する

export interface Vec2 { x: number; y: number }

// 仕様書 L165: 山・平地・森・砂漠・沼は移動可
export type TerrainType = 'plain' | 'forest' | 'mountain' | 'desert' | 'swamp'

// 仕様書 L145: 移動タイプごとに地形速度補正(50%〜200%)
export type MovementType = 'plain' | 'forest'

/** 地形ごとの移動速度補正 (%) */
export const TERRAIN_SPEED: Record<MovementType, Record<TerrainType, number>> = {
  plain:  { plain: 100, forest: 60,  mountain: 50, desert: 70, swamp: 40 },
  forest: { plain: 80,  forest: 100, mountain: 60, desert: 60, swamp: 50 },
}

export function dist(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** a から b への角度（ラジアン, 0=右, π/2=下） */
export function angleTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x)
}

/** pos を target 方向へ speed 分だけ移動 */
export function stepToward(pos: Vec2, target: Vec2, speed: number): Vec2 {
  const d = dist(pos, target)
  if (d <= speed) return { ...target }
  const r = speed / d
  return { x: pos.x + (target.x - pos.x) * r, y: pos.y + (target.y - pos.y) * r }
}
