import type { UnitState, FormationType } from '@fb/sim-core'
import type { SquadEquip, OwnedEquip } from './equipment'

// ─── 兵士（所持ロスター用）─────────────────────────────────────────
export interface RosterUnit extends UnitState {
  level: number   // 1起点
  exp:   number   // 累積経験値
  // α7: 兵士の質と来歴
  kind:       'unique' | 'general'  // ユニーク（一体限り・固有）/ 一般（ランダム）
  forced?:    boolean               // 強制加入（編成画面で削除不可）
  traitName?: string                // ランダム特性の表示名
}

// ─── 隊編成（プレイヤーが編成画面で組む）───────────────────────
export interface SquadSetup {
  id:        string
  name:      string
  unitIds:   string[]              // RosterUnit.id[] （リーダー = [0]）
  formation: FormationType
  equip?:    SquadEquip            // α3: 隊の装備ロードアウト（スロット→所持装備uid）
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
  recruitGenerals?: number // α7: 初回突入時に強制加入する一般兵（援軍）の数
}

// ─── ゲームステート（persistence 対象）──────────────────────────
export interface GameState {
  roster:      RosterUnit[]   // 所持兵士一覧
  squads:      SquadSetup[]   // 現在の編成（最大5隊）
  tokens:      number         // 所持トークン（戦闘報酬で増え、傭兵購入で減る）
  inventory:   OwnedEquip[]   // α3: 軍所有の装備インベントリ
  recruitedBattles: string[]  // α7: 強制加入を適用済みの戦場ID（再付与防止）
  // α8: マップ分岐（後戻り不可）
  clearedNodes: string[]      // クリア済みノードID
  frontier:     string[]      // 現在選択可能なノードID（クリアで次へ更新）
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
