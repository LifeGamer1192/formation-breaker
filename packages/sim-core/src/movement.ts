// ─── 移動ロジック（じりじり移動・地形コスト・向き更新） ─────────────────
// 仕様書 L143-148: 隊単位・移動予定キュー・地形乗算・常時薄表示

import type { WorldState, SquadState } from './types'
import { dist, angleTo, stepToward, TERRAIN_SPEED } from './geo'
import type { TerrainType } from './geo'
import { FORMATION_MOVE_MULT, getEffectiveFormation } from './formation'

// ─── デモ地形グリッド（10列×6行、各セル10×10ゲーム単位）─────────────
// 仕様書L165: 山・平地・森・砂漠・沼は移動可
export const DEMO_TERRAIN: TerrainType[][] = [
  ['plain',  'plain',   'forest',   'forest',   'plain',    'plain',    'plain',    'mountain', 'plain', 'plain'],
  ['plain',  'forest',  'forest',   'forest',   'plain',    'plain',    'forest',   'mountain', 'plain', 'plain'],
  ['plain',  'forest',  'plain',    'plain',    'plain',    'plain',    'forest',   'plain',    'plain', 'plain'],
  ['plain',  'plain',   'plain',    'plain',    'mountain', 'mountain', 'forest',   'plain',    'plain', 'plain'],
  ['plain',  'plain',   'plain',    'plain',    'mountain', 'plain',    'plain',    'plain',    'plain', 'plain'],
  ['plain',  'plain',   'plain',    'plain',    'plain',    'plain',    'plain',    'plain',    'plain', 'plain'],
]

export function getTerrainAt(pos: { x: number; y: number }, grid = DEMO_TERRAIN): TerrainType {
  const col = Math.min(9, Math.max(0, Math.floor(pos.x / 10)))
  const row = Math.min(5, Math.max(0, Math.floor(pos.y / 10)))
  return grid[row]?.[col] ?? 'plain'
}

function tickSquad(squad: SquadState, allSquads: SquadState[], aliveCount: number): SquadState {
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
  const terrain = getTerrainAt(target)
  const pct = TERRAIN_SPEED[squad.movementType][terrain] ?? 100
  // 実効陣形（フォールダウン後）の移動速度補正を掛ける（仕様書 L103-110）
  const effFormation = getEffectiveFormation(squad.formation, aliveCount)
  const formMult = FORMATION_MOVE_MULT[effFormation]
  const effectiveSpeed = squad.moveSpeed * pct / 100 * formMult

  const newPos    = stepToward(squad.pos, target, effectiveSpeed)
  const arrived   = dist(newPos, target) < effectiveSpeed * 0.6
  const newFacing = angleTo(squad.pos, target)

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

export function tickMovement(world: WorldState): WorldState {
  return {
    ...world,
    squads: world.squads.map(s => {
      // 全ユニット離脱済みの隊は移動しない・ゲージも止める
      const alive = s.unitIds.filter(id => world.units[id]?.alive).length
      if (alive === 0) return s
      return fillUlt(tickSquad(s, world.squads, alive))
    }),
  }
}
