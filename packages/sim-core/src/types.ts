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
  attackSpeed:  number  // ゲージ充填量/tick
  gaugeMax:     number  // 基本100（仕様書「攻撃ゲージ 基本は1」= 100）
  gauge:        number  // 現在ゲージ値
  alive:        boolean
}

export interface SquadState {
  id:      SquadId
  side:    Side
  unitIds: UnitId[]
}

export interface WorldState {
  tick:     number
  units:    Record<UnitId, UnitState>
  squads:   SquadState[]
  log:      string[]
  finished: boolean
  winner:   Side | null
}
