// ─── 移動ロジック（じりじり移動・地形コスト・向き更新） ─────────────────
// 仕様書 L143-148: 隊単位・移動予定キュー・地形乗算・常時薄表示

import type { WorldState, SquadState } from './types'
import { dist, angleTo, stepToward, TERRAIN_SPEED, isImpassable } from './geo'
import type { TerrainType } from './geo'
import { FORMATION_MOVE_MULT, getEffectiveFormation } from './formation'

// ─── デモ地形グリッド（10列×6行、各セル10×10ゲーム単位）─────────────
// 仕様書L165: 山・平地・森・砂漠・沼は移動可
// スポーン行(y18/38/58 = 行1/3/5)は水平に開通させ、障害物は非スポーン行(0/2/4)へ。
// → 基本AIで全隊が確実に交戦でき、堀塀破壊(行2の堀・行0/4の塀)も体験できる。
export const DEMO_TERRAIN: TerrainType[][] = [
  ['river',  'river',   'plain',    'plain',    'plain',    'wall',     'plain',    'mountain', 'plain', 'plain'], // 行0: 障害物
  ['plain',  'plain',   'forest',   'forest',   'plain',    'plain',    'plain',    'mountain', 'plain', 'plain'], // 行1: スポーン(開通)
  ['plain',  'forest',  'plain',    'moat',     'plain',    'plain',    'forest',   'plain',    'plain', 'plain'], // 行2: 障害物
  ['plain',  'plain',   'plain',    'plain',    'plain',    'mountain', 'forest',   'plain',    'plain', 'plain'], // 行3: スポーン(開通)
  ['plain',  'plain',   'plain',    'plain',    'plain',    'plain',    'wall',     'plain',    'plain', 'plain'], // 行4: 障害物
  ['plain',  'plain',   'plain',    'plain',    'plain',    'plain',    'plain',    'plain',    'plain', 'plain'], // 行5: スポーン(開通)
]

export function getTerrainAt(pos: { x: number; y: number }, grid = DEMO_TERRAIN): TerrainType {
  const col = Math.min(9, Math.max(0, Math.floor(pos.x / 10)))
  const row = Math.min(5, Math.max(0, Math.floor(pos.y / 10)))
  return grid[row]?.[col] ?? 'plain'
}

function tickSquad(squad: SquadState, allSquads: SquadState[], aliveCount: number, grid: TerrainType[][]): SquadState {
  if (squad.moveQueue.length === 0) {
    // 移動なし → 最寄り敵に向く（仕様書: 戦術画面で向きをリアルタイム更新）
    const enemies = allSquads.filter(s => s.side !== squad.side)
    if (enemies.length > 0) {
      const nearest = enemies.reduce((a, b) =>
        dist(squad.pos, a.pos) < dist(squad.pos, b.pos) ? a : b
      )
      if (dist(squad.pos, nearest.pos) < 30) {
        return { ...squad, facing: angleTo(squad.pos, nearest.pos) }
      }
    }
    return squad
  }

  const target = squad.moveQueue[0]
  const newFacing = angleTo(squad.pos, target)
  // 速度は現在地の地形で決まる（移動タイプ × 地形）。移動不可セル上は脱出のため通常速度
  const terrain = getTerrainAt(squad.pos, grid)
  const pct = isImpassable(terrain) ? 100 : (TERRAIN_SPEED[squad.movementType][terrain] ?? 100)
  // 実効陣形（フォールダウン後）の移動速度補正を掛ける（仕様書 L103-110）
  const effFormation = getEffectiveFormation(squad.formation, aliveCount)
  const formMult = FORMATION_MOVE_MULT[effFormation]
  const effectiveSpeed = squad.moveSpeed * pct / 100 * formMult

  const newPos = stepToward(squad.pos, target, effectiveSpeed)

  // 移動不可地形へは進入しない（手前で停止・向きだけ更新）。α8
  if (isImpassable(getTerrainAt(newPos, grid))) {
    return { ...squad, facing: newFacing }
  }

  const arrived = dist(newPos, target) < effectiveSpeed * 0.6
  return {
    ...squad,
    pos:       newPos,
    facing:    newFacing,
    moveQueue: arrived ? squad.moveQueue.slice(1) : squad.moveQueue,
  }
}

// 必殺技ゲージを充填（生存隊のみ・α5）
function fillUlt(squad: SquadState): SquadState {
  if (!squad.ult) return squad
  const next = Math.min(squad.ult.gaugeMax, (squad.ultGauge ?? 0) + squad.ult.ultSpeed)
  return next === squad.ultGauge ? squad : { ...squad, ultGauge: next }
}

