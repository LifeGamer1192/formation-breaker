import { useState } from 'react'
import type { WorldState } from '@fb/sim-core'
import { MapScreen } from './screens/MapScreen'
import { FormationScreen } from './screens/FormationScreen'
import { BattleScreen } from './screens/BattleScreen'
import { ResultScreen } from './screens/ResultScreen'
import type { GameState, RosterUnit, SquadSetup, BattleDef } from './game/types'
import { getBattleDef } from './game/campaign'
import { makeInitialGameState, resetAllUnits } from './game/army'
import { saveGame } from './game/storage'

// WorldState を GameState + BattleDef から動的生成
function makeWorldFromSetup(gameState: GameState, battleDef: BattleDef): WorldState {
  const allyUnits: Record<string, WorldState['units'][string]> = {}
  const enemyUnits: Record<string, WorldState['units'][string]> = {}

  // 味方ユニット（GameState.roster + squads）
  for (const squad of gameState.squads) {
    for (const unitId of squad.unitIds) {
      const rosterUnit = gameState.roster.find(u => u.id === unitId)
      if (rosterUnit) {
        allyUnits[unitId] = {
          id: rosterUnit.id,
          name: rosterUnit.name,
          side: 'ally',
          hp: rosterUnit.maxHp,
          maxHp: rosterUnit.maxHp,
          attack: rosterUnit.attack,
          defense: rosterUnit.defense,
          attackSpeed: rosterUnit.attackSpeed,
          gaugeMax: rosterUnit.gaugeMax,
          gauge: 0,
          alive: true,
          isLeader: squad.unitIds[0] === unitId,
          skills: rosterUnit.skills,
          flankMod: rosterUnit.flankMod,
          rearMod: rosterUnit.rearMod,
          range: rosterUnit.range,
        }
      }
    }
  }

  // 敵ユニット（BattleDef.enemies）
  for (const squad of battleDef.enemies.squads) {
    for (const unitId of squad.unitIds) {
      const rosterUnit = battleDef.enemies.units.find(u => u.id === unitId)
      if (rosterUnit) {
        enemyUnits[unitId] = {
          id: rosterUnit.id,
          name: rosterUnit.name,
          side: 'enemy',
          hp: rosterUnit.maxHp,
          maxHp: rosterUnit.maxHp,
          attack: rosterUnit.attack,
          defense: rosterUnit.defense,
          attackSpeed: rosterUnit.attackSpeed,
          gaugeMax: rosterUnit.gaugeMax,
          gauge: 0,
          alive: true,
          isLeader: squad.unitIds[0] === unitId,
          skills: rosterUnit.skills,
          flankMod: rosterUnit.flankMod,
          rearMod: rosterUnit.rearMod,
          range: rosterUnit.range,
        }
      }
    }
  }

  const allySquads = gameState.squads.map(s => ({
    id: s.id,
    name: s.name,
    side: 'ally' as const,
    unitIds: s.unitIds,
    formation: s.formation,
    pos: { x: battleDef.allyStartX, y: 18 + gameState.squads.indexOf(s) * 20 },
    facing: 0,
    moveQueue: [] as any[],
    moveSpeed: 1.0,
    movementType: 'forest' as const,
  }))

  const enemySquads = battleDef.enemies.squads.map((s, idx) => ({
    id: s.id,
    name: s.name,
    side: 'enemy' as const,
    unitIds: s.unitIds,
    formation: s.formation,
    pos: { x: battleDef.enemyStartX, y: 18 + idx * 20 },
    facing: Math.PI,
    moveQueue: [] as any[],
    moveSpeed: 1.0,
    movementType: 'plain' as const,
  }))

  return {
    tick: 0,
    units: { ...allyUnits, ...enemyUnits },
    squads: [...allySquads, ...enemySquads],
    log: [],
    finished: false,
    winner: null,
  }
}

type Screen = 'map' | 'formation' | 'battle' | 'result'

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => makeInitialGameState())
  const [screen, setScreen] = useState<Screen>('map')
  const [world, setWorld] = useState<WorldState | null>(null)
  const [battleDef, setBattleDef] = useState<BattleDef | null>(null)

  // 各画面遷移
  const handleSelectBattle = (idx: number) => {
    const battle = getBattleDef(idx)
    const world0 = makeWorldFromSetup(gameState, battle)
    setWorld(world0)
    setBattleDef(battle)
    setScreen('formation')
  }

  const handleStartBattle = (squads: SquadSetup[]) => {
    if (!battleDef) return
    const updatedGameState: GameState = {
      ...gameState,
      squads,
    }
    setGameState(updatedGameState)
    const world0 = makeWorldFromSetup(updatedGameState, battleDef)
    setWorld(world0)
    setScreen('battle')
  }

  const handleBattleEnd = (finalWorld: WorldState) => {
    setWorld(finalWorld)
    setScreen('result')
  }

  const handleResultContinue = (updatedRoster: RosterUnit[]) => {
    const newGameState: GameState = {
      ...gameState,
      roster: updatedRoster,
      battleIndex: gameState.battleIndex + 1,
      squads: [],
    }
    setGameState(newGameState)
    saveGame(newGameState)
    setScreen('map')
  }

  const handleResultRetry = () => {
    if (!battleDef) return
    // 兵士の HP とステータスをリセット
    const resettedRoster = resetAllUnits(gameState.roster)
    const updatedGameState: GameState = {
      ...gameState,
      roster: resettedRoster,
    }
    setGameState(updatedGameState)
    const world0 = makeWorldFromSetup(updatedGameState, battleDef)
    setWorld(world0)
    setScreen('formation')
  }

  return (
    <div style={{ background: '#0a0a14', color: '#ddd', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {screen === 'map' && (
        <MapScreen currentBattleIndex={gameState.battleIndex} onSelectBattle={handleSelectBattle} />
      )}
      {screen === 'formation' && (
        <FormationScreen roster={gameState.roster} onStart={handleStartBattle} />
      )}
      {screen === 'battle' && world && battleDef && (
        <BattleScreen battleDef={battleDef} initialWorld={world} onBattleEnd={handleBattleEnd} />
      )}
      {screen === 'result' && world && (
        <ResultScreen
          world={world}
          roster={gameState.roster}
          onContinue={handleResultContinue}
          onRetry={handleResultRetry}
        />
      )}
    </div>
  )
}
