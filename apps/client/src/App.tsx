import { useState, useEffect, useRef, useCallback } from 'react'
import {
  mulberry32, tickCombat, tickMovement, getEffectiveStats,
  FORMATION_LABEL, FORMATION_DESC, DEMO_TERRAIN, dist,
  calcFacingZone, ZONE_LABEL, applyCommand,
  getUnitPos, SQUAD_SPREAD,
} from '@fb/sim-core'
import type {
  WorldState, UnitState, SquadState, FormationType,
  TerrainType, Vec2, Command, ReplayData,
} from '@fb/sim-core'

// ─── 定数 ──────────────────────────────────────────────────────────────────
const SEED    = 42
const SCALE   = 6
const CW      = 600
const CH      = 360
const TILE_PX = 60
const UNIT_R  = 9   // 兵士アイコン半径 (px)
const SQUAD_R = 22  // 隊クリック判定半径 (px, 使われる場所のみ)

const TERRAIN_COLOR: Record<TerrainType, string> = {
  plain: '#4a7a30', forest: '#1e5010', mountain: '#7a7060', desert: '#b8922a', swamp: '#3a5a3a',
}
const TERRAIN_LABEL: Record<TerrainType, string> = {
  plain: '平地', forest: '森', mountain: '山', desert: '砂漠', swamp: '沼',
}
const gx = (x: number) => x * SCALE
const gy = (y: number) => y * SCALE

// ─── 初期ワールド ─────────────────────────────────────────────────────────
function makeWorld(): WorldState {
  return {
    tick: 0,
    units: {
      hannibal:  { id: 'hannibal',  name: 'ハンニバル',   side: 'ally',  isLeader: true,  hp: 10000, maxHp: 10000, attack: 300, defense: 85,  attackSpeed: 12, gaugeMax: 100, gauge: 0, alive: true, range: 10, flankMod: -30, rearMod: -60, skills: [{ layer: 'leaderSkill', target: 'attack',  op: 'mul', value: 10, priority: 0, source: '大将の号令' }, { layer: 'leaderSkill', target: 'defense', op: 'mul', value: 10, priority: 0, source: '大将の号令' }] },
      carthage1: { id: 'carthage1', name: 'カルタゴ兵A', side: 'ally',  isLeader: false, hp: 4000,  maxHp: 4000,  attack: 230, defense: 85,  attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true, range: 10, flankMod: -20, rearMod: -50, skills: [{ layer: 'generalSkill', target: 'defense', op: 'add', value: 10, priority: 0, source: '兵站支援' }] },
      mago:      { id: 'mago',      name: 'マゴ・バルカ', side: 'ally',  isLeader: true,  hp: 800,   maxHp: 800,   attack: 240, defense: 50,  attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true, range: 10, flankMod: -30, rearMod: -60, skills: [{ layer: 'leaderSkill', target: 'attack',  op: 'mul', value: 8,  priority: 0, source: '陣頭指揮'  }] },
      carthage2: { id: 'carthage2', name: 'カルタゴ兵B', side: 'ally',  isLeader: false, hp: 4000,  maxHp: 4000,  attack: 230, defense: 85,  attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true, range: 10, flankMod: -20, rearMod: -50, skills: [] },
      roman1:    { id: 'roman1',    name: 'ローマ兵α',   side: 'enemy', isLeader: true,  hp: 5000,  maxHp: 5000,  attack: 200, defense: 100, attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true, range: 10, flankMod: -20, rearMod: -50, skills: [{ layer: 'personalSkill', target: 'maxHp', op: 'mul', value: 15, priority: 0, source: '不屈' }] },
      roman2:    { id: 'roman2',    name: 'ローマ兵β',   side: 'enemy', isLeader: false, hp: 5000,  maxHp: 5000,  attack: 200, defense: 100, attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true, range: 10, flankMod: -20, rearMod: -50, skills: [] },
      roman3:    { id: 'roman3',    name: 'ローマ兵γ',   side: 'enemy', isLeader: true,  hp: 5000,  maxHp: 5000,  attack: 200, defense: 100, attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true, range: 10, flankMod: -20, rearMod: -50, skills: [] },
      roman4:    { id: 'roman4',    name: 'ローマ兵δ',   side: 'enemy', isLeader: false, hp: 5000,  maxHp: 5000,  attack: 200, defense: 100, attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true, range: 10, flankMod: -20, rearMod: -50, skills: [] },
    },
    squads: [
      { id: 'ally-front',  name: '前衛', side: 'ally',  unitIds: ['hannibal', 'carthage1'], formation: 'horizontal', pos: { x: 10, y: 18 }, facing: 0,         moveQueue: [{ x: 80, y: 18 }], moveSpeed: 1.0, movementType: 'forest' },
      { id: 'ally-rear',   name: '後衛', side: 'ally',  unitIds: ['mago', 'carthage2'],     formation: 'column',     pos: { x: 8,  y: 42 }, facing: 0,         moveQueue: [],                 moveSpeed: 1.1, movementType: 'forest' },
      { id: 'enemy-front', name: '前衛', side: 'enemy', unitIds: ['roman1', 'roman2'],      formation: 'square',     pos: { x: 90, y: 18 }, facing: Math.PI,   moveQueue: [{ x: 20, y: 18 }], moveSpeed: 0.9, movementType: 'plain'  },
      { id: 'enemy-rear',  name: '後衛', side: 'enemy', unitIds: ['roman3', 'roman4'],      formation: 'horizontal', pos: { x: 92, y: 42 }, facing: Math.PI,   moveQueue: [{ x: 75, y: 42 }], moveSpeed: 0.8, movementType: 'plain'  },
    ],
    log: [], finished: false, winner: null,
  }
}

