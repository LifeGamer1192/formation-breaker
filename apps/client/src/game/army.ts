import { mulberry32, ATTR_IDS } from '@fb/sim-core'
import type { FormationType, LayerEffect, StatId, EffectOp } from '@fb/sim-core'
import type { RosterUnit, GameState, SquadSetup } from './types'
import { makeInitialInventory } from './equipment'
import { makeInitialItems } from './item'
import { makeInitialUltItems } from './ultItem'
import { getModRoster } from './mod'
import { SKILLS } from './skills'
import { makeTechniques } from './technique'
import { START_NODE } from './campaign'

// ─── 初期兵士ロスター（カルタゴ陣営）──────────────────────────────
export function makeInitialRoster(): RosterUnit[] {
  // α16: Mod が初期ロスターを差し替えていれば、それを使う（新規ゲームのみ）
  const mr = getModRoster()
  if (mr && mr.length) return mr.map(u => ({ ...u }))
  return [
    {
      id: 'unit_hannibal',
      name: 'ハンニバル',
      kind: 'unique',
      forced: true,
      side: 'ally',
      attackAttr: 'thunder',
      ultId: 'raikou',
      hp: 10000,
      maxHp: 10000,
      attack: 300,
      defense: 85,
      attackSpeed: 12,
      gaugeMax: 100,
      gauge: 0,
      alive: true,
      isLeader: true,
      skills: SKILLS.rally.effects,
      techniques: makeTechniques(['warStance']),
      flankMod: -30,
      rearMod: -50,
      range: 10,
      level: 1,
      exp: 0,
    },
    {
      id: 'unit_carthage_a',
      name: 'カルタゴ兵A',
      kind: 'general',
      side: 'ally',
      attackAttr: 'slash',
      hp: 4000,
      maxHp: 4000,
      attack: 230,
      defense: 85,
      attackSpeed: 10,
      gaugeMax: 100,
      gauge: 0,
      alive: true,
      isLeader: false,
      skills: SKILLS.warcry.effects,
      techniques: makeTechniques(['throwBlade']),
      flankMod: -30,
      rearMod: -50,
      range: 10,
      level: 1,
      exp: 0,
    },
    {
      id: 'unit_carthage_b',
      name: 'カルタゴ兵B',
      kind: 'general',
      side: 'ally',
      attackAttr: 'pierce',
      hp: 4000,
      maxHp: 4000,
      attack: 235,
      defense: 86,
      attackSpeed: 10,
      gaugeMax: 100,
      gauge: 0,
      alive: true,
      isLeader: false,
      skills: SKILLS.unyielding.effects,
      flankMod: -30,
      rearMod: -50,
      range: 10,
      level: 1,
      exp: 0,
    },
    {
      id: 'unit_carthage_c',
      name: 'カルタゴ兵C',
      kind: 'general',
      side: 'ally',
      attackAttr: 'strike',
      hp: 4200,
      maxHp: 4200,
      attack: 225,
      defense: 88,
      attackSpeed: 10,
      gaugeMax: 100,
      gauge: 0,
      alive: true,
      isLeader: false,
      skills: SKILLS.blitz.effects,
      canLearn: true,   // α13: 「学び」隊スキル（交戦した敵隊のスキルをコピー）
      flankMod: -30,
      rearMod: -50,
      range: 10,
      level: 1,
      exp: 0,
    },
  ]
}

// ─── ユニーク入軍ビルダー（α15: 戦場ごとの入軍イベント）──────────────
// マゴ・バルカ（仕様 戦場3で入軍）。火属性の追撃技と戦陣鼓舞を持つ。
export function makeMago(): RosterUnit {
  return {
    id: 'unit_mago',
    name: 'マゴ・バルカ',
    kind: 'unique',
    forced: true,
    side: 'ally',
    attackAttr: 'slash',
    ultId: 'senjin',
    hp: 8000,
    maxHp: 8000,
    attack: 240,
    defense: 50,
    attackSpeed: 10,
    gaugeMax: 100,
    gauge: 0,
    alive: true,
    isLeader: true,
    skills: SKILLS.ironwall.effects,
    techniques: makeTechniques(['fireball']),
    flankMod: -30,
    rearMod: -50,
    range: 10,
    level: 1,
    exp: 0,
  }
}

// ユニークID → ビルダー（recruitUniques で参照）
export const UNIQUE_RECRUITS: Record<string, () => RosterUnit> = {
  mago: makeMago,
}

