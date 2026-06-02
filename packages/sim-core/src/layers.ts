// ─── レイヤー型効果計算エンジン ───────────────────────────────────────────
// 仕様書 L46-47:
//   異なるレイヤー → 基本値に対して加減算（べき乗なし）
//   同一レイヤー・同一効果対象 → 優先順位が最も高い1つだけ採用

export type LayerId =
  | 'base'           // 兵士の素ステータス（計算起点）
  | 'equipment'      // 武器・防具
  | 'equipmentItem'  // 隊装備アイテム
  | 'formation'      // 陣形（方陣・横陣・縦列陣・円陣・雁行）
  | 'personalSkill'  // 個人スキル
  | 'leaderSkill'    // リーダースキル
  | 'generalSkill'   // 一般スキル（非リーダー時のみ）
  | 'squadSkill'     // 隊スキル（リーダー/一般どちらでも）
  | 'ultimate'       // 必殺技・必殺技アイテム由来
  | 'technique'      // 技由来

export type StatId = 'attack' | 'defense' | 'attackSpeed' | 'maxHp'

export type EffectOp =
  | 'add'  // 絶対値加算（例: DEF +20）
  | 'mul'  // 基本値に対する%増減（例: ATK +10% → value=10）
  | 'set'  // 値を固定（例: 射程を固定値に上書き）

// スキルの適用範囲（仕様書 L201-202）
//   self   = 自分のみ
//   squad  = 隊全体（リーダー含む）
//   leader = リーダー宛（隊のリーダーにのみ）
export type EffectScope = 'self' | 'squad' | 'leader'

export interface LayerEffect {
  layer:    LayerId
  target:   StatId
  op:       EffectOp
  value:    number
  priority: number  // 同一レイヤー・同一対象の中で最大1つを選ぶ基準
  source:   string  // 表示・デバッグ用ラベル（スキル名・装備名など）
  // α4: スキルの適用範囲（省略時 self）
  scope?:   EffectScope
  // α4: 時限条件。tick がこの値以上になると効果が切れる（例: 戦闘開始10秒=200）
  untilTick?: number
}

export type EffectiveStats = Record<StatId, number>

/**
 * 基本値 + 全レイヤーのサバイバル効果を適用して実効ステータスを返す。
 *
 * 計算手順:
 *   1. 同一レイヤー・同一target → 最高 priority の1つだけ残す
 *   2. 残った効果を target ごとに集計
 *      - mul: 基本値 × (1 + Σ%) ― レイヤー間%は加算して1回だけ掛ける
 *      - add: mul 適用後に加算
 *      - set: 最後に上書き（set が複数あれば最高 priority を使用）
 */
export function calcEffectiveStats(
  base: EffectiveStats,
  effects: LayerEffect[],
): EffectiveStats {
  // Step1: 同一レイヤー・同一target → 最高 priority 生き残り
  const survivors = new Map<string, LayerEffect>()
  for (const e of effects) {
    const key = `${e.layer}:${e.target}`
    const prev = survivors.get(key)
    if (!prev || e.priority > prev.priority) survivors.set(key, e)
  }

  // Step2: 集計
  const adds: Partial<Record<StatId, number>> = {}
  const muls: Partial<Record<StatId, number>> = {}
  const sets: Partial<Record<StatId, LayerEffect>> = {}

  for (const e of survivors.values()) {
    if (e.op === 'add') adds[e.target] = (adds[e.target] ?? 0) + e.value
    if (e.op === 'mul') muls[e.target] = (muls[e.target] ?? 0) + e.value
    if (e.op === 'set') {
      const prev = sets[e.target]
      if (!prev || e.priority > prev.priority) sets[e.target] = e
    }
  }

  // Step3: 適用（mul → add → set）
  const result = { ...base }
  for (const [s, pct] of Object.entries(muls) as [StatId, number][]) {
    result[s] = Math.round(result[s] * (1 + pct / 100))
  }
  for (const [s, v] of Object.entries(adds) as [StatId, number][]) {
    result[s] = result[s] + v
  }
  for (const [s, e] of Object.entries(sets) as [StatId, LayerEffect][]) {
    result[s] = e.value
  }

  return result
}
