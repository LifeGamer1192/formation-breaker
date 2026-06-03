import { useState, useEffect, useRef, useCallback } from 'react'
import {
  mulberry32, tickCombat, tickMovement, getEffectiveStats,
  FORMATION_LABEL, FORMATION_DESC, DEMO_TERRAIN, dist,
  calcFacingZone, ZONE_LABEL, applyCommand,
  buildUnitView, getEffectiveFormation, ATTRIBUTES,
} from '@fb/sim-core'
import type {
  WorldState, UnitState, SquadState, FormationType,
  TerrainType, Vec2, Command, ReplayData,
} from '@fb/sim-core'
import type { BattleDef } from '../game/types'
import { ULT_ITEMS, resolveUltItem } from '../game/ultItem'
import { TECHNIQUES } from '../game/technique'
import { useTheme } from '../ui/ThemeContext'
import { bgUrl } from '../game/theme'
import { loadSettings, patchSettings } from '../game/settings'
import { FaceIcon } from '../ui/FaceIcon'
import { skillMarks } from '../game/skills'
import { PixiBattlefield } from './pixiBattlefield'
import type { FxEffect, AttackTracer } from './pixiBattlefield'

interface DmgFloat { id: string; x: number; y: number; dmg: number; age: number; side: 'ally'|'enemy' }

// 技ボタンのツールチップ（効果説明＋操作）。runtime は desc を持たないので TECHNIQUES から引く
function techTip(t: { id: string; name: string; icon?: string }): string {
  const d = TECHNIQUES[t.id]
  return d ? `${d.icon}${d.name}: ${d.desc}（クリックでオンオフ）` : `${t.name}（クリックでオンオフ）`
}

const SCALE   = 6
const CW      = 600
const CH      = 360
const UNIT_R  = 9
const SQUAD_R = 22
const DEPLOY_MAX_X = 40  // 配置ゾーン右端（ゲーム単位・α8）

const TERRAIN_COLOR: Record<TerrainType, string> = {
  plain: '#4a7a30', forest: '#1e5010', mountain: '#7a7060', desert: '#b8922a', swamp: '#3a5a3a',
  water: '#1f3a78', river: '#2f63c8', highmount: '#4a4038', moat: '#243a5e', wall: '#4a4a4a',
}
const TERRAIN_LABEL: Record<TerrainType, string> = {
  plain: '平地', forest: '森', mountain: '山', desert: '砂漠', swamp: '沼',
  water: '池', river: '川', highmount: '高山', moat: '堀', wall: '塀',
}


