import type { WorldState, UnitState, Side } from './types'
import type { Prng } from './prng'

// ダメージ = max(1, 攻撃力 - 防御力)  ←仕様書確定
function calcDamage(attacker: UnitState, defender: UnitState): number {
  return Math.max(1, attacker.attack - defender.defense)
}

export function tickCombat(world: WorldState, rng: Prng): WorldState {
  if (world.finished) return world

  // units をシャローコピー（イミュータブルに更新）
  const units: WorldState['units'] = {}
  for (const [k, v] of Object.entries(world.units)) {
    units[k] = { ...v }
  }

  const newLog: string[] = []

  // ① 全生存ユニットのゲージを充填
  for (const unit of Object.values(units)) {
    if (unit.alive) units[unit.id].gauge += unit.attackSpeed
  }

  // ② ゲージが満タンになったユニットが攻撃
  for (const unit of Object.values(units)) {
    if (!unit.alive || units[unit.id].gauge < unit.gaugeMax) continue

    const enemies = Object.values(units).filter(u => u.alive && u.side !== unit.side)
    if (enemies.length === 0) continue

    const target = enemies[Math.floor(rng() * enemies.length)]
    const dmg    = calcDamage(unit, target)
    const newHp  = Math.max(0, target.hp - dmg)

    newLog.push(`[T${world.tick + 1}] ${unit.name} → ${target.name}: ${dmg}dmg (${target.hp}→${newHp})`)

    units[target.id].hp    = newHp
    units[target.id].alive = newHp > 0
    units[unit.id].gauge  -= unit.gaugeMax
  }

  // ③ 勝敗判定（仕様書: 敵大将離脱で勝利。PoC#1は全滅で代用）
  const allyAlive  = Object.values(units).some(u => u.alive && u.side === 'ally')
  const enemyAlive = Object.values(units).some(u => u.alive && u.side === 'enemy')
  const finished   = !allyAlive || !enemyAlive
  const winner: Side | null = finished ? (allyAlive ? 'ally' : 'enemy') : null

  if (finished && winner) {
    newLog.push(winner === 'ally' ? '🏆 味方の勝利！' : '💀 敵の勝利！')
  }

  return {
    ...world,
    tick:     world.tick + 1,
    units,
    log:      [...world.log, ...newLog].slice(-200),
    finished,
    winner,
  }
}
