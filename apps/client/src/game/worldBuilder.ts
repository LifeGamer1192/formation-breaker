// ─── WorldState ビルダー（GameState + BattleDef → 戦闘初期World）────────
// α20: App.tsx から抽出（純ロジック）。ヘッドレスのバランステストからも利用する。

import type { WorldState, LayerEffect, AttrId } from '@fb/sim-core'
import { DEMO_TERRAIN } from '@fb/sim-core'
import type { GameState, BattleDef } from './types'
import { resolveEquip } from './equipment'
import type { OwnedEquip, ResolvedEquip } from './equipment'
import { resolveItems } from './item'
import type { OwnedItem, ResolvedItems } from './item'
import { resolveUltimate } from './ultimate'

// 属性別防御の合算
export function mergeArmor(a: Partial<Record<AttrId, number>> | undefined, b: Partial<Record<AttrId, number>>): Partial<Record<AttrId, number>> {
  const out: Partial<Record<AttrId, number>> = { ...(a ?? {}) }
  for (const [k, v] of Object.entries(b) as [AttrId, number][]) out[k] = (out[k] ?? 0) + v
  return out
}

// 装備効果を LayerEffect 列（装備レイヤー）に変換
function equipEffects(re: ResolvedEquip): LayerEffect[] {
  const fx: LayerEffect[] = []
  if (re.attackAdd)      fx.push({ layer: 'equipment', target: 'attack',      op: 'add', value: re.attackAdd,      priority: 0, source: '装備' })
  if (re.defenseAdd)     fx.push({ layer: 'equipment', target: 'defense',     op: 'add', value: re.defenseAdd,     priority: 0, source: '装備' })
  if (re.attackSpeedAdd) fx.push({ layer: 'equipment', target: 'attackSpeed', op: 'add', value: re.attackSpeedAdd, priority: 0, source: '装備' })
  return fx
}

// 装備アイテム効果（equipmentItem レイヤー＝装備とは別レイヤーで加算・α12）
function itemEffects(ri: ResolvedItems): LayerEffect[] {
  const fx: LayerEffect[] = []
  if (ri.attackAdd)      fx.push({ layer: 'equipmentItem', target: 'attack',      op: 'add', value: ri.attackAdd,      priority: 0, source: '装備アイテム' })
  if (ri.defenseAdd)     fx.push({ layer: 'equipmentItem', target: 'defense',     op: 'add', value: ri.defenseAdd,     priority: 0, source: '装備アイテム' })
  if (ri.attackSpeedAdd) fx.push({ layer: 'equipmentItem', target: 'attackSpeed', op: 'add', value: ri.attackSpeedAdd, priority: 0, source: '装備アイテム' })
  return fx
}

