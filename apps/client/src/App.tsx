import { useState, useEffect } from 'react'
import type { WorldState, LayerEffect, AttrId } from '@fb/sim-core'
import { DEMO_TERRAIN } from '@fb/sim-core'
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
import { resolveEquip, gainEquipExp, equippedUids } from './game/equipment'
import type { OwnedEquip, ResolvedEquip } from './game/equipment'
import { resolveItems } from './game/item'
import type { OwnedItem, ResolvedItems } from './game/item'
import { resolveUltimate } from './game/ultimate'
import { saveGame, normalizeGameState } from './game/storage'
import { isCloudEnabled, ensureAnonAuth, saveCloud, loadCloud } from './game/supabase'
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

// 装備アイテム効果（equipmentItem レイヤー＝装備とは別レイヤーで加算・α12）
function itemEffects(ri: ResolvedItems): LayerEffect[] {
  const fx: LayerEffect[] = []
  if (ri.attackAdd)      fx.push({ layer: 'equipmentItem', target: 'attack',      op: 'add', value: ri.attackAdd,      priority: 0, source: '装備アイテム' })
  if (ri.defenseAdd)     fx.push({ layer: 'equipmentItem', target: 'defense',     op: 'add', value: ri.defenseAdd,     priority: 0, source: '装備アイテム' })
  if (ri.attackSpeedAdd) fx.push({ layer: 'equipmentItem', target: 'attackSpeed', op: 'add', value: ri.attackSpeedAdd, priority: 0, source: '装備アイテム' })
  return fx
}

// WorldState を GameState + BattleDef から動的生成
function makeWorldFromSetup(gameState: GameState, battleDef: BattleDef): WorldState {
  const allyUnits: Record<string, WorldState['units'][string]> = {}
  const enemyUnits: Record<string, WorldState['units'][string]> = {}

  const ownedByUid = new Map<string, OwnedEquip>(gameState.inventory.map(o => [o.uid, o]))
  const itemByUid  = new Map<string, OwnedItem>(gameState.items.map(o => [o.uid, o]))
  // 隊ごとの装備・装備アイテム解決を事前計算（ユニット・隊の両方で使う）
  const reBySquad = new Map<string, ResolvedEquip>(
    gameState.squads.map(s => [s.id, resolveEquip(s.equip, ownedByUid)]),
  )
  const riBySquad = new Map<string, ResolvedItems>(
    gameState.squads.map(s => [s.id, resolveItems(s.itemUids, itemByUid)]),
  )

  // 味方ユニット（GameState.roster + squads + 隊装備 + 装備アイテム）
  for (const squad of gameState.squads) {
    const re = reBySquad.get(squad.id)!
    const ri = riBySquad.get(squad.id)!
    for (const unitId of squad.unitIds) {
      const rosterUnit = gameState.roster.find(u => u.id === unitId)
      if (rosterUnit) {
        allyUnits[unitId] = {
          id: rosterUnit.id,
          name: rosterUnit.name,
          side: 'ally',
          hp: Math.max(1, Math.min(rosterUnit.maxHp, rosterUnit.hp)), // α12: HP永続（現在HPで出撃）
          maxHp: rosterUnit.maxHp,
          attack: rosterUnit.attack,
          defense: rosterUnit.defense,
          attackSpeed: rosterUnit.attackSpeed,
          gaugeMax: rosterUnit.gaugeMax,
          gauge: 0,
          alive: true,
          isLeader: squad.unitIds[0] === unitId,
          skills: [...rosterUnit.skills, ...equipEffects(re), ...itemEffects(ri)],
          flankMod: rosterUnit.flankMod,
          rearMod: rosterUnit.rearMod,
          range: rosterUnit.range + re.rangeAdd + ri.rangeAdd,
          attackAttr: re.attackAttr ?? rosterUnit.attackAttr,
          armorDef: mergeArmor(mergeArmor(rosterUnit.armorDef, re.armorDef), ri.armorDef),
          regen: (re.regenAdd + ri.regenAdd) || undefined,
          techniques: rosterUnit.techniques?.map(t => ({ ...t, gauge: 0 })),
          canLearn: rosterUnit.canLearn,   // α13: 学び（隊スキル）
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
          isElephant: rosterUnit.isElephant,   // α14: 象（敵に配置時）
          canLearn: rosterUnit.canLearn,        // α13: 学び（敵に配置時）
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
    const ri = riBySquad.get(s.id)!
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
      moveSpeed: 1.0 * (1 + (re.moveMultPct + ri.moveMultPct) / 100),
      movementType: re.moveType ?? 'forest',   // α13: 装備（軍馬の鞍等）で移動タイプ変更
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
    // 敵AI: 「後衛/本陣」は離れて戦う rear、それ以外は接近する front（隊ごと）
    ai: (s.name.includes('後衛') || s.name.includes('本陣') ? 'rear' : 'front') as 'front' | 'rear',
  }))

  return {
    tick: 0,
    units: { ...allyUnits, ...enemyUnits },
    squads: [...allySquads, ...enemySquads],
    log: [],
    finished: false,
    winner: null,
    // α8/α15: 戦闘ごとに地形を複製（戦場固有 terrain があれば優先・なければ DEMO_TERRAIN）
    terrain: (battleDef.terrain ?? DEMO_TERRAIN).map(row => [...row]),
    terrainDmg: {},
  }
}

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