function UnitCard({ unit, squad, color, squadUnits, tick, onToggleTech }: {
  unit: UnitState; squad: SquadState; color: string; squadUnits: UnitState[]; tick: number
  onToggleTech?: (unitId: string, techId: string, enabled: boolean) => void
}) {
  const eff = getEffectiveStats(unit, squad, { aliveCount: squadUnits.length, squadUnits, tick })
  const marks = skillMarks(unit, tick)
  const hpPct = Math.max(0, Math.round(unit.hp / unit.maxHp * 100))
  const gPct  = Math.min(100, Math.round(unit.gauge / unit.gaugeMax * 100))
  const diff  = (b: number, e: number) => e === b ? '' : e > b ? ` ▲${e - b}` : ` ▼${b - e}`
  return (
    <div style={{ marginBottom: 10, opacity: unit.alive ? 1 : 0.35, display: 'flex', gap: 6 }}>
      <FaceIcon unit={unit} size={34} round={5} />
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span>
          <span title={`攻撃属性: ${ATTRIBUTES[unit.attackAttr ?? 'slash'].label}`}>
            {ATTRIBUTES[unit.attackAttr ?? 'slash'].icon}
          </span>
          {' '}{unit.name}{unit.isLeader ? ' 👑' : ''}{unit.isCommander ? ' 🎖' : ''}
        </span>
        <span style={{ color: '#aaa', fontSize: 10 }}>
          {unit.alive ? `${unit.hp.toLocaleString()}/${unit.maxHp.toLocaleString()}` : '離脱'}
        </span>
      </div>
      <div style={{ background: '#333', borderRadius: 3, height: 7, margin: '3px 0' }}>
        <div style={{ background: color, borderRadius: 3, height: '100%', width: `${hpPct}%`, transition: 'width 0.08s' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 9, color: '#777', width: 20 }}>ATK</span>
        <div style={{ background: '#333', borderRadius: 2, height: 4, flex: 1 }}>
          <div style={{ background: '#f90', borderRadius: 2, height: '100%', width: `${gPct}%` }} />
        </div>
      </div>
      {unit.alive && (
        <div style={{ fontSize: 9, color: '#999' }}>
          {(['attack', 'defense', 'attackSpeed'] as const).map(k => {
            const b = unit[k], e = eff[k === 'attackSpeed' ? 'attackSpeed' : k]; const d = diff(b, e)
            return (
              <span key={k} style={{ marginRight: 6 }}>
                {k === 'attack' ? 'ATK' : k === 'defense' ? 'DEF' : 'SPD'}{' '}
                <b style={{ color: '#fff' }}>{e}</b>
                <span style={{ color: d.startsWith(' ▲') ? '#4f4' : d.startsWith(' ▼') ? '#f64' : '' }}>{d}</span>
              </span>
            )
          })}
        </div>
      )}
      {unit.alive && unit.armorDef && Object.keys(unit.armorDef).length > 0 && (
        <div style={{ fontSize: 9, color: '#7cf', marginTop: 1 }}>
          🛡️ {Object.entries(unit.armorDef).map(([a, v]) =>
            `${ATTRIBUTES[a as keyof typeof ATTRIBUTES].icon}+${v}`).join(' ')}
        </div>
      )}
      {unit.alive && marks.length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
          {marks.map(m => (
            <span key={m.name} title={m.name} style={{
              fontSize: 9, padding: '0 4px', borderRadius: 3,
              background: m.active ? '#243' : '#222',
              color: m.active ? '#6f6' : '#666',
              border: `1px solid ${m.active ? '#4a4' : '#333'}`,
              opacity: m.active ? 1 : 0.6,
            }}>{m.icon}{m.name}</span>
          ))}
        </div>
      )}
      {/* 技（α6）: オンオフ切替 + 固有ゲージ */}
      {unit.alive && unit.techniques && unit.techniques.length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
          {unit.techniques.map(t => {
            const gPct = Math.min(100, Math.round((t.gauge / t.gaugeMax) * 100))
            const clickable = !!onToggleTech
            return (
              <span
                key={t.id}
                title={techTip(t)}
                onClick={clickable ? (e) => { e.stopPropagation(); onToggleTech!(unit.id, t.id, !t.enabled) } : undefined}
                style={{
                  fontSize: 9, padding: '0 4px', borderRadius: 3, position: 'relative', overflow: 'hidden',
                  background: t.enabled ? '#332' : '#222',
                  color: t.enabled ? '#fd6' : '#666',
                  border: `1px solid ${t.enabled ? '#a83' : '#333'}`,
                  cursor: clickable ? 'pointer' : 'default', opacity: t.enabled ? 1 : 0.55,
                }}
              >
                <span style={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: `${gPct}%`, background: t.enabled ? '#fd6' : '#555' }} />
                {t.enabled ? '🎯' : '⭘'}{t.icon}{t.name}
              </span>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}

const FORMATIONS: FormationType[] = ['none', 'horizontal', 'column', 'square', 'arrowhead', 'circle', 'solo']

function SquadCard({ squad, units, color, selected, onSelect, onFormation, isReplay, tick, onToggleTech }: {
  squad: SquadState; units: WorldState['units']; color: string
  selected: boolean; onSelect: () => void; onFormation: (f: FormationType) => void; isReplay: boolean; tick: number
  onToggleTech?: (unitId: string, techId: string, enabled: boolean) => void
}) {
  const terrain = DEMO_TERRAIN
    [Math.min(5, Math.max(0, Math.floor(squad.pos.y / 10)))]
    [Math.min(9, Math.max(0, Math.floor(squad.pos.x / 10)))]
  const aliveUnits = squad.unitIds.map(id => units[id]).filter(u => u?.alive)
  const aliveN = aliveUnits.length
  const allDead = aliveN === 0
  const effForm = getEffectiveFormation(squad.formation, aliveN)
  const fellDown = effForm !== squad.formation
  return (
    <div onClick={!allDead ? onSelect : undefined} style={{
      background: selected ? '#0a0a28' : '#0d0d1a',
      border: `1px solid ${allDead ? '#444' : selected ? color : color + '44'}`,
      borderRadius: 8, padding: 10, marginBottom: 6,
      cursor: allDead || isReplay ? 'default' : 'pointer',
      opacity: allDead ? 0.55 : 1,
    }}>
      {allDead && (
        <div style={{
          textAlign: 'center', padding: '2px 0 6px', fontSize: 12,
          color: '#888', letterSpacing: 2,
        }}>💀 全滅 — 駒を消去</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontWeight: 'bold', color, fontSize: 12 }}>
          {squad.name} {selected && !isReplay && <span style={{ fontSize: 9, color: '#fff' }}>◀ 選択中</span>}
        </span>
        <span style={{ fontSize: 9, color: '#777' }}>
          ({squad.pos.x.toFixed(0)},{squad.pos.y.toFixed(0)}) {TERRAIN_LABEL[terrain]}
          {squad.moveQueue.length > 0 ? ' ▶移動' : ' ■待機'}
        </span>
      </div>
      {!isReplay && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
          {FORMATIONS.map(f => (
            <button key={f} onClick={e => { e.stopPropagation(); onFormation(f) }} style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 3, border: 'none',
              background: squad.formation === f ? color : '#2a2a3a',
              color: squad.formation === f ? '#000' : '#999', cursor: 'pointer',
            }}>{FORMATION_LABEL[f]}</button>
          ))}
        </div>
      )}
      {/* 実効陣形（フォールダウン時は警告表示） */}
      <div style={{ fontSize: 9, color: fellDown ? '#fa0' : '#666', marginBottom: 4 }}>
        {fellDown && (
          <span style={{ color: '#fa0', fontWeight: 'bold' }}>
            ⚠ {FORMATION_LABEL[squad.formation]}→{FORMATION_LABEL[effForm]}（{aliveN}名）{' '}
          </span>
        )}
        {FORMATION_DESC[effForm]}
      </div>
      {/* 必殺技ゲージ（α5） */}
      {!allDead && squad.ult && (() => {
        const gPct = Math.min(100, Math.round(((squad.ultGauge ?? 0) / squad.ult.gaugeMax) * 100))
        const ready = (squad.ultGauge ?? 0) >= squad.ult.gaugeMax
        return (
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 9, color: ready ? '#fd0' : '#888', marginBottom: 1 }}>
              {squad.ult.icon} {squad.ult.name} {ready && <b style={{ color: '#fd0' }}>★READY</b>}
            </div>
            <div style={{ background: '#222', borderRadius: 2, height: 4 }}>
              <div style={{ background: ready ? '#fd0' : '#a8f', borderRadius: 2, height: '100%', width: `${gPct}%`, transition: 'width 0.1s' }} />
            </div>
          </div>
        )
      })()}
      {squad.unitIds.map(id => units[id] ? <UnitCard key={id} unit={units[id]} squad={squad} color={color} squadUnits={aliveUnits} tick={tick} onToggleTech={onToggleTech} /> : null)}
    </div>
  )
}