// WorldState を GameState + BattleDef から動的生成
export function makeWorldFromSetup(gameState: GameState, battleDef: BattleDef): WorldState {
  const allyUnits: Record<string, WorldState['units'][string]> = {}
  const enemyUnits: Record<string, WorldState['units'][string]> = {}

  const ownedByUid = new Map<string, OwnedEquip>(gameState.inventory.map(o => [o.uid, o]))
  const itemByUid  = new Map<string, OwnedItem>(gameState.items.map(o => [o.uid, o]))
  // 隊ごとの装備・装備アイテム解決を事前計算（ユニット・隊の両方で使う）
  const reBySquad = new Map<string, ResolvedEquip>(
    gameState.squads.map(s => [s.id, resolveEquip(s.equip, ownedByUid)]),
  )
  const riBySquad = new Map<string, ResolvedItems>(
    gameState.squads.map(s => [s.id, resolveItems(s.itemUids, itemByUid)]),
  )

  // 味方ユニット（GameState.roster + squads + 隊装備 + 装備アイテム）
  for (const squad of gameState.squads) {
    const re = reBySquad.get(squad.id)!
    const ri = riBySquad.get(squad.id)!
    for (const unitId of squad.unitIds) {
      const rosterUnit = gameState.roster.find(u => u.id === unitId)
      if (rosterUnit) {
        allyUnits[unitId] = {
          id: rosterUnit.id,
          name: rosterUnit.name,
          side: 'ally',
          hp: Math.max(1, Math.min(rosterUnit.maxHp, rosterUnit.hp)), // α12: HP永続（現在HPで出撃）
          maxHp: rosterUnit.maxHp,
          attack: rosterUnit.attack,
          defense: rosterUnit.defense,
          attackSpeed: rosterUnit.attackSpeed,
          gaugeMax: rosterUnit.gaugeMax,
          gauge: 0,
          alive: true,
          isLeader: squad.unitIds[0] === unitId,
          skills: [...rosterUnit.skills, ...equipEffects(re), ...itemEffects(ri)],
          flankMod: rosterUnit.flankMod,
          rearMod: rosterUnit.rearMod,
          range: rosterUnit.range + re.rangeAdd + ri.rangeAdd,
          attackAttr: re.attackAttr ?? rosterUnit.attackAttr,
          armorDef: mergeArmor(mergeArmor(rosterUnit.armorDef, re.armorDef), ri.armorDef),
          regen: (re.regenAdd + ri.regenAdd) || undefined,
          techniques: rosterUnit.techniques?.map(t => ({ ...t, gauge: 0 })),
          canLearn: rosterUnit.canLearn,   // α13: 学び（隊スキル）
        }
      }
    }
  }

  // 敵ユニット（BattleDef.enemies）
  for (const squad of battleDef.enemies.squads) {
    for (const unitId of squad.unitIds) {
      const rosterUnit = battleDef.enemies.units.find(u => u.id === unitId)
      if (rosterUnit) {
        enemyUnits[unitId] = {
          id: rosterUnit.id,
          name: rosterUnit.name,
          side: 'enemy',
          hp: rosterUnit.maxHp,
          maxHp: rosterUnit.maxHp,
          attack: rosterUnit.attack,
          defense: rosterUnit.defense,
          attackSpeed: rosterUnit.attackSpeed,
          gaugeMax: rosterUnit.gaugeMax,
          gauge: 0,
          alive: true,
          isLeader: squad.unitIds[0] === unitId,
          skills: rosterUnit.skills,
          flankMod: rosterUnit.flankMod,
          rearMod: rosterUnit.rearMod,
          range: rosterUnit.range,
          attackAttr: rosterUnit.attackAttr,
          armorDef: rosterUnit.armorDef,
          isElephant: rosterUnit.isElephant,   // α14: 象（敵に配置時）
          canLearn: rosterUnit.canLearn,        // α13: 学び（敵に配置時）
        }
      }
    }
  }

  // α8: 大将＝最後尾の隊のリーダー（撃破で陣営敗北）
  const allyRear = gameState.squads.filter(s => s.unitIds.length > 0).slice(-1)[0]
  const allyCmdId = allyRear?.unitIds[0]
  if (allyCmdId && allyUnits[allyCmdId]) allyUnits[allyCmdId].isCommander = true
  const enemyRear = battleDef.enemies.squads.filter(s => s.unitIds.length > 0).slice(-1)[0]
  const enemyCmdId = enemyRear?.unitIds[0]
  if (enemyCmdId && enemyUnits[enemyCmdId]) enemyUnits[enemyCmdId].isCommander = true

  const allySquads = gameState.squads.map(s => {
    const re = reBySquad.get(s.id)!
    const ri = riBySquad.get(s.id)!
    // 隊の必殺技はリーダー（先頭ユニット）の ultId から解決
    const leader = gameState.roster.find(u => u.id === s.unitIds[0])
    const ult = resolveUltimate(leader?.ultId, leader?.level)
    return {
      id: s.id,
      name: s.name,
      side: 'ally' as const,
      unitIds: s.unitIds,
      formation: s.formation,
      pos: { x: battleDef.allyStartX, y: 18 + gameState.squads.indexOf(s) * 20 },
      facing: 0,
      moveQueue: [] as { x: number; y: number }[],
      moveSpeed: 1.0 * (1 + (re.moveMultPct + ri.moveMultPct) / 100),
      movementType: re.moveType ?? 'forest',   // α13: 装備（軍馬の鞍等）で移動タイプ変更
      ult,
      ultGauge: 0,
    }
  })

  const enemySquads = battleDef.enemies.squads.map((s, idx) => ({
    id: s.id,
    name: s.name,
    side: 'enemy' as const,
    unitIds: s.unitIds,
    formation: s.formation,
    pos: { x: battleDef.enemyStartX, y: 18 + idx * 20 },
    facing: Math.PI,
    moveQueue: [] as { x: number; y: number }[],
    moveSpeed: 1.0,
    movementType: 'plain' as const,
    // 敵AI: 「後衛/本陣」は離れて戦う rear、それ以外は接近する front（隊ごと）
    ai: (s.name.includes('後衛') || s.name.includes('本陣') ? 'rear' : 'front') as 'front' | 'rear',
  }))

  return {
    tick: 0,
    units: { ...allyUnits, ...enemyUnits },
    squads: [...allySquads, ...enemySquads],
    log: [],
    finished: false,
    winner: null,
    // α8/α15: 戦闘ごとに地形を複製（戦場固有 terrain があれば優先・なければ DEMO_TERRAIN）
    terrain: (battleDef.terrain ?? DEMO_TERRAIN).map(row => [...row]),
    terrainDmg: {},
  }
}
