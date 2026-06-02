import type { TerrainType } from '@fb/sim-core'
import type { BattleDef, RosterUnit } from './types'

// ─── マップ1データ（仕様書「マップ1データ」厳密準拠・α15）──────────────
// 戦場1=平地/縦列ローマ兵2・戦場2=森/縦列剣2+横陣長弓2・戦場3=山/縦列剣4+横陣長弓4。
// 入軍: ハンニバル=開始(初期ロスター)・マゴ=戦場3。

// ローマ兵（基準: HP5000 攻200 防100 射程10 攻速10）。装備は数値へ織り込む。
//   none = 素 / sword = 剣(攻+50・斬)+青銅防具 / bow = 長弓(射程+40・攻速-4・刺)+青銅防具
type RomanKit = 'none' | 'sword' | 'bow'
const BRONZE_SET = { slash: 40, pierce: 40, strike: 40 } as const  // 頭+胴+小手+具足（青銅）相当

function makeRoman(id: string, name: string, kit: RomanKit): RosterUnit {
  const base: RosterUnit = {
    id, name, kind: 'general', side: 'enemy',
    hp: 5000, maxHp: 5000, attack: 200, defense: 100,
    attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true, isLeader: false,
    skills: [], flankMod: -30, rearMod: -50, range: 10, level: 1, exp: 0,
    attackAttr: 'pierce',
  }
  if (kit === 'sword') return { ...base, attack: 250, attackAttr: 'slash', armorDef: { ...BRONZE_SET } }
  if (kit === 'bow')   return { ...base, attack: 212, range: 50, attackSpeed: 6, attackAttr: 'pierce', armorDef: { ...BRONZE_SET } }
  return base
}

// ─── 戦場固有の地形（6行×10列・スポーン行1/3/5=y18/38/58 は水平に開通）──────
// 障害物は非スポーン行(0/2/4)に置き、テーマ（平地/森/山主体）を表現する。
const P: TerrainType = 'plain'
function field(theme: TerrainType): TerrainType[][] {
  return [
    [theme, theme, P,    theme, P,    theme, P,    theme, P,    P], // 行0: 障害テーマ
    [P,     P,     P,    P,     P,     P,     P,    P,     P,    P], // 行1: スポーン(開通)
    [P,     theme, P,    theme, P,     P,     theme,P,     P,    P], // 行2: 障害テーマ
    [P,     P,     P,    P,     P,     P,     P,    P,     P,    P], // 行3: スポーン(開通)
    [P,     theme, P,    P,     theme, P,     P,    theme, P,    P], // 行4: 障害テーマ
    [P,     P,     P,    P,     P,     P,     P,    P,     P,    P], // 行5: スポーン(開通)
  ]
}
export const PLAIN_FIELD    = field('plain')     // 戦場1: 平地主体
export const FOREST_FIELD   = field('forest')    // 戦場2: 森主体
export const MOUNTAIN_FIELD = field('mountain')  // 戦場3: 山主体
export const RIVER_FIELD    = field('river')     // 戦場4B: 河の防衛線
export const SWAMP_FIELD    = field('swamp')     // 戦場5: 湿地
export const DESERT_FIELD   = field('desert')    // 戦場6: 決戦の砂塵

// ─── 敵ユニーク・象（中期/後期）─────────────────────────────────────
// スキピオ・アフリカヌス（仕様 ユニーク2）。象無効化＋「学び」を持つローマの名将。
function makeScipio(): RosterUnit {
  return {
    id: 'enemy_scipio', name: 'スキピオ・アフリカヌス', kind: 'unique', side: 'enemy',
    hp: 9000, maxHp: 9000, attack: 340, defense: 100, attackSpeed: 10, gaugeMax: 100, gauge: 0,
    alive: true, isLeader: true, skills: [], flankMod: -30, rearMod: -50, range: 10, level: 1, exp: 0,
    attackAttr: 'slash', armorDef: { ...BRONZE_SET, slash: 60, pierce: 60, strike: 60 },
    ultId: 'zouMukou', canLearn: true,
  }
}

// 戦象（仕様 ランダム3）。体力半分以下で離脱。プレイヤーは象封じの銅鑼で移動不可にできる。
function makeWarElephant(id: string, name: string): RosterUnit {
  return {
    id, name, kind: 'general', side: 'enemy',
    hp: 12000, maxHp: 12000, attack: 500, defense: 10, attackSpeed: 5, gaugeMax: 100, gauge: 0,
    alive: true, isLeader: false, skills: [], flankMod: -30, rearMod: -50, range: 7, level: 1, exp: 0,
    attackAttr: 'strike', isElephant: true,
  }
}

