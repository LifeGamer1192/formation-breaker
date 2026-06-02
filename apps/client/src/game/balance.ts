// ─── 通しバランス自動テスト（α20）──────────────────────────────────
// 決定論シムで標準軍が戦場1→6（分岐の一方）を通しプレイし、勝敗・決着tick・生存数を集計。
// プレイヤー操作は無いため、味方隊は ai='front'（接近）として AI vs AI で評価する。
// バランス調整の土台（数値を変えて勝率・決着の速さの変化を観測する）。

import { tickMovement, tickCombat, mulberry32 } from '@fb/sim-core'
import type { WorldState, FormationType } from '@fb/sim-core'
import { makeInitialGameState, autoArrange, makeRecruitGenerals, avgLevel, applyLevelUps, awardXp, UNIQUE_RECRUITS } from './army'
import { makeWorldFromSetup } from './worldBuilder'
import { MAP_NODES } from './campaign'
import type { GameState, BattleDef } from './types'

const SQUAD_DEFS: { id: string; name: string; formation: FormationType }[] = [
  { id: 'sq1', name: '前衛', formation: 'horizontal' },
  { id: 'sq2', name: '中衛', formation: 'column' },
  { id: 'sq3', name: '後衛', formation: 'horizontal' },
]

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)

export interface BattleResult {
  nodeId: string; name: string; won: boolean; tick: number
  allySurvivors: number; allyTotal: number; enemySurvivors: number; enemyTotal: number
}

function simBattle(gs: GameState, battle: BattleDef, seed: number, maxTicks = 3000): WorldState {
  const world0 = makeWorldFromSetup(gs, battle)
  // 味方隊は接近AI。ただし大将隊（最後尾＝last ally squad）は後置 rear（実プレイヤー同様に温存）
  const allyIds = world0.squads.filter(s => s.side === 'ally').map(s => s.id)
  const cmdSquadId = allyIds[allyIds.length - 1]
  let w: WorldState = {
    ...world0,
    squads: world0.squads.map(s => s.side === 'ally'
      ? { ...s, ai: (s.id === cmdSquadId ? 'rear' : 'front') as 'front' | 'rear' }
      : s),
  }
  const rng = mulberry32(seed)
  for (let t = 0; t < maxTicks && !w.finished; t++) { w = tickMovement(w); w = tickCombat(w, rng) }
  return w
}

// 1シードで通しプレイ。負けた時点で打ち切り。
export function runThroughRun(seed: number, path: string[]): BattleResult[] {
  let gs = makeInitialGameState()
  const recruited = new Set<string>()
  const out: BattleResult[] = []
  for (const nodeId of path) {
    const node = MAP_NODES[nodeId]; if (!node) continue
    const battle = node.battle
    // 入軍（初回のみ）
    if (!recruited.has(battle.id) && (battle.recruitGenerals || battle.recruitUniques?.length)) {
      recruited.add(battle.id)
      const lvl = avgLevel(gs.roster)
      const seed2 = seed * 131 + hash(battle.id)
      const generals = battle.recruitGenerals ? makeRecruitGenerals(seed2, battle.recruitGenerals, lvl) : []
      const uniques = (battle.recruitUniques ?? [])
        .map(u => UNIQUE_RECRUITS[u]?.())
        .filter((u): u is NonNullable<typeof u> => !!u && !gs.roster.some(r => r.id === u.id))
      gs = { ...gs, roster: [...gs.roster, ...uniques, ...generals] }
    }
    // オート編成
    const squads = autoArrange(gs.roster, SQUAD_DEFS).filter(s => s.unitIds.length > 0)
    gs = { ...gs, squads }
    const participantIds = squads.flatMap(s => s.unitIds)
    // シム
    const w = simBattle(gs, battle, seed + hash(nodeId))
    const won = w.winner === 'ally'
    const enemyUnits = battle.enemies.units
    const enemySurv = enemyUnits.filter(u => w.units[u.id]?.alive).length
    const allySurv = participantIds.filter(id => w.units[id]?.alive).length
    out.push({
      nodeId, name: battle.name, won, tick: w.tick,
      allySurvivors: allySurv, allyTotal: participantIds.length,
      enemySurvivors: enemySurv, enemyTotal: enemyUnits.length,
    })
    // ロスター更新（XP・レベルアップ）。戦闘間は全回復（プレイヤーの回復薬/休息運用を想定）
    const killCount = enemyUnits.length - enemySurv
    let roster = gs.roster.map(u => ({ ...u, hp: u.maxHp, alive: true }))
    roster = awardXp(roster, participantIds, killCount, won)
    roster = applyLevelUps(roster).roster
    gs = { ...gs, roster }
    if (!won) break   // 敗北で打ち切り
  }
  return out
}

export interface BattleAgg { nodeId: string; name: string; winRate: number; avgTick: number; avgAllySurv: number; runs: number }

// 複数シードで集計
export function summarize(seeds: number[], path: string[]): { perBattle: BattleAgg[]; clearRate: number } {
  const acc = new Map<string, { name: string; wins: number; tickSum: number; survSum: number; runs: number }>()
  let clears = 0
  for (const seed of seeds) {
    const res = runThroughRun(seed, path)
    if (res.length === path.length && res[res.length - 1].won) clears++
    for (const r of res) {
      const a = acc.get(r.nodeId) ?? { name: r.name, wins: 0, tickSum: 0, survSum: 0, runs: 0 }
      a.wins += r.won ? 1 : 0; a.tickSum += r.tick; a.survSum += r.allySurvivors; a.runs++
      acc.set(r.nodeId, a)
    }
  }
  const perBattle: BattleAgg[] = path.filter(id => acc.has(id)).map(id => {
    const a = acc.get(id)!
    return { nodeId: id, name: a.name, winRate: a.wins / a.runs, avgTick: a.tickSum / a.runs, avgAllySurv: a.survSum / a.runs, runs: a.runs }
  })
  return { perBattle, clearRate: clears / seeds.length }
}

export const DEFAULT_PATH = ['n1', 'n2', 'n3', 'n4a', 'n5', 'n6']
