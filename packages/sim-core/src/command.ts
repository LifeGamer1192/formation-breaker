// ─── コマンド列モデル（PoC#4）─────────────────────────────────────────────
// プレイヤー操作をすべて {tick番号, 内容} に変換して記録する。
// (初期状態, シード, コマンド列) があれば戦闘を完全再現できる。
// → リプレイ・後日続き・ゴーストPvP・チート検証の共通基盤 (仕様書L5-6参照)

import type { Vec2 } from './geo'
import type { FormationType } from './formation'
import type { WorldState } from './types'
import { executeUltimate } from './combat'

export type Command =
  | { tick: number; type: 'moveSet';    squadId: string; waypoints: Vec2[]       }
  | { tick: number; type: 'moveAppend'; squadId: string; waypoint:  Vec2         }
  | { tick: number; type: 'moveCancel'; squadId: string                           }
  | { tick: number; type: 'formation';  squadId: string; formation: FormationType }
  | { tick: number; type: 'ultimate';   squadId: string; targetPos?: Vec2         }

/** 1コマンドを worldState に適用して新 worldState を返す (純粋関数) */
export function applyCommand(world: WorldState, cmd: Command): WorldState {
  switch (cmd.type) {
    case 'moveSet':
      return { ...world, squads: world.squads.map(s =>
        s.id === cmd.squadId ? { ...s, moveQueue: [...cmd.waypoints] } : s) }
    case 'moveAppend':
      return { ...world, squads: world.squads.map(s =>
        s.id === cmd.squadId ? { ...s, moveQueue: [...s.moveQueue, cmd.waypoint] } : s) }
    case 'moveCancel':
      return { ...world, squads: world.squads.map(s =>
        s.id === cmd.squadId ? { ...s, moveQueue: [] } : s) }
    case 'formation':
      return { ...world, squads: world.squads.map(s =>
        s.id === cmd.squadId ? { ...s, formation: cmd.formation } : s) }
    case 'ultimate':
      return executeUltimate(world, cmd.squadId, cmd.targetPos)
  }
}

/** 記録データ（これだけあれば戦闘を完全再現できる） */
export interface ReplayData {
  seed:      number
  commands:  Command[]
  tickCount: number   // 記録終了時の tick 数
}
