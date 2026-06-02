import { useState, useEffect, useRef, useCallback } from 'react'
import {
  mulberry32, tickCombat, tickMovement, getEffectiveStats,
  FORMATION_LABEL, FORMATION_DESC, DEMO_TERRAIN, dist,
  calcFacingZone, ZONE_LABEL, applyCommand,
  buildUnitView, SQUAD_SPREAD, getEffectiveFormation,
} from '@fb/sim-core'
import type {
  WorldState, UnitState, SquadState, FormationType,
  TerrainType, Vec2, Command, ReplayData,
} from '@fb/sim-core'
import type { BattleDef } from '../game/types'

interface DmgFloat { id: string; x: number; y: number; dmg: number; age: number; side: 'ally'|'enemy' }

const SCALE   = 6
const CW      = 600
const CH      = 360
const TILE_PX = 60
const UNIT_R  = 9
const SQUAD_R = 22

const TERRAIN_COLOR: Record<TerrainType, string> = {
  plain: '#4a7a30', forest: '#1e5010', mountain: '#7a7060', desert: '#b8922a', swamp: '#3a5a3a',
}
const TERRAIN_LABEL: Record<TerrainType, string> = {
  plain: '平地', forest: '森', mountain: '山', desert: '砂漠', swamp: '沼',
}
const gx = (x: number) => x * SCALE
const gy = (y: number) => y * SCALE

function drawBattlefield(ctx: CanvasRenderingContext2D, world: WorldState, selectedId: string | null, isReplay: boolean, damageFloats: DmgFloat[]) {
  ctx.clearRect(0, 0, CW, CH)

  DEMO_TERRAIN.forEach((row, ri) => row.forEach((terrain, ci) => {
    ctx.fillStyle = TERRAIN_COLOR[terrain]
    ctx.fillRect(ci * TILE_PX, ri * TILE_PX, TILE_PX, TILE_PX)
    ctx.strokeStyle = '#00000018'; ctx.lineWidth = 1
    ctx.strokeRect(ci * TILE_PX, ri * TILE_PX, TILE_PX, TILE_PX)
  }))

  const view = buildUnitView(world)

  for (const squad of world.squads) {
    const aliveIds = squad.unitIds.filter(id => world.units[id]?.alive)
    if (aliveIds.length === 0) continue

    const px = gx(squad.pos.x), py = gy(squad.pos.y)
    const isAlly    = squad.side === 'ally'
    const isFront   = squad.name === '前衛'
    const baseColor = isAlly ? (isFront ? '#48aaff' : '#88ccff') : (isFront ? '#ff6644' : '#ff9977')
    const isSelected = squad.id === selectedId

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

    ctx.save(); ctx.globalAlpha = isSelected ? 0.25 : 0.12
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

    ctx.save()
    ctx.strokeStyle = baseColor + (isSelected ? 'ee' : '55'); ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(px - 5, py); ctx.lineTo(px + 5, py)
    ctx.moveTo(px, py - 5); ctx.lineTo(px, py + 5); ctx.stroke()
    ctx.restore()

    aliveIds.forEach(unitId => {
      const unit   = world.units[unitId]
      const uv     = view.get(unitId)
      if (!uv) return
      const ux     = gx(uv.pos.x), uy = gy(uv.pos.y)
      const facing = uv.facing
      const hpPct  = Math.max(0, unit.hp / unit.maxHp)

      ctx.save()
      const noseLen = UNIT_R + 7, baseW = 0.55
      const nx = ux + Math.cos(facing) * noseLen
      const ny = uy + Math.sin(facing) * noseLen
      ctx.beginPath()
      ctx.moveTo(nx, ny)
      ctx.lineTo(ux + Math.cos(facing + Math.PI / 2) * UNIT_R * baseW,
                 uy + Math.sin(facing + Math.PI / 2) * UNIT_R * baseW)
      ctx.lineTo(ux + Math.cos(facing - Math.PI / 2) * UNIT_R * baseW,
                 uy + Math.sin(facing - Math.PI / 2) * UNIT_R * baseW)
      ctx.closePath()
      ctx.fillStyle = '#ffffffdd'
      ctx.fill()
      ctx.restore()

      ctx.save()
      ctx.strokeStyle = '#ff3333aa'; ctx.lineWidth = 2
      const back = facing + Math.PI
      ctx.beginPath()
      ctx.moveTo(ux + Math.cos(back) * (UNIT_R - 1) + Math.cos(back + Math.PI / 2) * UNIT_R * 0.5,
                 uy + Math.sin(back) * (UNIT_R - 1) + Math.sin(back + Math.PI / 2) * UNIT_R * 0.5)
      ctx.lineTo(ux + Math.cos(back) * (UNIT_R - 1) + Math.cos(back - Math.PI / 2) * UNIT_R * 0.5,
                 uy + Math.sin(back) * (UNIT_R - 1) + Math.sin(back - Math.PI / 2) * UNIT_R * 0.5)
      ctx.stroke()
      ctx.restore()

      if (isSelected) {
        ctx.beginPath(); ctx.arc(ux, uy, UNIT_R + 3, 0, 2 * Math.PI)
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
      }

      ctx.beginPath(); ctx.arc(ux, uy, UNIT_R, 0, 2 * Math.PI)
      ctx.fillStyle   = baseColor + Math.round(100 + hpPct * 155).toString(16).padStart(2, '0')
      ctx.strokeStyle = baseColor; ctx.lineWidth = 1.5
      ctx.fill(); ctx.stroke()

      if (unit.isLeader) {
        ctx.beginPath(); ctx.arc(ux, uy - UNIT_R - 3, 3, 0, 2 * Math.PI)
        ctx.fillStyle = '#ffdd00'; ctx.fill()
      }

      const barW = 14, barH = 2, barX = ux - barW / 2, barY = uy + UNIT_R + 3
      ctx.fillStyle = '#333'; ctx.fillRect(barX, barY, barW, barH)
      ctx.fillStyle = hpPct > 0.5 ? '#4d4' : hpPct > 0.25 ? '#fa0' : '#f44'
      ctx.fillRect(barX, barY, barW * hpPct, barH)
    })

    if (isSelected) {
      ctx.fillStyle = baseColor; ctx.font = 'bold 9px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      ctx.fillText(`${isAlly ? '味' : '敵'}${squad.name}`, px, py - 4)
    }
  }

  // ダメージフロート描画
  damageFloats.forEach(f => {
    const alpha = Math.max(0, 1 - f.age / 20)
    const yOff = f.age * 0.4
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = f.side === 'ally' ? '#ffff55' : '#ff5555'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`-${f.dmg}`, gx(f.x) + 4, gy(f.y) - yOff)
    ctx.restore()
  })

  if (isReplay) {
    ctx.fillStyle = '#ff880044'; ctx.fillRect(0, 0, CW, 22)
    ctx.fillStyle = '#ffaa00'; ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('⏪ REPLAY', CW / 2, 11)
  }
}

