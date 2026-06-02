import type { BattleDef, RosterUnit } from './types'

// ─── 敵ロスター（各戦場ごと）─────────────────────────────────────
function makeEnemyUnit(id: string, name: string, overrides: Partial<RosterUnit> = {}): RosterUnit {
  return {
    id,
    name,
    kind: 'general',
    side: 'enemy',
    hp: 5000,        // 仕様: ローマ兵
    maxHp: 5000,
    attack: 200,
    defense: 100,
    attackSpeed: 10,
    gaugeMax: 100,
    gauge: 0,
    alive: true,
    isLeader: false,
    skills: [],
    flankMod: -30,
    rearMod: -50,
    range: 10,
    level: 1,
    exp: 0,
    attackAttr: 'pierce', // ローマ兵は槍/弓 → 刺
    ...overrides,
  }
}

// 重装（物理に強く、火・雷に弱い）防御セット（新スケール）
const HEAVY_ARMOR = { slash: 60, pierce: 60, strike: 60 } as const
// 雷鎧（雷に強い）
const THUNDER_ARMOR = { thunder: 150 } as const

// ─── 戦場0: 初陣の平原────────────────────────────────────────────
export const BATTLE_0: BattleDef = {
  id: 'battle_0',
  name: '初陣の平原',
  allyStartX: 10,
  enemyStartX: 80,
  reward: 30,
  enemies: {
    units: [
      makeEnemyUnit('enemy_0_0', '敵兵士A'),
      makeEnemyUnit('enemy_0_1', '敵兵士B'),
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
      makeEnemyUnit('enemy_1_0', '重装ローマ兵A', { armorDef: { ...HEAVY_ARMOR } }),
      makeEnemyUnit('enemy_1_1', '重装ローマ兵B', { armorDef: { ...HEAVY_ARMOR } }),
      makeEnemyUnit('enemy_1_2', '敵兵士C'),
      makeEnemyUnit('enemy_1_3', '敵兵士D'),
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
      makeEnemyUnit('enemy_2_0', '敵兵士A'),
      makeEnemyUnit('enemy_2_1', '敵兵士B'),
      makeEnemyUnit('enemy_2_2', '敵兵士C'),
      makeEnemyUnit('enemy_2_3', '敵兵士D'),
      makeEnemyUnit('enemy_2_4', '雷鎧ローマ兵E', { armorDef: { ...THUNDER_ARMOR } }),
      makeEnemyUnit('enemy_2_5', '雷鎧ローマ兵F', { armorDef: { ...THUNDER_ARMOR } }),
      makeEnemyUnit('enemy_2_6', '雷鎧ローマ兵G', { armorDef: { ...THUNDER_ARMOR } }),
      makeEnemyUnit('enemy_2_7', '雷鎧ローマ兵H', { armorDef: { ...THUNDER_ARMOR } }),
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
      makeEnemyUnit('enemy_1b_0', 'ローマ精鋭A'),
      makeEnemyUnit('enemy_1b_1', 'ローマ精鋭B'),
      makeEnemyUnit('enemy_1b_2', '雷鎧ローマ兵C', { armorDef: { ...THUNDER_ARMOR } }),
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
