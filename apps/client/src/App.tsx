import { useState, useEffect, useRef, useCallback } from 'react'
import {
  mulberry32, tickCombat, tickMovement, getEffectiveStats,
  FORMATION_LABEL, FORMATION_DESC, DEMO_TERRAIN, dist,
  calcFacingZone, ZONE_LABEL,
} from '@fb/sim-core'
import type { WorldState, UnitState, SquadState, FormationType, TerrainType, Vec2 } from '@fb/sim-core'

// ─── 定数 ──────────────────────────────────────────────────────────────────
const SEED    = 42
const SCALE   = 6    // px per game unit
const CW      = 600  // canvas 幅 (10 tiles × 10gu × 6px)
const CH      = 360  // canvas 高さ ( 6 tiles × 10gu × 6px)
const TILE_PX = 60
const SQUAD_R = 18   // 隊アイコン半径 (px)

const TERRAIN_COLOR: Record<TerrainType, string> = {
  plain: '#4a7a30', forest: '#1e5010', mountain: '#7a7060', desert: '#b8922a', swamp: '#3a5a3a',
}
const TERRAIN_LABEL: Record<TerrainType, string> = {
  plain: '平地', forest: '森', mountain: '山', desert: '砂漠', swamp: '沼',
}

const gx = (x: number) => x * SCALE
const gy = (y: number) => y * SCALE

// ─── 初期ワールド（2隊×2軍 = 計4駒）──────────────────────────────────────
function makeWorld(): WorldState {
  return {
    tick: 0,
    units: {
      // ── 味方 前衛隊 ──────────────────────────────────────────────────
      hannibal: {
        id: 'hannibal', name: 'ハンニバル', side: 'ally', isLeader: true,
        hp: 10000, maxHp: 10000, attack: 300, defense: 85,
        attackSpeed: 12, gaugeMax: 100, gauge: 0, alive: true,
        range: 10, flankMod: -30, rearMod: -60,
        skills: [
          { layer: 'leaderSkill', target: 'attack',  op: 'mul', value: 10, priority: 0, source: '大将の号令' },
          { layer: 'leaderSkill', target: 'defense', op: 'mul', value: 10, priority: 0, source: '大将の号令' },
        ],
      },
      carthage1: {
        id: 'carthage1', name: 'カルタゴ兵A', side: 'ally', isLeader: false,
        hp: 4000, maxHp: 4000, attack: 230, defense: 85,
        attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true,
        range: 10, flankMod: -20, rearMod: -50,
        skills: [
          { layer: 'generalSkill', target: 'defense', op: 'add', value: 10, priority: 0, source: '兵站支援' },
        ],
      },
      // ── 味方 後衛隊 ──────────────────────────────────────────────────
      mago: {
        id: 'mago', name: 'マゴ・バルカ', side: 'ally', isLeader: true,
        hp: 800, maxHp: 800, attack: 240, defense: 50,
        attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true,
        range: 10, flankMod: -30, rearMod: -60,
        skills: [
          { layer: 'leaderSkill', target: 'attack', op: 'mul', value: 8, priority: 0, source: '陣頭指揮' },
        ],
      },
      carthage2: {
        id: 'carthage2', name: 'カルタゴ兵B', side: 'ally', isLeader: false,
        hp: 4000, maxHp: 4000, attack: 230, defense: 85,
        attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true,
        range: 10, flankMod: -20, rearMod: -50,
        skills: [],
      },
      // ── 敵 前衛隊 ─────────────────────────────────────────────────────
      roman1: {
        id: 'roman1', name: 'ローマ兵α', side: 'enemy', isLeader: true,
        hp: 5000, maxHp: 5000, attack: 200, defense: 100,
        attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true,
        range: 10, flankMod: -20, rearMod: -50,
        skills: [
          { layer: 'personalSkill', target: 'maxHp', op: 'mul', value: 15, priority: 0, source: '不屈' },
        ],
      },
      roman2: {
        id: 'roman2', name: 'ローマ兵β', side: 'enemy', isLeader: false,
        hp: 5000, maxHp: 5000, attack: 200, defense: 100,
        attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true,
        range: 10, flankMod: -20, rearMod: -50,
        skills: [],
      },
      // ── 敵 後衛隊 ─────────────────────────────────────────────────────
      roman3: {
        id: 'roman3', name: 'ローマ兵γ', side: 'enemy', isLeader: true,
        hp: 5000, maxHp: 5000, attack: 200, defense: 100,
        attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true,
        range: 10, flankMod: -20, rearMod: -50,
        skills: [],
      },
      roman4: {
        id: 'roman4', name: 'ローマ兵δ', side: 'enemy', isLeader: false,
        hp: 5000, maxHp: 5000, attack: 200, defense: 100,
        attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true,
        range: 10, flankMod: -20, rearMod: -50,
        skills: [],
      },
    },
    squads: [
      // 味方: 前衛（上）・後衛（下）
      {
        id: 'ally-front', name: '前衛', side: 'ally',
        unitIds: ['hannibal', 'carthage1'], formation: 'horizontal',
        pos: { x: 10, y: 18 }, facing: 0,
        moveQueue: [{ x: 80, y: 18 }],   // 自動で前進
        moveSpeed: 1.0, movementType: 'forest',
      },
      {
        id: 'ally-rear', name: '後衛', side: 'ally',
        unitIds: ['mago', 'carthage2'], formation: 'column',
        pos: { x: 8, y: 42 }, facing: 0,
        moveQueue: [],   // 初期は待機 → プレイヤーが指示
        moveSpeed: 1.1, movementType: 'forest',
      },
      // 敵: 前衛（上）・後衛（下）
      {
        id: 'enemy-front', name: '前衛', side: 'enemy',
        unitIds: ['roman1', 'roman2'], formation: 'square',
        pos: { x: 90, y: 18 }, facing: Math.PI,
        moveQueue: [{ x: 20, y: 18 }],  // 自動で前進
        moveSpeed: 0.9, movementType: 'plain',
      },
      {
        id: 'enemy-rear', name: '後衛', side: 'enemy',
        unitIds: ['roman3', 'roman4'], formation: 'horizontal',
        pos: { x: 92, y: 42 }, facing: Math.PI,
        moveQueue: [{ x: 75, y: 42 }],  // 後衛も前進（プレイヤーが迂回を阻止できる）
        moveSpeed: 0.8, movementType: 'plain',
      },
    ],
    log: [], finished: false, winner: null,
  }
}