// ─── レベルアップ判定・処理────────────────────────────────────────
export function checkLevelUp(unit: RosterUnit): RosterUnit {
  const expNeeded = unit.level * 100
  if (unit.exp < expNeeded) return unit

  // level up
  const newLevel = unit.level + 1
  const statBonus = 1.05  // 5% increase

  return {
    ...unit,
    level: newLevel,
    exp: unit.exp - expNeeded,  // 超過分は持ち越し
    maxHp:       Math.round(unit.maxHp * statBonus),
    attack:      Math.round(unit.attack * statBonus),
    defense:     Math.round(unit.defense * statBonus),
    hp:          Math.round(unit.hp * statBonus),  // HP も回復率で上げる
  }
}

// ─── 全ユニットをレベルアップチェック───────────────────────────────
export function applyLevelUps(roster: RosterUnit[]): { roster: RosterUnit[]; leveledUpIds: string[] } {
  const leveledUpIds: string[] = []
  const newRoster = roster.map(u => {
    let current = u
    let prevLevel = u.level
    while (current.exp >= current.level * 100) {
      current = checkLevelUp(current)
    }
    if (current.level > prevLevel) leveledUpIds.push(u.id)
    return current
  })
  return { roster: newRoster, leveledUpIds }
}

// ─── 戦闘参加時のXP付与（仕様書 L273-276 準拠）────────────────────
// 1戦闘でほぼ1-2レベルアップする量。リーダーは部下数で0-50%増、勝利(トドメ)で+50%。
export function awardXp(roster: RosterUnit[], participantIds: string[], killCount: number, won: boolean): RosterUnit[] {
  return roster.map(u => {
    if (!participantIds.includes(u.id)) return u
    let xp = 50 + killCount * 15  // 参加 + 撃破ボーナス
    // リーダーボーナス: 部下数 × 10%（最大 +50%）
    if (u.isLeader) {
      const subs = participantIds.filter(id => {
        const p = roster.find(r => r.id === id)
        return p && !p.isLeader
      }).length
      xp = Math.round(xp * (1 + Math.min(5, subs) * 0.1))
    }
    if (won) xp = Math.round(xp * 1.5) // トドメ（勝利）ボーナス +50%
    return { ...u, exp: u.exp + xp }
  })
}

// 既存全兵士の平均レベル（四捨五入・最低1）。ランダム兵士の入隊レベルに使う。
export function avgLevel(roster: RosterUnit[]): number {
  if (roster.length === 0) return 1
  return Math.max(1, Math.round(roster.reduce((s, u) => s + u.level, 0) / roster.length))
}

// ─── デバッグ用: 全兵士のステータスリセット─────────────────────────
export function resetAllUnits(roster: RosterUnit[]): RosterUnit[] {
  return roster.map(u => ({ ...u, hp: u.maxHp, alive: true, gauge: 0 }))
}

// ─── 初期 GameState 作成────────────────────────────────────────────
export function makeInitialGameState(): GameState {
  return {
    roster: makeInitialRoster(),
    squads: [],
    gold: 0,
    tokens: 0,
    potions: 3,
    inventory: makeInitialInventory(),
    items: makeInitialItems(),
    ultItems: makeInitialUltItems(),
    recruitedBattles: [],
    clearedNodes: [],
    frontier: [START_NODE],
    log: ['キャンペーン開始'],
  }
}

// ─── トークン経済（Proto#3）───────────────────────────────────────
export const PER_KILL_BONUS = 10
export const MERCENARY_COST = 50

// 勝利報酬 = 基礎報酬 + 撃破数 × ボーナス
export function calcBattleReward(reward: number, killCount: number): number {
  return reward + killCount * PER_KILL_BONUS
}

// 一般兵生成（傭兵・援軍で共用）。Math.random 禁止のため mulberry32 を使用。
const MERC_NAMES = ['ヌミディア騎兵', 'イベリア兵', 'ガリア傭兵', 'バレアレス投石兵', 'リビア槍兵']

// ランダム特性プール（仕様書 L154: 加入時にランダムで付与）
// 個人スキルレイヤー（自分のみ）。mul=百分率（+15等）、add=実数加算。
const tfx = (name: string, target: StatId, op: EffectOp, value: number): LayerEffect =>
  ({ layer: 'personalSkill', target, op, value, priority: 0, source: name, scope: 'self' })