// ─── 戦場1: 平原の遭遇戦（縦列ローマ兵2）────────────────────────────
export const BATTLE_1: BattleDef = {
  id: 'battle_1',
  name: '戦場1・平原の遭遇戦',
  allyStartX: 10, enemyStartX: 80, reward: 40,
  terrain: PLAIN_FIELD,
  enemies: {
    units: [makeRoman('r1_0', 'ローマ兵士A', 'none'), makeRoman('r1_1', 'ローマ兵士B', 'none')],
    squads: [{ id: 'r1_sq', name: '敵前衛', unitIds: ['r1_0', 'r1_1'], formation: 'column' }],
  },
}

// ─── 戦場2: 森の伏撃（縦列剣2＋横陣長弓2）──────────────────────────
export const BATTLE_2: BattleDef = {
  id: 'battle_2',
  name: '戦場2・森の伏撃',
  allyStartX: 10, enemyStartX: 80, reward: 60,
  terrain: FOREST_FIELD,
  enemies: {
    units: [
      makeRoman('r2_0', 'ローマ剣兵A', 'sword'), makeRoman('r2_1', 'ローマ剣兵B', 'sword'),
      makeRoman('r2_2', 'ローマ弓兵C', 'bow'),   makeRoman('r2_3', 'ローマ弓兵D', 'bow'),
    ],
    squads: [
      { id: 'r2_sword', name: '敵前衛', unitIds: ['r2_0', 'r2_1'], formation: 'column' },
      { id: 'r2_bow',   name: '敵後衛', unitIds: ['r2_2', 'r2_3'], formation: 'horizontal' },
    ],
  },
}

// ─── 戦場3: 山道の決戦（縦列剣4＋横陣長弓4・マゴ入軍）─────────────────
export const BATTLE_3: BattleDef = {
  id: 'battle_3',
  name: '戦場3・山道の決戦',
  allyStartX: 10, enemyStartX: 80, reward: 100,
  terrain: MOUNTAIN_FIELD,
  recruitUniques: ['mago'],  // マゴ・バルカ入軍
  recruitGenerals: 2,        // ランダム2カルタゴ兵士2名
  enemies: {
    units: [
      makeRoman('r3_0', 'ローマ剣兵A', 'sword'), makeRoman('r3_1', 'ローマ剣兵B', 'sword'),
      makeRoman('r3_2', 'ローマ剣兵C', 'sword'), makeRoman('r3_3', 'ローマ剣兵D', 'sword'),
      makeRoman('r3_4', 'ローマ弓兵E', 'bow'),   makeRoman('r3_5', 'ローマ弓兵F', 'bow'),
      makeRoman('r3_6', 'ローマ弓兵G', 'bow'),   makeRoman('r3_7', 'ローマ弓兵H', 'bow'),
    ],
    squads: [
      { id: 'r3_sword', name: '敵前衛', unitIds: ['r3_0', 'r3_1', 'r3_2', 'r3_3'], formation: 'column' },
      { id: 'r3_bow',   name: '敵本陣', unitIds: ['r3_4', 'r3_5', 'r3_6', 'r3_7'], formation: 'horizontal' },
    ],
  },
}

// ─── 中期: 戦場4（分岐A=平原の追撃 / 分岐B=河の防衛線）────────────────
export const BATTLE_4A: BattleDef = {
  id: 'battle_4a', name: '戦場4A・平原の追撃', allyStartX: 10, enemyStartX: 80, reward: 80,
  terrain: PLAIN_FIELD, recruitGenerals: 2,   // α20: 戦場3の山場後の援軍（曲線調整）
  enemies: {
    units: [
      makeRoman('r4a_0', 'ローマ剣兵A', 'sword'), makeRoman('r4a_1', 'ローマ剣兵B', 'sword'), makeRoman('r4a_2', 'ローマ剣兵C', 'sword'),
      makeRoman('r4a_3', 'ローマ弓兵D', 'bow'),   makeRoman('r4a_4', 'ローマ弓兵E', 'bow'),   makeRoman('r4a_5', 'ローマ弓兵F', 'bow'),
    ],
    squads: [
      { id: 'r4a_sw', name: '敵前衛', unitIds: ['r4a_0', 'r4a_1', 'r4a_2'], formation: 'column' },
      { id: 'r4a_bw', name: '敵後衛', unitIds: ['r4a_3', 'r4a_4', 'r4a_5'], formation: 'horizontal' },
    ],
  },
}
export const BATTLE_4B: BattleDef = {
  id: 'battle_4b', name: '戦場4B・河の防衛線', allyStartX: 10, enemyStartX: 80, reward: 85,
  terrain: RIVER_FIELD, recruitGenerals: 2,   // α20: 援軍（曲線調整）
  enemies: {
    units: [
      makeRoman('r4b_0', 'ローマ剣兵A', 'sword'), makeRoman('r4b_1', 'ローマ剣兵B', 'sword'),
      makeRoman('r4b_2', 'ローマ弓兵C', 'bow'), makeRoman('r4b_3', 'ローマ弓兵D', 'bow'),
      makeRoman('r4b_4', 'ローマ弓兵E', 'bow'), makeRoman('r4b_5', 'ローマ弓兵F', 'bow'),
    ],
    squads: [
      { id: 'r4b_sw', name: '敵前衛', unitIds: ['r4b_0', 'r4b_1'], formation: 'column' },
      { id: 'r4b_bw', name: '敵本陣', unitIds: ['r4b_2', 'r4b_3', 'r4b_4', 'r4b_5'], formation: 'horizontal' },
    ],
  },
}