// ─── キャンバス描画 ─────────────────────────────────────────────────────────
function drawBattlefield(ctx: CanvasRenderingContext2D, world: WorldState, selectedId: string | null) {
  ctx.clearRect(0, 0, CW, CH)

  // 地形タイル
  DEMO_TERRAIN.forEach((row, ri) =>
    row.forEach((terrain, ci) => {
      ctx.fillStyle = TERRAIN_COLOR[terrain]
      ctx.fillRect(ci * TILE_PX, ri * TILE_PX, TILE_PX, TILE_PX)
      ctx.strokeStyle = '#00000018'; ctx.lineWidth = 1
      ctx.strokeRect(ci * TILE_PX, ri * TILE_PX, TILE_PX, TILE_PX)
    })
  )

  for (const squad of world.squads) {
    const px = gx(squad.pos.x), py = gy(squad.pos.y)
    const isAlly = squad.side === 'ally'
    // 前衛は濃い色、後衛は少し薄い色で区別
    const isFront = squad.name === '前衛'
    const baseColor = isAlly ? (isFront ? '#48aaff' : '#88ccff') : (isFront ? '#ff6644' : '#ff9977')
    const isSelected = squad.id === selectedId

    // 移動予定ライン（常時薄表示 仕様書L147）
    if (squad.moveQueue.length > 0) {
      ctx.save()
      ctx.strokeStyle = baseColor + '99'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4])
      ctx.beginPath(); ctx.moveTo(px, py)
      squad.moveQueue.forEach(wp => ctx.lineTo(gx(wp.x), gy(wp.y)))
      ctx.stroke()
      squad.moveQueue.forEach(wp => {
        const wx = gx(wp.x), wy = gy(wp.y)
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(wx - 5, wy - 5); ctx.lineTo(wx + 5, wy + 5); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(wx + 5, wy - 5); ctx.lineTo(wx - 5, wy + 5); ctx.stroke()
      })
      ctx.restore()
    }

    // 向きゾーン扇形（正面=緑/側面=黄/背面=赤）
    ctx.save(); ctx.globalAlpha = 0.13
    const arc = (a1: number, a2: number, c: string) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(px, py)
      ctx.arc(px, py, SQUAD_R + 18, squad.facing + a1, squad.facing + a2); ctx.closePath(); ctx.fill()
    }
    arc(-Math.PI / 3,      Math.PI / 3,       '#44ff44')
    arc( Math.PI / 3,      2 * Math.PI / 3,   '#ffff44')
    arc(-2 * Math.PI / 3, -Math.PI / 3,       '#ffff44')
    arc( 2 * Math.PI / 3,  Math.PI,           '#ff4444')
    arc(-Math.PI,         -2 * Math.PI / 3,   '#ff4444')
    ctx.restore()

    // 射程内の敵とのラインを表示
    for (const other of world.squads) {
      if (other.side === squad.side) continue
      const maxRange = Math.max(...squad.unitIds.map(id => world.units[id]?.range ?? 10))
      if (dist(squad.pos, other.pos) <= maxRange + 2) {
        ctx.save(); ctx.strokeStyle = '#ffcc0044'; ctx.lineWidth = 1; ctx.setLineDash([2, 3])
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(gx(other.pos.x), gy(other.pos.y)); ctx.stroke()
        ctx.restore()
      }
    }

    // 隊アイコン（円）
    ctx.beginPath(); ctx.arc(px, py, SQUAD_R, 0, 2 * Math.PI)
    ctx.fillStyle   = isSelected ? '#ffffffcc' : baseColor + 'cc'
    ctx.strokeStyle = isSelected ? '#fff' : baseColor
    ctx.lineWidth   = isSelected ? 3 : 2
    ctx.fill(); ctx.stroke()

    // 向き矢印
    const arrowLen = SQUAD_R + 14
    const ax = px + Math.cos(squad.facing) * arrowLen
    const ay = py + Math.sin(squad.facing) * arrowLen
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ax, ay); ctx.stroke()
    const hl = 7, ha = 0.45
    ctx.fillStyle = '#fff'; ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(ax - hl * Math.cos(squad.facing - ha), ay - hl * Math.sin(squad.facing - ha))
    ctx.lineTo(ax - hl * Math.cos(squad.facing + ha), ay - hl * Math.sin(squad.facing + ha))
    ctx.closePath(); ctx.fill()

    // 隊ラベル（アイコン内）
    ctx.fillStyle = isSelected ? '#000' : '#fff'
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText((isAlly ? '味' : '敵') + squad.name[0], px, py)
  }

  if (selectedId) {
    ctx.fillStyle = '#ffffff88'; ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText('Click: 移動先  Ctrl+Click: ウェイポイント追加', 6, 4)
  }
}

