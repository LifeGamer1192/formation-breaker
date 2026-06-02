import type { WorldState, SquadState, Side, UltimateRuntime } from './types'
import type { Prng } from './prng'
import type { LayerEffect } from './layers'
import type { Vec2 } from './geo'
import { dist } from './geo'
import { getEffectiveStats } from './stats'
import { calcFacingZone, ZONE_LABEL } from './facing'
import { buildUnitView } from './view'
import { ATTRIBUTES, armorDefFor } from './attribute'
import { getTerrainAt, DEMO_TERRAIN } from './movement'

// 塀（wall）が a→b の射線上にあるか（攻撃側=ally は塀越しに攻撃できない・仕様書 L272）
function wallBetween(a: Vec2, b: Vec2, grid: WorldState['terrain']): boolean {
  const g = grid ?? DEMO_TERRAIN
  const d = dist(a, b)
  const steps = Math.max(1, Math.ceil(d / 3))
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    if (getTerrainAt({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, g) === 'wall') return true
  }
  return false
}

function findSquad(world: WorldState, unitId: string): SquadState {
  return world.squads.find(s => s.unitIds.includes(unitId))!
}

// 隊の生存ユニット（tick開始時の状態で固定）。実効陣形・スキル集約に使用。
function squadAlive(squad: SquadState, units: WorldState['units']) {
  return squad.unitIds.map(id => units[id]).filter(u => u?.alive)
}

// 勝敗判定（α8: 大将撃破で決着）。大将がいればその離脱、いなければ全滅で敗北。
function checkOutcome(units: WorldState['units']): { finished: boolean; winner: Side | null; reason: 'commander' | 'wipe' | null } {
  const us = Object.values(units)
  const sideDefeated = (side: Side): { defeated: boolean; byCommander: boolean } => {
    const anyAlive = us.some(u => u.alive && u.side === side)
    const cmd = us.find(u => u.side === side && u.isCommander)
    if (cmd && !cmd.alive) return { defeated: true, byCommander: true }
    return { defeated: !anyAlive, byCommander: false }
  }
  const ally = sideDefeated('ally')
  const enemy = sideDefeated('enemy')
  if (!ally.defeated && !enemy.defeated) return { finished: false, winner: null, reason: null }
  // 両者同時敗北は ally 敗北を優先（防御側基準）。通常は片方のみ。
  if (enemy.defeated && !ally.defeated) return { finished: true, winner: 'ally', reason: enemy.byCommander ? 'commander' : 'wipe' }
  return { finished: true, winner: 'enemy', reason: ally.byCommander ? 'commander' : 'wipe' }
}

