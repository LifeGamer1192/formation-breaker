import type { WorldState, SquadState, Side } from './types'
import type { Prng } from './prng'
import type { Vec2 } from './geo'
import { dist } from './geo'
import { getEffectiveStats } from './stats'
import { calcFacingZone, ZONE_LABEL } from './facing'
import { getUnitPos } from './formation'

function findSquad(world: WorldState, unitId: string): SquadState {
  return world.squads.find(s => s.unitIds.includes(unitId))!
}

/** tick開始時の全生存ユニットの実座標を一括計算（tick中は不変） */
function buildPosMap(world: WorldState): Map<string, Vec2> {
  const map = new Map<string, Vec2>()
  for (const squad of world.squads) {
    const aliveIds = squad.unitIds.filter(id => world.units[id]?.alive)
    aliveIds.forEach((id, idx) =>
      map.set(id, getUnitPos(squad.pos, squad.facing, squad.formation, idx))
    )
  }
  return map
}

export function tickCombat(world: WorldState, rng: Prng): WorldState {
  if (world.finished) return world

  // tick開始時の位置マップ（兵士単位）
  const posMap = buildPosMap(world)

  const units: WorldState['units'] = {}
  for (const [k, v] of Object.entries(world.units)) units[k] = { ...v }

  const newLog: string[] = []

  // ① 攻撃ゲージ充填（実効 attackSpeed を使用）
  for (const unit of Object.values(units)) {
    if (!unit.alive) continue
    const squad = findSquad(world, unit.id)
    const eff   = getEffectiveStats(unit, squad)
    units[unit.id].gauge += eff.attackSpeed
  }

  // ② ゲージ満タン → 兵士単位で射程内の敵兵士を攻撃
  for (const unit of Object.values(units)) {
    if (!unit.alive || units[unit.id].gauge < unit.gaugeMax) continue

    const attackerPos = posMap.get(unit.id)
    if (!attackerPos) continue

    const attSquad = findSquad(world, unit.id)
    const attEff   = getEffectiveStats(unit, attSquad)

    // 射程内の生存敵兵士（兵士単位の距離判定）
    const enemies = Object.values(units).filter(u => {
      if (!u.alive || u.side === unit.side) return false
      const tpos = posMap.get(u.id)
      return tpos !== undefined && dist(attackerPos, tpos) <= unit.range
    })
    if (enemies.length === 0) continue

    const target    = enemies[Math.floor(rng() * enemies.length)]
    const targetPos = posMap.get(target.id)!
    const defSquad  = findSquad(world, target.id)
    const defEff    = getEffectiveStats(target, defSquad)

    // 向き判定（兵士単位の実座標 + 隊の向きで判定）
    const zone      = calcFacingZone(attackerPos, targetPos, defSquad.facing)
    const facingMod = zone === 'front' ? 0
                    : zone === 'flank' ? (target.flankMod ?? -30)
                    :                    (target.rearMod  ?? -50)
    const adjDef    = Math.max(0, Math.round(defEff.defense * (1 + facingMod / 100)))

    // ダメージ = max(1, 実効ATK - 向き補正後DEF)
    const dmg   = Math.max(1, attEff.attack - adjDef)
    const newHp = Math.max(0, target.hp - dmg)

    const zoneStr = zone !== 'front' ? `[${ZONE_LABEL[zone]} DEF${adjDef}]` : `[DEF${adjDef}]`
    newLog.push(
      `[T${world.tick + 1}] ${unit.name}(ATK${attEff.attack}) → ${target.name}${zoneStr}: ${dmg}dmg (${target.hp}→${newHp})`
    )

    units[target.id].hp    = newHp
    units[target.id].alive = newHp > 0
    units[unit.id].gauge  -= unit.gaugeMax
  }

  // ③ 勝敗判定
  const allyAlive  = Object.values(units).some(u => u.alive && u.side === 'ally')
  const enemyAlive = Object.values(units).some(u => u.alive && u.side === 'enemy')
  const finished   = !allyAlive || !enemyAlive
  const winner: Side | null = finished ? (allyAlive ? 'ally' : 'enemy') : null

  if (finished && winner) newLog.push(winner === 'ally' ? '🏆 味方の勝利！' : '💀 敵の勝利！')

  return {
    ...world,
    tick:     world.tick + 1,
    units,
    log:      [...world.log, ...newLog].slice(-200),
    finished,
    winner,
  }
}
