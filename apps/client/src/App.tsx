import { useState, useEffect } from 'react'
import type { WorldState } from '@fb/sim-core'
import { MapScreen } from './screens/MapScreen'
import { FormationScreen } from './screens/FormationScreen'
import { BattleScreen } from './screens/BattleScreen'
import { ResultScreen } from './screens/ResultScreen'
import { GhostScreen } from './screens/GhostScreen'
import { ImportScreen } from './screens/ImportScreen'
import type { GameState, RosterUnit, SquadSetup, BattleDef, Ghost } from './game/types'
import type { BattleScenario } from './game/scenario'
import { scenarioToWorld } from './game/scenario'
import { getNode } from './game/campaign'
import { makeInitialGameState, resetAllUnits, generateMercenary, MERCENARY_COST, makeRecruitGenerals, avgLevel, UNIQUE_RECRUITS } from './game/army'
import { makeGhostFromSquads, ghostToBattleDef, saveGhost } from './game/ghost'
import { gainEquipExp, equippedUids } from './game/equipment'
import { saveGame, normalizeGameState } from './game/storage'
import { isCloudEnabled, ensureAnonAuth, saveCloud, loadCloud } from './game/supabase'
import { C } from './ui/theme'

import { makeWorldFromSetup } from './game/worldBuilder'

