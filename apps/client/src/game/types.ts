import type { UnitState, FormationType } from '@fb/sim-core'

// ─── 兵士（所持ロスター用）─────────────────────────────────────────
export interface RosterUnit extends UnitState {
  level: number   // 1起点
  exp:   number   // 累積経験値
}

// ─── 隊編成（プレイヤーが編成画面で組む）───────────────────────
export interface SquadSetup {
  id:        string
  name:      string
  unitIds:   string[]              // RosterUnit.id[] （リーダー = [0]）
  formation: FormationType
}

// ─── バトル定義（各キャンペーン戦場のデータ）─────────────────
export interface BattleDef {
  id:         string
  name:       string
  enemies:    {
    units:   RosterUnit[]
    squads:  SquadSetup[]
  }
  allyStartX:   number    // 味方初期X座標
  enemyStartX:  number    // 敵初期X座標
  reward:       number    // 勝利時の基礎報酬トークン
}

// ─── ゲームステート（persistence 対象）──────────────────────────
export interface GameState {
  battleIndex: number         // 0〜2（現在のキャンペーン進捗）
  roster:      RosterUnit[]   // 所持兵士一覧
  squads:      SquadSetup[]   // 現在の編成（最大5隊）
  tokens:      number         // 所持トークン（戦闘報酬で増え、傭兵購入で減る）
  log:         string[]       // キャンペーンログ
}

// ─── ゴースト（非同期PvP用の軍スナップショット）─────────────────
export interface Ghost {
  id:        string          // 'g_'+Date.now()
  name:      string          // 例: 'ハンニバルの軍'
  createdAt: number
  squads:    SquadSetup[]
  roster:    RosterUnit[]    // squads が参照する兵士のみ
}

// ─── 戦闘結果（ResultScreen に渡す）───────────────────────────────
export interface BattleResult {
  won:        boolean
  unitXps:    Record<string, number>  // unitId → 獲得EXP
  levelUps:   string[]                 // level up した unitId[]
}