export function tickCombat(world: WorldState, rng: Prng): WorldState {
  if (world.finished) return world

  // tick開始時の兵士単位の位置・向きを確定（tick中は不変）
  const view = buildUnitView(world)

  const units: WorldState['units'] = {}
  for (const [k, v] of Object.entries(world.units)) units[k] = { ...v }

  const newLog: string[] = []

  // ① 攻撃ゲージ充填（実効 attackSpeed を使用）＋リジェネ（α12）
  for (const unit of Object.values(units)) {
    if (!unit.alive) continue
    const squad = findSquad(world, unit.id)
    const sa    = squadAlive(squad, world.units)
    const eff   = getEffectiveStats(unit, squad, { aliveCount: sa.length, squadUnits: sa, tick: world.tick })
    units[unit.id].gauge += eff.attackSpeed
    if (unit.regen) units[unit.id].hp = Math.min(unit.maxHp, units[unit.id].hp + unit.regen)
  }

  // ② ゲージ満タン → 兵士単位で射程内の敵兵士を攻撃
  for (const unit of Object.values(units)) {
    if (!unit.alive || units[unit.id].gauge < unit.gaugeMax) continue

    const attView = view.get(unit.id)
    if (!attView) continue
    const attackerPos = attView.pos

    const attSquad = findSquad(world, unit.id)
    const attSa    = squadAlive(attSquad, world.units)
    const attEff   = getEffectiveStats(unit, attSquad, { aliveCount: attSa.length, squadUnits: attSa, tick: world.tick })

    // 射程内の生存敵兵士（兵士単位の距離判定）。攻撃側=ally は塀越しに攻撃不可
    const enemies = Object.values(units).filter(u => {
      if (!u.alive || u.side === unit.side) return false
      const tv = view.get(u.id)
      if (tv === undefined || dist(attackerPos, tv.pos) > unit.range) return false
      if (unit.side === 'ally' && wallBetween(attackerPos, tv.pos, world.terrain)) return false
      return true
    })
    if (enemies.length === 0) continue

    const target    = enemies[Math.floor(rng() * enemies.length)]
    const targetView= view.get(target.id)!
    const targetPos = targetView.pos
    const defSquad  = findSquad(world, target.id)
    const defSa     = squadAlive(defSquad, world.units)
    const defEff    = getEffectiveStats(target, defSquad, { aliveCount: defSa.length, squadUnits: defSa, tick: world.tick })

    // α2: 攻撃属性に対応する防御力を使う
    // 属性別防御力 = 基礎/レイヤー防御(共通) + 攻撃属性に対応する防具防御(armorDef)
    const atkAttr   = unit.attackAttr ?? 'slash'
    const attrDef   = defEff.defense + armorDefFor(target.armorDef, atkAttr)

    // 向き判定（攻撃側の兵士座標 vs 守備側の兵士座標・守備兵士自身の向き）
    const zone      = calcFacingZone(attackerPos, targetPos, targetView.facing)
    const facingMod = zone === 'front' ? 0
                    : zone === 'flank' ? (target.flankMod ?? -30)
                    :                    (target.rearMod  ?? -50)
    const adjDef    = Math.max(0, Math.round(attrDef * (1 + facingMod / 100)))

    // ダメージ = max(1, 実効ATK - 属性別・向き補正後DEF)
    const dmg   = Math.max(1, attEff.attack - adjDef)
    const newHp = Math.max(0, target.hp - dmg)

    const icon    = ATTRIBUTES[atkAttr].icon
    const zoneStr = zone !== 'front' ? `[${ZONE_LABEL[zone]} DEF${adjDef}]` : `[DEF${adjDef}]`
    newLog.push(
      `[T${world.tick + 1}] ${unit.name}(${icon}ATK${attEff.attack}) → ${target.name}${zoneStr}: ${dmg}dmg (${target.hp}→${newHp})`
    )

    units[target.id].hp    = newHp
    units[target.id].alive = newHp > 0
    units[unit.id].gauge  -= unit.gaugeMax
  }

  // ③ 技（technique）: 固有ゲージ充填 → 有効かつ満タンを優先順位順に1つ自動発動
  for (const unit of Object.values(units)) {
    if (!unit.alive || !unit.techniques || unit.techniques.length === 0) continue
    // 充填
    let techs = unit.techniques.map(t => ({ ...t, gauge: Math.min(t.gaugeMax, t.gauge + t.speed) }))
    // 有効かつ満タンを優先順位降順で。1tickに1つ、「実際に発動できた」技だけ消費する。
    const ready = techs.filter(t => t.enabled && t.gauge >= t.gaugeMax).sort((a, b) => b.priority - a.priority)
    for (const t of ready) {
      let fired = false
      if (t.kind === 'selfBuff') {
        const until = world.tick + (t.durationTicks ?? 100)
        const fx: LayerEffect[] = (t.buffs ?? []).map(b => ({
          layer: 'technique', target: b.target, op: b.op, value: b.value,
          priority: 0, source: t.name, scope: 'self', untilTick: until,
        }))
        units[unit.id].skills = [...units[unit.id].skills, ...fx]
        newLog.push(`[T${world.tick + 1}] 🎯${unit.name}: ${t.icon}${t.name}`)
        fired = true
      } else if (t.kind === 'bonusAttack') {
        const myPos = view.get(unit.id)?.pos
        // 射程内の最寄り敵（決定論: 最短距離、同距離は走査順）
        let best: { id: string; d: number } | null = null
        if (myPos) {
          for (const u of Object.values(units)) {
            if (!u.alive || u.side === unit.side) continue
            const tv = view.get(u.id)
            if (!tv) continue
            const d = dist(myPos, tv.pos)
            if (d <= (t.range ?? 0) && (!best || d < best.d)) best = { id: u.id, d }
          }
        }
        if (best) {
          const tgt = units[best.id]
          const sq = world.squads.find(s => s.unitIds.includes(tgt.id))!
          const sa = squadAlive(sq, world.units)
          const defEff = getEffectiveStats(tgt, sq, { aliveCount: sa.length, squadUnits: sa, tick: world.tick })
          const attr = t.attr ?? 'slash'
          const attrDef = defEff.defense + armorDefFor(tgt.armorDef, attr)
          const dmg = Math.max(1, (t.power ?? 0) - attrDef)
          units[best.id].hp = Math.max(0, tgt.hp - dmg)
          units[best.id].alive = units[best.id].hp > 0
          newLog.push(`[T${world.tick + 1}] 🎯${unit.name}: ${t.icon}${t.name} ${ATTRIBUTES[attr].icon}→${tgt.name} ${dmg}dmg`)
          fired = true
        }
      }
      if (fired) {
        techs = techs.map(x => x.id === t.id ? { ...x, gauge: x.gauge - x.gaugeMax } : x)
        break // 1tickに1つ
      }
    }
    units[unit.id].techniques = techs
  }

  // ④ 勝敗判定（大将撃破で決着）
  const outcome = checkOutcome(units)
  if (outcome.finished && outcome.winner) {
    const tag = outcome.reason === 'commander' ? '（大将討ち取り）' : ''
    newLog.push(outcome.winner === 'ally' ? `🏆 味方の勝利！${tag}` : `💀 敵の勝利！${tag}`)
  }

  return {
    ...world,
    tick:     world.tick + 1,
    units,
    log:      [...world.log, ...newLog].slice(-200),
    finished: outcome.finished,
    winner:   outcome.winner,
  }
}

