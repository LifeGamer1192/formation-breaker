// ─── 実効ステータス計算（描画・戦闘両方から呼ばれる） ──────────────────
import type { UnitState, SquadState } from './types'
import type { LayerEffect, EffectiveStats } from './layers'
import { calcEffectiveStats } from './layers'
import { FORMATION_EFFECTS } from './formation'

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

export function getEffectiveStats(unit: UnitState, squad: SquadState): EffectiveStats {
  const effects = [...activeSkills(unit), ...FORMATION_EFFECTS[squad.formation]]
  return calcEffectiveStats(unitBase(unit), effects)
}
