import { useState } from 'react'
import type { WorldState, LayerEffect, AttrId } from '@fb/sim-core'
import { DEMO_TERRAIN } from '@fb/sim-core'
import { MapScreen } from './screens/MapScreen'
import { FormationScreen } from './screens/FormationScreen'
import { BattleScreen } from './screens/BattleScreen'
import { ResultScreen } from './screens/ResultScreen'
import { GhostScreen } from './screens/GhostScreen'
import type { GameState, RosterUnit, SquadSetup, BattleDef, Ghost } from './game/types'
import { getNode } from './game/campaign'
import { makeInitialGameState, resetAllUnits, generateMercenary, MERCENARY_COST, makeRecruitGenerals, avgLevel } from './game/army'
import { makeGhostFromSquads, ghostToBattleDef, saveGhost } from './game/ghost'
import { resolveEquip, gainEquipExp, equippedUids } from './game/equipment'
import type { OwnedEquip, ResolvedEquip } from './game/equipment'
import { resolveUltimate } from './game/ultimate'
import { saveGame } from './game/storage'
import { C } from './ui/theme'

// 属性別防御の合算
function mergeArmor(a: Partial<Record<AttrId, number>> | undefined, b: Partial<Record<AttrId, number>>): Partial<Record<AttrId, number>> {
  const out: Partial<Record<AttrId, number>> = { ...(a ?? {}) }
  for (const [k, v] of Object.entries(b) as [AttrId, number][]) out[k] = (out[k] ?? 0) + v
  return out
}

// 装備効果を LayerEffect 列（装備レイヤー）に変換
function equipEffects(re: ResolvedEquip): LayerEffect[] {
  const fx: LayerEffect[] = []
  if (re.attackAdd)      fx.push({ layer: 'equipment', target: 'attack',      op: 'add', value: re.attackAdd,      priority: 0, source: '装備' })
  if (re.defenseAdd)     fx.push({ layer: 'equipment', target: 'defense',     op: 'add', value: re.defenseAdd,     priority: 0, source: '装備' })
  if (re.attackSpeedAdd) fx.push({ layer: 'equipment', target: 'attackSpeed', op: 'add', value: re.attackSpeedAdd, priority: 0, source: '装備' })
  return fx
}

// WorldState を GameState + BattleDef から動的生成
function makeWorldFromSetup(gameState: GameState, battleDef: BattleDef): WorldState {
  const allyUnits: Record<string, WorldState['units'][string]> = {}
  const enemyUnits: Record<string, WorldState['units'][string]> = {}

  const ownedByUid = new Map<string, OwnedEquip>(gameState.inventory.map(o => [o.uid, o]))
  // 隊ごとの装備解決を事前計算（ユニット・隊の両方で使う）
  const reBySquad = new Map<string, ResolvedEquip>(
    gameState.squads.map(s => [s.id, resolveEquip(s.equip, ownedByUid)]),
  )

  // 味方ユニット（GameState.roster + squads + 隊装備）
  for (const squad of gameState.squads) {
    const re = reBySquad.get(squad.id)!
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
          skills: [...rosterUnit.skills, ...equipEffects(re)],
          flankMod: rosterUnit.flankMod,
          rearMod: rosterUnit.rearMod,
          range: rosterUnit.range + re.rangeAdd,
          attackAttr: re.attackAttr ?? rosterUnit.attackAttr,
          armorDef: mergeArmor(rosterUnit.armorDef, re.armorDef),
          techniques: rosterUnit.techniques?.map(t => ({ ...t, gauge: 0 })),
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
          attackAttr: rosterUnit.attackAttr,
          armorDef: rosterUnit.armorDef,
        }
      }
    }
  }

  // α8: 大将＝最後尾の隊のリーダー（撃破で陣営敗北）
  const allyRear = gameState.squads.filter(s => s.unitIds.length > 0).slice(-1)[0]
  const allyCmdId = allyRear?.unitIds[0]
  if (allyCmdId && allyUnits[allyCmdId]) allyUnits[allyCmdId].isCommander = true
  const enemyRear = battleDef.enemies.squads.filter(s => s.unitIds.length > 0).slice(-1)[0]
  const enemyCmdId = enemyRear?.unitIds[0]
  if (enemyCmdId && enemyUnits[enemyCmdId]) enemyUnits[enemyCmdId].isCommander = true

  const allySquads = gameState.squads.map(s => {
    const re = reBySquad.get(s.id)!
    // 隊の必殺技はリーダー（先頭ユニット）の ultId から解決
    const leader = gameState.roster.find(u => u.id === s.unitIds[0])
    const ult = resolveUltimate(leader?.ultId, leader?.level)
    return {
      id: s.id,
      name: s.name,
      side: 'ally' as const,
      unitIds: s.unitIds,
      formation: s.formation,
      pos: { x: battleDef.allyStartX, y: 18 + gameState.squads.indexOf(s) * 20 },
      facing: 0,
      moveQueue: [] as any[],
      moveSpeed: 1.0 * (1 + re.moveMultPct / 100),
      movementType: 'forest' as const,
      ult,
      ultGauge: 0,
    }
  })

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
    // α8: 戦闘ごとに地形を複製（堀塀破壊で変化しても DEMO_TERRAIN を汚さない）
    terrain: DEMO_TERRAIN.map(row => [...row]),
    terrainDmg: {},
  }
}