function UnitCard({ unit, squad, color, aliveCount }: { unit: UnitState; squad: SquadState; color: string; aliveCount: number }) {
  const eff = getEffectiveStats(unit, squad, aliveCount)
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

const FORMATIONS: FormationType[] = ['none', 'horizontal', 'column', 'square', 'arrowhead', 'circle', 'solo']

function SquadCard({ squad, units, color, selected, onSelect, onFormation, isReplay }: {
  squad: SquadState; units: WorldState['units']; color: string
  selected: boolean; onSelect: () => void; onFormation: (f: FormationType) => void; isReplay: boolean
}) {
  const terrain = DEMO_TERRAIN
    [Math.min(5, Math.max(0, Math.floor(squad.pos.y / 10)))]
    [Math.min(9, Math.max(0, Math.floor(squad.pos.x / 10)))]
  const aliveN = squad.unitIds.filter(id => units[id]?.alive).length
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
      {squad.unitIds.map(id => units[id] ? <UnitCard key={id} unit={units[id]} squad={squad} color={color} aliveCount={aliveN} /> : null)}
    </div>
  )
}

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
}

export function BattleScreen({ battleDef, initialWorld, onBattleEnd }: BattleScreenProps) {
  const SEED = 42
  const [world,    setWorld]    = useState<WorldState>(initialWorld)
  const [running,  setRunning]  = useState(false)
  const [speed,    setSpeed]    = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [mode,     setMode]     = useState<'live' | 'replaying' | 'replay-done'>('live')
  const [matchMsg, setMatchMsg] = useState('')
  const [damageFloats, setDamageFloats] = useState<DmgFloat[]>([])
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rngRef       = useRef(mulberry32(SEED))
  const replayRngRef = useRef(mulberry32(SEED))
  const replayTickRef= useRef(0)
  const cmdsRef      = useRef<Command[]>([])
  const replayRef    = useRef<ReplayData | null>(null)
  const liveResultRef= useRef<WorldState | null>(null)
  const prevWorldRef = useRef<WorldState>(initialWorld)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawBattlefield(ctx, world, mode === 'live' ? selected : null, mode === 'replaying', damageFloats)
  }, [world, selected, mode, damageFloats])

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
    setWorld(initialWorld)
    setRunning(false)
    setSelected(null)
    setMode('live')
    setMatchMsg('')
  }, [initialWorld])

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

  useEffect(() => {
    if (!running || mode !== 'live') return
    const id = setInterval(() => {
      setWorld(prev => {
        if (prev.finished) { setRunning(false); return prev }
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
    setWorld(initialWorld)
    setRunning(false)
    setSelected(null)
    setMatchMsg('')
    setMode('replaying')
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'live') return
    const rect = canvasRef.current!.getBoundingClientRect()
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
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px', minHeight: '100vh' }}>
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
        <canvas ref={canvasRef} width={CW} height={CH} onClick={handleCanvasClick}
          style={{ width: '100%', borderRadius: 8, cursor: isReplay ? 'default' : selected ? 'crosshair' : 'pointer', display: 'block' }} />
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
          onFormation={changeFormation} isReplay={isReplay} />
        <ArmyPanel title="⚔️ 敵軍"   side="enemy" squads={enemySquads} units={world.units} color="#f64"
          selected={selected} onSelect={id => setSelected(s => s === id ? null : id)}
          onFormation={changeFormation} isReplay={isReplay} />
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
