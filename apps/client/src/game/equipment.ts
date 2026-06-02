import type { AttrId } from '@fb/sim-core'

// ─── 装備（武器・防具）─────────────────────────────────────────────
// 仕様書「装備データ」を本プロトのスケールに調整して定義。
// 隊単位で装備し、隊の全兵士に効果が乗る（装備レイヤー）。
// 特殊能力（リジェネ等）・装備アイテム・消耗品は後続（α3範囲外）。

export type EquipSlot = 'weapon' | 'body' | 'arms' | 'head' | 'legs'

export const SLOT_LABEL: Record<EquipSlot, string> = {
  weapon: '武器', body: '胴', arms: '腕', head: '頭', legs: '足',
}
export const SLOTS: EquipSlot[] = ['weapon', 'body', 'arms', 'head', 'legs']

export interface EquipDef {
  id:    string
  name:  string
  slot:  EquipSlot
  icon:  string
  attackAdd?:      number                       // 攻撃力+（武器/雷の鎧）
  defenseAdd?:     number                       // 全属性共通の防御+（槍）
  attr?:           AttrId                        // 武器の攻撃属性
  armorDef?:       Partial<Record<AttrId, number>> // 防具の属性別防御
  attackSpeedAdd?: number                       // 攻撃速度補正（加算）
  rangeAdd?:       number                       // 射程補正
  moveMultPct?:    number                       // 移動速度補正（%）
  perLevelAtk?:    number                       // +1レベルあたり攻撃力
  perLevelArmor?:  number                       // +1レベルあたり全属性防御
}

export const EQUIP_DEFS: Record<string, EquipDef> = {
  // 武器
  sword:     { id: 'sword',     name: '剣',   slot: 'weapon', icon: '⚔️', attackAdd: 10, attr: 'slash',  perLevelAtk: 1 },
  spear:     { id: 'spear',     name: '槍',   slot: 'weapon', icon: '🔱', attackAdd: 6,  defenseAdd: 4, attr: 'pierce', rangeAdd: 2, moveMultPct: -5, perLevelAtk: 1 },
  fireSword: { id: 'fireSword', name: '炎剣', slot: 'weapon', icon: '🔥', attackAdd: 12, attr: 'fire',   attackSpeedAdd: 0.1, perLevelAtk: 1 },
  shortBow:  { id: 'shortBow',  name: '短弓', slot: 'weapon', icon: '🏹', attackAdd: 4,  attr: 'pierce', rangeAdd: 12, attackSpeedAdd: -0.2, moveMultPct: -10, perLevelAtk: 1 },
  longBow:   { id: 'longBow',   name: '長弓', slot: 'weapon', icon: '🏹', attackAdd: 5,  attr: 'pierce', rangeAdd: 18, attackSpeedAdd: -0.3, moveMultPct: -10, perLevelAtk: 1 },

  // 防具
  bronzeBody:  { id: 'bronzeBody',  name: '青銅の鎧',   slot: 'body', icon: '🛡️', armorDef: { slash: 8, pierce: 8, strike: 8 }, perLevelArmor: 1 },
  thunderBody: { id: 'thunderBody', name: '雷の鎧',     slot: 'body', icon: '⚡', attackAdd: 5, armorDef: { slash: 10, pierce: 10, strike: 10, thunder: 40 }, perLevelArmor: 1 },
  bronzeArms:  { id: 'bronzeArms',  name: '青銅の小手', slot: 'arms', icon: '🧤', armorDef: { slash: 3, pierce: 3, strike: 3 }, perLevelArmor: 1 },
  bronzeHead:  { id: 'bronzeHead',  name: '青銅の兜',   slot: 'head', icon: '⛑️', armorDef: { slash: 5, pierce: 5, strike: 5 }, perLevelArmor: 1 },
  bronzeLegs:  { id: 'bronzeLegs',  name: '青銅の具足', slot: 'legs', icon: '🥾', armorDef: { slash: 3, pierce: 3, strike: 3 }, perLevelArmor: 1 },
  melqartLegs: { id: 'melqartLegs', name: 'メルカルトの具足', slot: 'legs', icon: '🔥', armorDef: { fire: 40 }, moveMultPct: 20, perLevelArmor: 1 },
}

