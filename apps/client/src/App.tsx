import { useState, useEffect, useRef, useCallback } from 'react'
import {
  mulberry32, tickCombat, getEffectiveStats,
  FORMATION_LABEL, FORMATION_DESC,
} from '@fb/sim-core'
import type { WorldState, UnitState, SquadState, FormationType } from '@fb/sim-core'

const SEED = 42

// ─── 初期ワールド生成（陣形パラメータ付き） ──────────────────────────────
function makeWorld(allyF: FormationType, enemyF: FormationType): WorldState {
  return {
    tick: 0,
    units: {
      hannibal: {
        id: 'hannibal', name: 'ハンニバル', side: 'ally', isLeader: true,
        hp: 10000, maxHp: 10000, attack: 300, defense: 85,
        attackSpeed: 12, gaugeMax: 100, gauge: 0, alive: true,
        skills: [
          // 大将の号令 [リーダースキル]: ATK+10%, DEF+10%
          { layer: 'leaderSkill', target: 'attack',  op: 'mul', value: 10, priority: 0, source: '大将の号令' },
          { layer: 'leaderSkill', target: 'defense', op: 'mul', value: 10, priority: 0, source: '大将の号令' },
        ],
      },
      carthage1: {
        id: 'carthage1', name: 'カルタゴ兵A', side: 'ally', isLeader: false,
        hp: 4000, maxHp: 4000, attack: 230, defense: 85,
        attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true,
        skills: [
          // 兵站支援 [一般スキル]: 非リーダー時のみ DEF+10
          { layer: 'generalSkill', target: 'defense', op: 'add', value: 10, priority: 0, source: '兵站支援' },
        ],
      },
      roman1: {
        id: 'roman1', name: 'ローマ兵α', side: 'enemy', isLeader: true,
        hp: 5000, maxHp: 5000, attack: 200, defense: 100,
        attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true,
        skills: [
          // 不屈 [個人スキル]: 常時 maxHp+15%
          { layer: 'personalSkill', target: 'maxHp', op: 'mul', value: 15, priority: 0, source: '不屈' },
        ],
      },
      roman2: {
        id: 'roman2', name: 'ローマ兵β', side: 'enemy', isLeader: false,
        hp: 5000, maxHp: 5000, attack: 200, defense: 100,
        attackSpeed: 10, gaugeMax: 100, gauge: 0, alive: true,
        skills: [],
      },
    },
    squads: [
      { id: 'ally',  side: 'ally',  unitIds: ['hannibal', 'carthage1'], formation: allyF  },
      { id: 'enemy', side: 'enemy', unitIds: ['roman1',   'roman2'],    formation: enemyF },
    ],
    log: [], finished: false, winner: null,
  }
}

// ─── 実効ステータスの差分表示ヘルパー ─────────────────────────────────────
function statDiff(base: number, eff: number): string {
  const d = eff - base
  if (d === 0) return ''
  return d > 0 ? ` ▲${d}` : ` ▼${Math.abs(d)}`
}

// ─── ユニットカード（実効ステータス付き） ────────────────────────────────
function UnitCard({ unit, squad, color }: { unit: UnitState; squad: SquadState; color: string }) {
  const eff    = getEffectiveStats(unit, squad)
  const hpPct  = Math.max(0, Math.round(unit.hp / unit.maxHp * 100))
  const gPct   = Math.min(100, Math.round(unit.gauge / unit.gaugeMax * 100))
  const activeSkills = unit.skills.filter(s => {
    if (s.layer === 'leaderSkill'  && !unit.isLeader) return false
    if (s.layer === 'generalSkill' &&  unit.isLeader) return false
    return true
  })

  return (
    <div style={{ marginBottom: 14, opacity: unit.alive ? 1 : 0.35 }}>
      {/* 名前 + HP */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span>{unit.name}{unit.isLeader ? ' 👑' : ''}</span>
        <span style={{ color: '#aaa', fontSize: 12 }}>
          {unit.alive ? `${unit.hp.toLocaleString()} / ${unit.maxHp.toLocaleString()}` : '離脱'}
        </span>
      </div>

      {/* HP バー */}
      <div style={{ background: '#333', borderRadius: 4, height: 10, margin: '4px 0' }}>
        <div style={{ background: color, borderRadius: 4, height: '100%', width: `${hpPct}%`, transition: 'width 0.08s' }} />
      </div>

      {/* 攻撃ゲージ */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#777', width: 24 }}>ATK</span>
        <div style={{ background: '#333', borderRadius: 3, height: 5, flex: 1 }}>
          <div style={{ background: '#f90', borderRadius: 3, height: '100%', width: `${gPct}%` }} />
        </div>
      </div>

      {/* 実効ステータス行（基礎 → 実効） */}
      {unit.alive && (
        <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.6 }}>
          <span style={{ marginRight: 8 }}>
            ATK <b style={{ color: '#fff' }}>{eff.attack}</b>
            <span style={{ color: eff.attack > unit.attack ? '#4f4' : eff.attack < unit.attack ? '#f64' : '#aaa' }}>
              {statDiff(unit.attack, eff.attack)}
            </span>
          </span>
          <span style={{ marginRight: 8 }}>
            DEF <b style={{ color: '#fff' }}>{eff.defense}</b>
            <span style={{ color: eff.defense > unit.defense ? '#4f4' : eff.defense < unit.defense ? '#f64' : '#aaa' }}>
              {statDiff(unit.defense, eff.defense)}
            </span>
          </span>
          <span>
            SPD <b style={{ color: '#fff' }}>{eff.attackSpeed}</b>
            <span style={{ color: eff.attackSpeed > unit.attackSpeed ? '#4f4' : eff.attackSpeed < unit.attackSpeed ? '#f64' : '#aaa' }}>
              {statDiff(unit.attackSpeed, eff.attackSpeed)}
            </span>
          </span>
        </div>
      )}

      {/* アクティブスキル名 */}
      {unit.alive && activeSkills.length > 0 && (
        <div style={{ fontSize: 10, color: '#7af', marginTop: 2 }}>
          ✦ {[...new Set(activeSkills.map(s => s.source))].join(' / ')}
        </div>
      )}
    </div>
  )
}