type Screen = 'map' | 'formation' | 'battle' | 'result' | 'ghost' | 'import'

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => makeInitialGameState())
  const [screen, setScreen] = useState<Screen>('map')
  const [world, setWorld] = useState<WorldState | null>(null)
  const [battleDef, setBattleDef] = useState<BattleDef | null>(null)
  const [matchType, setMatchType] = useState<'campaign' | 'ghost' | 'scenario'>('campaign')
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)
  const [cloudUserId, setCloudUserId] = useState<string | null>(null)
  const [cloudMsg, setCloudMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // 起動時に匿名サインイン（Supabase設定時のみ・ベストエフォート）
  useEffect(() => {
    if (!isCloudEnabled()) return
    ensureAnonAuth().then(uid => { if (uid) setCloudUserId(uid) })
  }, [])

  // クラウドセーブ（本人のみ）
  const handleCloudSave = async () => {
    setCloudMsg({ ok: true, text: '⏳ 保存中...' })
    const res = await saveCloud(gameState)
    setCloudMsg(res.ok ? { ok: true, text: '☁️ クラウドに保存しました' } : { ok: false, text: `❌ ${res.error ?? '失敗'}` })
  }

  // クラウドロード（明示的・確認なしで上書きしない＝ボタン操作が明示確認）
  const handleCloudLoad = async () => {
    setCloudMsg({ ok: true, text: '⏳ 読込中...' })
    const data = await loadCloud<GameState>()
    if (!data) { setCloudMsg({ ok: false, text: 'クラウドセーブが見つかりません' }); return }
    const gs = normalizeGameState(data)
    setGameState(gs)
    saveGame(gs)
    setScreen('map')
    setCloudMsg({ ok: true, text: '☁️ クラウドから復元しました' })
  }

  // 各画面遷移（マップ分岐ノードを選択）
  const handleSelectNode = (nodeId: string) => {
    const node = getNode(nodeId)
    if (!node) return
    setMatchType('campaign')
    setCurrentNodeId(nodeId)
    const battle = node.battle
    // α7: 初回突入時の強制加入（援軍・一般）。入隊レベル=平均、再付与は防止
    let gs = gameState
    const needsRecruit = (battle.recruitGenerals || battle.recruitUniques?.length) && !gs.recruitedBattles.includes(battle.id)
    if (needsRecruit) {
      const lvl = avgLevel(gs.roster)
      const seed = gs.clearedNodes.length * 9973 + gs.roster.length * 17 + 3
      const generals = battle.recruitGenerals ? makeRecruitGenerals(seed, battle.recruitGenerals, lvl) : []
      // α15: ユニーク入軍（マゴ等）。既にロスターに居るユニークは再加入しない
      const uniques = (battle.recruitUniques ?? [])
        .map(uid => UNIQUE_RECRUITS[uid]?.())
        .filter((u): u is RosterUnit => !!u && !gs.roster.some(r => r.id === u.id))
      const recruits = [...uniques, ...generals]
      if (recruits.length > 0) {
        const names = recruits.map(r => r.name).join('・')
        gs = {
          ...gs,
          roster: [...gs.roster, ...recruits],
          recruitedBattles: [...gs.recruitedBattles, battle.id],
          log: [...gs.log, `入軍: ${names}（Lv${lvl}）`],
        }
        setGameState(gs)
        saveGame(gs)
      }
    }
    setBattleDef(battle)
    setWorld(makeWorldFromSetup(gs, battle))
    setScreen('formation')
  }

  // α12: 回復薬を使う（兵士のHPを最大50%回復・回復薬1消費）
  const handleUsePotion = (unitId: string) => {
    if (gameState.potions <= 0) return
    const u = gameState.roster.find(r => r.id === unitId)
    if (!u || u.hp >= u.maxHp) return
    const heal = Math.ceil(u.maxHp * 0.5)
    const gs: GameState = {
      ...gameState,
      potions: gameState.potions - 1,
      roster: gameState.roster.map(r => r.id === unitId ? { ...r, hp: Math.min(r.maxHp, r.hp + heal), alive: true } : r),
    }
    setGameState(gs)
    saveGame(gs)
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

  // ─── 局地戦インポート（α9）─────────────────────────────────────
  const handleOpenImport = () => setScreen('import')

  const handleRunScenario = (scn: BattleScenario) => {
    setMatchType('scenario')
    setBattleDef({ id: 'scenario', name: scn.name, enemies: { units: [], squads: [] }, allyStartX: 10, enemyStartX: 80, reward: 0 })
    setWorld(scenarioToWorld(scn))
    setScreen('battle')
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

  // 必殺技アイテム消費（戦闘中に発動した分を GameState へ即時反映・永続化）
  const handleUseUltItem = (defId: string) => {
    setGameState(prev => {
      const cur = prev.ultItems[defId] ?? 0
      if (cur <= 0) return prev
      const next: GameState = { ...prev, ultItems: { ...prev.ultItems, [defId]: cur - 1 } }
      saveGame(next)
      return next
    })
  }

  const handleResultContinue = (updatedRoster: RosterUnit[], earnedGold: number) => {
    // 局地戦は進捗・ロスターに影響しない → インポート画面へ戻る
    if (matchType === 'scenario') { setScreen('import'); return }
    const isGhost = matchType === 'ghost'
    // 出撃した隊が装備していた装備に経験値を付与（レベルアップ）
    const usedUids = equippedUids(gameState.squads)
    const newInventory = gainEquipExp(gameState.inventory, usedUids)

    // α12: 戦闘終了時のHPをロスターへ反映（永続）。
    // キャンペーン=戦死は1で復帰し以後は回復薬で立て直す。ゴースト練習は無償回復。
    const finalRoster = updatedRoster.map(u => {
      const wu = world?.units[u.id]
      if (!wu) return u // 出撃していない兵はそのまま
      if (isGhost) return { ...u, hp: u.maxHp, alive: true }
      return { ...u, hp: wu.alive ? Math.min(u.maxHp, wu.hp) : 1, alive: true }
    })

    // キャンペーン: クリアしたノードを記録し、frontier を次ノードへ（後戻り不可）
    let clearedNodes = gameState.clearedNodes
    let frontier = gameState.frontier
    let tokenGain = 0   // メタ通貨はノードクリアで蓄積
    let potionGain = 0  // 回復薬もノードクリアで
    if (!isGhost && currentNodeId) {
      const node = getNode(currentNodeId)
      if (node && !clearedNodes.includes(currentNodeId)) {
        clearedNodes = [...clearedNodes, currentNodeId]
        frontier = node.next.filter(n => !clearedNodes.includes(n))
        tokenGain = 10
        potionGain = 1
      }
    }

    const newGameState: GameState = {
      ...gameState,
      roster: finalRoster,
      gold: gameState.gold + earnedGold,       // 戦闘報酬はラン内通貨（金）へ
      tokens: gameState.tokens + tokenGain,    // メタ通貨はノードクリアで
      potions: gameState.potions + potionGain,
      inventory: newInventory,
      clearedNodes,
      frontier,
      // squads は維持（編成・装備を次マップへ引き継ぐ）
    }
    setGameState(newGameState)
    saveGame(newGameState)
    if (cloudUserId) void saveCloud(newGameState) // 進捗を自動クラウドバックアップ（ベストエフォート）
    setScreen(isGhost ? 'ghost' : 'map')
  }

  // 傭兵を雇う（金を消費 → ランダム一般兵をロスターに追加）
  const handleHire = () => {
    if (gameState.gold < MERCENARY_COST) return
    // ロスター数と金残から擬似シードを生成（ID 衝突回避のため roster.length も加味）
    const seed = gameState.gold * 7919 + gameState.roster.length * 31 + gameState.clearedNodes.length
    const merc = generateMercenary(seed, avgLevel(gameState.roster))
    const newGameState: GameState = {
      ...gameState,
      roster: [...gameState.roster, merc],
      gold: gameState.gold - MERCENARY_COST,
    }
    setGameState(newGameState)
    saveGame(newGameState)
  }

  const handleResultRetry = () => {
    // 局地戦のやり直しはインポート画面へ戻る（シナリオは保持していないため）
    if (matchType === 'scenario') { setScreen('import'); return }
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
          tokens={gameState.tokens}
          onSelectNode={handleSelectNode}
          onOpenGhost={handleOpenGhost}
          onOpenImport={handleOpenImport}
          cloudEnabled={isCloudEnabled()}
          cloudUserId={cloudUserId}
          cloudMsg={cloudMsg}
          onCloudSave={handleCloudSave}
          onCloudLoad={handleCloudLoad}
        />
      )}
      {screen === 'ghost' && (
        <GhostScreen onChallenge={handleChallengeGhost} onBack={() => setScreen('map')} />
      )}
      {screen === 'import' && (
        <ImportScreen onRun={handleRunScenario} onBack={() => setScreen('map')} />
      )}
      {screen === 'formation' && (
        <FormationScreen
          roster={gameState.roster}
          gold={gameState.gold}
          potions={gameState.potions}
          inventory={gameState.inventory}
          items={gameState.items}
          initialSquads={gameState.squads}
          onHire={handleHire}
          onUsePotion={handleUsePotion}
          onDelete={handleDeleteUnit}
          onStart={handleStartBattle}
          onSaveGhost={handleSaveGhost}
        />
      )}
      {screen === 'battle' && world && battleDef && (
        <BattleScreen battleDef={battleDef} initialWorld={world} onBattleEnd={handleBattleEnd}
          ultItems={gameState.ultItems} onUseUltItem={handleUseUltItem} />
      )}
      {screen === 'result' && world && (
        <ResultScreen
          world={world}
          roster={gameState.roster}
          reward={battleDef?.reward ?? 0}
          scenario={matchType === 'scenario'}
          onContinue={handleResultContinue}
          onRetry={handleResultRetry}
        />
      )}
    </div>
  )
}
