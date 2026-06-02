// ─── 属性データ（仕様書 属性データ表）─────────────────────────────────────
// 斬・刺・殴 = 物理 / 火・雷 = 元素
// ダメージ式: ダメージ = 攻撃側の最終攻撃力 − 守備側の「攻撃属性に対応する防御力」
//   属性別防御力 = 基礎防御力(全属性共通) + 攻撃属性に対応する防具防御力 + レイヤー防御効果(共通)
//   属性別の値を持つのは防具防御力のみ（armorDef）。装備本実装は α3。

export type AttrId = 'slash' | 'pierce' | 'strike' | 'fire' | 'thunder'

export type AttrKind = 'physical' | 'element'

export interface AttrInfo {
  label: string   // 表示名
  icon:  string   // 仮グラ（絵文字プレースホルダ）
  color: string   // UI色
  kind:  AttrKind
}

export const ATTRIBUTES: Record<AttrId, AttrInfo> = {
  slash:   { label: '斬', icon: '⚔️', color: '#cccccc', kind: 'physical' },
  pierce:  { label: '刺', icon: '🗡️', color: '#99ccff', kind: 'physical' },
  strike:  { label: '殴', icon: '🔨', color: '#ccaa88', kind: 'physical' },
  fire:    { label: '火', icon: '🔥', color: '#ff7733', kind: 'element'  },
  thunder: { label: '雷', icon: '⚡', color: '#ffdd00', kind: 'element'  },
}

export const ATTR_IDS: AttrId[] = ['slash', 'pierce', 'strike', 'fire', 'thunder']

/** 攻撃属性に対応する、守備側の属性別防御加算（防具由来）を返す */
export function armorDefFor(armorDef: Partial<Record<AttrId, number>> | undefined, attr: AttrId): number {
  return armorDef?.[attr] ?? 0
}
