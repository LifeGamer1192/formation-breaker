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

// ─── キャンペーン（マップ1=戦場1→2→3の一本道・後戻り不可）──────────────
export interface MapNode {
  id:     string
  battle: BattleDef
  next:   string[]   // クリア後に選べる次ノード
  col:    number     // レイアウト: 進行の深さ
  row:    number     // レイアウト: 分岐レーン
}

export const MAP_NODES: Record<string, MapNode> = {
  n1: { id: 'n1', battle: BATTLE_1, next: ['n2'], col: 0, row: 1 },
  n2: { id: 'n2', battle: BATTLE_2, next: ['n3'], col: 1, row: 1 },
  n3: { id: 'n3', battle: BATTLE_3, next: [],     col: 2, row: 1 },
}
export const START_NODE = 'n1'

export function getNode(id: string): MapNode | undefined {
  return MAP_NODES[id]
}

// 互換: 旧 CAMPAIGN（インデックス）参照が残る箇所向け
export const CAMPAIGN = [BATTLE_1, BATTLE_2, BATTLE_3]