// ─── ユニットカード ──────────────────────────────────────────────────────────
function UnitCard({ unit, squad, color }: { unit: UnitState; squad: SquadState; color: string }) {
  const eff   = getEffectiveStats(unit, squad)
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
            const b = unit[k], e = eff[k === 'attackSpeed' ? 'attackSpeed' : k]
            const d = diff(b, e)
            return (
              <span key={k} style={{ marginRight: 6 }}>
                {k === 'attack' ? 'ATK' : k === 'defense' ? 'DEF' : 'SPD'} <b style={{ color: '#fff' }}>{e}</b>
                <span style={{ color: d.startsWith(' ▲') ? '#4f4' : d.startsWith(' ▼') ? '#f64' : '' }}>{d}</span>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── 隊カード（1隊分のパネル）───────────────────────────────────────────────
const FORMATIONS: FormationType[] = ['none', 'horizontal', 'column', 'square', 'arrowhead', 'circle', 'solo']

function SquadCard({
  squad, units, color, selected, onSelect, onFormation,
}: {
  squad: SquadState; units: WorldState['units']; color: string
  selected: boolean; onSelect: () => void; onFormation: (f: FormationType) => void
}) {
  const terrain = DEMO_TERRAIN
    [Math.min(5, Math.max(0, Math.floor(squad.pos.y / 10)))]
    [Math.min(9, Math.max(0, Math.floor(squad.pos.x / 10)))]

  return (
    <div onClick={onSelect} style={{
      background: selected ? '#0a0a28' : '#0d0d1a',
      border: `1px solid ${selected ? color : color + '44'}`,
      borderRadius: 8, padding: 10, marginBottom: 6, cursor: 'pointer',
    }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontWeight: 'bold', color, fontSize: 12 }}>
          {squad.name} {selected && <span style={{ fontSize: 9, color: '#fff' }}>◀ 選択中</span>}
        </span>
        <span style={{ fontSize: 9, color: '#777' }}>
          ({squad.pos.x.toFixed(0)},{squad.pos.y.toFixed(0)}) {TERRAIN_LABEL[terrain]}
          {squad.moveQueue.length > 0 ? ' ▶移動中' : ' ■待機'}
        </span>
      </div>

      {/* 陣形セレクター */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
        {FORMATIONS.map(f => (
          <button key={f} onClick={e => { e.stopPropagation(); onFormation(f) }} style={{
            fontSize: 9, padding: '1px 5px', borderRadius: 3, border: 'none',
            background: squad.formation === f ? color : '#2a2a3a',
            color: squad.formation === f ? '#000' : '#999', cursor: 'pointer',
          }}>{FORMATION_LABEL[f]}</button>
        ))}
      </div>
      <div style={{ fontSize: 9, color: '#666', marginBottom: 6 }}>{FORMATION_DESC[squad.formation]}</div>

      {/* ユニットカード */}
      {squad.unitIds.map(id =>
        units[id] ? <UnitCard key={id} unit={units[id]} squad={squad} color={color} /> : null
      )}
    </div>
  )
}

// ─── 軍パネル（複数隊をまとめて表示）──────────────────────────────────────
function ArmyPanel({
  title, side, squads, units, color, selected, onSelect, onFormation,
}: {
  title: string; side: 'ally' | 'enemy'
  squads: SquadState[]; units: WorldState['units']; color: string
  selected: string | null
  onSelect: (id: string) => void
  onFormation: (squadId: string, f: FormationType) => void
}) {
  const aliveUnits = squads.flatMap(s => s.unitIds).filter(id => units[id]?.alive)
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 'bold', color, fontSize: 13, marginBottom: 6 }}>
        {title} <span style={{ fontSize: 10, color: '#888' }}>({squads.length}隊 / {aliveUnits.length}名生存)</span>
      </div>
      {squads.filter(s => s.side === side).map(s => (
        <SquadCard key={s.id} squad={s} units={units} color={color}
          selected={selected === s.id}
          onSelect={() => onSelect(s.id)}
          onFormation={f => onFormation(s.id, f)} />
      ))}
    </div>
  )
}

