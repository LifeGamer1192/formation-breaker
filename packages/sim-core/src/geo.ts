// ─── 座標・地形・移動計算のプリミティブ ─────────────────────────────────
// 他の sim-core ファイルはここから Vec2 / TerrainType を import する

export interface Vec2 { x: number; y: number }

// 仕様書 L165-269: 山・平地・森・砂漠・沼は移動可 / 池・川・高山・堀・塀は移動不可
export type TerrainType =
  | 'plain' | 'forest' | 'mountain' | 'desert' | 'swamp'   // 移動可
  | 'water' | 'river' | 'highmount' | 'moat' | 'wall'      // 移動不可（α8）

// 移動不可地形（squad はここへ進入できない）
export const IMPASSABLE: ReadonlySet<TerrainType> = new Set<TerrainType>(['water', 'river', 'highmount', 'moat', 'wall'])
export function isImpassable(t: TerrainType): boolean { return IMPASSABLE.has(t) }

// 仕様書 L145: 移動タイプごとに地形速度補正(50%〜200%)
export type MovementType = 'plain' | 'forest'

/** 地形ごとの移動速度補正 (%)。移動不可地形は 0（進入不可）。 */
export const TERRAIN_SPEED: Record<MovementType, Record<TerrainType, number>> = {
  plain:  { plain: 100, forest: 60,  mountain: 50, desert: 70, swamp: 40, water: 0, river: 0, highmount: 0, moat: 0, wall: 0 },
  forest: { plain: 80,  forest: 100, mountain: 60, desert: 60, swamp: 50, water: 0, river: 0, highmount: 0, moat: 0, wall: 0 },
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
