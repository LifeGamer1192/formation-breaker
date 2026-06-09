// ─── グラフィックテーマ（α15）──────────────────────────────────────
// 2テーマ（default / alt）を localStorage で切り替え、パス /themes/{id}/… で配信される
// 画像（顔グラ・ユニットスプライト・地形チップ・背景）を参照する。
// 画像が無い場合は各描画側で色塗りフォールバックする。

export type ThemeId = 'default' | 'alt'
export const THEME_IDS: ThemeId[] = ['default', 'alt']
export const THEME_LABEL: Record<ThemeId, string> = { default: '標準テーマ', alt: '代替テーマ' }
export const DEFAULT_THEME: ThemeId = 'default'

// GitHub Pages のサブパス配信に対応（base 配下）。dev は '/'、build は '/formation-breaker/'。
const ROOT = `${import.meta.env.BASE_URL}themes`

// ── 顔グラ（128×128）。仕様の ユニットID→ファイル名 マッピング ──────────
export interface FaceLike { id: string; side: 'ally' | 'enemy'; kind?: string; isCommander?: boolean }
export function faceFile(u: FaceLike): string {
  if (u.id === 'unit_hannibal') return 'hannibal'
  if (u.id === 'unit_mago') return 'mago'
  if (u.side === 'enemy') {
    // 敵ユニーク武将 or 大将 → enemy_commander、それ以外の敵一般兵 → spearman
    return (u.kind === 'unique' || u.isCommander) ? 'enemy_commander' : 'spearman'
  }
  // 味方一般兵: id 末尾の数値で a/b 振り分け（数値が無ければ文字コード総和でパリティ）
  const m = u.id.match(/(\d+)\s*$/)
  const n = m ? parseInt(m[1], 10) : [...u.id].reduce((s, c) => s + c.charCodeAt(0), 0)
  return n % 2 === 0 ? 'infantry_a' : 'infantry_b'
}
export function faceUrl(theme: ThemeId, u: FaceLike): string {
  return `${ROOT}/${theme}/face/${faceFile(u)}.png`
}

// ── ユニットスプライト（32×32）。side と簡易タイプで選択 ──────────────
export interface SpriteLike { side: 'ally' | 'enemy'; isLeader?: boolean; range?: number; movementType?: string }
export function unitSpriteFile(u: SpriteLike): string {
  const cavalry = u.movementType === 'cavalry'
  if (u.side === 'ally') {
    if (u.isLeader) return 'ally_elite'
    if (cavalry) return 'ally_cavalry'
    if ((u.range ?? 0) >= 30) return 'ally_archer'
    return 'ally_infantry'
  }
  return cavalry ? 'enemy_cavalry' : 'enemy_infantry'
}
export function unitSpriteUrl(theme: ThemeId, u: SpriteLike): string {
  return `${ROOT}/${theme}/unit/${unitSpriteFile(u)}.png`
}

// ── 地形チップ（60×60）。地形ID highmount のみファイル名 highland ─────────
export function terrainFile(terrain: string): string {
  return terrain === 'highmount' ? 'highland' : terrain
}
export function terrainUrl(theme: ThemeId, terrain: string): string {
  return `${ROOT}/${theme}/terrain/${terrainFile(terrain)}.png`
}

// ── 戦場背景（600×360）─────────────────────────────────────────────
export function bgUrl(theme: ThemeId): string {
  return `${ROOT}/${theme}/bg/battlefield.png`
}

// 全地形ID（テクスチャ事前読み込み用）
export const ALL_TERRAINS = ['plain', 'forest', 'mountain', 'desert', 'swamp', 'water', 'river', 'highmount', 'moat', 'wall']
export const ALL_UNIT_SPRITES = ['ally_infantry', 'ally_cavalry', 'ally_archer', 'ally_elite', 'enemy_infantry', 'enemy_cavalry']

// localStorage 永続（ゲームセーブとは分離）
const THEME_KEY = 'fb-theme'
export function loadTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'alt' || v === 'default' ? v : DEFAULT_THEME
  } catch { return DEFAULT_THEME }
}
export function saveTheme(id: ThemeId): void {
  try { localStorage.setItem(THEME_KEY, id) } catch { /* ignore */ }
}
