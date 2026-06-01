import type { RosterUnit, GameState } from './types'

// ─── 初期兵士ロスター（カルタゴ陣営）──────────────────────────────
export function makeInitialRoster(): RosterUnit[] {
  return [
    {
      id: 'unit_hannibal',
      name: 'ハンニバル',
      side: 'ally',
      hp: 100,
      maxHp: 100,
      attack: 80,
      defense: 70,
      attackSpeed: 1.2,
      gaugeMax: 100,
      gauge: 0,
      alive: true,
      isLeader: true,
      skills: [],
      flankMod: -30,
      rearMod: -50,
      range: 20,
      level: 1,
      exp: 0,
    },
    {
      id: 'unit_mago',
      name: 'マゴ・バルカ',
      side: 'ally',
      hp: 90,
      maxHp: 90,
      attack: 75,
      defense: 65,
      attackSpeed: 1.3,
      gaugeMax: 100,
      gauge: 0,
      alive: true,
      isLeader: true,
      skills: [],
      flankMod: -30,
      rearMod: -50,
      range: 20,
      level: 1,
      exp: 0,
    },
    {
      id: 'unit_carthage_a',
      name: 'カルタゴ兵A',
      side: 'ally',
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
    },
    {
      id: 'unit_carthage_b',
      name: 'カルタゴ兵B',
      side: 'ally',
      hp: 70,
      maxHp: 70,
      attack: 62,
      defense: 56,
      attackSpeed: 0.95,
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
    },
    {
      id: 'unit_carthage_c',
      name: 'カルタゴ兵C',
      side: 'ally',
      hp: 75,
      maxHp: 75,
      attack: 58,
      defense: 58,
      attackSpeed: 1.1,
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
    },
    {
      id: 'unit_carthage_d',
      name: 'カルタゴ兵D',
      side: 'ally',
      hp: 72,
      maxHp: 72,
      attack: 61,
      defense: 54,
      attackSpeed: 1.05,
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
    },
  ]
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

// ─── 戦闘参加時のXP付与（戦闘中に呼ぶ）────────────────────────────
// 戦闘参加: +20, 敵撃破: +30 をベースに、リーダーボーナス(部下数*10%)を加算
export function awardXp(roster: RosterUnit[], participantIds: string[], killCount: number): RosterUnit[] {
  return roster.map(u => {
    if (!participantIds.includes(u.id)) return u
    let xp = u.exp + 20  // 参加ボーナス
    if (killCount > 0) xp += 30  // 敵撃破ボーナス（全員で分配する簡略版）

    // リーダーボーナス: 部下数 × 10%
    if (u.isLeader) {
      const subordinates = participantIds.filter(id => {
        const participant = roster.find(r => r.id === id)
        return participant && !participant.isLeader
      }).length
      xp = Math.round(xp * (1 + subordinates * 0.1))
    }

    return { ...u, exp: xp }
  })
}

// ─── デバッグ用: 全兵士のステータスリセット─────────────────────────
export function resetAllUnits(roster: RosterUnit[]): RosterUnit[] {
  return roster.map(u => ({ ...u, hp: u.maxHp, alive: true, gauge: 0 }))
}

// ─── 初期 GameState 作成────────────────────────────────────────────
export function makeInitialGameState(): GameState {
  return {
    battleIndex: 0,
    roster: makeInitialRoster(),
    squads: [],
    log: ['キャンペーン開始'],
  }
}