// ─── キャンバス描画 ─────────────────────────────────────────────────────────
function drawBattlefield(ctx: CanvasRenderingContext2D, world: WorldState, selectedId: string | null, isReplay: boolean) {
  ctx.clearRect(0, 0, CW, CH)

  // 地形タイル
  DEMO_TERRAIN.forEach((row, ri) => row.forEach((terrain, ci) => {
    ctx.fillStyle = TERRAIN_COLOR[terrain]
    ctx.fillRect(ci * TILE_PX, ri * TILE_PX, TILE_PX, TILE_PX)
    ctx.strokeStyle = '#00000018'; ctx.lineWidth = 1
    ctx.strokeRect(ci * TILE_PX, ri * TILE_PX, TILE_PX, TILE_PX)
  }))

  for (const squad of world.squads) {
    const aliveIds = squad.unitIds.filter(id => world.units[id]?.alive)
    if (aliveIds.length === 0) continue  // 全滅隊は描画しない

    const px = gx(squad.pos.x), py = gy(squad.pos.y)
    const isAlly    = squad.side === 'ally'
    const isFront   = squad.name === '前衛'
    const baseColor = isAlly ? (isFront ? '#48aaff' : '#88ccff') : (isFront ? '#ff6644' : '#ff9977')
    const isSelected = squad.id === selectedId

    // 移動予定ライン（隊中心から、常時薄表示）
    if (squad.moveQueue.length > 0) {
      ctx.save(); ctx.strokeStyle = baseColor + '88'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4])
      ctx.beginPath(); ctx.moveTo(px, py)
      squad.moveQueue.forEach(wp => ctx.lineTo(gx(wp.x), gy(wp.y))); ctx.stroke()
      squad.moveQueue.forEach(wp => {
        const wx = gx(wp.x), wy = gy(wp.y); ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(wx - 5, wy - 5); ctx.lineTo(wx + 5, wy + 5); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(wx + 5, wy - 5); ctx.lineTo(wx - 5, wy + 5); ctx.stroke()
      }); ctx.restore()
    }

    // 向きゾーン扇形（隊中心から、薄く）
    ctx.save(); ctx.globalAlpha = 0.09
    const ZONE_R = SQUAD_SPREAD * SCALE + 24
    const arc = (a1: number, a2: number, c: string) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(px, py)
      ctx.arc(px, py, ZONE_R, squad.facing + a1, squad.facing + a2); ctx.closePath(); ctx.fill()
    }
    arc(-Math.PI / 3,       Math.PI / 3,       '#44ff44')
    arc( Math.PI / 3,       2 * Math.PI / 3,   '#ffff44')
    arc(-2 * Math.PI / 3,  -Math.PI / 3,       '#ffff44')
    arc( 2 * Math.PI / 3,   Math.PI,           '#ff4444')
    arc(-Math.PI,          -2 * Math.PI / 3,   '#ff4444')
    ctx.restore()

    // 隊中心のクロスヘア（移動指示の基点）
    ctx.save()
    ctx.strokeStyle = baseColor + (isSelected ? 'ee' : '66'); ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(px - 5, py); ctx.lineTo(px + 5, py)
    ctx.moveTo(px, py - 5); ctx.lineTo(px, py + 5); ctx.stroke()
    ctx.restore()

    // 向き矢印（隊中心から）
    const arrowEnd = SQUAD_SPREAD * SCALE + 16
    const ax = px + Math.cos(squad.facing) * arrowEnd
    const ay = py + Math.sin(squad.facing) * arrowEnd
    ctx.save()
    ctx.strokeStyle = baseColor + (isSelected ? 'cc' : '77'); ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ax, ay); ctx.stroke()
    const hl = 6, ha = 0.45; ctx.fillStyle = baseColor + (isSelected ? 'cc' : '77')
    ctx.beginPath(); ctx.moveTo(ax, ay)
    ctx.lineTo(ax - hl * Math.cos(squad.facing - ha), ay - hl * Math.sin(squad.facing - ha))
    ctx.lineTo(ax - hl * Math.cos(squad.facing + ha), ay - hl * Math.sin(squad.facing + ha))
    ctx.closePath(); ctx.fill(); ctx.restore()

    // 各生存兵士をアイコンで描画
    aliveIds.forEach((unitId, idx) => {
      const unit  = world.units[unitId]
      const upos  = getUnitPos(squad.pos, squad.facing, squad.formation, idx)
      const ux    = gx(upos.x), uy = gy(upos.y)
      const hpPct = Math.max(0, unit.hp / unit.maxHp)

      // 選択中の隊の兵士: 外枠リング
      if (isSelected) {
        ctx.beginPath(); ctx.arc(ux, uy, UNIT_R + 3, 0, 2 * Math.PI)
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
      }

      // 兵士アイコン本体
      ctx.beginPath(); ctx.arc(ux, uy, UNIT_R, 0, 2 * Math.PI)
      ctx.fillStyle   = baseColor + Math.round(100 + hpPct * 155).toString(16).padStart(2, '0')
      ctx.strokeStyle = baseColor; ctx.lineWidth = 1.5
      ctx.fill(); ctx.stroke()

      // リーダー表示（金色ドット）
      if (unit.isLeader) {
        ctx.beginPath(); ctx.arc(ux, uy - UNIT_R - 3, 3, 0, 2 * Math.PI)
        ctx.fillStyle = '#ffdd00'; ctx.fill()
      }

      // HP バー（兵士アイコン下）
      const barW = 14, barH = 2, barX = ux - barW / 2, barY = uy + UNIT_R + 2
      ctx.fillStyle = '#333'; ctx.fillRect(barX, barY, barW, barH)
      ctx.fillStyle = hpPct > 0.5 ? '#4d4' : hpPct > 0.25 ? '#fa0' : '#f44'
      ctx.fillRect(barX, barY, barW * hpPct, barH)
    })

    // 隊名ラベル（選択中のみ表示、中心付近）
    if (isSelected) {
      ctx.fillStyle = baseColor; ctx.font = 'bold 9px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      ctx.fillText(`${isAlly ? '味' : '敵'}${squad.name}`, px, py - 4)
    }
  }

  // リプレイ中オーバーレイ
  if (isReplay) {
    ctx.fillStyle = '#ff880044'; ctx.fillRect(0, 0, CW, 22)
    ctx.fillStyle = '#ffaa00'; ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('⏪ REPLAY', CW / 2, 11)
  }
}

