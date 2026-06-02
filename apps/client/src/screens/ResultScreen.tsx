import type { WorldState } from '@fb/sim-core'
import type { RosterUnit } from '../game/types'
import { applyLevelUps, awardXp, calcBattleReward } from '../game/army'
import { C } from '../ui/theme'
import { Button } from '../ui/Button'

export interface ResultScreenProps {
  world: WorldState
  roster: RosterUnit[]
  reward: number
  scenario?: boolean   // α9: 局地戦（XP/トークンなし・インポートへ戻る）
  onContinue: (updatedRoster: RosterUnit[], earnedTokens: number) => void
  onRetry: () => void
}

export function ResultScreen({ world, roster, reward, scenario, onContinue, onRetry }: ResultScreenProps) {
  const won = world.winner === 'ally'
  const participantIds = world.squads.filter(s => s.side === 'ally').flatMap(s => s.unitIds)
  const killCount = Object.values(world.units)
    .filter(u => !u.alive && u.side === 'enemy').length

  // 局地戦は報酬・成長なし
  const earnedTokens = !scenario && won ? calcBattleReward(reward, killCount) : 0

  // XP 付与 → レベルアップ処理
  const withXp = awardXp(roster, participantIds, killCount, won)
  const { roster: withLevelUp, leveledUpIds } = applyLevelUps(withXp)

  const unitXps: Record<string, number> = {}
  for (const uid of participantIds) {
    const before = roster.find(u => u.id === uid)
    const after = withXp.find(u => u.id === uid)
    unitXps[uid] = (after?.exp ?? 0) - (before?.exp ?? 0)
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '12px', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 18, marginBottom: 12, textAlign: 'center', color: won ? C.gold : C.danger }}>
        {won ? '🏆 勝利！' : '💀 敗北…'}
      </h1>

      {/* 結果サマリー */}
      <div style={{ background: C.panel, borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.7 }}>
          <div>戦闘時間: {world.tick} tick ({(world.tick / 20).toFixed(1)}秒)</div>
          <div>味方生存数: {Object.values(world.units).filter(u => u.side === 'ally' && u.alive).length}</div>
          <div>敵撃破数: {killCount}</div>
        </div>
        {won && !scenario && (
          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: '1px solid #333',
            fontSize: 14, fontWeight: 'bold', color: C.gold
          }}>
            🪙 +{earnedTokens} トークン獲得！
            <span style={{ fontSize: 10, color: C.sub, marginLeft: 6 }}>
              (基礎{reward} + 撃破{killCount}×10)
            </span>
          </div>
        )}
        {scenario && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #333', fontSize: 11, color: C.sub }}>
            📥 局地戦（シナリオ検証）— 成長・報酬は反映されません
          </div>
        )}
      </div>

      {/* 兵士別 XP・レベルアップ表示（局地戦では非表示） */}
      {!scenario && (
      <div style={{ background: C.panel, borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: C.warn, marginBottom: 10 }}>
          🎯 経験値・成長
        </div>
        {participantIds.map(uid => {
          const unit = withLevelUp.find(u => u.id === uid)
          if (!unit) return null
          const leveledUp = leveledUpIds.includes(uid)
          const expNeeded = unit.level * 100
          const expPct = Math.min(100, Math.round((unit.exp / expNeeded) * 100))
          return (
            <div key={uid} style={{ padding: '8px 0', borderBottom: '1px solid #333' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 11, marginBottom: 4, color: leveledUp ? C.green : C.text
              }}>
                <span>
                  {unit.name} {unit.isLeader && '👑'} <span style={{ color: C.sub }}>Lv.{unit.level}</span>
                </span>
                <span>
                  <span style={{ color: C.warn }}>+{unitXps[uid] ?? 0} EXP</span>
                  {leveledUp && (
                    <span style={{ marginLeft: 8, color: C.green, fontWeight: 'bold' }}>
                      ↗ LEVEL UP!
                    </span>
                  )}
                </span>
              </div>
              {/* EXP バー（次レベルまでの進捗） */}
              <div style={{ background: C.card, borderRadius: 3, height: 5, overflow: 'hidden' }}>
                <div style={{
                  background: leveledUp ? C.green : C.warn, height: '100%', width: `${expPct}%`,
                  transition: 'width 0.3s'
                }} />
              </div>
              <div style={{ fontSize: 8, color: C.muted, textAlign: 'right', marginTop: 1 }}>
                {unit.exp} / {expNeeded}
              </div>
            </div>
          )
        })}
      </div>
      )}

      {/* 次へボタン */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {scenario ? (
          <Button variant="default" onClick={() => onContinue(roster, 0)}>↩ インポートへ戻る</Button>
        ) : !won ? (
          <Button variant="default" onClick={onRetry}>↩ もう一度</Button>
        ) : (
          <Button variant="accent" onClick={() => onContinue(withLevelUp, earnedTokens)}>▶ 次へ進む</Button>
        )}
      </div>
    </div>
  )
}
