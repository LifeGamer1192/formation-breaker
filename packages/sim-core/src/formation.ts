// ─── 陣形データ（仕様書 L20-28 の表） ────────────────────────────────────
// 移動速度効果は PoC#3（移動実装）のスコープ

import type { LayerEffect } from './layers'

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
  solo:       'ATK/SPD/DEF -10%',
  horizontal: 'ATK速度 +20%, DEF -20%',
  column:     '移動速度 +30%（PoC#3）',
  square:     'DEF +30%',
  circle:     'DEF +30%（背面取られにくい）',
  arrowhead:  'ATK +10%, DEF -10%',
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
