import type { WorldState, UnitState, FormationType, AttrId, MovementType, TerrainType, LayerEffect } from '@fb/sim-core'
import { DEMO_TERRAIN } from '@fb/sim-core'
import { resolveUltimate } from './ultimate'
import { makeTechniques } from './technique'

// ─── インポート局地戦シナリオ（仕様書 L254-257）────────────────────
// 地形＋両軍データを JSON で投入し、任意の局地戦をシミュレータで再現する。
// スキル/必殺技/技は ID で参照（データ駆動）。ユニット数値は自己完結。

export interface ScenarioUnit {
  id: string
  name: string
  hp: number
  attack: number
  defense: number
  attackSpeed?: number
  range?: number
  gaugeMax?: number
  attackAttr?: AttrId
  armorDef?: Partial<Record<AttrId, number>>
  isLeader?: boolean
  ultId?: string          // 必殺技カタログID（リーダー時に隊へ）
  techniques?: string[]   // 技カタログID列
  skills?: LayerEffect[]  // 効果（インライン）
  flankMod?: number
  rearMod?: number
}

export interface ScenarioSquad {
  id: string
  name: string
  unitIds: string[]
  formation: FormationType
  pos: { x: number; y: number }
  facing?: number
  moveSpeed?: number
  movementType?: MovementType
}

export interface BattleScenario {
  name: string
  terrain?: TerrainType[][]
  ally:  { units: ScenarioUnit[]; squads: ScenarioSquad[] }
  enemy: { units: ScenarioUnit[]; squads: ScenarioSquad[] }
}

function buildUnit(u: ScenarioUnit, side: 'ally' | 'enemy', isLeader: boolean): UnitState {
  return {
    id: u.id, name: u.name, side,
    hp: u.hp, maxHp: u.hp, attack: u.attack, defense: u.defense,
    attackSpeed: u.attackSpeed ?? 1, gaugeMax: u.gaugeMax ?? 100, gauge: 0, alive: true,
    isLeader, skills: u.skills ?? [],
    flankMod: u.flankMod ?? -30, rearMod: u.rearMod ?? -50, range: u.range ?? 20,
    attackAttr: u.attackAttr, armorDef: u.armorDef,
    techniques: u.techniques && u.techniques.length ? makeTechniques(u.techniques) : undefined,
  }
}

// シナリオ → WorldState（BattleScreen でそのまま実行可能）
export function scenarioToWorld(scn: BattleScenario): WorldState {
  const units: Record<string, UnitState> = {}

  const buildSide = (army: BattleScenario['ally'], side: 'ally' | 'enemy') => {
    const byId = new Map(army.units.map(u => [u.id, u]))
    return army.squads.map(sq => {
      sq.unitIds.forEach((uid, i) => {
        const su = byId.get(uid)
        if (su) units[uid] = buildUnit(su, side, i === 0)
      })
      const leader = byId.get(sq.unitIds[0])
      return {
        id: sq.id, name: sq.name, side, unitIds: [...sq.unitIds], formation: sq.formation,
        pos: { ...sq.pos }, facing: sq.facing ?? (side === 'ally' ? 0 : Math.PI),
        moveQueue: [] as { x: number; y: number }[],
        moveSpeed: sq.moveSpeed ?? 1, movementType: sq.movementType ?? 'plain',
        ult: resolveUltimate(leader?.ultId, 1), ultGauge: 0,
        // 敵側はAIで動く（後衛/本陣=rear、他=front）
        ai: side === 'enemy' ? ((sq.name.includes('後衛') || sq.name.includes('本陣')) ? 'rear' as const : 'front' as const) : undefined,
      }
    })
  }

  const allySquads = buildSide(scn.ally, 'ally')
  const enemySquads = buildSide(scn.enemy, 'enemy')

  // 大将＝各陣営最後尾の隊のリーダー
  const allyRear = allySquads.filter(s => s.unitIds.length > 0).slice(-1)[0]
  if (allyRear && units[allyRear.unitIds[0]]) units[allyRear.unitIds[0]].isCommander = true
  const enemyRear = enemySquads.filter(s => s.unitIds.length > 0).slice(-1)[0]
  if (enemyRear && units[enemyRear.unitIds[0]]) units[enemyRear.unitIds[0]].isCommander = true

  return {
    tick: 0, units, squads: [...allySquads, ...enemySquads],
    log: [], finished: false, winner: null,
    terrain: (scn.terrain ?? DEMO_TERRAIN).map(r => [...r]), terrainDmg: {},
  }
}