// ─── 必殺技の発動（α5）─────────────────────────────────────────────
// コマンド経由で呼ばれる純粋関数（RNG不使用＝決定論）。
// ゲージ未満なら何もしない。aoeDamage=範囲ダメージ / squadBuff=隊バフ。
export function executeUltimate(world: WorldState, squadId: string, targetPos?: Vec2): WorldState {
  if (world.finished) return world
  const caster = world.squads.find(s => s.id === squadId)
  if (!caster || !caster.ult) return world
  if ((caster.ultGauge ?? 0) < caster.ult.gaugeMax) return world // 未充填
  return applyUltEffect(world, caster, caster.ult, targetPos, true)
}

// 必殺技アイテム（消費）用（α12）。ゲージに依存せず任意の必殺技ランタイムを発動。
// アイテムの消費は GameState 側（クライアント）で行い、ここでは盤面効果のみ適用する。
export function executeUltimateWith(world: WorldState, squadId: string, ult: UltimateRuntime, targetPos?: Vec2): WorldState {
  if (world.finished) return world
  const caster = world.squads.find(s => s.id === squadId)
  if (!caster) return world
  return applyUltEffect(world, caster, ult, targetPos, false)
}

// 必殺技効果の本体（executeUltimate / executeUltimateWith 共用）。
// resetGauge=true のとき発動隊のゲージを 0 に戻す（通常必殺技）。アイテム発動は false。
function applyUltEffect(world: WorldState, caster: SquadState, ult: UltimateRuntime, targetPos: Vec2 | undefined, resetGauge: boolean): WorldState {
  const view = buildUnitView(world)
  const units: WorldState['units'] = {}
  for (const [k, v] of Object.entries(world.units)) units[k] = { ...v }
  const newLog: string[] = []

  const aliveOf = (sq: SquadState) => sq.unitIds.map(id => world.units[id]).filter(u => u?.alive)

  if (ult.kind === 'aoeDamage') {
    // 対象中心: 指定座標 or 最寄りの敵隊中心
    let center = targetPos
    if (!center) {
      const enemySquads = world.squads.filter(s => s.side !== caster.side && aliveOf(s).length > 0)
      if (enemySquads.length === 0) return world
      const near = enemySquads.reduce((a, b) => dist(caster.pos, a.pos) < dist(caster.pos, b.pos) ? a : b)
      center = near.pos
    }
    // 射程外なら不発（ゲージ温存）
    if (dist(caster.pos, center) > ult.range + ult.radius) return world

    const attr = ult.attr ?? 'fire'
    let hit = 0
    for (const u of Object.values(units)) {
      if (!u.alive || u.side === caster.side) continue
      const uv = view.get(u.id)
      if (!uv || dist(uv.pos, center) > ult.radius) continue
      const sq = world.squads.find(s => s.unitIds.includes(u.id))!
      const sa = aliveOf(sq)
      const defEff = getEffectiveStats(u, sq, { aliveCount: sa.length, squadUnits: sa, tick: world.tick })
      const attrDef = defEff.defense + armorDefFor(u.armorDef, attr)
      const dmg = Math.max(1, (ult.power ?? 0) - attrDef)
      units[u.id].hp = Math.max(0, u.hp - dmg)
      units[u.id].alive = units[u.id].hp > 0
      hit++
    }
    if (hit === 0) return world // 範囲内に敵なし → 不発
    newLog.push(`[T${world.tick}] ✨${caster.name}: ${ult.icon}${ult.name}！ ${ATTRIBUTES[attr].icon}範囲${hit}体に命中`)
  } else if (ult.kind === 'squadBuff') {
    // 発動隊に時限バフを付与（仕様: 味方1隊。簡易版は自隊対象）
    const until = world.tick + (ult.durationTicks ?? 200)
    const buffEffects: LayerEffect[] = (ult.buffs ?? []).map(b => ({
      layer: 'ultimate', target: b.target, op: b.op, value: b.value,
      priority: 0, source: ult.name, scope: 'self', untilTick: until,
    }))
    for (const u of aliveOf(caster)) {
      units[u.id] = { ...units[u.id], skills: [...units[u.id].skills, ...buffEffects] }
    }
    newLog.push(`[T${world.tick}] ✨${caster.name}: ${ult.icon}${ult.name}！ 隊を強化（${((ult.durationTicks ?? 200) / 20).toFixed(0)}秒）`)
  } else if (ult.kind === 'heal') {
    // 回復（α13）。radius 0=自隊のみ / >0=発動隊中心の半径内の味方全隊。
    // 戦闘中の死者は蘇生しない（生存者のみ最大HPまで回復）。
    const amount = Math.max(0, ult.power ?? 0)
    const targets = ult.radius > 0
      ? world.squads.filter(s => s.side === caster.side && dist(caster.pos, s.pos) <= ult.range + ult.radius)
      : [caster]
    let healed = 0
    for (const sq of targets) {
      for (const u of aliveOf(sq)) {
        const before = units[u.id].hp
        const after = Math.min(u.maxHp, before + amount)
        if (after > before) { units[u.id].hp = after; healed++ }
      }
    }
    if (healed === 0) return world // 回復対象なし → 不発（ゲージ温存）
    const scope = ult.radius > 0 ? '範囲回復' : '自隊回復'
    newLog.push(`[T${world.tick}] ✨${caster.name}: ${ult.icon}${ult.name}！ ${scope}（${healed}体 +${amount}）`)
  }

  // ゲージ消費（通常必殺技のみ。アイテム発動はゲージに依存しない）
  const squads = resetGauge ? world.squads.map(s => s.id === caster.id ? { ...s, ultGauge: 0 } : s) : world.squads

  // 勝敗再判定（範囲攻撃で決着しうる・大将撃破含む）
  const outcome = checkOutcome(units)
  if (outcome.finished && outcome.winner) {
    const tag = outcome.reason === 'commander' ? '（大将討ち取り）' : ''
    newLog.push(outcome.winner === 'ally' ? `🏆 味方の勝利！${tag}` : `💀 敵の勝利！${tag}`)
  }

  return { ...world, units, squads, log: [...world.log, ...newLog].slice(-200), finished: outcome.finished, winner: outcome.winner }
}
