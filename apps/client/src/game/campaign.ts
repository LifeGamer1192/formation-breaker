import type { BattleDef, RosterUnit } from './types'

// ─── 敵ロスター（各戦場ごと）─────────────────────────────────────
function makeEnemyUnit(id: string, name: string, overrides: Partial<RosterUnit> = {}): RosterUnit {
  return {
    id,
    name,
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
    ...overrides,
  }
}

// ─── 戦場0: 初陣の平原────────────────────────────────────────────
export const BATTLE_0: BattleDef = {
  id: 'battle_0',
  name: '初陣の平原',
  allyStartX: 10,
  enemyStartX: 80,
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
  enemies: {
    units: [
      makeEnemyUnit('enemy_1_0', '敵兵士A', { hp: 75, maxHp: 75, attack: 62, defense: 56 }),
      makeEnemyUnit('enemy_1_1', '敵兵士B', { hp: 73, maxHp: 73, attack: 60, defense: 55 }),
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
  enemies: {
    units: [
      makeEnemyUnit('enemy_2_0', '敵兵士A', { hp: 85, maxHp: 85, attack: 70, defense: 65 }),
      makeEnemyUnit('enemy_2_1', '敵兵士B', { hp: 83, maxHp: 83, attack: 68, defense: 64 }),
      makeEnemyUnit('enemy_2_2', '敵兵士C', { hp: 80, maxHp: 80, attack: 65, defense: 62 }),
      makeEnemyUnit('enemy_2_3', '敵兵士D', { hp: 82, maxHp: 82, attack: 67, defense: 63 }),
      makeEnemyUnit('enemy_2_4', '敵兵士E', { hp: 81, maxHp: 81, attack: 66, defense: 61 }),
      makeEnemyUnit('enemy_2_5', '敵兵士F', { hp: 84, maxHp: 84, attack: 69, defense: 66 }),
      makeEnemyUnit('enemy_2_6', '敵兵士G', { hp: 80, maxHp: 80, attack: 64, defense: 60 }),
      makeEnemyUnit('enemy_2_7', '敵兵士H', { hp: 82, maxHp: 82, attack: 66, defense: 62 }),
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

// ─── キャンペーン戦場一覧──────────────────────────────────────────
export const CAMPAIGN = [BATTLE_0, BATTLE_1, BATTLE_2]

export function getBattleDef(battleIndex: number): BattleDef {
  return CAMPAIGN[battleIndex] ?? BATTLE_0
}