// ─── バリデーション付きパース ─────────────────────────────────────
function validate(o: any): string | null {
  if (!o || typeof o !== 'object') return 'JSON がオブジェクトではありません'
  if (typeof o.name !== 'string') return 'name（文字列）が必要です'
  for (const side of ['ally', 'enemy'] as const) {
    const army = o[side]
    if (!army) return `${side} がありません`
    if (!Array.isArray(army.units)) return `${side}.units が配列ではありません`
    if (!Array.isArray(army.squads)) return `${side}.squads が配列ではありません`
    const ids = new Set<string>()
    for (const u of army.units) {
      if (!u || typeof u.id !== 'string' || typeof u.name !== 'string') return `${side}: unit に id/name（文字列）が必要`
      for (const f of ['hp', 'attack', 'defense'] as const) {
        if (typeof u[f] !== 'number') return `${side} unit「${u.id}」: ${f} は数値が必要`
      }
      ids.add(u.id)
    }
    if (army.squads.length === 0) return `${side}.squads が空です`
    for (const sq of army.squads) {
      if (!sq || typeof sq.id !== 'string' || !Array.isArray(sq.unitIds)) return `${side}: squad に id/unitIds が必要`
      if (!sq.pos || typeof sq.pos.x !== 'number' || typeof sq.pos.y !== 'number') return `${side} squad「${sq.id}」: pos{x,y} が必要`
      if (sq.unitIds.length === 0) return `${side} squad「${sq.id}」: unitIds が空です`
      for (const uid of sq.unitIds) if (!ids.has(uid)) return `${side} squad「${sq.id}」: 未定義ユニット「${uid}」`
    }
  }
  return null
}

export function parseScenario(text: string): { ok: true; scenario: BattleScenario } | { ok: false; error: string } {
  let obj: any
  try { obj = JSON.parse(text) } catch (e) { return { ok: false, error: 'JSON構文エラー: ' + String(e) } }
  const err = validate(obj)
  if (err) return { ok: false, error: err }
  return { ok: true, scenario: obj as BattleScenario }
}

// ─── サンプルシナリオ（フォーマット例）─────────────────────────────
export const SAMPLE_SCENARIO: BattleScenario = {
  name: 'サンプル局地戦：雷神 vs 重装兵',
  ally: {
    units: [
      { id: 'a_han', name: 'ハンニバル', hp: 120, attack: 90, defense: 70, attackSpeed: 1.2, range: 20, attackAttr: 'thunder', ultId: 'raikou', techniques: ['warStance'], isLeader: true },
      { id: 'a_sol', name: 'カルタゴ兵', hp: 80, attack: 65, defense: 55, attackSpeed: 1.0, range: 20, attackAttr: 'fire', techniques: ['fireball'] },
    ],
    squads: [
      { id: 'a_sq', name: '前衛', unitIds: ['a_han', 'a_sol'], formation: 'horizontal', pos: { x: 20, y: 30 } },
    ],
  },
  enemy: {
    units: [
      { id: 'e0', name: '重装ローマ兵A', hp: 90, attack: 60, defense: 60, attackAttr: 'pierce', armorDef: { slash: 25, pierce: 25, strike: 25 } },
      { id: 'e1', name: '重装ローマ兵B', hp: 90, attack: 60, defense: 60, attackAttr: 'pierce', armorDef: { slash: 25, pierce: 25, strike: 25 } },
      { id: 'e_cmd', name: 'ローマ百人隊長', hp: 110, attack: 70, defense: 70, attackAttr: 'slash', isLeader: true },
    ],
    squads: [
      { id: 'e_front', name: '敵前衛', unitIds: ['e0', 'e1'], formation: 'square', pos: { x: 75, y: 30 } },
      { id: 'e_rear', name: '敵本陣', unitIds: ['e_cmd'], formation: 'solo', pos: { x: 90, y: 30 } },
    ],
  },
}
