import type { WorldState } from '@fb/sim-core'
import type { RosterUnit } from '../game/types'
import { applyLevelUps, awardXp } from '../game/army'

export interface ResultScreenProps {
  world: WorldState
  roster: RosterUnit[]
  onContinue: (updatedRoster: RosterUnit[]) => void
  onRetry: () => void
}

export function ResultScreen({ world, roster, onContinue, onRetry }: ResultScreenProps) {
  const won = world.winner === 'ally'
  const participantIds = world.squads.filter(s => s.side === 'ally').flatMap(s => s.unitIds)
  const killCount = Object.values(world.units)
    .filter(u => !u.alive && u.side === 'enemy').length

  // XP 付与 → レベルアップ処理
  const withXp = awardXp(roster, participantIds, killCount)
  const { roster: withLevelUp, leveledUpIds } = applyLevelUps(withXp)

  const unitXps: Record<string, number> = {}
  for (const uid of participantIds) {
    const before = roster.find(u => u.id === uid)
    const after = withXp.find(u => u.id === uid)
    unitXps[uid] = (after?.exp ?? 0) - (before?.exp ?? 0)
  }

  const btn = (accent = false): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 6, border: 'none',
    cursor: 'pointer',
    background: accent ? '#554400' : '#2a2a4a',
    color: accent ? '#ffcc00' : '#ddf', fontSize: 13, fontWeight: 'bold',
  })

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '12px', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 17, marginBottom: 12, textAlign: 'center' }}>
        {won ? '🏆 勝利！' : '💀 敗北…'}
      </h1>

      {/* 結果サマリー */}
      <div style={{ background: '#0d0d1a', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
          <div>戦闘時間: {world.tick} tick ({(world.tick / 20).toFixed(1)}秒)</div>
          <div>味方生存数: {Object.values(world.units).filter(u => u.side === 'ally' && u.alive).length}</div>
          <div>敵撃破数: {killCount}</div>
        </div>
      </div>

      {/* 兵士別 XP・レベルアップ表示 */}
      <div style={{ background: '#0d0d1a', borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 'bold', color: '#fa0', marginBottom: 8 }}>
          🎯 経験値・成長
        </div>
        {participantIds.map(uid => {
          const unit = withLevelUp.find(u => u.id === uid)
          if (!unit) return null
          const leveledUp = leveledUpIds.includes(uid)
          return (
            <div key={uid} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', fontSize: 11, borderBottom: '1px solid #333',
              color: leveledUp ? '#4f4' : '#ccc'
            }}>
              <span>
                {unit.name} {unit.isLeader && '👑'}
              </span>
              <span>
                EXP: +{unitXps[uid] ?? 0}
                {leveledUp && (
                  <span style={{ marginLeft: 8, color: '#4f4', fontWeight: 'bold' }}>
                    ↗ Lv.{unit.level}
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {/* 次へボタン */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {!won ? (
          <button style={btn()} onClick={onRetry}>↩ もう一度</button>
        ) : (
          <button style={btn(true)} onClick={() => onContinue(withLevelUp)}>
            ▶ 次へ進む
          </button>
        )}
      </div>
    </div>
  )
}
