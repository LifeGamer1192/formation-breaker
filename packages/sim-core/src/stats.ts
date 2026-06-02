// ─── 実効ステータス計算（描画・戦闘両方から呼ばれる） ──────────────────
import type { UnitState, SquadState } from './types'
import type { LayerEffect, EffectiveStats } from './layers'
import { calcEffectiveStats } from './layers'
import { FORMATION_EFFECTS, getEffectiveFormation } from './formation'

function unitBase(unit: UnitState): EffectiveStats {
  return {
    attack:      unit.attack,
    defense:     unit.defense,
    attackSpeed: unit.attackSpeed,
    maxHp:       unit.maxHp,
  }
}

function activeSkills(unit: UnitState): LayerEffect[] {
  return unit.skills.filter(s => {
    if (s.layer === 'leaderSkill'  && !unit.isLeader) return false
    if (s.layer === 'generalSkill' &&  unit.isLeader) return false
    return true
  })
}

/**
 * 実効ステータスを返す。
 * aliveCount を渡すと、人数条件に応じた実効陣形（フォールダウン後）の補正を適用する。
 * 省略時は選択陣形をそのまま使う（後方互換）。
 */
export function getEffectiveStats(unit: UnitState, squad: SquadState, aliveCount?: number): EffectiveStats {
  const formation = aliveCount == null
    ? squad.formation
    : getEffectiveFormation(squad.formation, aliveCount)
  const effects = [...activeSkills(unit), ...FORMATION_EFFECTS[formation]]
  return calcEffectiveStats(unitBase(unit), effects)
}