// ─── メイン ─────────────────────────────────────────────────────────────────
const btn = (d = false): React.CSSProperties => ({
  padding: '5px 11px', borderRadius: 6, border: 'none',
  cursor: d ? 'default' : 'pointer', background: d ? '#333' : '#2a2a4a',
  color: d ? '#666' : '#ddf', fontSize: 12,
})

export default function App() {
  const [world,    setWorld]    = useState<WorldState>(makeWorld)
  const [running,  setRunning]  = useState(false)
  const [speed,    setSpeed]    = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rngRef    = useRef(mulberry32(SEED))

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawBattlefield(ctx, world, selected)
  }, [world, selected])

  const reset = useCallback(() => {
    rngRef.current = mulberry32(SEED)
    setWorld(makeWorld())
    setRunning(false)
    setSelected(null)
  }, [])

  // 陣形変更（隊ごと）
  const changeFormation = (squadId: string, f: FormationType) => {
    setWorld(prev => ({
      ...prev,
      squads: prev.squads.map(s => s.id === squadId ? { ...s, formation: f } : s),
    }))
  }

  // ティック（移動→戦闘）
  useEffect(() => {
    if (!running) return
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
  }, [running, speed])

  // キャンバスクリック
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = CW / rect.width
    const scaleY = CH / rect.height
    const clickGx: Vec2 = {
      x: (e.clientX - rect.left) * scaleX / SCALE,
      y: (e.clientY - rect.top)  * scaleY / SCALE,
    }

    const clicked = world.squads.find(s => dist(s.pos, clickGx) <= SQUAD_R / SCALE + 1.5)
    if (clicked) { setSelected(prev => prev === clicked.id ? null : clicked.id); return }

    if (selected) {
      const append = e.ctrlKey || e.metaKey
      setWorld(prev => ({
        ...prev,
        squads: prev.squads.map(s =>
          s.id !== selected ? s
            : append
            ? { ...s, moveQueue: [...s.moveQueue, clickGx] }
            : { ...s, moveQueue: [clickGx] }
        ),
      }))
    }
  }

  const allySquads  = world.squads.filter(s => s.side === 'ally')
  const enemySquads = world.squads.filter(s => s.side === 'enemy')

  // 向き判定の概況
  const facingInfos = world.squads.flatMap(s =>
    world.squads.filter(o => o.side !== s.side && dist(s.pos, o.pos) < 20).map(o => ({
      atk: s.name, def: o.name,
      zone: calcFacingZone(s.pos, o.pos, o.facing),
      side: s.side,
    }))
  ).slice(0, 2)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px', minHeight: '100vh' }}>
      {/* ヘッダー */}
      <h1 style={{ fontSize: 17, marginBottom: 2 }}>
        Formation Breaker
        <span style={{ fontSize: 10, color: '#888', marginLeft: 8 }}>PoC#3 じりじり移動・隊単位独立移動・向き判定</span>
      </h1>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
        seed:{SEED} | Tick:{world.tick} | {(world.tick/20).toFixed(1)}s
        {facingInfos.map((fi, i) => (
          <span key={i} style={{ marginLeft: 10, color: fi.side === 'ally' ? '#7af' : '#f74' }}>
            {fi.atk}→{fi.def}: {ZONE_LABEL[fi.zone]}攻撃
          </span>
        ))}
      </div>

      {/* コントロール */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <button style={btn(world.finished)} onClick={() => setRunning(r => !r)} disabled={world.finished}>
          {running ? '⏸ 停止' : '▶ 開始'}
        </button>
        <button style={btn()} onClick={reset}>↩ リセット</button>
        <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
          style={{ background: '#2a2a4a', color: '#ddf', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
          {[1, 2, 4, 8].map(s => <option key={s} value={s}>{s}x</option>)}
        </select>
        {selected && <>
          <button style={btn()} onClick={() => {
            setWorld(prev => ({ ...prev, squads: prev.squads.map(s => s.id === selected ? { ...s, moveQueue: [] } : s) }))
          }}>✕ 移動キャンセル</button>
          <button style={btn()} onClick={() => setSelected(null)}>選択解除</button>
        </>}
      </div>

      {/* 勝敗 */}
      {world.finished && (
        <div style={{ marginBottom: 8, fontSize: 16, fontWeight: 'bold', textAlign: 'center', padding: 8,
          color: world.winner === 'ally' ? '#4af' : '#f64' }}>
          {world.winner === 'ally' ? '🏆 味方の勝利！' : '💀 敵の勝利！'}
          <span style={{ fontSize: 11, marginLeft: 8, color: '#888' }}>({world.tick}tick / {(world.tick/20).toFixed(1)}s)</span>
        </div>
      )}

      {/* キャンバス戦場 */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <canvas ref={canvasRef} width={CW} height={CH} onClick={handleCanvasClick}
          style={{ width: '100%', borderRadius: 8, cursor: selected ? 'crosshair' : 'pointer', display: 'block' }} />
        <div style={{ position: 'absolute', top: 5, right: 8, fontSize: 9, color: '#ffffff60' }}>
          🟢正面 🟡側面 🔴背面
        </div>
        <div style={{ position: 'absolute', bottom: 5, right: 8, display: 'flex', gap: 6, fontSize: 9, color: '#ffffff60' }}>
          {Object.entries(TERRAIN_COLOR).map(([k, c]) => (
            <span key={k}><span style={{ background: c, padding: '1px 4px', borderRadius: 2 }}>&nbsp;</span> {TERRAIN_LABEL[k as TerrainType]}</span>
          ))}
        </div>
      </div>

      {/* 軍パネル（左:味方 / 右:敵） */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <ArmyPanel title="🏴 味方軍" side="ally"  squads={allySquads}  units={world.units} color="#4af"
          selected={selected} onSelect={id => setSelected(s => s === id ? null : id)}
          onFormation={changeFormation} />
        <ArmyPanel title="⚔️ 敵軍"   side="enemy" squads={enemySquads} units={world.units} color="#f64"
          selected={selected} onSelect={id => setSelected(s => s === id ? null : id)}
          onFormation={changeFormation} />
      </div>

      {/* バトルログ */}
      <div style={{ background: '#0d0d1a', borderRadius: 8, padding: 10 }}>
        <div style={{ fontSize: 11, color: '#888', fontWeight: 'bold', marginBottom: 5 }}>バトルログ</div>
        <div style={{ height: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse' }}>
          {[...world.log].reverse().map((l, i) => (
            <div key={i} style={{ fontSize: 10, color: '#9a9', fontFamily: 'monospace', lineHeight: 1.6 }}>{l}</div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: '#444', textAlign: 'center' }}>
        隊を選択→クリックで移動指示 / Ctrl+Clickでウェイポイント追加 / 後衛を側面に回せ！
      </div>
    </div>
  )
}
