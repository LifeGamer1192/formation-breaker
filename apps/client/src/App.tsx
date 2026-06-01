import { useState, useEffect, useRef, useCallback } from 'react'
import { mulberry32, tickCombat } from '@fb/sim-core'
import type { WorldState, UnitState } from '@fb/sim-core'

// ─── 初期ワールド（仕様書マップ1・戦場1のデータ） ───────────────────────
const SEED = 42

function makeWorld(): WorldState {
  return {
    tick: 0,
    units: {
      hannibal: {
        id: 'hannibal', name: 'ハンニバル', side: 'ally',
        hp: 10000, maxHp: 10000, attack: 300, defense: 85,
        attackSpeed: 12, gaugeMax: 100, gauge: 0, alive: true,
      },
      carthage1: {
        id: 'carthage1', name: 'カルタゴ兵A', side: 'ally',
        hp: 4000, maxHp: 4000, attack: 230, defense: 85,
        attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true,
      },
      roman1: {
        id: 'roman1', name: 'ローマ兵α', side: 'enemy',
        hp: 5000, maxHp: 5000, attack: 200, defense: 100,
        attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true,
      },
      roman2: {
        id: 'roman2', name: 'ローマ兵β', side: 'enemy',
        hp: 5000, maxHp: 5000, attack: 200, defense: 100,
        attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true,
      },
    },
    squads: [
      { id: 'ally',  side: 'ally',  unitIds: ['hannibal', 'carthage1'] },
      { id: 'enemy', side: 'enemy', unitIds: ['roman1',   'roman2']    },
    ],
    log:      [],
    finished: false,
    winner:   null,
  }
}

// ─── ユニット表示コンポーネント ──────────────────────────────────────────
function UnitCard({ unit, color }: { unit: UnitState; color: string }) {
  const hpPct    = Math.max(0, Math.round(unit.hp / unit.maxHp * 100))
  const gaugePct = Math.min(100, Math.round(unit.gauge / unit.gaugeMax * 100))
  return (
    <div style={{ marginBottom: 14, opacity: unit.alive ? 1 : 0.35 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span>{unit.name}</span>
        <span style={{ color: '#aaa' }}>
          {unit.alive ? `${unit.hp.toLocaleString()} / ${unit.maxHp.toLocaleString()}` : '離脱'}
        </span>
      </div>
      {/* HP バー */}
      <div style={{ background: '#333', borderRadius: 4, height: 10, margin: '4px 0' }}>
        <div style={{
          background: color, borderRadius: 4, height: '100%',
          width: `${hpPct}%`, transition: 'width 0.08s',
        }} />
      </div>
      {/* 攻撃ゲージ */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: '#777', width: 24 }}>ATK</span>
        <div style={{ background: '#333', borderRadius: 3, height: 5, flex: 1 }}>
          <div style={{
            background: '#f90', borderRadius: 3, height: '100%',
            width: `${gaugePct}%`,
          }} />
        </div>
      </div>
    </div>
  )
}

// ─── 隊パネル ────────────────────────────────────────────────────────────
function SquadPanel({
  title, unitIds, units, color,
}: { title: string; unitIds: string[]; units: WorldState['units']; color: string }) {
  return (
    <div style={{
      flex: 1, background: '#0d0d1a', border: `1px solid ${color}33`,
      borderRadius: 10, padding: 14,
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: 12, color }}>{title}</div>
      {unitIds.map(id => <UnitCard key={id} unit={units[id]} color={color} />)}
    </div>
  )
}

// ─── ボタンスタイル ──────────────────────────────────────────────────────
const btn = (disabled = false): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 6, border: 'none', cursor: disabled ? 'default' : 'pointer',
  background: disabled ? '#333' : '#2a2a4a', color: disabled ? '#666' : '#ddf',
  fontSize: 13,
})