// ─── 所持装備インスタンス（軍単位所有・レベルを持つ）─────────────────
export interface OwnedEquip {
  uid:   string   // インスタンス固有ID
  defId: string   // EQUIP_DEFS のキー
  level: number   // 1起点
  exp:   number   // 経験値100ごとに+1
}

// 隊の装備ロードアウト（スロット→所持装備uid）
export type SquadEquip = Partial<Record<EquipSlot, string>>

// ─── 装備効果の解決（隊の装備ロードアウト → 兵士へ乗る効果）───────────
export interface ResolvedEquip {
  attackAdd:      number
  defenseAdd:     number
  attackSpeedAdd: number
  rangeAdd:       number
  moveMultPct:    number
  attackAttr?:    AttrId
  armorDef:       Partial<Record<AttrId, number>>
}

function applyLevel(def: EquipDef, level: number): { attackAdd: number; armorBonus: number } {
  const lv = Math.max(1, level)
  return {
    attackAdd: (def.attackAdd ?? 0) + (def.perLevelAtk ?? 0) * (lv - 1),
    armorBonus: (def.perLevelArmor ?? 0) * (lv - 1),
  }
}

export function resolveEquip(loadout: SquadEquip | undefined, ownedByUid: Map<string, OwnedEquip>): ResolvedEquip {
  const r: ResolvedEquip = { attackAdd: 0, defenseAdd: 0, attackSpeedAdd: 0, rangeAdd: 0, moveMultPct: 0, armorDef: {} }
  if (!loadout) return r

  for (const slot of SLOTS) {
    const uid = loadout[slot]
    if (!uid) continue
    const owned = ownedByUid.get(uid)
    if (!owned) continue
    const def = EQUIP_DEFS[owned.defId]
    if (!def) continue

    const { attackAdd, armorBonus } = applyLevel(def, owned.level)
    r.attackAdd      += attackAdd
    r.defenseAdd     += def.defenseAdd ?? 0
    r.attackSpeedAdd += def.attackSpeedAdd ?? 0
    r.rangeAdd       += def.rangeAdd ?? 0
    r.moveMultPct    += def.moveMultPct ?? 0
    if (slot === 'weapon' && def.attr) r.attackAttr = def.attr
    if (def.armorDef) {
      for (const [a, v] of Object.entries(def.armorDef) as [AttrId, number][]) {
        r.armorDef[a] = (r.armorDef[a] ?? 0) + v + armorBonus
      }
    }
  }
  return r
}

// ─── 初期インベントリ（軍所有装備）────────────────────────────────
let _uidCounter = 0
function mkOwned(defId: string): OwnedEquip {
  return { uid: `eq_${defId}_${_uidCounter++}`, defId, level: 1, exp: 0 }
}

// 装備の経験値付与・レベルアップ（経験値100ごとに+1）
export function gainEquipExp(inventory: OwnedEquip[], usedUids: Set<string>, amount = 20): OwnedEquip[] {
  return inventory.map(o => {
    if (!usedUids.has(o.uid)) return o
    let exp = o.exp + amount
    let level = o.level
    while (exp >= 100) { exp -= 100; level++ }
    return { ...o, exp, level }
  })
}

// 編成中の隊が装備している装備uidの集合
export function equippedUids(squads: { equip?: SquadEquip }[]): Set<string> {
  const set = new Set<string>()
  for (const s of squads) {
    if (!s.equip) continue
    for (const slot of SLOTS) {
      const uid = s.equip[slot]
      if (uid) set.add(uid)
    }
  }
  return set
}

export function makeInitialInventory(): OwnedEquip[] {
  _uidCounter = 0
  return [
    mkOwned('sword'), mkOwned('sword'),
    mkOwned('fireSword'),
    mkOwned('longBow'),
    mkOwned('bronzeBody'), mkOwned('bronzeBody'),
    mkOwned('bronzeHead'), mkOwned('bronzeHead'),
    mkOwned('bronzeArms'),
    mkOwned('bronzeLegs'),
  ]
}
