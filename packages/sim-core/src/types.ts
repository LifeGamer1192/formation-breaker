import type { LayerEffect } from './layers'
import type { FormationType } from './formation'
import type { Vec2, MovementType } from './geo'

export type UnitId  = string
export type SquadId = string
export type Side    = 'ally' | 'enemy'

export interface UnitState {
  id:           UnitId
  name:         string
  side:         Side
  hp:           number
  maxHp:        number
  attack:       number
  defense:      number
  attackSpeed:  number
  gaugeMax:     number
  gauge:        number
  alive:        boolean
  isLeader:     boolean
  skills:       LayerEffect[]
  // 仕様書 L94-95: 側面・背面防御補正（0 〜 -100%）
  flankMod:     number
  rearMod:      number
  // PoC#3: 射程（仕様書L58: 100で戦場端〜端）
  range:        number
}

export interface SquadState {
  id:           SquadId
  side:         Side
  unitIds:      UnitId[]
  formation:    FormationType
  // PoC#3: 位置・向き・移動
  pos:          Vec2
  facing:       number      // ラジアン（0=右, π=左）
  moveQueue:    Vec2[]      // 移動予定地点（仕様書L146）
  moveSpeed:    number      // 基礎移動速度（ゲーム単位/tick）
  movementType: MovementType
}

export interface WorldState {
  tick:     number
  units:    Record<UnitId, UnitState>
  squads:   SquadState[]
  log:      string[]
  finished: boolean
  winner:   Side | null
}
