import type { BattleDef, RosterUnit } from './types'

// ─── 敵ロスター（各戦場ごと）─────────────────────────────────────
function makeEnemyUnit(id: string, name: string, overrides: Partial<RosterUnit> = {}): RosterUnit {
  return {
    id,
    name,
    kind: 'general',
    side: 'enemy',
    hp: 70,
    maxHp: 70,
    attack: 60,
    defense: 55,
    attackSpeed: 1.0,
    gaugeMax: 100,
    gauge: 0,
    alive: true,
    isLeader: false,
    skills: [],
    flankMod: -30,
    rearMod: -50,
    range: 20,
    level: 1,
    exp: 0,
    attackAttr: 'pierce', // ローマ兵は槍/弓 → 刺
    ...overrides,
  }
}

// 重装（物理に強く、火・雷に弱い）防御セット
const HEAVY_ARMOR = { slash: 25, pierce: 25, strike: 25 } as const
// 雷鎧（雷に強い）
const THUNDER_ARMOR = { thunder: 40 } as const

// ─── 戦場0: 初陣の平原────────────────────────────────────────────
export const BATTLE_0: BattleDef = {
  id: 'battle_0',
  name: '初陣の平原',
  allyStartX: 10,
  enemyStartX: 80,
  reward: 30,
  enemies: {
    units: [
      makeEnemyUnit('enemy_0_0', '敵兵士A', { hp: 70, maxHp: 70, attack: 55, defense: 50 }),
      makeEnemyUnit('enemy_0_1', '敵兵士B', { hp: 68, maxHp: 68, attack: 57, defense: 51 }),
    ],
    squads: [
      {
        id: 'enemy_squad_0',
        name: '敵前衛',
        unitIds: ['enemy_0_0', 'enemy_0_1'],
        formation: 'horizontal',
      },
    ],
  },
}

// ─── 戦場1: 森の伏兵────────────────────────────────────────────────
export const BATTLE_1: BattleDef = {
  id: 'battle_1',
  name: '森の伏兵',
  allyStartX: 10,
  enemyStartX: 80,
  reward: 50,
  recruitGenerals: 2,
  enemies: {
    units: [
      makeEnemyUnit('enemy_1_0', '重装ローマ兵A', { hp: 75, maxHp: 75, attack: 62, defense: 56, armorDef: { ...HEAVY_ARMOR } }),
      makeEnemyUnit('enemy_1_1', '重装ローマ兵B', { hp: 73, maxHp: 73, attack: 60, defense: 55, armorDef: { ...HEAVY_ARMOR } }),
      makeEnemyUnit('enemy_1_2', '敵兵士C', { hp: 72, maxHp: 72, attack: 61, defense: 54 }),
      makeEnemyUnit('enemy_1_3', '敵兵士D', { hp: 74, maxHp: 74, attack: 59, defense: 56 }),
    ],
    squads: [
      {
        id: 'enemy_squad_1a',
        name: '敵前衛',
        unitIds: ['enemy_1_0', 'enemy_1_1'],
        formation: 'horizontal',
      },
      {
        id: 'enemy_squad_1b',
        name: '敵後衛',
        unitIds: ['enemy_1_2', 'enemy_1_3'],
        formation: 'horizontal',
      },
    ],
  },
}