// 堀・塀の破壊（攻撃側=ally のみ）。隣接して一定時間で平地化（仕様書 L270）
const WALL_THRESHOLD = 60   // 破壊に必要な蓄積
const WALL_RATE = 3         // 隣接1tickあたりの蓄積
const WALL_RANGE = 13       // 隊中心からセル中心までの破壊有効距離
function tickTerrainDestruction(world: WorldState, grid: TerrainType[][]): {
  terrain: TerrainType[][]; terrainDmg: Record<string, number>; log: string[]
} {
  const dmg = { ...(world.terrainDmg ?? {}) }
  const log: string[] = []
  let newGrid: TerrainType[][] | null = null
  const allyPos = world.squads
    .filter(s => s.side === 'ally' && s.unitIds.some(id => world.units[id]?.alive))
    .map(s => s.pos)
  if (allyPos.length === 0) return { terrain: grid, terrainDmg: dmg, log }

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const t = grid[r][c]
      if (t !== 'moat' && t !== 'wall') continue
      const center = { x: c * 10 + 5, y: r * 10 + 5 }
      if (!allyPos.some(p => dist(p, center) <= WALL_RANGE)) continue
      const key = `${r},${c}`
      const nd = (dmg[key] ?? 0) + WALL_RATE
      dmg[key] = nd
      if (nd >= WALL_THRESHOLD) {
        if (!newGrid) newGrid = grid.map(row => [...row])
        newGrid[r][c] = 'plain'
        log.push(`[T${world.tick}] 攻撃側が${t === 'wall' ? '塀' : '堀'}を破壊した`)
      }
    }
  }
  return { terrain: newGrid ?? grid, terrainDmg: dmg, log }
}

// ─── 敵AI（隊ごと・α12+）──────────────────────────────────────────
// front: 最寄り敵へ接近し射程より少し近い距離で停止。障害物は回避。
// rear : 接近に加え、近づきすぎたら敵を向いたまま後退（カイト）。
function nearestEnemySquad(squad: SquadState, allSquads: SquadState[], units: WorldState['units']): SquadState | null {
  const enemies = allSquads.filter(s => s.side !== squad.side && s.unitIds.some(id => units[id]?.alive))
  if (enemies.length === 0) return null
  return enemies.reduce((a, b) => dist(squad.pos, a.pos) < dist(squad.pos, b.pos) ? a : b)
}

function squadRange(squad: SquadState, units: WorldState['units']): number {
  const ranges = squad.unitIds.map(id => units[id]).filter(u => u?.alive).map(u => u!.range)
  return ranges.length ? Math.max(...ranges) : 10
}

// 障害物回避つき1ステップ。基準角を中心に左右へ振って通れる方向を探す（場外も回避）
function stepAvoiding(pos: { x: number; y: number }, angle: number, speed: number, grid: TerrainType[][]): { x: number; y: number } {
  // 直進を優先しつつ、塞がれたら徐々に大きく振って壁沿いに滑る（最大±115°）
  const offsets = [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2.0, -2.0]
  for (const off of offsets) {
    const a = angle + off
    const np = { x: pos.x + Math.cos(a) * speed, y: pos.y + Math.sin(a) * speed }
    if (np.x < 2 || np.x > 98 || np.y < 2 || np.y > 58) continue
    if (!isImpassable(getTerrainAt(np, grid))) return np
  }
  return pos
}

function aiMove(squad: SquadState, allSquads: SquadState[], units: WorldState['units'], aliveCount: number, grid: TerrainType[][]): SquadState {
  const target = nearestEnemySquad(squad, allSquads, units)
  if (!target) return squad
  const d = dist(squad.pos, target.pos)
  const facing = angleTo(squad.pos, target.pos)
  const desired = Math.max(2, squadRange(squad, units) - 2) // 射程より少し近い距離
  const terrain = getTerrainAt(squad.pos, grid)
  // 移動不可セル上にいる場合は脱出のため通常速度扱い
  const pct = isImpassable(terrain) ? 100 : (TERRAIN_SPEED[squad.movementType][terrain] ?? 100)
  const speed = squad.moveSpeed * pct / 100 * FORMATION_MOVE_MULT[getEffectiveFormation(squad.formation, aliveCount)]

  if (d > desired + 0.5) {
    return { ...squad, pos: stepAvoiding(squad.pos, facing, Math.min(speed, d - desired), grid), facing }
  }
  if (squad.ai === 'rear' && d < desired * 0.7) {
    // 近づきすぎ → 敵を向いたまま後退
    return { ...squad, pos: stepAvoiding(squad.pos, facing + Math.PI, speed, grid), facing }
  }
  return { ...squad, facing } // 適正距離 → 停止（敵を向く）
}

export function tickMovement(world: WorldState): WorldState {
  const grid = world.terrain ?? DEMO_TERRAIN
  const squads = world.squads.map(s => {
    // 全ユニット離脱済みの隊は移動しない・ゲージも止める
    const alive = s.unitIds.filter(id => world.units[id]?.alive).length
    if (alive === 0) return s
    // α14: 象無効化で移動不可にされている間は移動しない（ゲージ充填は継続）
    if (s.moveDisabledUntil != null && world.tick < s.moveDisabledUntil) return fillUlt(s)
    const moved = s.ai
      ? aiMove(s, world.squads, world.units, alive, grid)
      : tickSquad(s, world.squads, alive, grid)
    return fillUlt(moved)
  })
  const dz = tickTerrainDestruction({ ...world, squads }, grid)
  return {
    ...world,
    squads,
    terrain: dz.terrain,
    terrainDmg: dz.terrainDmg,
    log: dz.log.length ? [...world.log, ...dz.log].slice(-200) : world.log,
  }
}