type Screen = 'map' | 'formation' | 'battle' | 'result' | 'ghost'

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => makeInitialGameState())
  const [screen, setScreen] = useState<Screen>('map')
  const [world, setWorld] = useState<WorldState | null>(null)
  const [battleDef, setBattleDef] = useState<BattleDef | null>(null)
  const [matchType, setMatchType] = useState<'campaign' | 'ghost'>('campaign')
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)

  // 各画面遷移（マップ分岐ノードを選択）
  const handleSelectNode = (nodeId: string) => {
    const node = getNode(nodeId)
    if (!node) return
    setMatchType('campaign')
    setCurrentNodeId(nodeId)
    const battle = node.battle
    // α7: 初回突入時の強制加入（援軍・一般）。入隊レベル=平均、再付与は防止
    let gs = gameState
    if (battle.recruitGenerals && !gs.recruitedBattles.includes(battle.id)) {
      const lvl = avgLevel(gs.roster)
      const seed = gs.clearedNodes.length * 9973 + gs.roster.length * 17 + 3
      const recruits = makeRecruitGenerals(seed, battle.recruitGenerals, lvl)
      gs = {
        ...gs,
        roster: [...gs.roster, ...recruits],
        recruitedBattles: [...gs.recruitedBattles, battle.id],
        log: [...gs.log, `援軍 ${recruits.length}名が加入（Lv${lvl}）`],
      }
      setGameState(gs)
      saveGame(gs)
    }
    setBattleDef(battle)
    setWorld(makeWorldFromSetup(gs, battle))
    setScreen('formation')
  }

  // α7: 兵士の削除（強制加入・ユニークは不可）。ベンチ兵のみ対象
  const handleDeleteUnit = (unitId: string) => {
    const u = gameState.roster.find(r => r.id === unitId)
    if (!u || u.forced) return
    const gs: GameState = {
      ...gameState,
      roster: gameState.roster.filter(r => r.id !== unitId),
      squads: gameState.squads.map(s => ({ ...s, unitIds: s.unitIds.filter(id => id !== unitId) })),
    }
    setGameState(gs)
    saveGame(gs)
  }

  // ─── ゴーストPvP ─────────────────────────────────────────────
  const handleOpenGhost = () => setScreen('ghost')

  const handleChallengeGhost = (ghost: Ghost) => {
    setMatchType('ghost')
    const bd = ghostToBattleDef(ghost)
    setBattleDef(bd)
    setWorld(makeWorldFromSetup(gameState, bd))
    setScreen('formation')
  }

  const handleSaveGhost = (squads: SquadSetup[]) => {
    saveGhost(makeGhostFromSquads(squads, gameState.roster))
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

  const handleResultContinue = (updatedRoster: RosterUnit[], earnedTokens: number) => {
    const isGhost = matchType === 'ghost'
    // 出撃した隊が装備していた装備に経験値を付与（レベルアップ）
    const usedUids = equippedUids(gameState.squads)
    const newInventory = gainEquipExp(gameState.inventory, usedUids)

    // キャンペーン: クリアしたノードを記録し、frontier を次ノードへ（後戻り不可）
    let clearedNodes = gameState.clearedNodes
    let frontier = gameState.frontier
    if (!isGhost && currentNodeId) {
      const node = getNode(currentNodeId)
      if (node && !clearedNodes.includes(currentNodeId)) {
        clearedNodes = [...clearedNodes, currentNodeId]
        frontier = node.next.filter(n => !clearedNodes.includes(n))
      }
    }

    const newGameState: GameState = {
      ...gameState,
      roster: updatedRoster,
      tokens: gameState.tokens + earnedTokens,
      inventory: newInventory,
      clearedNodes,
      frontier,
      squads: [],
    }
    setGameState(newGameState)
    saveGame(newGameState)
    setScreen(isGhost ? 'ghost' : 'map')
  }

  // 傭兵を雇う（トークン消費 → ランダム一般兵をロスターに追加）
  const handleHire = () => {
    if (gameState.tokens < MERCENARY_COST) return
    // ロスター数とトークン残から擬似シードを生成（ID 衝突回避のため roster.length も加味）
    const seed = gameState.tokens * 7919 + gameState.roster.length * 31 + gameState.clearedNodes.length
    const merc = generateMercenary(seed, avgLevel(gameState.roster))
    const newGameState: GameState = {
      ...gameState,
      roster: [...gameState.roster, merc],
      tokens: gameState.tokens - MERCENARY_COST,
    }
    setGameState(newGameState)
    saveGame(newGameState)
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
    <div style={{ background: C.bg, color: C.text, minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {screen === 'map' && (
        <MapScreen
          clearedNodes={gameState.clearedNodes}
          frontier={gameState.frontier}
          onSelectNode={handleSelectNode}
          onOpenGhost={handleOpenGhost}
        />
      )}
      {screen === 'ghost' && (
        <GhostScreen onChallenge={handleChallengeGhost} onBack={() => setScreen('map')} />
      )}
      {screen === 'formation' && (
        <FormationScreen
          roster={gameState.roster}
          tokens={gameState.tokens}
          inventory={gameState.inventory}
          onHire={handleHire}
          onDelete={handleDeleteUnit}
          onStart={handleStartBattle}
          onSaveGhost={handleSaveGhost}
        />
      )}
      {screen === 'battle' && world && battleDef && (
        <BattleScreen battleDef={battleDef} initialWorld={world} onBattleEnd={handleBattleEnd} />
      )}
      {screen === 'result' && world && (
        <ResultScreen
          world={world}
          roster={gameState.roster}
          reward={battleDef?.reward ?? 0}
          onContinue={handleResultContinue}
          onRetry={handleResultRetry}
        />
      )}
    </div>
  )
}