// ─── 戦場2: 要塞の攻防────────────────────────────────────────────
export const BATTLE_2: BattleDef = {
  id: 'battle_2',
  name: '要塞の攻防',
  allyStartX: 10,
  enemyStartX: 80,
  reward: 80,
  recruitGenerals: 2,
  enemies: {
    units: [
      makeEnemyUnit('enemy_2_0', '敵兵士A', { hp: 85, maxHp: 85, attack: 70, defense: 65 }),
      makeEnemyUnit('enemy_2_1', '敵兵士B', { hp: 83, maxHp: 83, attack: 68, defense: 64 }),
      makeEnemyUnit('enemy_2_2', '敵兵士C', { hp: 80, maxHp: 80, attack: 65, defense: 62 }),
      makeEnemyUnit('enemy_2_3', '敵兵士D', { hp: 82, maxHp: 82, attack: 67, defense: 63 }),
      makeEnemyUnit('enemy_2_4', '雷鎧ローマ兵E', { hp: 81, maxHp: 81, attack: 66, defense: 61, armorDef: { ...THUNDER_ARMOR } }),
      makeEnemyUnit('enemy_2_5', '雷鎧ローマ兵F', { hp: 84, maxHp: 84, attack: 69, defense: 66, armorDef: { ...THUNDER_ARMOR } }),
      makeEnemyUnit('enemy_2_6', '雷鎧ローマ兵G', { hp: 80, maxHp: 80, attack: 64, defense: 60, armorDef: { ...THUNDER_ARMOR } }),
      makeEnemyUnit('enemy_2_7', '雷鎧ローマ兵H', { hp: 82, maxHp: 82, attack: 66, defense: 62, armorDef: { ...THUNDER_ARMOR } }),
    ],
    squads: [
      {
        id: 'enemy_squad_2a',
        name: '敵前衛',
        unitIds: ['enemy_2_0', 'enemy_2_1'],
        formation: 'horizontal',
      },
      {
        id: 'enemy_squad_2b',
        name: '敵中衛',
        unitIds: ['enemy_2_2', 'enemy_2_3'],
        formation: 'horizontal',
      },
      {
        id: 'enemy_squad_2c',
        name: '敵後衛',
        unitIds: ['enemy_2_4', 'enemy_2_5', 'enemy_2_6', 'enemy_2_7'],
        formation: 'square',
      },
    ],
  },
}

// ─── 戦場1B: 山道の奇襲（分岐先）─────────────────────────────────
export const BATTLE_1B: BattleDef = {
  id: 'battle_1b',
  name: '山道の奇襲',
  allyStartX: 10,
  enemyStartX: 80,
  reward: 55,
  recruitGenerals: 2,
  enemies: {
    units: [
      makeEnemyUnit('enemy_1b_0', 'ローマ精鋭A', { hp: 80, maxHp: 80, attack: 66, defense: 60 }),
      makeEnemyUnit('enemy_1b_1', 'ローマ精鋭B', { hp: 78, maxHp: 78, attack: 64, defense: 58 }),
      makeEnemyUnit('enemy_1b_2', '雷鎧ローマ兵C', { hp: 82, maxHp: 82, attack: 62, defense: 56, armorDef: { ...THUNDER_ARMOR } }),
    ],
    squads: [
      { id: 'enemy_squad_1b_a', name: '敵前衛', unitIds: ['enemy_1b_0', 'enemy_1b_1'], formation: 'square' },
      { id: 'enemy_squad_1b_b', name: '敵後衛', unitIds: ['enemy_1b_2'], formation: 'solo' },
    ],
  },
}

// ─── キャンペーン（ノードグラフ・α8）────────────────────────────────
// 一本道 → 分岐（中期）→ 合流。後戻りはできない（frontier で制御）。
export interface MapNode {
  id:     string
  battle: BattleDef
  next:   string[]   // クリア後に選べる次ノード
  col:    number     // レイアウト: 進行の深さ
  row:    number     // レイアウト: 分岐レーン
}

export const MAP_NODES: Record<string, MapNode> = {
  n0:  { id: 'n0',  battle: BATTLE_0,  next: ['n1a', 'n1b'], col: 0, row: 1 },
  n1a: { id: 'n1a', battle: BATTLE_1,  next: ['n2'],         col: 1, row: 0 },
  n1b: { id: 'n1b', battle: BATTLE_1B, next: ['n2'],         col: 1, row: 2 },
  n2:  { id: 'n2',  battle: BATTLE_2,  next: [],             col: 2, row: 1 },
}
export const START_NODE = 'n0'

export function getNode(id: string): MapNode | undefined {
  return MAP_NODES[id]
}

// 互換: 旧 CAMPAIGN（インデックス）参照が残る箇所向け
export const CAMPAIGN = [BATTLE_0, BATTLE_1, BATTLE_2]
