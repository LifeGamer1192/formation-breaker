import type { LayerEffect } from './layers'
import type { FormationType } from './formation'

export type UnitId  = string
export type SquadId = string
export type Side    = 'ally' | 'enemy'

export interface UnitState {
  id:           UnitId
  name:         string
  side:         Side
  hp:           number
  maxHp:        number
  attack:       number      // 基礎攻撃力
  defense:      number      // 基礎防御力
  attackSpeed:  number      // 基礎攻撃速度（ゲージ充填量/tick）
  gaugeMax:     number      // 基本100（仕様書「攻撃ゲージ基本1」= 100）
  gauge:        number
  alive:        boolean
  isLeader:     boolean     // リーダースキルの適用条件に影響
  skills:       LayerEffect[] // 固有スキルのレイヤー効果リスト
}

export interface SquadState {
  id:        SquadId
  side:      Side
  unitIds:   UnitId[]
  formation: FormationType  // 陣形
}

export interface WorldState {
  tick:     number
  units:    Record<UnitId, UnitState>
  squads:   SquadState[]
  log:      string[]
  finished: boolean
  winner:   Side | null
}