// ─── ユニットカード ──────────────────────────────────────────────────────────
function UnitCard({ unit, squad, color }: { unit: UnitState; squad: SquadState; color: string }) {
  const eff = getEffectiveStats(unit, squad)
  const hpPct = Math.max(0, Math.round(unit.hp / unit.maxHp * 100))
  const gPct  = Math.min(100, Math.round(unit.gauge / unit.gaugeMax * 100))
  const diff  = (b: number, e: number) => e === b ? '' : e > b ? ` ▲${e - b}` : ` ▼${b - e}`
  return (
    <div style={{ marginBottom: 10, opacity: unit.alive ? 1 : 0.35 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span>{unit.name}{unit.isLeader ? ' 👑' : ''}</span>
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
    </div>
  )
}

// ─── 隊カード ────────────────────────────────────────────────────────────────
const FORMATIONS: FormationType[] = ['none', 'horizontal', 'column', 'square', 'arrowhead', 'circle', 'solo']

function SquadCard({ squad, units, color, selected, onSelect, onFormation, isReplay }: {
  squad: SquadState; units: WorldState['units']; color: string
  selected: boolean; onSelect: () => void; onFormation: (f: FormationType) => void; isReplay: boolean
}) {
  const terrain = DEMO_TERRAIN
    [Math.min(5, Math.max(0, Math.floor(squad.pos.y / 10)))]
    [Math.min(9, Math.max(0, Math.floor(squad.pos.x / 10)))]
  const allDead = !squad.unitIds.some(id => units[id]?.alive)
  return (
    <div onClick={!allDead ? onSelect : undefined} style={{
      background: selected ? '#0a0a28' : '#0d0d1a',
      border: `1px solid ${allDead ? '#444' : selected ? color : color + '44'}`,
      borderRadius: 8, padding: 10, marginBottom: 6,
      cursor: allDead || isReplay ? 'default' : 'pointer',
      opacity: allDead ? 0.55 : 1,
    }}>
      {/* 全滅バナー */}
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
      <div style={{ fontSize: 9, color: '#666', marginBottom: 4 }}>{FORMATION_DESC[squad.formation]}</div>
      {squad.unitIds.map(id => units[id] ? <UnitCard key={id} unit={units[id]} squad={squad} color={color} /> : null)}
    </div>
  )
}

// ─── 軍パネル ────────────────────────────────────────────────────────────────
function ArmyPanel({ title, side, squads, units, color, selected, onSelect, onFormation, isReplay }: {
  title: string; side: 'ally' | 'enemy'; squads: SquadState[]; units: WorldState['units']; color: string
  selected: string | null; onSelect: (id: string) => void; onFormation: (sqId: string, f: FormationType) => void; isReplay: boolean
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
          onFormation={f => onFormation(s.id, f)} isReplay={isReplay} />
      ))}
    </div>
  )
}

