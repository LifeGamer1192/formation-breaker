import { CAMPAIGN } from '../game/campaign'
import { C } from '../ui/theme'
import { Button } from '../ui/Button'

export interface MapScreenProps {
  currentBattleIndex: number
  onSelectBattle: (index: number) => void
}

export function MapScreen({ currentBattleIndex, onSelectBattle }: MapScreenProps) {
  const total = CAMPAIGN.length
  const progress = Math.min(100, Math.round((currentBattleIndex / total) * 100))

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 18, marginBottom: 4, textAlign: 'center' }}>🗺️ キャンペーン</h1>

      {/* 進捗バー */}
      <div style={{ maxWidth: 320, margin: '0 auto 8px' }}>
        <div style={{ fontSize: 10, color: C.sub, textAlign: 'center', marginBottom: 4 }}>
          進捗 {Math.min(currentBattleIndex, total)} / {total}
        </div>
        <div style={{ background: C.card, borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{ background: C.green, height: '100%', width: `${progress}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* ノード（接続線つき） */}
      <div style={{ position: 'relative', marginTop: 32 }}>
        {/* 背景接続線（ノード中心を貫く） */}
        <div style={{
          position: 'absolute', top: 40, left: '16%', right: '16%', height: 2,
          background: `linear-gradient(90deg, ${C.green} 0%, ${C.green} ${progress}%, #444 ${progress}%, #444 100%)`,
          zIndex: 0,
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-around', gap: 16, position: 'relative', zIndex: 1 }}>
          {CAMPAIGN.map((battle, idx) => {
            const status = idx < currentBattleIndex ? 'done' : idx === currentBattleIndex ? 'current' : 'locked'
            const statusLabel = status === 'done' ? '✅' : status === 'current' ? '▶' : '🔒'

            return (
              <div key={battle.id} style={{
                flex: 1, textAlign: 'center', padding: 20, borderRadius: 8,
                background: C.panel, border: status === 'current' ? `2px solid ${C.ally}` : '1px solid #333',
                opacity: status === 'locked' ? 0.6 : 1,
                boxShadow: status === 'current' ? `0 0 12px ${C.ally}44` : 'none',
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>
                  {status === 'done' ? '🏰' : status === 'current' ? '⚔️' : '❓'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 'bold', color: status === 'current' ? C.ally : C.text, marginBottom: 4 }}>
                  {idx + 1}. {battle.name}
                </div>
                <div style={{ fontSize: 11, color: C.sub, marginBottom: 6 }}>
                  敵: {battle.enemies.squads.length}隊 {battle.enemies.units.length}名
                </div>
                {status === 'done' && (
                  <div style={{ fontSize: 10, color: C.green, marginBottom: 8 }}>🏆 攻略済</div>
                )}
                {status !== 'done' && <div style={{ height: 18 }} />}
                <Button
                  variant={status === 'current' ? 'accent' : 'default'}
                  disabled={status === 'locked'}
                  onClick={() => onSelectBattle(idx)}
                  style={{ fontSize: 12, padding: '8px 12px' }}
                >
                  {statusLabel} {status === 'current' ? '編成' : status === 'done' ? '再挑戦' : 'ロック中'}
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      {currentBattleIndex >= total && (
        <div style={{
          marginTop: 32, padding: 16, borderRadius: 8, background: '#1a3a1a',
          textAlign: 'center', color: C.green, fontSize: 15, fontWeight: 'bold'
        }}>
          🎉 全キャンペーン完了！
        </div>
      )}
    </div>
  )
}
