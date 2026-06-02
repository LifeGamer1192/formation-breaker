// ─── 陣形データ（仕様書 L20-28 の表） ────────────────────────────────────
// 移動速度効果は PoC#3（移動実装）のスコープ

import type { LayerEffect } from './layers'
import type { Vec2 } from './geo'

export type FormationType =
  | 'none'       // 陣形なし（デフォルト）
  | 'solo'       // 単独: 1人のみ
  | 'horizontal' // 横陣: 2-6人
  | 'column'     // 縦列陣: 2-6人
  | 'square'     // 方陣: 4人のみ
  | 'circle'     // 円陣: 4人または6人
  | 'arrowhead'  // 雁行: 3人または5人

export const FORMATION_LABEL: Record<FormationType, string> = {
  none:       '（なし）',
  solo:       '単独',
  horizontal: '横陣',
  column:     '縦列陣',
  square:     '方陣',
  circle:     '円陣',
  arrowhead:  '雁行',
}

// 表示用（条件と効果の説明文）
export const FORMATION_DESC: Record<FormationType, string> = {
  none:       '効果なし',
  solo:       '1人: ATK/SPD/DEF/移動 -10%',
  horizontal: '2-6人: SPD +20%, DEF -20%',
  column:     '2-6人: 移動 +30%',
  square:     '4人: DEF +30%, 移動 -30%',
  circle:     '4/6人: DEF +30%, 移動 -20%（背面に強い）',
  arrowhead:  '3/5人: ATK +10%, DEF -10%, 移動 +20%',
}

// ─── 人数条件（仕様書 L103-110）─────────────────────────────────────
// 生存兵士数がこの条件を満たさない場合、フォールダウンする
export const FORMATION_CONDITION: Record<FormationType, (n: number) => boolean> = {
  none:       n => n >= 1,
  solo:       n => n === 1,
  horizontal: n => n >= 2 && n <= 6,
  column:     n => n >= 2 && n <= 6,
  square:     n => n === 4,
  circle:     n => n === 4 || n === 6,
  arrowhead:  n => n === 3 || n === 5,
}

// ─── フォールダウン先（条件を満たせなくなった時の陣形）─────────────
// 方陣/円陣/雁行 → 横陣、横陣/縦列陣 → 単独、単独 → 単独（底）
export const FORMATION_FALLDOWN: Record<FormationType, FormationType> = {
  none:       'none',
  solo:       'solo',
  horizontal: 'solo',
  column:     'solo',
  square:     'horizontal',
  circle:     'horizontal',
  arrowhead:  'horizontal',
}

/**
 * 生存兵士数に応じた「実効陣形」を返す。
 * 選択陣形が人数条件を満たさない場合、満たすまでフォールダウンを連鎖させる。
 */
export function getEffectiveFormation(formation: FormationType, aliveCount: number): FormationType {
  let f = formation
  for (let i = 0; i < 8; i++) {
    if (FORMATION_CONDITION[f](aliveCount)) return f
    const next = FORMATION_FALLDOWN[f]
    if (next === f) return f // これ以上落ちない
    f = next
  }
  return f
}

// ─── 移動速度補正（仕様書 L103-110、移動速度列）─────────────────────
// FORMATION_EFFECTS は attack/attackSpeed/defense のみ扱う（EffectiveStats）。
// 移動速度は SquadState 側なので、別テーブルで movement に適用する。
export const FORMATION_MOVE_MULT: Record<FormationType, number> = {
  none:       1.0,
  solo:       0.9,  // -10%
  horizontal: 1.0,  // ±0
  column:     1.3,  // +30%
  square:     0.7,  // -30%
  circle:     0.8,  // -20%
  arrowhead:  1.2,  // +20%
}

type PartialEffect = Omit<LayerEffect, 'source'>
const fe = (es: PartialEffect[]): LayerEffect[] =>
  es.map(e => ({ ...e, source: 'formation' }))

// 仕様書 L20-28 に準拠（移動速度効果は省略 → PoC#3で追加）
export const FORMATION_EFFECTS: Record<FormationType, LayerEffect[]> = {
  none: fe([]),
  solo: fe([
    { layer: 'formation', target: 'attack',      op: 'mul', value: -10, priority: 0 },
    { layer: 'formation', target: 'attackSpeed', op: 'mul', value: -10, priority: 0 },
    { layer: 'formation', target: 'defense',     op: 'mul', value: -10, priority: 0 },
  ]),
  horizontal: fe([
    { layer: 'formation', target: 'attackSpeed', op: 'mul', value: +20, priority: 0 },
    { layer: 'formation', target: 'defense',     op: 'mul', value: -20, priority: 0 },
  ]),
  column: fe([
    // moveSpeed +30% → PoC#3
  ]),
  square: fe([
    { layer: 'formation', target: 'defense', op: 'mul', value: +30, priority: 0 },
    // moveSpeed -30% → PoC#3
  ]),
  circle: fe([
    { layer: 'formation', target: 'defense', op: 'mul', value: +30, priority: 0 },
    // moveSpeed -20% → PoC#3
  ]),
  arrowhead: fe([
    { layer: 'formation', target: 'attack',  op: 'mul', value: +10, priority: 0 },
    { layer: 'formation', target: 'defense', op: 'mul', value: -10, priority: 0 },
    // moveSpeed +20% → PoC#3
  ]),
}

// ─── 隊内配置スロット（兵士の実際の位置） ────────────────────────────────
// 局所座標 [lx=右方向, ly=前方向]（正規化済み、× SQUAD_SPREAD でゲーム単位）
// slot[0] = リーダー位置、以降は兵士位置（unitIds の生存者順）

export const SQUAD_SPREAD = 5  // ゲーム単位（隊中心から各兵士までの基準距離）

export const FORMATION_SLOTS: Record<FormationType, [number, number][]> = {
  none:       [[0, 0],        [-0.5, 0.5],  [0.5, 0.5],   [0, -0.5],     [-0.5, -0.5],  [0.5, -0.5]],
  solo:       [[0, 0]],
  horizontal: [[0, 0],        [-0.9, 0],    [0.9, 0],     [-1.8, 0],     [1.8, 0],      [0, 0.7]],
  column:     [[0, 0.9],      [0, 0],       [0, -0.9],    [0, -1.8],     [0.5, 0.45],   [-0.5, 0.45]],
  square:     [[-0.55, 0.55], [0.55, 0.55], [-0.55,-0.55],[0.55,-0.55],  [0, 0],        [0, 1.1]],
  circle:     [[0, 0.9],      [0.78, 0.45], [0.78,-0.45], [0, -0.9],     [-0.78,-0.45], [-0.78, 0.45]],
  arrowhead:  [[0, 0.9],      [-0.7, 0],    [0.7, 0],     [-1.4,-0.9],   [1.4,-0.9],    [0, -0.3]],
}

/**
 * 隊内の生存ユニットの絶対位置を返す。
 * unitIndex: その隊の生存ユニット列での順序（0=リーダーまたは先頭）
 */
export function getUnitPos(
  squadPos:    Vec2,
  squadFacing: number,
  formation:   FormationType,
  unitIndex:   number,
): Vec2 {
  const slots = FORMATION_SLOTS[formation] ?? [[0, 0]]
  const [lx, ly] = slots[unitIndex % slots.length]
  const sinF = Math.sin(squadFacing), cosF = Math.cos(squadFacing)
  return {
    x: squadPos.x + (-sinF * lx + cosF * ly) * SQUAD_SPREAD,
    y: squadPos.y + ( cosF * lx + sinF * ly) * SQUAD_SPREAD,
  }
}
