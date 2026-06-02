// ─── 移動ロジック（じりじり移動・地形コスト・向き更新） ─────────────────
// 仕様書 L143-148: 隊単位・移動予定キュー・地形乗算・常時薄表示

import type { WorldState, SquadState } from './types'
import { dist, angleTo, stepToward, TERRAIN_SPEED, isImpassable } from './geo'
import type { TerrainType } from './geo'
import { FORMATION_MOVE_MULT, getEffectiveFormation } from './formation'

// ─── デモ地形グリッド（10列×6行、各セル10×10ゲーム単位）─────────────
// 仕様書L165: 山・平地・森・砂漠・沼は移動可
export const DEMO_TERRAIN: TerrainType[][] = [
  ['plain',  'plain',   'forest',   'forest',   'river',    'plain',    'plain',    'mountain', 'plain', 'plain'],
  ['plain',  'forest',  'forest',   'forest',   'river',    'plain',    'forest',   'mountain', 'plain', 'plain'],
  ['plain',  'forest',  'plain',    'plain',    'plain',    'plain',    'forest',   'plain',    'plain', 'plain'],
  ['plain',  'plain',   'plain',    'plain',    'river',    'mountain', 'forest',   'plain',    'wall',  'plain'],
  ['plain',  'plain',   'plain',    'plain',    'river',    'plain',    'plain',    'plain',    'wall',  'plain'],
  ['plain',  'plain',   'plain',    'plain',    'plain',    'plain',    'plain',    'plain',    'plain', 'plain'],
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
  // 速度は現在地の地形で決まる（移動タイプ × 地形）
  const terrain = getTerrainAt(squad.pos, grid)
  const pct = TERRAIN_SPEED[squad.movementType][terrain] ?? 100
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

export function tickMovement(world: WorldState): WorldState {
  const grid = world.terrain ?? DEMO_TERRAIN
  const squads = world.squads.map(s => {
    // 全ユニット離脱済みの隊は移動しない・ゲージも止める
    const alive = s.unitIds.filter(id => world.units[id]?.alive).length
    if (alive === 0) return s
    return fillUlt(tickSquad(s, world.squads, alive, grid))
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
