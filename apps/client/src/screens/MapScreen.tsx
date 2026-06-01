import { CAMPAIGN } from '../game/campaign'

export interface MapScreenProps {
  currentBattleIndex: number
  onSelectBattle: (index: number) => void
}

export function MapScreen({ currentBattleIndex, onSelectBattle }: MapScreenProps) {
  const btn = (disabled = false, accent = false): React.CSSProperties => ({
    padding: '8px 12px', borderRadius: 6, border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    background: disabled ? '#333' : accent ? '#4a7a30' : '#2a2a4a',
    color: disabled ? '#666' : accent ? '#fff' : '#ddf', fontSize: 12, fontWeight: 'bold',
  })

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 18, marginBottom: 8, textAlign: 'center' }}>🗺️ キャンペーン</h1>

      <div style={{ display: 'flex', justifyContent: 'space-around', gap: 16, marginTop: 32 }}>
        {CAMPAIGN.map((battle, idx) => {
          const status = idx < currentBattleIndex ? 'done' : idx === currentBattleIndex ? 'current' : 'locked'
          const statusLabel = status === 'done' ? '✅' : status === 'current' ? '▶' : '🔒'

          return (
            <div key={battle.id} style={{
              flex: 1, textAlign: 'center', padding: 20, borderRadius: 8,
              background: '#0d0d1a', border: status === 'current' ? '2px solid #4af' : '1px solid #333',
              opacity: status === 'locked' ? 0.6 : 1,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>
                {status === 'done' ? '🏰' : status === 'current' ? '⚔️' : '❓'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: status === 'current' ? '#4af' : '#ccc', marginBottom: 4 }}>
                {idx + 1}. {battle.name}
              </div>
              <div style={{ fontSize: 10, color: '#888', marginBottom: 12 }}>
                敵: {battle.enemies.squads.length}隊 {battle.enemies.units.length}名
              </div>
              <button
                style={btn(status === 'locked', status === 'current')}
                disabled={status === 'locked'}
                onClick={() => onSelectBattle(idx)}
              >
                {statusLabel} {status === 'current' ? '編成' : status === 'done' ? '再挑戦' : 'ロック中'}
              </button>
            </div>
          )
        })}
      </div>

      {currentBattleIndex >= CAMPAIGN.length && (
        <div style={{
          marginTop: 32, padding: 16, borderRadius: 8, background: '#1a3a1a',
          textAlign: 'center', color: '#4f4', fontSize: 14, fontWeight: 'bold'
        }}>
          🎉 全キャンペーン完了！
        </div>
      )}
    </div>
  )
}
