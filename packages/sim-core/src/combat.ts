import type { WorldState, SquadState, Side } from './types'
import type { Prng } from './prng'
import { getEffectiveStats } from './stats'

function findSquad(world: WorldState, unitId: string): SquadState {
  return world.squads.find(s => s.unitIds.includes(unitId))!
}

export function tickCombat(world: WorldState, rng: Prng): WorldState {
  if (world.finished) return world

  const units: WorldState['units'] = {}
  for (const [k, v] of Object.entries(world.units)) units[k] = { ...v }

  const newLog: string[] = []

  // ① 全生存ユニットのゲージを充填（実効 attackSpeed を使用）
  for (const unit of Object.values(units)) {
    if (!unit.alive) continue
    const squad = findSquad(world, unit.id)
    const eff = getEffectiveStats(unit, squad)
    units[unit.id].gauge += eff.attackSpeed
  }

  // ② ゲージ満タンで攻撃（実効 attack / defense でダメージ計算）
  for (const unit of Object.values(units)) {
    if (!unit.alive || units[unit.id].gauge < unit.gaugeMax) continue

    const squad   = findSquad(world, unit.id)
    const attEff  = getEffectiveStats(unit, squad)
    const enemies = Object.values(units).filter(u => u.alive && u.side !== unit.side)
    if (enemies.length === 0) continue

    const target    = enemies[Math.floor(rng() * enemies.length)]
    const tarSquad  = findSquad(world, target.id)
    const defEff    = getEffectiveStats(target, tarSquad)

    // ダメージ = max(1, 実効攻撃力 - 実効防御力)  ← 仕様書確定
    const dmg   = Math.max(1, attEff.attack - defEff.defense)
    const newHp = Math.max(0, target.hp - dmg)

    newLog.push(
      `[T${world.tick + 1}] ${unit.name}(ATK${attEff.attack}) → ${target.name}(DEF${defEff.defense}): ${dmg}dmg (${target.hp}→${newHp})`
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
