import { useState, useEffect, useRef, useCallback } from 'react'
import {
  mulberry32, tickCombat, tickMovement, getEffectiveStats,
  FORMATION_LABEL, FORMATION_DESC, DEMO_TERRAIN, dist,
  calcFacingZone, ZONE_LABEL,
} from '@fb/sim-core'
import type { WorldState, UnitState, SquadState, FormationType, TerrainType, Vec2 } from '@fb/sim-core'

// ─── 定数 ──────────────────────────────────────────────────────────────────
const SEED       = 42
const TILE_PX    = 60   // 1 tile = 10 ゲーム単位 × 6px/unit
const SCALE      = 6    // px per game unit
const CW         = 600  // canvas width  (10 tiles × 60px)
const CH         = 360  // canvas height ( 6 tiles × 60px)
const SQUAD_R    = 18   // squad circle radius (px)

// ─── 地形カラー ─────────────────────────────────────────────────────────────
const TERRAIN_COLOR: Record<TerrainType, string> = {
  plain:    '#4a7a30', forest:   '#1e5010',
  mountain: '#7a7060', desert:   '#b8922a', swamp: '#3a5a3a',
}
const TERRAIN_LABEL: Record<TerrainType, string> = {
  plain: '平地', forest: '森', mountain: '山', desert: '砂漠', swamp: '沼',
}

// ─── ゲーム座標 ↔ キャンバスpx 変換 ────────────────────────────────────────
const gx = (x: number) => x * SCALE
const gy = (y: number) => y * SCALE

// ─── 初期ワールド ────────────────────────────────────────────────────────────
function makeWorld(allyF: FormationType, enemyF: FormationType): WorldState {
  return {
    tick: 0,
    units: {
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
    },
    squads: [
      {
        id: 'ally', side: 'ally', unitIds: ['hannibal', 'carthage1'], formation: allyF,
        pos: { x: 10, y: 30 }, facing: 0, // 初期位置: 左端、右向き
        moveQueue: [{ x: 82, y: 30 }],    // 自動で右（敵方向）へ進む
        moveSpeed: 1.0, movementType: 'forest',
      },
      {
        id: 'enemy', side: 'enemy', unitIds: ['roman1', 'roman2'], formation: enemyF,
        pos: { x: 90, y: 30 }, facing: Math.PI, // 初期位置: 右端、左向き
        moveQueue: [{ x: 18, y: 30 }],           // 自動で左（敵方向）へ進む
        moveSpeed: 0.9, movementType: 'plain',
      },
    ],
    log: [], finished: false, winner: null,
  }
}