function ArmyPanel({ title, side, squads, units, color, selected, onSelect, onFormation, isReplay, tick, onToggleTech }: {
  title: string; side: 'ally' | 'enemy'; squads: SquadState[]; units: WorldState['units']; color: string
  selected: string | null; onSelect: (id: string) => void; onFormation: (sqId: string, f: FormationType) => void; isReplay: boolean; tick: number
  onToggleTech?: (unitId: string, techId: string, enabled: boolean) => void
}) {
  const alive = squads.filter(s => s.side === side).flatMap(s => s.unitIds).filter(id => units[id]?.alive).length
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 'bold', color, fontSize: 13, marginBottom: 6 }}>
        {title} <span style={{ fontSize: 10, color: '#888' }}>({squads.filter(s=>s.side===side).length}隊 / {alive}名)</span>
      </div>
      {squads.filter(s => s.side === side).map(s => (
        <SquadCard key={s.id} squad={s} units={units} color={color}
          selected={selected === s.id} onSelect={() => onSelect(s.id)}
          onFormation={f => onFormation(s.id, f)} isReplay={isReplay} tick={tick} onToggleTech={onToggleTech} />
      ))}
    </div>
  )
}

const btn = (d = false, accent = false): React.CSSProperties => ({
  padding: '5px 11px', borderRadius: 6, border: 'none',
  cursor: d ? 'default' : 'pointer',
  background: d ? '#333' : accent ? '#554400' : '#2a2a4a',
  color: d ? '#666' : accent ? '#ffcc00' : '#ddf', fontSize: 12,
})

export interface BattleScreenProps {
  battleDef: BattleDef
  initialWorld: WorldState
  onBattleEnd: (world: WorldState) => void
  ultItems?: Record<string, number>          // α12: 必殺技アイテム所持（defId→個数）
  onUseUltItem?: (defId: string) => void      // 消費を GameState 側へ永続化
}

