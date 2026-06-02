import type { LayerEffect, StatId, EffectOp } from './layers'
import type { FormationType } from './formation'
import type { Vec2, MovementType, TerrainType } from './geo'
import type { AttrId } from './attribute'

// ─── 技ランタイム（[技レイヤー]・α6）──────────────────────────────
// 兵士ごとに0-10個。固有ゲージを持ち、有効かつ満タンで優先順位順に自動発動。
export interface TechniqueRuntime {
  id:        string
  name:      string
  icon:      string
  kind:      'selfBuff' | 'bonusAttack'
  gauge:     number
  gaugeMax:  number
  speed:     number    // ゲージ充填速度/tick
  priority:  number     // 大きいほど優先
  enabled:   boolean    // 戦術画面でオンオフ
  // bonusAttack
  attr?:     AttrId
  power?:    number
  range?:    number
  // selfBuff
  durationTicks?: number
  buffs?:    { target: StatId; op: EffectOp; value: number }[]
}

// ─── 必殺技ランタイム（[必殺技レイヤー]・α5）──────────────────────
// リーダーの必殺技が隊にセットされる。数値解決済みのものを隊に持たせ、
// sim-core はカタログを知らずに汎用処理する（カタログは client 側）。
export interface UltimateRuntime {
  id:            string
  name:          string
  icon:          string
  kind:          'aoeDamage' | 'squadBuff' | 'heal' | 'terrain' | 'attrChange'
  range:         number            // 発動可能距離（隊中心→対象）
  radius:        number            // 効果半径（範囲技。heal: 0=自隊のみ / >0=範囲内の味方全隊。terrain: 変化半径）
  ultSpeed:      number            // ゲージ充填速度/tick
  gaugeMax:      number            // 満タン値
  attr?:         AttrId            // 攻撃属性（aoeDamage）
  power?:        number            // 攻撃力（aoeDamage）/ 回復量（heal）
  durationTicks?: number           // 効果持続（squadBuff）
  buffs?:        { target: StatId; op: EffectOp; value: number }[]  // squadBuff
  terrainType?:  TerrainType       // 変化後の地形（terrain）
}

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
  // α2: 属性。通常攻撃の属性（省略時 slash）。
  attackAttr?:  AttrId
  // α2: 属性別防御加算（防具由来、装備本実装は α3）。例 { thunder: 100 }
  armorDef?:    Partial<Record<AttrId, number>>
  // α5: この兵士が持つ必殺技ID（リーダー時に隊へセットされる）
  ultId?:       string
  // α6: 兵士の技（固有ゲージ・自動発動）
  techniques?:  TechniqueRuntime[]
  // α8: 大将（最後尾隊のリーダー）。離脱でその陣営は敗北
  isCommander?: boolean
  // α12: リジェネ（毎tick回復するHP・装備/スキル特殊能力由来）
  regen?:       number
  // α13: 通常攻撃属性の時限上書き（必殺技 attrChange 由来。tick < untilTick の間だけ有効）
  attrOverride?: { attr: AttrId; untilTick: number }
}

export interface SquadState {
  id:           SquadId
  name:         string      // 表示用名称（例: 前衛・後衛）
  side:         Side
  unitIds:      UnitId[]
  formation:    FormationType
  // PoC#3: 位置・向き・移動
  pos:          Vec2
  facing:       number      // ラジアン（0=右, π=左）
  moveQueue:    Vec2[]      // 移動予定地点（仕様書L146）
  moveSpeed:    number      // 基礎移動速度（ゲーム単位/tick）
  movementType: MovementType
  // α5: 隊の必殺技（リーダー由来）と充填ゲージ
  ult?:         UltimateRuntime
  ultGauge?:    number
  // α12+: 敵AIアルゴリズム（front=接近して射程手前で停止 / rear=接近＋近すぎたら離れる）
  ai?:          'front' | 'rear'
}

export interface WorldState {
  tick:     number
  units:    Record<UnitId, UnitState>
  squads:   SquadState[]
  log:      string[]
  finished: boolean
  winner:   Side | null
  // α8: 戦闘ごとの地形（堀塀の破壊で変化）。省略時は DEMO_TERRAIN
  terrain?:    TerrainType[][]
  terrainDmg?: Record<string, number>  // "row,col" → 破壊蓄積ダメージ
}