// ─── キャンバス描画 ─────────────────────────────────────────────────────────
function drawBattlefield(
  ctx: CanvasRenderingContext2D,
  world: WorldState,
  selectedId: string | null,
) {
  ctx.clearRect(0, 0, CW, CH)

  // 地形
  DEMO_TERRAIN.forEach((row, ri) =>
    row.forEach((terrain, ci) => {
      ctx.fillStyle = TERRAIN_COLOR[terrain]
      ctx.fillRect(ci * TILE_PX, ri * TILE_PX, TILE_PX, TILE_PX)
      ctx.strokeStyle = '#00000018'
      ctx.lineWidth = 1
      ctx.strokeRect(ci * TILE_PX, ri * TILE_PX, TILE_PX, TILE_PX)
    })
  )

  // 隊ごとに描画
  for (const squad of world.squads) {
    const px = gx(squad.pos.x), py = gy(squad.pos.y)
    const isAlly = squad.side === 'ally'
    const color  = isAlly ? '#48aaff' : '#ff6644'
    const isSelected = squad.id === selectedId

    // 移動予定ライン（仕様書L147: 常時薄表示）
    if (squad.moveQueue.length > 0) {
      ctx.save()
      ctx.strokeStyle = color + '88'
      ctx.lineWidth   = 1.5
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(px, py)
      squad.moveQueue.forEach(wp => ctx.lineTo(gx(wp.x), gy(wp.y)))
      ctx.stroke()
      // ウェイポイント × マーカー
      squad.moveQueue.forEach(wp => {
        const wx = gx(wp.x), wy = gy(wp.y)
        ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(wx - 5, wy - 5); ctx.lineTo(wx + 5, wy + 5); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(wx + 5, wy - 5); ctx.lineTo(wx - 5, wy + 5); ctx.stroke()
      })
      ctx.restore()
    }

    // 交戦中ライン
    for (const other of world.squads) {
      if (other.side === squad.side) continue
      const d = dist(squad.pos, other.pos)
      // 射程内（最大range=10）かチェック
      const maxRange = Math.max(...squad.unitIds.map(id => world.units[id].range))
      if (d <= maxRange + 2) {
        ctx.save()
        ctx.strokeStyle = '#ffcc0044'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 3])
        ctx.beginPath()
        ctx.moveTo(px, py)
        ctx.lineTo(gx(other.pos.x), gy(other.pos.y))
        ctx.stroke()
        ctx.restore()
      }
    }

    // 向き判定ゾーン（扇形: 正面 = 濃い, 側面/背面 = 薄）
    ctx.save()
    ctx.globalAlpha = 0.12
    const drawArc = (startAngle: number, endAngle: number, c: string) => {
      ctx.fillStyle = c
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.arc(px, py, SQUAD_R + 16, squad.facing + startAngle, squad.facing + endAngle)
      ctx.closePath()
      ctx.fill()
    }
    drawArc(-Math.PI / 3,      Math.PI / 3,      '#44ff44')  // 正面
    drawArc( Math.PI / 3,      2 * Math.PI / 3,  '#ffff44')  // 側面右
    drawArc(-2 * Math.PI / 3, -Math.PI / 3,      '#ffff44')  // 側面左
    drawArc( 2 * Math.PI / 3,  Math.PI,          '#ff4444')  // 背面
    drawArc(-Math.PI,         -2 * Math.PI / 3,  '#ff4444')  // 背面
    ctx.restore()

    // 隊の円
    ctx.save()
    ctx.beginPath()
    ctx.arc(px, py, SQUAD_R, 0, 2 * Math.PI)
    ctx.fillStyle   = isSelected ? '#ffffffcc' : color + 'cc'
    ctx.strokeStyle = isSelected ? '#fff' : color
    ctx.lineWidth   = isSelected ? 3 : 2
    ctx.fill(); ctx.stroke()
    ctx.restore()

    // 向き矢印
    ctx.save()
    const arrowLen = SQUAD_R + 12
    const ax = px + Math.cos(squad.facing) * arrowLen
    const ay = py + Math.sin(squad.facing) * arrowLen
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ax, ay); ctx.stroke()
    const hl = 7, ha = 0.45
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(ax - hl * Math.cos(squad.facing - ha), ay - hl * Math.sin(squad.facing - ha))
    ctx.lineTo(ax - hl * Math.cos(squad.facing + ha), ay - hl * Math.sin(squad.facing + ha))
    ctx.closePath(); ctx.fill()
    ctx.restore()

    // ラベル
    ctx.fillStyle = isSelected ? '#000' : '#fff'
    ctx.font = `bold 10px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(isAlly ? '味方' : '敵', px, py)
  }

  // 選択中の隊: マウスで追加するウェイポイントのヒント
  if (selectedId) {
    ctx.fillStyle = '#ffffff88'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('Click: 移動先設定  Ctrl+Click: ウェイポイント追加', 6, 4)
  }
}

// ─── ユニットカード ──────────────────────────────────────────────────────────
function UnitCard({ unit, squad, color }: { unit: UnitState; squad: SquadState; color: string }) {
  const eff = getEffectiveStats(unit, squad)
  const hpPct = Math.max(0, Math.round(unit.hp / unit.maxHp * 100))
  const gPct  = Math.min(100, Math.round(unit.gauge / unit.gaugeMax * 100))
  const diff  = (b: number, e: number) => e === b ? '' : e > b ? ` ▲${e - b}` : ` ▼${b - e}`

  return (
    <div style={{ marginBottom: 12, opacity: unit.alive ? 1 : 0.35 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>{unit.name}{unit.isLeader ? ' 👑' : ''}</span>
        <span style={{ color: '#aaa', fontSize: 11 }}>
          {unit.alive ? `${unit.hp.toLocaleString()}/${unit.maxHp.toLocaleString()}` : '離脱'}
        </span>
      </div>
      <div style={{ background: '#333', borderRadius: 3, height: 8, margin: '3px 0' }}>
        <div style={{ background: color, borderRadius: 3, height: '100%', width: `${hpPct}%`, transition: 'width 0.08s' }} />
      </div>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 9, color: '#777', width: 22 }}>ATK</span>
        <div style={{ background: '#333', borderRadius: 2, height: 4, flex: 1 }}>
          <div style={{ background: '#f90', borderRadius: 2, height: '100%', width: `${gPct}%` }} />
        </div>
      </div>
      {unit.alive && (
        <div style={{ fontSize: 10, color: '#aaa' }}>
          {(['attack', 'defense', 'attackSpeed'] as const).map(s => {
            const base = unit[s], e = eff[s === 'attackSpeed' ? 'attackSpeed' : s]
            const d = diff(base, e)
            return (
              <span key={s} style={{ marginRight: 8 }}>
                {s === 'attack' ? 'ATK' : s === 'defense' ? 'DEF' : 'SPD'}{' '}
                <b style={{ color: '#fff' }}>{eff[s === 'attackSpeed' ? 'attackSpeed' : s]}</b>
                <span style={{ color: d.startsWith(' ▲') ? '#4f4' : d.startsWith(' ▼') ? '#f64' : '#aaa' }}>{d}</span>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── 陣形セレクター ─────────────────────────────────────────────────────────
const FORMATIONS: FormationType[] = ['none', 'horizontal', 'column', 'square', 'arrowhead', 'circle', 'solo']

function FormationSelector({ value, onChange, color }: { value: FormationType; onChange: (f: FormationType) => void; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {FORMATIONS.map(f => (
          <button key={f} onClick={() => onChange(f)} style={{
            fontSize: 9, padding: '2px 6px', borderRadius: 3, border: 'none',
            background: value === f ? color : '#2a2a3a',
            color: value === f ? '#000' : '#999', cursor: 'pointer',
          }}>{FORMATION_LABEL[f]}</button>
        ))}
      </div>
      <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>{FORMATION_DESC[value]}</div>
    </div>
  )
}

// ─── 隊パネル ────────────────────────────────────────────────────────────────
function SquadPanel({
  title, squad, units, color, selected, onSelect, onFormation,
}: {
  title: string; squad: SquadState; units: WorldState['units']; color: string
  selected: boolean; onSelect: () => void; onFormation: (f: FormationType) => void
}) {
  const terrain = DEMO_TERRAIN[Math.min(5, Math.max(0, Math.floor(squad.pos.y / 10)))]
                               [Math.min(9, Math.max(0, Math.floor(squad.pos.x / 10)))]
  return (
    <div style={{ flex: 1, background: selected ? '#0a0a20' : '#0d0d1a',
      border: `1px solid ${selected ? color : color + '33'}`, borderRadius: 10, padding: 12, cursor: 'pointer' }}
      onClick={onSelect}>
      <div style={{ fontWeight: 'bold', marginBottom: 4, color, fontSize: 13 }}>
        {title} {selected && <span style={{ fontSize: 10, color: '#fff' }}>選択中</span>}
      </div>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>
        位置 ({squad.pos.x.toFixed(1)}, {squad.pos.y.toFixed(1)}) &nbsp;
        地形: {TERRAIN_LABEL[terrain]} &nbsp;
        向き: {(squad.facing * 180 / Math.PI).toFixed(0)}°
      </div>
      <FormationSelector value={squad.formation} onChange={onFormation} color={color} />
      {squad.unitIds.map(id => <UnitCard key={id} unit={units[id]} squad={squad} color={color} />)}
    </div>
  )
}

// ─── メイン ─────────────────────────────────────────────────────────────────
const btn = (d = false): React.CSSProperties => ({
  padding: '6px 12px', borderRadius: 6, border: 'none',
  cursor: d ? 'default' : 'pointer', background: d ? '#333' : '#2a2a4a',
  color: d ? '#666' : '#ddf', fontSize: 12,
})

export default function App() {
  const [allyF,    setAllyF]    = useState<FormationType>('horizontal')
  const [enemyF,   setEnemyF]   = useState<FormationType>('column')
  const [world,    setWorld]    = useState<WorldState>(() => makeWorld('horizontal', 'column'))
  const [running,  setRunning]  = useState(false)
  const [speed,    setSpeed]    = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rngRef    = useRef(mulberry32(SEED))

  // キャンバス描画
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawBattlefield(ctx, world, selected)
  }, [world, selected])

  const reset = useCallback((af = allyF, ef = enemyF) => {
    rngRef.current = mulberry32(SEED)
    setWorld(makeWorld(af, ef))
    setRunning(false)
    setSelected(null)
  }, [allyF, enemyF])

  const changeFormation = (side: 'ally' | 'enemy', f: FormationType) => {
    const [af, ef] = side === 'ally' ? [f, enemyF] : [allyF, f]
    if (side === 'ally') setAllyF(f); else setEnemyF(f)
    rngRef.current = mulberry32(SEED)
    setWorld(makeWorld(af, ef))
    setRunning(false)
  }

  // ティック
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

  // キャンバスクリック: 隊選択 or 移動指示
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const clickPx: Vec2 = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    const clickGx: Vec2 = { x: clickPx.x / SCALE, y: clickPx.y / SCALE }

    // 隊クリック判定
    const clicked = world.squads.find(s => dist(s.pos, clickGx) <= SQUAD_R / SCALE + 1)
    if (clicked) {
      setSelected(prev => prev === clicked.id ? null : clicked.id)
      return
    }

    // 移動先指示（仕様書L146: Ctrl+Click で複数ウェイポイント）
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

  const ally  = world.squads[0]
  const enemy = world.squads[1]

  // 向き判定の現状表示
  const facingInfo = (() => {
    const d = dist(ally.pos, enemy.pos)
    if (d > 20) return null
    const z1 = calcFacingZone(enemy.pos, ally.pos, ally.facing)
    const z2 = calcFacingZone(ally.pos, enemy.pos, enemy.facing)
    return { allyZone: z1, enemyZone: z2 }
  })()

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '12px', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 18, marginBottom: 2 }}>
        Formation Breaker
        <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>PoC#3 じりじり移動・向き判定・地形コスト</span>
      </h1>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
        seed: {SEED} | Tick: {world.tick} | 経過: {(world.tick / 20).toFixed(1)}s
        &nbsp;|&nbsp; 距離: {dist(ally.pos, enemy.pos).toFixed(1)}gu
        {facingInfo && (
          <>
            &nbsp;|&nbsp;
            <span style={{ color: '#7af' }}>味方 {ZONE_LABEL[facingInfo.allyZone]}から攻撃</span>
            &nbsp;/&nbsp;
            <span style={{ color: '#f74' }}>敵 {ZONE_LABEL[facingInfo.enemyZone]}から攻撃</span>
          </>
        )}
      </div>

      {/* コントロール */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <button style={btn(world.finished)} onClick={() => setRunning(r => !r)} disabled={world.finished}>
          {running ? '⏸ 停止' : '▶ 開始'}
        </button>
        <button style={btn()} onClick={() => reset()}>↩ リセット</button>
        <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
          style={{ background: '#2a2a4a', color: '#ddf', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
          {[1, 2, 4, 8].map(s => <option key={s} value={s}>{s}x</option>)}
        </select>
        {selected && (
          <button style={btn()} onClick={() => {
            setWorld(prev => ({ ...prev, squads: prev.squads.map(s => s.id === selected ? { ...s, moveQueue: [] } : s) }))
          }}>✕ 移動キャンセル</button>
        )}
        <button style={btn()} onClick={() => setSelected(null)}>選択解除</button>
      </div>

      {/* 勝敗 */}
      {world.finished && (
        <div style={{ marginBottom: 8, fontSize: 16, fontWeight: 'bold', textAlign: 'center', padding: 8,
          color: world.winner === 'ally' ? '#4af' : '#f64' }}>
          {world.winner === 'ally' ? '🏆 味方の勝利！' : '💀 敵の勝利！'}
          <span style={{ fontSize: 12, marginLeft: 8, color: '#888' }}>({world.tick}tick / {(world.tick/20).toFixed(1)}s)</span>
        </div>
      )}

      {/* キャンバス戦場 */}
      <div style={{ marginBottom: 8, position: 'relative' }}>
        <canvas ref={canvasRef} width={CW} height={CH} onClick={handleCanvasClick}
          style={{ width: '100%', borderRadius: 8, cursor: selected ? 'crosshair' : 'pointer', display: 'block' }} />
        <div style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 9, color: '#ffffff60',
          display: 'flex', gap: 8 }}>
          {Object.entries(TERRAIN_COLOR).map(([k, c]) => (
            <span key={k}><span style={{ background: c, padding: '1px 4px', borderRadius: 2 }}>&nbsp;</span>{' '}{TERRAIN_LABEL[k as TerrainType]}</span>
          ))}
        </div>
        <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 9, color: '#ffffff70' }}>
          <span style={{ marginRight: 6 }}>🟢正面</span>
          <span style={{ marginRight: 6 }}>🟡側面</span>
          <span>🔴背面</span>
        </div>
      </div>

      {/* 隊パネル */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <SquadPanel title="🏴 味方" squad={ally}  units={world.units} color="#4af"
          selected={selected === 'ally'}  onSelect={() => setSelected(s => s === 'ally'  ? null : 'ally')}
          onFormation={f => changeFormation('ally', f)} />
        <SquadPanel title="⚔️ 敵"   squad={enemy} units={world.units} color="#f64"
          selected={selected === 'enemy'} onSelect={() => setSelected(s => s === 'enemy' ? null : 'enemy')}
          onFormation={f => changeFormation('enemy', f)} />
      </div>

      {/* バトルログ */}
      <div style={{ background: '#0d0d1a', borderRadius: 8, padding: 10 }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 6, fontWeight: 'bold' }}>バトルログ</div>
        <div style={{ height: 130, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse' }}>
          {[...world.log].reverse().map((line, i) => (
            <div key={i} style={{ fontSize: 10, color: '#9a9', fontFamily: 'monospace', lineHeight: 1.6 }}>{line}</div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 10, color: '#444', textAlign: 'center' }}>
        PoC#3: 緑=正面, 黄=側面, 赤=背面 · 背面攻撃は防御-60% · Ctrl+Click でウェイポイント追加
      </div>
    </div>
  )
}
