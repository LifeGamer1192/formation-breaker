import type { GameState } from './types'
import { makeInitialGameState } from './army'
import { makeInitialInventory } from './equipment'
import { START_NODE } from './campaign'

const STORAGE_KEY = 'fb-game-state'

// 任意の（古い/外部の）セーブデータを現行スキーマへ正規化（ローカル/クラウド共用）
export function normalizeGameState(parsed: Partial<GameState>): GameState {
  return {
    roster:      parsed.roster ?? [],
    squads:      parsed.squads ?? [],
    gold:        parsed.gold ?? 0,
    tokens:      parsed.tokens ?? 0,
    potions:     parsed.potions ?? 3,
    inventory:   parsed.inventory ?? makeInitialInventory(),
    recruitedBattles: parsed.recruitedBattles ?? [],
    clearedNodes: parsed.clearedNodes ?? [],
    frontier:     parsed.frontier ?? [START_NODE],
    log:         parsed.log ?? [],
  }
}

export function saveGame(gameState: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState))
  } catch (e) {
    console.error('Failed to save game:', e)
  }
}

export function loadGame(): GameState | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return null
    return normalizeGameState(JSON.parse(data) as Partial<GameState>)
  } catch (e) {
    console.error('Failed to load game:', e)
    return null
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.error('Failed to clear game:', e)
  }
}

export function initializeGameState(): GameState {
  const saved = loadGame()
  if (saved) return saved
  return makeInitialGameState()
}
