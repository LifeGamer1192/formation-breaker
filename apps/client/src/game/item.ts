import type { AttrId } from '@fb/sim-core'

// ─── 装備アイテム（[装備アイテムレイヤー]・α12）────────────────────
// 仕様書 L222-234: 隊単位で装備し、隊に紐付く（兵士が入れ替わっても残る）。
// 隊が解散されると軍インベントリへ戻る（uid 参照なので未割当=復帰）。
// 効果は equipmentItem レイヤー（武器/防具=equipment とは別レイヤーで加算）。

export interface ItemDef {
  id:    string
  name:  string
  icon:  string
  desc:  string
  attackAdd?:      number
  defenseAdd?:     number
  attackSpeedAdd?: number
  rangeAdd?:       number
  moveMultPct?:    number
  regen?:          number
  armorDef?:       Partial<Record<AttrId, number>>
}

export const ITEM_DEFS: Record<string, ItemDef> = {
  warBanner:  { id: 'warBanner',  name: '軍旗',         icon: '🚩', attackAdd: 40, desc: '隊全体の攻撃力+40' },
  aegis:      { id: 'aegis',      name: '守りの護符',   icon: '🛡', defenseAdd: 40, desc: '隊全体の防御力+40' },
  swiftCharm: { id: 'swiftCharm', name: '俊足のお守り', icon: '🌀', attackSpeedAdd: 2, moveMultPct: 15, desc: '攻撃速度+2・移動+15%' },
  rangeScope: { id: 'rangeScope', name: '遠見の眼',     icon: '🔭', rangeAdd: 8, desc: '射程+8' },
  regenIdol:  { id: 'regenIdol',  name: '癒しの像',     icon: '💠', regen: 15, desc: 'リジェネ15（毎tick回復）' },
  wardCharm:  { id: 'wardCharm',  name: '元素の盾',     icon: '🔮', armorDef: { fire: 60, thunder: 60 }, desc: '火・雷防御+60' },
}

export const MAX_ITEMS_PER_SQUAD = 2

export interface OwnedItem { uid: string; defId: string }

export interface ResolvedItems {
  attackAdd:      number
  defenseAdd:     number
  attackSpeedAdd: number
  rangeAdd:       number
  moveMultPct:    number
  regenAdd:       number
  armorDef:       Partial<Record<AttrId, number>>
}

export function resolveItems(uids: string[] | undefined, ownedByUid: Map<string, OwnedItem>): ResolvedItems {
  const r: ResolvedItems = { attackAdd: 0, defenseAdd: 0, attackSpeedAdd: 0, rangeAdd: 0, moveMultPct: 0, regenAdd: 0, armorDef: {} }
  if (!uids) return r
  for (const uid of uids.slice(0, MAX_ITEMS_PER_SQUAD)) {
    const owned = ownedByUid.get(uid)
    if (!owned) continue
    const def = ITEM_DEFS[owned.defId]
    if (!def) continue
    r.attackAdd      += def.attackAdd ?? 0
    r.defenseAdd     += def.defenseAdd ?? 0
    r.attackSpeedAdd += def.attackSpeedAdd ?? 0
    r.rangeAdd       += def.rangeAdd ?? 0
    r.moveMultPct    += def.moveMultPct ?? 0
    r.regenAdd       += def.regen ?? 0
    if (def.armorDef) {
      for (const [a, v] of Object.entries(def.armorDef) as [AttrId, number][]) {
        r.armorDef[a] = (r.armorDef[a] ?? 0) + v
      }
    }
  }
  return r
}

let _uidCounter = 0
function mkOwned(defId: string): OwnedItem {
  return { uid: `it_${defId}_${_uidCounter++}`, defId }
}

export function makeInitialItems(): OwnedItem[] {
  _uidCounter = 0
  return [mkOwned('warBanner'), mkOwned('aegis'), mkOwned('swiftCharm'), mkOwned('rangeScope'), mkOwned('regenIdol'), mkOwned('wardCharm')]
}
