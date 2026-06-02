// ─── 決定論リプレイ再生・検証（α17: サーバー権威の不正対策の核）──────────
// (初期World, seed, コマンド列) があれば戦闘を完全再現できる（RNGは mulberry32 シード固定）。
// クライアントの実戦ループと同一順序: 各tickで「該当コマンド適用 → 移動 → 戦闘」。
// サーバー（Edge Function）は提出された結果をこの再生で照合し、不一致なら不正として却下する。

import type { WorldState } from './types'
import type { Command, ReplayData } from './command'
import { applyCommand } from './command'
import { tickMovement } from './movement'
import { tickCombat } from './combat'
import { mulberry32 } from './prng'

// 1tick進める（実戦ループと同一順序）。純粋関数。
export function stepWorld(world: WorldState, commands: Command[], rng: () => number): WorldState {
  let w = world
  // このtick(=w.tick)に発行されたコマンドを記録順に適用
  for (const cmd of commands) if (cmd.tick === w.tick) w = applyCommand(w, cmd)
  w = tickMovement(w)
  w = tickCombat(w, rng)
  return w
}

// 初期World＋ReplayData から最終Worldを決定論再生する。
// maxTicks は暴走防止の上限（既定 tickCount。finished で早期終了）。
export function runReplay(initialWorld: WorldState, replay: ReplayData, maxTicks?: number): WorldState {
  const rng = mulberry32(replay.seed)
  const limit = maxTicks ?? replay.tickCount
  let w = initialWorld
  for (let i = 0; i < limit && !w.finished; i++) {
    const cmds = replay.commands.filter(c => c.tick === w.tick)
    w = stepWorld(w, cmds, rng)
  }
  return w
}

export interface VerifyResult {
  valid:        boolean          // 主張された勝敗と再生結果が一致したか
  actualWinner: WorldState['winner']
  actualTick:   number
  reason?:      string
}

// 提出された (初期World, replay, 主張する勝者) を再生して照合する。
// クライアントが改ざんした結果は決定論再生と一致しないため弾ける。
export function verifyReplay(initialWorld: WorldState, replay: ReplayData, claimedWinner: WorldState['winner']): VerifyResult {
  // 基本検証: コマンドの tick が記録範囲内・昇順性は問わない（同tick複数可）
  for (const c of replay.commands) {
    if (typeof c.tick !== 'number' || c.tick < 0 || c.tick > replay.tickCount) {
      return { valid: false, actualWinner: null, actualTick: 0, reason: `コマンドtickが範囲外: ${c.tick}` }
    }
  }
  const final = runReplay(initialWorld, replay)
  const valid = final.winner === claimedWinner
  return {
    valid,
    actualWinner: final.winner,
    actualTick: final.tick,
    reason: valid ? undefined : `勝者不一致: 主張=${claimedWinner} / 再生=${final.winner}`,
  }
}