// ─── メインコンポーネント ─────────────────────────────────────────────────
export default function App() {
  const [world,        setWorld]        = useState<WorldState>(makeWorld)
  const [running,      setRunning]      = useState(false)
  const [speed,        setSpeed]        = useState(1)
  const [replayResult, setReplayResult] = useState('')
  const rngRef = useRef(mulberry32(SEED))

  // リセット
  const reset = useCallback(() => {
    rngRef.current = mulberry32(SEED)
    setWorld(makeWorld())
    setRunning(false)
    setReplayResult('')
  }, [])

  // 終了まで一気に実行
  const runToEnd = useCallback(() => {
    setWorld(prev => {
      let w = prev
      let safety = 0
      while (!w.finished && safety++ < 100_000) {
        w = tickCombat(w, rngRef.current)
      }
      return w
    })
  }, [])

  // 自動進行タイマー（50ms = 論理20Hz）
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setWorld(prev => {
        if (prev.finished) { setRunning(false); return prev }
        let w = prev
        for (let i = 0; i < speed; i++) {
          if (w.finished) break
          w = tickCombat(w, rngRef.current)
        }
        return w
      })
    }, 50)
    return () => clearInterval(id)
  }, [running, speed])

  // ──────────────────────────────────────────────────────────────────────
  // 決定論の確認：同じシードで2回走らせ、結果が一致するか検証
  // ──────────────────────────────────────────────────────────────────────
  const proveReplay = useCallback(() => {
    const run = () => {
      const rng = mulberry32(SEED)
      let w = makeWorld()
      let safety = 0
      while (!w.finished && safety++ < 100_000) w = tickCombat(w, rng)
      return w
    }
    const w1 = run()
    const w2 = run()
    const unitsSame = Object.keys(w1.units).every(id =>
      w1.units[id].hp === w2.units[id].hp && w1.units[id].alive === w2.units[id].alive
    )
    const same = w1.tick === w2.tick && w1.winner === w2.winner && unitsSame
    setReplayResult(
      same
        ? `✅ 決定論の確認: ${w1.tick} tick で完全に同一の結果（シード ${SEED}）`
        : `❌ 再現失敗: ${w1.tick} tick vs ${w2.tick} tick`
    )
  }, [])

  const gameSec   = (world.tick / 20).toFixed(1)
  const allyIds   = world.squads[0].unitIds
  const enemyIds  = world.squads[1].unitIds

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 12px', minHeight: '100vh' }}>
      {/* ヘッダー */}
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>
        Formation Breaker
        <span style={{ fontSize: 12, color: '#888', marginLeft: 10 }}>PoC#1 決定論シム</span>
      </h1>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
        seed: {SEED} &nbsp;|&nbsp; Tick: {world.tick} &nbsp;|&nbsp; 経過: {gameSec}s
      </div>

      {/* コントロール */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button style={btn(world.finished)} onClick={() => setRunning(r => !r)} disabled={world.finished}>
          {running ? '⏸ 停止' : '▶ 開始'}
        </button>
        <button style={btn(running || world.finished)} onClick={runToEnd} disabled={running || world.finished}>
          ⏭ 終了まで
        </button>
        <button style={btn()} onClick={reset}>↩ リセット</button>
        <select
          value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
          style={{ background: '#2a2a4a', color: '#ddf', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}
        >
          {[1, 2, 4, 8].map(s => <option key={s} value={s}>{s}x</option>)}
        </select>
        <button style={btn()} onClick={proveReplay}>🔁 再現確認</button>
      </div>

      {/* 再現確認結果 */}
      {replayResult && (
        <div style={{
          marginBottom: 10, fontSize: 13, padding: '6px 12px', borderRadius: 6,
          background: replayResult.startsWith('✅') ? '#1a3a1a' : '#3a1a1a',
          color:      replayResult.startsWith('✅') ? '#4f4'    : '#f66',
        }}>
          {replayResult}
        </div>
      )}

      {/* 勝敗表示 */}
      {world.finished && (
        <div style={{
          marginBottom: 12, fontSize: 18, fontWeight: 'bold', textAlign: 'center', padding: 10,
          color: world.winner === 'ally' ? '#4af' : '#f64',
        }}>
          {world.winner === 'ally' ? '🏆 味方の勝利！' : '💀 敵の勝利！'}
          <span style={{ fontSize: 13, marginLeft: 10, color: '#888' }}>({world.tick} tick / {gameSec}s)</span>
        </div>
      )}

      {/* 戦場 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <SquadPanel title="🏴 味方" unitIds={allyIds}  units={world.units} color="#4af" />
        <SquadPanel title="⚔️ 敵"   unitIds={enemyIds} units={world.units} color="#f64" />
      </div>

      {/* バトルログ */}
      <div style={{ background: '#0d0d1a', borderRadius: 10, padding: 12 }}>
        <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8, color: '#888' }}>バトルログ</div>
        <div style={{ height: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse' }}>
          {[...world.log].reverse().map((line, i) => (
            <div key={i} style={{ fontSize: 11, color: '#9a9', fontFamily: 'monospace', lineHeight: 1.6 }}>
              {line}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: '#555', textAlign: 'center' }}>
        Formation Breaker — PoC#1 &nbsp;·&nbsp; 決定論: 固定tickレート(20Hz) + シード付きPRNG(mulberry32)
      </div>
    </div>
  )
}