// ─── メイン ─────────────────────────────────────────────────────────────────
const btn = (d = false, accent = false): React.CSSProperties => ({
  padding: '5px 11px', borderRadius: 6, border: 'none',
  cursor: d ? 'default' : 'pointer',
  background: d ? '#333' : accent ? '#554400' : '#2a2a4a',
  color: d ? '#666' : accent ? '#ffcc00' : '#ddf', fontSize: 12,
})

export default function App() {
  const [world,    setWorld]    = useState<WorldState>(makeWorld)
  const [running,  setRunning]  = useState(false)
  const [speed,    setSpeed]    = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [mode,     setMode]     = useState<'live' | 'replaying' | 'replay-done'>('live')
  const [matchMsg, setMatchMsg] = useState('')
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rngRef       = useRef(mulberry32(SEED))
  const replayRngRef = useRef(mulberry32(SEED))
  const replayTickRef= useRef(0)
  const cmdsRef      = useRef<Command[]>([])       // 記録中のコマンド列
  const replayRef    = useRef<ReplayData | null>(null) // 保存済みリプレイデータ
  const liveResultRef= useRef<WorldState | null>(null) // 初回終了時の状態

  // キャンバス描画
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawBattlefield(ctx, world, mode === 'live' ? selected : null, mode === 'replaying')
  }, [world, selected, mode])

  // 戦闘終了 → リプレイデータ自動保存
  useEffect(() => {
    if (world.finished && mode === 'live' && !replayRef.current) {
      liveResultRef.current = world
      replayRef.current = { seed: SEED, commands: [...cmdsRef.current], tickCount: world.tick }
    }
  }, [world.finished, mode])

  // ─── リセット ──────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    rngRef.current = mulberry32(SEED)
    cmdsRef.current = []
    replayRef.current = null
    liveResultRef.current = null
    setWorld(makeWorld())
    setRunning(false)
    setSelected(null)
    setMode('live')
    setMatchMsg('')
  }, [])

  // ─── コマンド発行ヘルパー（live 時のみ記録） ───────────────────────────
  const issue = useCallback((cmd: Command) => {
    if (mode !== 'live') return
    cmdsRef.current.push(cmd)
    setWorld(prev => applyCommand(prev, cmd))
  }, [mode])

  // ─── 陣形変更 ───────────────────────────────────────────────────────────
  const changeFormation = (squadId: string, f: FormationType) => {
    issue({ tick: 0, type: 'formation', squadId, formation: f } as Command)
    // tick は world.tick を使いたいが closure の問題があるため
    // setWorld の中で tick を取得する方法に変更
    setWorld(prev => {
      const cmd: Command = { tick: prev.tick, type: 'formation', squadId, formation: f }
      // 既にpushした仮のものを正しいtickで上書き
      const idx = cmdsRef.current.length - 1
      if (idx >= 0 && cmdsRef.current[idx].type === 'formation') {
        cmdsRef.current[idx] = cmd
      }
      return applyCommand(prev, cmd)
    })
  }

  // ─── ライブ進行タイマー ─────────────────────────────────────────────────
  useEffect(() => {
    if (!running || mode !== 'live') return
    const id = setInterval(() => {
      setWorld(prev => {
        if (prev.finished) { setRunning(false); return prev }
        let w = prev
        for (let i = 0; i < speed; i++) {
          if (w.finished) break
          // コマンドは tickMovement/tickCombat の前に適用済みのため不要
          w = tickMovement(w)
          w = tickCombat(w, rngRef.current)
        }
        return w
      })
    }, 50)
    return () => clearInterval(id)
  }, [running, speed, mode])

  // ─── リプレイ進行タイマー ───────────────────────────────────────────────
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
        // この tick に対応するコマンドを適用
        const cmds = replay.commands.filter((c: Command) => c.tick === t)
        let w = prev
        for (const cmd of cmds) w = applyCommand(w, cmd)
        w = tickMovement(w)
        w = tickCombat(w, replayRngRef.current)

        // 最終 tick に到達 or 終了
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

  // ─── リプレイ開始 ──────────────────────────────────────────────────────
  const startReplay = () => {
    if (!replayRef.current) return
    replayRngRef.current = mulberry32(SEED)
    replayTickRef.current = 0
    setWorld(makeWorld())
    setRunning(false)
    setSelected(null)
    setMatchMsg('')
    setMode('replaying')
  }

  // ─── キャンバスクリック ─────────────────────────────────────────────────
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'live') return
    const rect = canvasRef.current!.getBoundingClientRect()
    const clickGx: Vec2 = {
      x: (e.clientX - rect.left) * (CW / rect.width)  / SCALE,
      y: (e.clientY - rect.top)  * (CH / rect.height) / SCALE,
    }

    // 兵士アイコン上をクリック → その兵士の隊を選択
    const CLICK_R = UNIT_R / SCALE + 1.5  // ゲーム単位でのクリック判定半径
    let clickedSquad: SquadState | undefined
    outer: for (const squad of world.squads) {
      const aliveIds = squad.unitIds.filter(id => world.units[id]?.alive)
      for (let i = 0; i < aliveIds.length; i++) {
        const upos = getUnitPos(squad.pos, squad.facing, squad.formation, i)
        if (dist(upos, clickGx) <= CLICK_R) { clickedSquad = squad; break outer }
      }
      // 隊中心付近もクリック可（移動キュー設定用）
      if (dist(squad.pos, clickGx) <= SQUAD_R / SCALE) { clickedSquad = squad; break }
    }
    if (clickedSquad) { setSelected(prev => prev === clickedSquad!.id ? null : clickedSquad!.id); return }

    if (selected) {
      setWorld(prev => {
        const waypoints = e.ctrlKey || e.metaKey
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
  const replayDone  = mode === 'replay-done'
  const hasReplay   = replayRef.current !== null
  const cmdCount    = cmdsRef.current.length

  const facingInfos = world.squads.flatMap(s =>
    world.squads.filter(o => o.side !== s.side && dist(s.pos, o.pos) < 20).map(o => ({
      atk: s.name, def: o.name, zone: calcFacingZone(s.pos, o.pos, o.facing), side: s.side,
    }))
  ).slice(0, 2)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px', minHeight: '100vh' }}>
      {/* ヘッダー */}
      <h1 style={{ fontSize: 17, marginBottom: 2 }}>
        Formation Breaker
        <span style={{ fontSize: 10, color: '#888', marginLeft: 8 }}>PoC#4 コマンド記録・リプレイ</span>
      </h1>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
        seed:{SEED} | Tick:{world.tick} | {(world.tick/20).toFixed(1)}s
        {' | '}<span style={{ color: '#fa0' }}>⏺ REC: {cmdCount}コマンド記録済</span>
        {facingInfos.map((fi, i) => (
          <span key={i} style={{ marginLeft: 8, color: fi.side === 'ally' ? '#7af' : '#f74' }}>
            {fi.atk}→{fi.def}:{ZONE_LABEL[fi.zone]}
          </span>
        ))}
      </div>

      {/* コントロール */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {!isReplay && (
          <button style={btn(world.finished || isReplay)} onClick={() => setRunning(r => !r)} disabled={world.finished || isReplay}>
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
      </div>

      {/* 一致確認メッセージ */}
      {matchMsg && (
        <div style={{
          marginBottom: 8, padding: '8px 12px', borderRadius: 6, fontSize: 13,
          background: matchMsg.startsWith('✅') ? '#1a3a1a' : '#3a1a1a',
          color:      matchMsg.startsWith('✅') ? '#4f4'    : '#f66',
        }}>{matchMsg}</div>
      )}

      {/* 勝敗 */}
      {world.finished && (
        <div style={{ marginBottom: 8, fontSize: 16, fontWeight: 'bold', textAlign: 'center', padding: 8,
          color: world.winner === 'ally' ? '#4af' : '#f64' }}>
          {world.winner === 'ally' ? '🏆 味方の勝利！' : '💀 敵の勝利！'}
          <span style={{ fontSize: 11, marginLeft: 8, color: '#888' }}>({world.tick}tick)</span>
          {hasReplay && !isReplay && !replayDone && (
            <span style={{ fontSize: 11, marginLeft: 12, color: '#fa0' }}>
              → ⏪ リプレイで同一結果を確認できます
            </span>
          )}
        </div>
      )}

      {/* キャンバス */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <canvas ref={canvasRef} width={CW} height={CH} onClick={handleCanvasClick}
          style={{ width: '100%', borderRadius: 8, cursor: isReplay ? 'default' : selected ? 'crosshair' : 'pointer', display: 'block' }} />
        <div style={{ position: 'absolute', top: 5, right: 8, fontSize: 9, color: '#ffffff60' }}>🟢正面 🟡側面 🔴背面</div>
        <div style={{ position: 'absolute', bottom: 5, right: 8, display: 'flex', gap: 6, fontSize: 9, color: '#ffffff60' }}>
          {Object.entries(TERRAIN_COLOR).map(([k, c]) => (
            <span key={k}><span style={{ background: c, padding: '1px 4px', borderRadius: 2 }}>&nbsp;</span> {TERRAIN_LABEL[k as TerrainType]}</span>
          ))}
        </div>
      </div>

      {/* PoC#4 説明パネル */}
      <div style={{ background: '#0a0a20', border: '1px solid #fa044', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 11, color: '#aaa' }}>
        <b style={{ color: '#fa0' }}>⏺ PoC#4: コマンド記録・リプレイ</b>
        <span style={{ color: '#777' }}>　— すべての操作を </span>
        <code style={{ color: '#7af' }}>{'{tick, type, squadId, ...}'}</code>
        <span style={{ color: '#777' }}> として自動記録。戦闘終了後「⏪ リプレイ」で同シード・同コマンドで再実行し完全一致を確認。</span>
        <br />
        <span style={{ color: '#777' }}>記録対象: 移動指示（moveSet/Cancel）・陣形変更（formation）。
          これが後日続き(L5)・ゴーストPvP(L6)・チート検証の共通基盤。</span>
        {replayRef.current && (
          <div style={{ marginTop: 4, color: '#fa0' }}>
            💾 リプレイデータ保存済: {replayRef.current.commands.length}コマンド / {replayRef.current.tickCount}tick
          </div>
        )}
      </div>

      {/* 軍パネル */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <ArmyPanel title="🏴 味方軍" side="ally"  squads={allySquads}  units={world.units} color="#4af"
          selected={selected} onSelect={id => setSelected(s => s === id ? null : id)}
          onFormation={changeFormation} isReplay={isReplay} />
        <ArmyPanel title="⚔️ 敵軍"   side="enemy" squads={enemySquads} units={world.units} color="#f64"
          selected={selected} onSelect={id => setSelected(s => s === id ? null : id)}
          onFormation={changeFormation} isReplay={isReplay} />
      </div>

      {/* バトルログ */}
      <div style={{ background: '#0d0d1a', borderRadius: 8, padding: 10 }}>
        <div style={{ fontSize: 11, color: '#888', fontWeight: 'bold', marginBottom: 5 }}>バトルログ</div>
        <div style={{ height: 110, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse' }}>
          {[...world.log].reverse().map((l, i) => (
            <div key={i} style={{ fontSize: 10, color: '#9a9', fontFamily: 'monospace', lineHeight: 1.6 }}>{l}</div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: '#444', textAlign: 'center' }}>
        隊を選択→クリックで移動指示 / Ctrl+Clickでウェイポイント追加 / 戦闘終了後「⏪ リプレイ」で決定論を確認
      </div>
    </div>
  )
}