const TRAITS: { name: string; effects: RosterUnit['skills'] }[] = [
  // 既存（スキル由来）
  { name: '不屈',     effects: SKILLS.unyielding.effects },
  { name: '電光石火', effects: SKILLS.blitz.effects },
  { name: '猛き血',   effects: SKILLS.warcry.effects },
  { name: '無骨',     effects: [] },
  // α拡張: ステ系特性
  { name: '剛力',     effects: [tfx('剛力', 'attack', 'mul', 15)] },
  { name: '鉄壁',     effects: [tfx('鉄壁', 'defense', 'mul', 20)] },
  { name: '俊敏',     effects: [tfx('俊敏', 'attackSpeed', 'mul', 15)] },
  { name: '頑健',     effects: [tfx('頑健', 'maxHp', 'mul', 15)] },
  { name: '精密',     effects: [tfx('精密', 'attack', 'add', 25)] },
  { name: '狂戦士',   effects: [tfx('狂戦士', 'attack', 'mul', 25), tfx('狂戦士', 'defense', 'mul', -15)] },
  { name: '守勢',     effects: [tfx('守勢', 'defense', 'mul', 25), tfx('守勢', 'attackSpeed', 'mul', -10)] },
  { name: '巨漢',     effects: [tfx('巨漢', 'maxHp', 'mul', 25), tfx('巨漢', 'attackSpeed', 'mul', -10)] },
]

function makeGeneral(seed: number, id: string, name: string, lvl: number): RosterUnit {
  const rng = mulberry32(seed)
  const pick = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1))
  const trait = TRAITS[pick(0, TRAITS.length - 1)]
  const scale = Math.pow(1.05, Math.max(0, lvl - 1)) // 平均レベル相当に底上げ
  // 一般兵は仕様の「カルタゴ兵」基準（HP4000/攻230/防85）にばらつき
  const hp = Math.round(pick(3600, 4400) * scale)
  return {
    id,
    name,
    kind: 'general',
    side: 'ally',
    attackAttr: ATTR_IDS[pick(0, ATTR_IDS.length - 1)],
    hp,
    maxHp: hp,
    attack: Math.round(pick(200, 250) * scale),
    defense: Math.round(pick(75, 95) * scale),
    attackSpeed: pick(9, 11),
    gaugeMax: 100,
    gauge: 0,
    alive: true,
    isLeader: false,
    skills: trait.effects,
    traitName: trait.name,
    flankMod: -30,
    rearMod: -50,
    range: 10,
    level: Math.max(1, lvl),
    exp: 0,
  }
}

// 傭兵購入（ランダム一般・入隊レベル=平均）
export function generateMercenary(seed: number, lvl = 1): RosterUnit {
  const nameRng = mulberry32(seed * 13 + 1)
  const name = `傭兵・${MERC_NAMES[Math.floor(nameRng() * MERC_NAMES.length)]}`
  return makeGeneral(seed, `merc_${seed}`, name, lvl)
}

// 強制加入の援軍（一般・複数）
export function makeRecruitGenerals(seed: number, count: number, lvl: number): RosterUnit[] {
  return Array.from({ length: count }, (_, i) =>
    makeGeneral(seed + i * 131 + 7, `recruit_${seed}_${i}`, `援軍カルタゴ兵${i + 1}`, lvl))
}

// ─── オート編成（roster を各隊に自動配分）─────────────────────────
// リーダーを各隊の先頭（=隊長）に置き、残りを戦力順でラウンドロビン配分する。
// squadDefs の id/name/formation は維持し、unitIds のみ再割当する。
export function autoArrange(
  roster: RosterUnit[],
  squadDefs: { id: string; name: string; formation: FormationType }[],
): SquadSetup[] {
  const MAX_PER_SQUAD = 5
  const power = (u: RosterUnit) => u.attack + u.defense + u.maxHp
  const leaders = roster.filter(u => u.isLeader).sort((a, b) => power(b) - power(a))
  const others = roster.filter(u => !u.isLeader).sort((a, b) => power(b) - power(a))

  const squads: SquadSetup[] = squadDefs.map(d => ({ ...d, unitIds: [] as string[] }))

  // ① 各隊の先頭にリーダーを配置
  leaders.slice(0, squads.length).forEach((l, i) => squads[i].unitIds.push(l.id))

  // ② 余ったリーダー + 一般兵を戦力順でラウンドロビン配分（各隊最大5名）
  const pool = [...leaders.slice(squads.length), ...others]
  let cursor = 0
  for (const u of pool) {
    let placed = false
    for (let k = 0; k < squads.length; k++) {
      const idx = (cursor + k) % squads.length
      if (squads[idx].unitIds.length < MAX_PER_SQUAD) {
        squads[idx].unitIds.push(u.id)
        cursor = idx + 1
        placed = true
        break
      }
    }
    if (!placed) break // 全隊満員
  }

  return squads
}
