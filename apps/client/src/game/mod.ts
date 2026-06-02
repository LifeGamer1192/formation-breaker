// ─── Mod システム（α16: データ駆動・カタログ差し替え）────────────────
// JSON の Mod パックで各カタログ（装備/必殺技/必殺技アイテム/装備アイテム/技/スキル）を
// 追加・上書きできる。built-in は起動時にスナップショットし、解除で元に戻せる。
// 全カタログは Record<string, データ> の可変オブジェクトなので key 単位で差し替える。

import { EQUIP_DEFS } from './equipment'
import { ULTIMATES } from './ultimate'
import { ULT_ITEMS } from './ultItem'
import { ITEM_DEFS } from './item'
import { TECHNIQUES } from './technique'
import { SKILLS } from './skills'

// Mod が差し替え可能なカタログ（id→任意データ）
export interface ModPack {
  name: string
  version?: string
  equipment?: Record<string, unknown>
  ultimates?: Record<string, unknown>
  ultItems?: Record<string, unknown>
  items?: Record<string, unknown>
  techniques?: Record<string, unknown>
  skills?: Record<string, unknown>
}

type AnyRec = Record<string, unknown>
const CATALOGS: Record<keyof Omit<ModPack, 'name' | 'version'>, AnyRec> = {
  equipment:  EQUIP_DEFS as unknown as AnyRec,
  ultimates:  ULTIMATES as unknown as AnyRec,
  ultItems:   ULT_ITEMS as unknown as AnyRec,
  items:      ITEM_DEFS as unknown as AnyRec,
  techniques: TECHNIQUES as unknown as AnyRec,
  skills:     SKILLS as unknown as AnyRec,
}

// built-in スナップショット（モジュール読込時。元 entry 参照を保持）
const ORIGINAL: Record<string, AnyRec> = {}
for (const [k, cat] of Object.entries(CATALOGS)) ORIGINAL[k] = { ...cat }

const MOD_KEY = 'fb-mod'
let activeName: string | null = null
export function activeModName(): string | null { return activeName }

// Mod を適用（追加・上書き）。戻り値は適用件数サマリ。
export function applyModPack(mod: ModPack): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const cat of Object.keys(CATALOGS) as (keyof typeof CATALOGS)[]) {
    const entries = mod[cat] as AnyRec | undefined
    if (!entries) continue
    let n = 0
    for (const [id, val] of Object.entries(entries)) { CATALOGS[cat][id] = val; n++ }
    if (n) counts[cat] = n
  }
  activeName = mod.name
  return counts
}

// built-in に戻す（Mod 追加分を削除・上書き分を復元）
export function resetMod(): void {
  for (const cat of Object.keys(CATALOGS) as (keyof typeof CATALOGS)[]) {
    const live = CATALOGS[cat], orig = ORIGINAL[cat]
    for (const id of Object.keys(live)) if (!(id in orig)) delete live[id]
    for (const id of Object.keys(orig)) live[id] = orig[id]
  }
  activeName = null
}

// 検証（軽量）。name 必須、各カテゴリはオブジェクト、未知キーは無視。
export function validateMod(o: unknown): string | null {
  if (!o || typeof o !== 'object') return 'JSON がオブジェクトではありません'
  const m = o as Record<string, unknown>
  if (typeof m.name !== 'string' || !m.name) return 'name（文字列）が必要です'
  const cats = ['equipment', 'ultimates', 'ultItems', 'items', 'techniques', 'skills']
  let any = false
  for (const c of cats) {
    if (m[c] == null) continue
    if (typeof m[c] !== 'object' || Array.isArray(m[c])) return `${c} はオブジェクト（id→定義）が必要です`
    any = true
  }
  if (!any) return '差し替えるカタログが1つもありません'
  return null
}

export function parseMod(text: string): { ok: true; mod: ModPack } | { ok: false; error: string } {
  let obj: unknown
  try { obj = JSON.parse(text) } catch (e) { return { ok: false, error: 'JSON構文エラー: ' + String(e) } }
  const err = validateMod(obj)
  if (err) return { ok: false, error: err }
  return { ok: true, mod: obj as ModPack }
}

// localStorage 永続（起動時に再適用）
export function saveMod(mod: ModPack): void { try { localStorage.setItem(MOD_KEY, JSON.stringify(mod)) } catch { /* ignore */ } }
export function clearSavedMod(): void { try { localStorage.removeItem(MOD_KEY) } catch { /* ignore */ } }
export function loadSavedMod(): ModPack | null {
  try {
    const t = localStorage.getItem(MOD_KEY)
    if (!t) return null
    const r = parseMod(t)
    return r.ok ? r.mod : null
  } catch { return null }
}
// 起動時に呼ぶ（永続 Mod があれば適用）
export function applySavedModOnBoot(): void {
  const m = loadSavedMod()
  if (m) applyModPack(m)
}

// ─── サンプル Mod（ファンタジー風・上書き＋追加のデモ）──────────────────
export const SAMPLE_MOD: ModPack = {
  name: 'ファンタジーMod（サンプル）',
  version: '1',
  equipment: {
    // 既存「剣」を魔剣に上書き（攻撃力UP・火属性）
    sword: { id: 'sword', name: '魔剣エクスカリバー', slot: 'weapon', icon: '⚔️', attackAdd: 90, attr: 'fire', perLevelAtk: 8 },
    // 新規装備を追加
    frostStaff: { id: 'frostStaff', name: '氷の杖', slot: 'weapon', icon: '🪄', attackAdd: 40, attr: 'thunder', rangeAdd: 20, attackSpeedAdd: -2 },
  },
  ultimates: {
    // 新必殺技: 隕石（範囲・大ダメージ）
    meteor: { id: 'meteor', name: '隕石召喚', icon: '☄️', kind: 'aoeDamage', attr: 'fire', power: 1200, range: 35, radius: 22, ultSpeed: 1, gaugeMax: 100, desc: '広範囲に隕石を落とす' },
  },
  skills: {
    // 新スキル: 魔法障壁（隊の防御を大きく上げる）
    wardField: { name: '魔法障壁', effects: [{ layer: 'squadSkill', target: 'defense', op: 'add', value: 80, priority: 0, source: '魔法障壁', scope: 'squad' }] },
  },
}