export function BattleScreen({ battleDef, initialWorld, onBattleEnd, ultItems, onUseUltItem }: BattleScreenProps) {
  const SEED = 42
  const { theme } = useTheme()
  const [world,    setWorld]    = useState<WorldState>(initialWorld)
  // 必殺技アイテムの残数（戦闘ローカル。発動でローカル減算＋onUseUltItemで永続化）
  const [ultItemCounts, setUltItemCounts] = useState<Record<string, number>>(() => ({ ...(ultItems ?? {}) }))
  const settings0 = loadSettings()
  const reduceMotion = settings0.reduceMotion
  const [running,  setRunning]  = useState(false)
  const [speed,    setSpeed]    = useState<number>(settings0.battleSpeed)
  const [multiMove, setMultiMove] = useState(false)   // α19: スマホ向け 複数移動（タップで追加）
  const [tutorial, setTutorial]   = useState(!settings0.tutorialSeen)
  const [selected, setSelected] = useState<string | null>(null)
  const [mode,     setMode]     = useState<'deploy' | 'live' | 'replaying' | 'replay-done'>('deploy')
  const [matchMsg, setMatchMsg] = useState('')
  const [damageFloats, setDamageFloats] = useState<DmgFloat[]>([])
  const [effects, setEffects] = useState<FxEffect[]>([])   // α18: 必殺技/技エフェクト
  const [tracers, setTracers] = useState<AttackTracer[]>([])  // 攻撃トレーサー
  const [pixiReady, setPixiReady] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const pixiRef      = useRef<PixiBattlefield | null>(null)
  const rngRef       = useRef(mulberry32(SEED))
  const replayRngRef = useRef(mulberry32(SEED))
  const replayTickRef= useRef(0)
  const cmdsRef      = useRef<Command[]>([])
  const replayRef    = useRef<ReplayData | null>(null)
  const liveResultRef= useRef<WorldState | null>(null)
  const prevWorldRef = useRef<WorldState>(initialWorld)
  const battleInitRef= useRef<WorldState>(initialWorld) // 配置確定後の開戦時の初期状態（リプレイ基準）
  // α18: tick間補間（60fps）用。ステップ直前のWorldとその時刻を保持し RAF で線形補間
  const interpPrevRef = useRef<WorldState | null>(null)
  const lastStepRef   = useRef<number>(0)
  const renderStateRef = useRef({ world, selected: null as string | null, mode: 'deploy' as typeof mode, damageFloats, speed, effects, tracers })
  renderStateRef.current = { world, selected, mode, damageFloats, speed, effects, tracers }
  // 必殺技/技エフェクトを発生（ゲーム座標）
  const spawnFx = (x: number, y: number, color: string, radius = 18) =>
    setEffects(prev => [...prev.filter(f => f.age < 16), { id: `${x},${y},${performance.now()}`, x, y, age: 0, color, radius }])

  // PixiJS アプリの初期化（マウント時に一度）
  useEffect(() => {
    let disposed = false
    PixiBattlefield.create().then(pb => {
      if (disposed) { pb.destroy(); return }
      pb.canvas.style.width = '100%'
      pb.canvas.style.display = 'block'
      pb.canvas.style.borderRadius = '8px'
      containerRef.current?.appendChild(pb.canvas)
      pixiRef.current = pb
      setPixiReady(true)
    })
    return () => { disposed = true; pixiRef.current?.destroy(); pixiRef.current = null }
  }, [])

  // テーマ画像の読み込み（テーマ変更・初期化時）。RAF が毎フレーム参照するので完了で自動反映
  useEffect(() => {
    if (!pixiReady || !pixiRef.current) return
    pixiRef.current.setTheme(theme)
  }, [pixiReady, theme])

  // α18: RAF ループで 60fps 描画＋tick間補間。状態は ref 経由で参照
  useEffect(() => {
    if (!pixiReady) return
    let raf = 0
    const loop = () => {
      const pb = pixiRef.current
      if (pb) {
        const { world, selected, mode, damageFloats, speed, effects, tracers } = renderStateRef.current
        const animating = (mode === 'live' || mode === 'replaying') && !reduceMotion
        const dur = 50 / Math.max(1, speed)   // 1ステップの実時間(ms)
        const alpha = animating && interpPrevRef.current
          ? Math.min(1, (performance.now() - lastStepRef.current) / dur)
          : 1
        pb.render({
          world,
          prevWorld: animating ? (interpPrevRef.current ?? undefined) : undefined,
          alpha,
          selectedId: (mode === 'live' || mode === 'deploy') ? selected : null,
          isReplay: mode === 'replaying',
          isDeploy: mode === 'deploy',
          damageFloats,
          effects,
          tracers,
        })
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [pixiReady])

  // ダメージフロート検出・更新
  useEffect(() => {
    if (mode !== 'live') return

    const view = buildUnitView(world)
    const newFloats: DmgFloat[] = []
    const damagedIds = new Set<string>()

    // 前フレームとの HP 差分を検出
    for (const id of Object.keys(world.units)) {
      const prevUnit = prevWorldRef.current.units[id]
      const currUnit = world.units[id]
      if (prevUnit && currUnit) {
        const dmg = prevUnit.hp - currUnit.hp
        if (dmg > 0) {
          const pos = view.get(id)?.pos
          if (pos) {
            newFloats.push({ id: id + world.tick, x: pos.x, y: pos.y, dmg, age: 0, side: currUnit.side })
            damagedIds.add(id)
          }
        }
      }
    }

    // 既存フロートの年齢をインクリメント
    const aged = damageFloats.map(f => ({ ...f, age: f.age + 1 })).filter(f => f.age < 25)
    setDamageFloats([...aged, ...newFloats])
    setEffects(prev => prev.map(e => ({ ...e, age: e.age + 1 })).filter(e => e.age < 16))  // α18: エフェクト加齢
    // 攻撃トレーサー: このtickの攻撃をスポーン＋加齢（誰→誰を可視化）
    const newTracers = (world.attacks ?? []).map((at, i) => ({
      id: `${at.from}-${at.to}-${world.tick}-${i}`, fromId: at.from, toId: at.to, attr: at.attr, ranged: at.ranged, age: 0,
    }))
    setTracers(prev => [...prev.map(t => ({ ...t, age: t.age + 1 })).filter(t => t.age < 9), ...newTracers])

    prevWorldRef.current = world
  }, [world, mode, damageFloats])

  useEffect(() => {
    if (world.finished && mode === 'live' && !replayRef.current) {
      liveResultRef.current = world
      replayRef.current = { seed: SEED, commands: [...cmdsRef.current], tickCount: world.tick }
      onBattleEnd(world)
    }
  }, [world.finished, mode, onBattleEnd])

  const reset = useCallback(() => {
    rngRef.current = mulberry32(SEED)
    cmdsRef.current = []
    replayRef.current = null
    liveResultRef.current = null
    setWorld(battleInitRef.current) // 配置確定後の開戦状態に戻す
    setRunning(false)
    setSelected(null)
    setMode('live')
    setMatchMsg('')
  }, [])

  // 配置確定 → 開戦（この時点の world をリプレイ基準に固定）
  const startBattle = useCallback(() => {
    battleInitRef.current = world
    prevWorldRef.current = world
    rngRef.current = mulberry32(SEED)
    cmdsRef.current = []        // 配置フェーズの操作は記録しない（初期状態に内包）
    setSelected(null)
    setMode('live')
    setRunning(true)
  }, [world])

  const changeFormation = (squadId: string, f: FormationType) => {
    setWorld(prev => {
      const cmd: Command = { tick: prev.tick, type: 'formation', squadId, formation: f }
      const idx = cmdsRef.current.length - 1
      if (idx >= 0 && cmdsRef.current[idx].type === 'formation') {
        cmdsRef.current[idx] = cmd
      }
      return applyCommand(prev, cmd)
    })
  }

  // 技のオンオフ切替（コマンド化＝リプレイ可）
  const toggleTech = (unitId: string, techId: string, enabled: boolean) => {
    setWorld(prev => {
      const cmd: Command = { tick: prev.tick, type: 'technique', unitId, techId, enabled }
      cmdsRef.current.push(cmd)
      return applyCommand(prev, cmd)
    })
  }

  useEffect(() => {
    if (!running || mode !== 'live') return
    const id = setInterval(() => {
      setWorld(prev => {
        if (prev.finished) { setRunning(false); return prev }
        interpPrevRef.current = prev; lastStepRef.current = performance.now()  // α18: 補間基点
        let w = prev
        for (let i = 0; i < speed; i++) {
          if (w.finished) break
          w = tickMovement(w)
          w = tickCombat(w, rngRef.current)
        }
        return w
      })
    }, 50)
    return () => clearInterval(id)
  }, [running, speed, mode])

  useEffect(() => {
    if (mode !== 'replaying') return
    const replay = replayRef.current
    if (!replay) return

    const id = setInterval(() => {
      const t = replayTickRef.current
      if (t >= replay.tickCount) {
        setMode('replay-done')
        return
      }
      setWorld(prev => {
        interpPrevRef.current = prev; lastStepRef.current = performance.now()  // α18: 補間基点
        const cmds = replay.commands.filter((c: Command) => c.tick === t)
        let w = prev
        for (const cmd of cmds) w = applyCommand(w, cmd)
        w = tickMovement(w)
        w = tickCombat(w, replayRngRef.current)

        if (replayTickRef.current + 1 >= replay.tickCount || w.finished) {
          const orig = liveResultRef.current
          if (orig) {
            const same = w.tick === orig.tick && w.winner === orig.winner &&
              Object.keys(w.units).every(id => w.units[id]?.hp === orig.units[id]?.hp)
            setMatchMsg(same
              ? `✅ ${w.tick}tick・全ユニットHPが完全一致 — 決定論の確認`
              : `❌ 不一致: ${w.tick}tick vs ${orig.tick}tick`)
          }
          setTimeout(() => setMode('replay-done'), 0)
        }
        return w
      })
      replayTickRef.current++
    }, 50 / speed)
    return () => clearInterval(id)
  }, [mode, speed])

  const startReplay = () => {
    if (!replayRef.current) return
    replayRngRef.current = mulberry32(SEED)
    replayTickRef.current = 0
    setWorld(battleInitRef.current)
    setRunning(false)
    setSelected(null)
    setMatchMsg('')
    setMode('replaying')
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== 'live' && mode !== 'deploy') return
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const clickGx: Vec2 = {
      x: (e.clientX - rect.left) * (CW / rect.width)  / SCALE,
      y: (e.clientY - rect.top)  * (CH / rect.height) / SCALE,
    }

    const CLICK_R = UNIT_R / SCALE + 1.5
    const clickView = buildUnitView(world)
    let clickedSquad: SquadState | undefined
    outer: for (const squad of world.squads) {
      const aliveIds = squad.unitIds.filter(id => world.units[id]?.alive)
      for (const id of aliveIds) {
        const uv = clickView.get(id)
        if (uv && dist(uv.pos, clickGx) <= CLICK_R) { clickedSquad = squad; break outer }
      }
      if (dist(squad.pos, clickGx) <= SQUAD_R / SCALE) { clickedSquad = squad; break }
    }

    // 配置フェーズ: 選択中の味方隊を配置ゾーン内に再配置（移動コマンドではない）
    if (mode === 'deploy') {
      if (clickedSquad) { setSelected(prev => prev === clickedSquad!.id ? null : clickedSquad!.id); return }
      if (selected) {
        const sq = world.squads.find(s => s.id === selected)
        if (sq && sq.side === 'ally') {
          const pos = { x: Math.min(DEPLOY_MAX_X, Math.max(8, clickGx.x)), y: Math.min(52, Math.max(8, clickGx.y)) }
          setWorld(prev => ({ ...prev, squads: prev.squads.map(s => s.id === selected ? { ...s, pos } : s) }))
        }
      }
      return
    }

    if (clickedSquad) { setSelected(prev => prev === clickedSquad!.id ? null : clickedSquad!.id); return }

    if (selected) {
      setWorld(prev => {
        const waypoints = e.ctrlKey || e.metaKey || multiMove
          ? [...prev.squads.find(s => s.id === selected)!.moveQueue, clickGx]
          : [clickGx]
        const cmd: Command = { tick: prev.tick, type: 'moveSet', squadId: selected, waypoints }
        cmdsRef.current.push(cmd)
        return applyCommand(prev, cmd)
      })
    }
  }

  const allySquads  = world.squads.filter(s => s.side === 'ally')
  const enemySquads = world.squads.filter(s => s.side === 'enemy')
  const isReplay    = mode === 'replaying'
  const hasReplay   = replayRef.current !== null
  const cmdCount    = cmdsRef.current.length

  const hudView = buildUnitView(world)
  const facingInfos: { atk: string; def: string; zone: ReturnType<typeof calcFacingZone>; side: string }[] = []
  for (const sq of world.squads) {
    for (const id of sq.unitIds) {
      const av = hudView.get(id); if (!av) continue
      for (const o of world.squads) {
        if (o.side === sq.side) continue
        for (const tid of o.unitIds) {
          const tv = hudView.get(tid); if (!tv) continue
          if (dist(av.pos, tv.pos) <= (world.units[id].range)) {
            facingInfos.push({
              atk: world.units[id].name, def: world.units[tid].name,
              zone: calcFacingZone(av.pos, tv.pos, tv.facing), side: sq.side,
            })
          }
        }
      }
    }
  }
  const facingHud = facingInfos.slice(0, 2)

  return (
    <div style={{
      maxWidth: 720, margin: '0 auto', padding: '12px', minHeight: '100vh',
      // α15: 戦場背景をテーマ画像で（暗いオーバーレイで可読性を確保・未設置は暗背景にフォールバック）
      backgroundImage: `linear-gradient(rgba(10,10,20,0.84), rgba(10,10,20,0.93)), url(${bgUrl(theme)})`,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed',
    }}>
      <h1 style={{ fontSize: 17, marginBottom: 2 }}>
        Formation Breaker
        <span style={{ fontSize: 10, color: '#888', marginLeft: 8 }}>Proto#2 - {battleDef.name}</span>
      </h1>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
        Tick:{world.tick} | {(world.tick/20).toFixed(1)}s
        {' | '}<span style={{ color: '#fa0' }}>⏺ REC: {cmdCount}コマンド記録済</span>
        {facingHud.map((fi, i) => (
          <span key={i} style={{ marginLeft: 8, color: fi.side === 'ally' ? '#7af' : '#f74' }}>
            {fi.atk}→{fi.def}:{ZONE_LABEL[fi.zone]}
          </span>
        ))}
      </div>

      {/* 操作ボタン行: 隊選択でボタン数が変わってもフィールドがズレないよう最小高さを固定 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, minHeight: 64, alignContent: 'flex-start' }}>
        {mode === 'deploy' && (
          <button style={btn(false, true)} onClick={startBattle}>⚔️ 開戦</button>
        )}
        {mode === 'live' && (
          <button style={btn(world.finished)} onClick={() => setRunning(r => !r)} disabled={world.finished}>
            {running ? '⏸ 停止' : '▶ 開始'}
          </button>
        )}
        {isReplay && (
          <span style={{ padding: '5px 11px', background: '#554400', color: '#ffcc00', borderRadius: 6, fontSize: 12 }}>
            ⏪ REPLAY 再生中...
          </span>
        )}
        <button style={btn(isReplay)} onClick={reset} disabled={isReplay}>↩ リセット</button>
        <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
          style={{ background: '#2a2a4a', color: '#ddf', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
          {[1, 2, 4, 8].map(s => <option key={s} value={s}>{s}x</option>)}
        </select>
        {hasReplay && !isReplay && (
          <button style={btn(false, true)} onClick={startReplay}>⏪ リプレイ</button>
        )}
        {selected && mode === 'live' && (
          <button style={btn()} onClick={() => {
            setWorld(prev => {
              const cmd: Command = { tick: prev.tick, type: 'moveCancel', squadId: selected }
              cmdsRef.current.push(cmd)
              return applyCommand(prev, cmd)
            })
          }}>✕ 移動キャンセル</button>
        )}
        {mode === 'live' && (
          <button style={btn(false, multiMove)} title="タップで移動先を次々に追加（スマホ向け）"
            onClick={() => setMultiMove(m => !m)}>📍 複数移動 {multiMove ? 'ON' : 'OFF'}</button>
        )}
        {(() => {
          if (!selected || mode !== 'live') return null
          const sq = world.squads.find(s => s.id === selected)
          if (!sq?.ult) return null
          const ready = (sq.ultGauge ?? 0) >= sq.ult.gaugeMax
          return (
            <button
              style={btn(!ready, true)}
              disabled={!ready}
              onClick={() => {
                const center = sq.ult?.kind === 'aoeDamage' || sq.ult?.kind === 'terrain' || sq.ult?.kind === 'elephantDisable'
                  ? (world.squads.filter(s => s.side !== sq.side && s.unitIds.some(id => world.units[id]?.alive))
                      .map(s => s.pos).sort((p, q) => (Math.hypot(p.x - sq.pos.x, p.y - sq.pos.y) - Math.hypot(q.x - sq.pos.x, q.y - sq.pos.y)))[0]) ?? sq.pos
                  : sq.pos
                spawnFx(center.x, center.y, '#ffdd55', sq.ult?.radius ? Math.max(12, sq.ult.radius) : 16)
                setWorld(prev => {
                  const cmd: Command = { tick: prev.tick, type: 'ultimate', squadId: selected }
                  cmdsRef.current.push(cmd)
                  return applyCommand(prev, cmd)
                })
              }}
            >{sq.ult.icon} {sq.ult.name}{ready ? '！' : '（充填中）'}</button>
          )
        })()}
        {/* 必殺技アイテム（消費・α12）: 選択隊が即時発動。ゲージ不要・1個消費 */}
        {selected && mode === 'live' && Object.entries(ultItemCounts).map(([defId, count]) => {
          const def = ULT_ITEMS[defId]
          if (!def || count <= 0) return null
          return (
            <button
              key={defId}
              style={btn(false, true)}
              title={def.desc}
              onClick={() => {
                const ult = resolveUltItem(defId)
                if (!ult) return
                const sq = world.squads.find(s => s.id === selected)
                const center = (ult.kind === 'aoeDamage' || ult.kind === 'terrain' || ult.kind === 'elephantDisable') && sq
                  ? (world.squads.filter(s => s.side !== sq.side && s.unitIds.some(id => world.units[id]?.alive))
                      .map(s => s.pos).sort((p, q) => (Math.hypot(p.x - sq.pos.x, p.y - sq.pos.y) - Math.hypot(q.x - sq.pos.x, q.y - sq.pos.y)))[0]) ?? sq.pos
                  : sq?.pos
                if (center) spawnFx(center.x, center.y, '#88ddff', Math.max(12, ult.radius || 16))
                setWorld(prev => {
                  const cmd: Command = { tick: prev.tick, type: 'ultItem', squadId: selected, ult }
                  cmdsRef.current.push(cmd)
                  return applyCommand(prev, cmd)
                })
                setUltItemCounts(prev => ({ ...prev, [defId]: (prev[defId] ?? 0) - 1 }))
                onUseUltItem?.(defId)
              }}
            >{def.icon} {def.name} ×{count}</button>
          )
        })}
      </div>

      {tutorial && (
        <div style={{ marginBottom: 8, padding: '8px 12px', borderRadius: 6, fontSize: 11, lineHeight: 1.7, background: '#15203a', border: '1px solid #2a4a7a', color: '#bcd' }}>
          <b style={{ color: '#8cf' }}>🎓 操作のヒント</b>　隊をタップで選択 → 盤面をタップで移動先指定（隊は堀塀を自動で迂回）。
          「📍複数移動」で経路を連続指定。ゲージが満タンの隊は必殺技ボタンで発動。
          <button onClick={() => { setTutorial(false); patchSettings({ tutorialSeen: true }) }}
            style={{ marginLeft: 8, background: '#2a4a7a', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 10 }}>了解</button>
        </div>
      )}

      {matchMsg && (
        <div style={{
          marginBottom: 8, padding: '8px 12px', borderRadius: 6, fontSize: 13,
          background: matchMsg.startsWith('✅') ? '#1a3a1a' : '#3a1a1a',
          color:      matchMsg.startsWith('✅') ? '#4f4'    : '#f66',
        }}>{matchMsg}</div>
      )}

      {world.finished && (
        <div style={{ marginBottom: 8, fontSize: 16, fontWeight: 'bold', textAlign: 'center', padding: 8,
          color: world.winner === 'ally' ? '#4af' : '#f64' }}>
          {world.winner === 'ally' ? '🏆 味方の勝利！' : '💀 敵の勝利！'}
          <span style={{ fontSize: 11, marginLeft: 8, color: '#888' }}>({world.tick}tick)</span>
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: 8 }}>
        <div ref={containerRef} onClick={handleCanvasClick}
          style={{ width: '100%', aspectRatio: `${CW} / ${CH}`, borderRadius: 8, background: '#0a0a14', cursor: isReplay ? 'default' : selected ? 'crosshair' : 'pointer' }} />
        <div style={{ position: 'absolute', top: 5, right: 8, fontSize: 9, color: '#ffffff70', textAlign: 'right', lineHeight: 1.5 }}>
          隊の向き: 🟢正面 🟡側面 🔴背面<br />兵の向き: ▲ 正面 / <span style={{ color: '#f77' }}>━ 背面（弱点）</span>
        </div>
        <div style={{ position: 'absolute', bottom: 5, right: 8, display: 'flex', gap: 6, fontSize: 9, color: '#ffffff60' }}>
          {Object.entries(TERRAIN_COLOR).map(([k, c]) => (
            <span key={k}><span style={{ background: c, padding: '1px 4px', borderRadius: 2 }}>&nbsp;</span> {TERRAIN_LABEL[k as TerrainType]}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <ArmyPanel title="🏴 味方軍" side="ally"  squads={allySquads}  units={world.units} color="#4af"
          selected={selected} onSelect={id => setSelected(s => s === id ? null : id)}
          onFormation={changeFormation} isReplay={isReplay} tick={world.tick}
          onToggleTech={(mode === 'live' || mode === 'deploy') ? toggleTech : undefined} />
        <ArmyPanel title="⚔️ 敵軍"   side="enemy" squads={enemySquads} units={world.units} color="#f64"
          selected={selected} onSelect={id => setSelected(s => s === id ? null : id)}
          onFormation={changeFormation} isReplay={isReplay} tick={world.tick} />
      </div>

      <div style={{ background: '#0d0d1a', borderRadius: 8, padding: 10 }}>
        <div style={{ fontSize: 11, color: '#888', fontWeight: 'bold', marginBottom: 5 }}>バトルログ</div>
        <div style={{ height: 110, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse' }}>
          {[...world.log].reverse().map((l, i) => (
            <div key={i} style={{ fontSize: 10, color: '#9a9', fontFamily: 'monospace', lineHeight: 1.6 }}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