// ─── 陣形セレクター ────────────────────────────────────────────────────────
const FORMATIONS: FormationType[] = ['none', 'horizontal', 'column', 'square', 'arrowhead', 'circle', 'solo']

function FormationSelector({
  value, onChange, color,
}: { value: FormationType; onChange: (f: FormationType) => void; color: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {FORMATIONS.map(f => (
          <button key={f} onClick={() => onChange(f)} style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 4, border: 'none',
            background: value === f ? color : '#2a2a3a',
            color: value === f ? '#000' : '#aaa',
            cursor: 'pointer', fontWeight: value === f ? 'bold' : 'normal',
          }}>
            {FORMATION_LABEL[f]}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10, color: '#777', marginTop: 3 }}>{FORMATION_DESC[value]}</div>
    </div>
  )
}

// ─── 隊パネル ────────────────────────────────────────────────────────────
function SquadPanel({
  title, squad, units, color, onFormation,
}: { title: string; squad: SquadState; units: WorldState['units']; color: string; onFormation: (f: FormationType) => void }) {
  return (
    <div style={{ flex: 1, background: '#0d0d1a', border: `1px solid ${color}33`, borderRadius: 10, padding: 14 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 6, color }}>{title}</div>
      <FormationSelector value={squad.formation} onChange={onFormation} color={color} />
      {squad.unitIds.map(id => <UnitCard key={id} unit={units[id]} squad={squad} color={color} />)}
    </div>
  )
}

// ─── ボタンスタイル ──────────────────────────────────────────────────────
const btn = (disabled = false): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 6, border: 'none',
  cursor: disabled ? 'default' : 'pointer',
  background: disabled ? '#333' : '#2a2a4a',
  color: disabled ? '#666' : '#ddf', fontSize: 13,
})

