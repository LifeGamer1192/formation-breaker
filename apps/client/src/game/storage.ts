import type { GameState } from './types'
import { makeInitialGameState } from './army'

const STORAGE_KEY = 'fb-game-state'

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
    return JSON.parse(data) as GameState
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