// ─── 中期: 戦場5（合流・湿地の戦象）────────────────────────────────
export const BATTLE_5: BattleDef = {
  id: 'battle_5', name: '戦場5・湿地の戦象', allyStartX: 10, enemyStartX: 80, reward: 120,
  terrain: SWAMP_FIELD, recruitGenerals: 2,   // α20: 決戦前の増援（曲線調整）
  enemies: {
    units: [
      makeRoman('r5_0', 'ローマ剣兵A', 'sword'), makeRoman('r5_1', 'ローマ剣兵B', 'sword'), makeRoman('r5_2', 'ローマ剣兵C', 'sword'),
      makeRoman('r5_3', 'ローマ弓兵D', 'bow'),   makeRoman('r5_4', 'ローマ弓兵E', 'bow'),
      makeWarElephant('r5_zou', '戦象'),
    ],
    squads: [
      { id: 'r5_sw', name: '敵前衛', unitIds: ['r5_0', 'r5_1', 'r5_2'], formation: 'column' },
      { id: 'r5_zou_sq', name: '象隊', unitIds: ['r5_zou'], formation: 'solo' },
      { id: 'r5_bw', name: '敵後衛', unitIds: ['r5_3', 'r5_4'], formation: 'horizontal' },
    ],
  },
}

// ─── 後期: 戦場6（決戦・スキピオと戦象軍・大規模）──────────────────────
export const BATTLE_6: BattleDef = {
  id: 'battle_6', name: '戦場6・決戦 スキピオ', allyStartX: 10, enemyStartX: 80, reward: 200,
  terrain: DESERT_FIELD,
  enemies: {
    units: [
      makeRoman('r6_0', 'ローマ剣兵A', 'sword'), makeRoman('r6_1', 'ローマ剣兵B', 'sword'),
      makeRoman('r6_2', 'ローマ剣兵C', 'sword'), makeRoman('r6_3', 'ローマ剣兵D', 'sword'),
      makeWarElephant('r6_zou0', '戦象A'), makeWarElephant('r6_zou1', '戦象B'),
      makeScipio(), makeRoman('r6_g0', 'ローマ近衛A', 'sword'), makeRoman('r6_g1', 'ローマ近衛B', 'sword'),
    ],
    squads: [
      { id: 'r6_front', name: '敵前衛', unitIds: ['r6_0', 'r6_1', 'r6_2', 'r6_3'], formation: 'column' },
      { id: 'r6_zou', name: '象隊', unitIds: ['r6_zou0', 'r6_zou1'], formation: 'horizontal' },
      { id: 'r6_hq', name: '敵本陣', unitIds: ['enemy_scipio', 'r6_g0', 'r6_g1'], formation: 'column' },
    ],
  },
}

// ─── キャンペーン（マップ1=戦場1→2→3、中期で分岐4→合流5→決戦6・後戻り不可）──
export interface MapNode {
  id:     string
  battle: BattleDef
  next:   string[]   // クリア後に選べる次ノード
  col:    number     // レイアウト: 進行の深さ
  row:    number     // レイアウト: 分岐レーン
}

export const MAP_NODES: Record<string, MapNode> = {
  n1:  { id: 'n1',  battle: BATTLE_1,  next: ['n2'],          col: 0, row: 1 },
  n2:  { id: 'n2',  battle: BATTLE_2,  next: ['n3'],          col: 1, row: 1 },
  n3:  { id: 'n3',  battle: BATTLE_3,  next: ['n4a', 'n4b'],  col: 2, row: 1 },
  n4a: { id: 'n4a', battle: BATTLE_4A, next: ['n5'],          col: 3, row: 0 },
  n4b: { id: 'n4b', battle: BATTLE_4B, next: ['n5'],          col: 3, row: 2 },
  n5:  { id: 'n5',  battle: BATTLE_5,  next: ['n6'],          col: 4, row: 1 },
  n6:  { id: 'n6',  battle: BATTLE_6,  next: [],              col: 5, row: 1 },
}
export const START_NODE = 'n1'

export function getNode(id: string): MapNode | undefined {
  return MAP_NODES[id]
}

// 互換: 旧 CAMPAIGN（インデックス）参照が残る箇所向け
export const CAMPAIGN = [BATTLE_1, BATTLE_2, BATTLE_3, BATTLE_4A, BATTLE_4B, BATTLE_5, BATTLE_6]