// ─── メインコンポーネント ─────────────────────────────────────────────────
export default function App() {
  const [allyF,  setAllyF]  = useState<FormationType>('horizontal')
  const [enemyF, setEnemyF] = useState<FormationType>('column')
  const [world,  setWorld]  = useState<WorldState>(() => makeWorld('horizontal', 'column'))
  const [running,      setRunning]      = useState(false)
  const [speed,        setSpeed]        = useState(1)
  const [replayResult, setReplayResult] = useState('')
  const rngRef = useRef(mulberry32(SEED))

  const reset = useCallback((af = allyF, ef = enemyF) => {
    rngRef.current = mulberry32(SEED)
    setWorld(makeWorld(af, ef))
    setRunning(false)
    setReplayResult('')
  }, [allyF, enemyF])

  const changeFormation = (side: 'ally' | 'enemy', f: FormationType) => {
    const [af, ef] = side === 'ally' ? [f, enemyF] : [allyF, f]
    if (side === 'ally') setAllyF(f); else setEnemyF(f)
    // 陣形変更でバトルをリセット（PoC#4でコマンド記録に昇格予定）
    rngRef.current = mulberry32(SEED)
    setWorld(makeWorld(af, ef))
    setRunning(false)
    setReplayResult('')
  }

  const runToEnd = useCallback(() => {
    setWorld(prev => {
      let w = prev; let n = 0
      while (!w.finished && n++ < 100_000) w = tickCombat(w, rngRef.current)
      return w
    })
  }, [])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setWorld(prev => {
        if (prev.finished) { setRunning(false); return prev }
        let w = prev
        for (let i = 0; i < speed; i++) { if (w.finished) break; w = tickCombat(w, rngRef.current) }
        return w
      })
    }, 50)
    return () => clearInterval(id)
  }, [running, speed])

  const proveReplay = useCallback(() => {
    const run = () => {
      const rng = mulberry32(SEED); let w = makeWorld(allyF, enemyF); let n = 0
      while (!w.finished && n++ < 100_000) w = tickCombat(w, rng)
      return w
    }
    const w1 = run(), w2 = run()
    const same = w1.tick === w2.tick && w1.winner === w2.winner &&
      Object.keys(w1.units).every(id => w1.units[id].hp === w2.units[id].hp)
    setReplayResult(same
      ? `✅ 決定論の確認: ${w1.tick}tick で同一結果（seed ${SEED}）`
      : `❌ 再現失敗`)
  }, [allyF, enemyF])

  const allySquad  = world.squads[0]
  const enemySquad = world.squads[1]

  return (
    <div style={{ maxWidth: 740, margin: '0 auto', padding: '16px 12px', minHeight: '100vh' }}>
      {/* ヘッダー */}
      <h1 style={{ fontSize: 20, marginBottom: 2 }}>
        Formation Breaker
        <span style={{ fontSize: 12, color: '#888', marginLeft: 10 }}>PoC#2 レイヤー計算エンジン</span>
      </h1>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
        seed: {SEED} | Tick: {world.tick} | 経過: {(world.tick / 20).toFixed(1)}s
        &nbsp;|&nbsp; <span style={{ color: '#7af' }}>陣形変更でリセット（PoC#4でコマンド記録化予定）</span>
      </div>

      {/* コントロール */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button style={btn(world.finished)} onClick={() => setRunning(r => !r)} disabled={world.finished}>
          {running ? '⏸ 停止' : '▶ 開始'}
        </button>
        <button style={btn(running || world.finished)} onClick={runToEnd} disabled={running || world.finished}>⏭ 終了まで</button>
        <button style={btn()} onClick={() => reset()}>↩ リセット</button>
        <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
          style={{ background: '#2a2a4a', color: '#ddf', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
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
        }}>{replayResult}</div>
      )}

      {/* 勝敗 */}
      {world.finished && (
        <div style={{ marginBottom: 12, fontSize: 18, fontWeight: 'bold', textAlign: 'center', padding: 10,
          color: world.winner === 'ally' ? '#4af' : '#f64' }}>
          {world.winner === 'ally' ? '🏆 味方の勝利！' : '💀 敵の勝利！'}
          <span style={{ fontSize: 13, marginLeft: 10, color: '#888' }}>({world.tick}tick / {(world.tick/20).toFixed(1)}s)</span>
        </div>
      )}

      {/* 戦場 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <SquadPanel title="🏴 味方" squad={allySquad}  units={world.units} color="#4af"
          onFormation={f => changeFormation('ally', f)} />
        <SquadPanel title="⚔️ 敵"   squad={enemySquad} units={world.units} color="#f64"
          onFormation={f => changeFormation('enemy', f)} />
      </div>

      {/* バトルログ */}
      <div style={{ background: '#0d0d1a', borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8, color: '#888' }}>バトルログ</div>
        <div style={{ height: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse' }}>
          {[...world.log].reverse().map((line, i) => (
            <div key={i} style={{ fontSize: 11, color: '#9a9', fontFamily: 'monospace', lineHeight: 1.6 }}>{line}</div>
          ))}
        </div>
      </div>

      {/* レイヤー説明 */}
      <div style={{ background: '#0d0d1a', borderRadius: 10, padding: 12, fontSize: 11, color: '#666', lineHeight: 1.8 }}>
        <b style={{ color: '#888' }}>PoC#2 実装内容: レイヤー型ステータス計算</b><br />
        異なるレイヤーは加算重複 / 同一レイヤー・同一対象は最大1つ（仕様書L46-47）<br />
        [リーダースキル] 大将の号令: ATK+10%, DEF+10% （ハンニバルのみ適用）<br />
        [一般スキル] 兵站支援: DEF+10 （非リーダーのカルタゴ兵Aのみ）<br />
        [個人スキル] 不屈: maxHP+15% （ローマ兵α常時）<br />
        [陣形レイヤー] 各陣形の効果が上記スキルと加算されステータスに反映される
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: '#555', textAlign: 'center' }}>
        Formation Breaker — PoC#2 · レイヤー計算エンジン · 決定論: 20Hz固定tick + mulberry32(seed={SEED})
      </div>
    </div>
  )
}
