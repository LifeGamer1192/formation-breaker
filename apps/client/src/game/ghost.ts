import type { Ghost, BattleDef, RosterUnit, SquadSetup } from './types'

export const GHOST_REWARD = 40
export const GHOSTS_KEY = 'fb-ghosts'
const MAX_GHOSTS = 12

// ─── 現在の編成 → Ghost ────────────────────────────────────────────
// squads が参照する兵士のみを roster から抽出してスナップショット
export function makeGhostFromSquads(squads: SquadSetup[], roster: RosterUnit[]): Ghost {
  const usedIds = new Set(squads.flatMap(s => s.unitIds))
  const usedRoster = roster.filter(u => usedIds.has(u.id)).map(u => ({ ...u }))
  const leader = usedRoster.find(u => u.isLeader) ?? usedRoster[0]
  const name = leader ? `${leader.name}の軍` : '無名の軍'
  return {
    id: `g_${Date.now()}`,
    name,
    createdAt: Date.now(),
    squads: squads.filter(s => s.unitIds.length > 0).map(s => ({ ...s, unitIds: [...s.unitIds] })),
    roster: usedRoster,
  }
}

// ─── Ghost → BattleDef（敵として召喚）──────────────────────────────
// 重要: unit/squad の id を 'ghost_' で名前空間化し、味方とのID衝突を防ぐ
export function ghostToBattleDef(ghost: Ghost): BattleDef {
  const pfx = (id: string) => `ghost_${id}`
  const units: RosterUnit[] = ghost.roster.map(u => ({ ...u, id: pfx(u.id), side: 'enemy' }))
  const squads: SquadSetup[] = ghost.squads.map(s => ({
    ...s,
    id: pfx(s.id),
    unitIds: s.unitIds.map(pfx),
  }))
  return {
    id: `ghost_${ghost.id}`,
    name: `👻 ${ghost.name}`,
    enemies: { units, squads },
    allyStartX: 10,
    enemyStartX: 80,
    reward: GHOST_REWARD,
  }
}

// ─── 共有コード（UTF-8安全な Base64）──────────────────────────────
export function encodeGhost(ghost: Ghost): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(ghost))))
}

export function decodeGhost(code: string): Ghost | null {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())))
    const g = JSON.parse(json) as Partial<Ghost>
    // 最低限の形状チェック
    if (!Array.isArray(g.squads) || !Array.isArray(g.roster) || typeof g.name !== 'string') {
      return null
    }
    // id を振り直して既存と衝突させない
    return {
      id: `g_${Date.now()}`,
      name: g.name,
      createdAt: Date.now(),
      squads: g.squads,
      roster: g.roster,
    }
  } catch {
    return null
  }
}

// ─── localStorage 複数スロット ─────────────────────────────────────
export function loadGhosts(): Ghost[] {
  try {
    const data = localStorage.getItem(GHOSTS_KEY)
    if (!data) return []
    const arr = JSON.parse(data)
    return Array.isArray(arr) ? arr : []
  } catch (e) {
    console.error('Failed to load ghosts:', e)
    return []
  }
}

export function saveGhost(ghost: Ghost): void {
  try {
    const ghosts = loadGhosts()
    const next = [ghost, ...ghosts].slice(0, MAX_GHOSTS)
    localStorage.setItem(GHOSTS_KEY, JSON.stringify(next))
  } catch (e) {
    console.error('Failed to save ghost:', e)
  }
}

export function deleteGhost(id: string): void {
  try {
    const next = loadGhosts().filter(g => g.id !== id)
    localStorage.setItem(GHOSTS_KEY, JSON.stringify(next))
  } catch (e) {
    console.error('Failed to delete ghost:', e)
  }
}
