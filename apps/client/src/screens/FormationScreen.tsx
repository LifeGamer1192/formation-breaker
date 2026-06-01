import { useState } from 'react'
import { FORMATION_LABEL } from '@fb/sim-core'
import type { FormationType } from '@fb/sim-core'
import type { RosterUnit, SquadSetup } from '../game/types'

export interface FormationScreenProps {
  roster: RosterUnit[]
  onStart: (squads: SquadSetup[]) => void
}

export function FormationScreen({ roster, onStart }: FormationScreenProps) {
  const [squads, setSquads] = useState<SquadSetup[]>([
    { id: 'squad-1', name: '前衛', unitIds: [], formation: 'horizontal' },
    { id: 'squad-2', name: '中衛', unitIds: [], formation: 'column' },
    { id: 'squad-3', name: '後衛', unitIds: [], formation: 'square' },
  ])

  const [dragSource, setDragSource] = useState<{ unitId: string; fromSquadId?: string } | null>(null)

  const assignedIds = new Set(squads.flatMap(s => s.unitIds))
  const benchUnits = roster.filter(u => !assignedIds.has(u.id))

  const handleDragStart = (unitId: string, fromSquadId?: string) => {
    setDragSource({ unitId, fromSquadId })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDropOnSquad = (squadId: string) => {
    if (!dragSource) return
    const { unitId, fromSquadId } = dragSource

    setSquads(prev => {
      // 元の隊から削除
      if (fromSquadId) {
        const fromSquad = prev.find(s => s.id === fromSquadId)
        if (fromSquad) {
          fromSquad.unitIds = fromSquad.unitIds.filter(id => id !== unitId)
        }
      }

      // 新しい隊に追加（最大5名）
      const toSquad = prev.find(s => s.id === squadId)
      if (toSquad && toSquad.unitIds.length < 5) {
        toSquad.unitIds = [...toSquad.unitIds, unitId]
      }

      return prev
    })
    setDragSource(null)
  }

  const handleDropOnBench = () => {
    if (!dragSource) return
    const { unitId, fromSquadId } = dragSource

    if (fromSquadId) {
      setSquads(prev => {
        const squad = prev.find(s => s.id === fromSquadId)
        if (squad) {
          squad.unitIds = squad.unitIds.filter(id => id !== unitId)
        }
        return prev
      })
    }
    setDragSource(null)
  }

  const canStart = squads.some(s => s.unitIds.length > 0)

  const btn = (disabled = false, accent = false): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 6, border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    background: disabled ? '#333' : accent ? '#554400' : '#2a2a4a',
    color: disabled ? '#666' : accent ? '#ffcc00' : '#ddf', fontSize: 13, fontWeight: 'bold',
  })

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '12px', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 17, marginBottom: 12 }}>⚔️ 隊編成</h1>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        {/* 左: 所持兵士（ベンチ） */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 13, color: '#fa0', marginBottom: 8 }}>📋 兵士一覧</h2>
          <div
            onDragOver={handleDragOver}
            onDrop={handleDropOnBench}
            style={{
              background: '#0d0d1a', borderRadius: 8, padding: 12, minHeight: 300,
              border: dragSource?.fromSquadId ? '2px solid #4f4' : '1px solid #333',
            }}
          >
            {benchUnits.length === 0 ? (
              <div style={{ fontSize: 11, color: '#666', textAlign: 'center', paddingTop: 12 }}>
                全員配置済
              </div>
            ) : (
              benchUnits.map(unit => (
                <div
                  key={unit.id}
                  draggable
                  onDragStart={() => handleDragStart(unit.id)}
                  onClick={() => handleDragStart(unit.id)}
                  style={{
                    background: '#1a1a2e', borderRadius: 6, padding: '8px 10px',
                    marginBottom: 6, cursor: 'grab', fontSize: 11, color: '#ccc',
                    border: '1px solid #333', userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>
                      <b>{unit.name}</b>
                      {unit.isLeader && ' 👑'}
                    </span>
                    <span style={{ color: '#888' }}>Lv.{unit.level}</span>
                  </div>
                  <div style={{ fontSize: 9, color: '#999' }}>
                    HP {unit.maxHp} / ATK {unit.attack} / DEF {unit.defense}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右: 隊スロット */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 13, color: '#4af', marginBottom: 8 }}>🏰 隊構成</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {squads.map(squad => (
              <div key={squad.id} style={{ background: '#0d0d1a', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 'bold', color: '#4af' }}>
                    {squad.name} ({squad.unitIds.length}/5)
                  </span>
                  <select
                    value={squad.formation}
                    onChange={e => {
                      setSquads(prev =>
                        prev.map(s => s.id === squad.id
                          ? { ...s, formation: e.target.value as FormationType }
                          : s
                        )
                      )
                    }}
                    style={{
                      background: '#2a2a4a', color: '#ddf', border: 'none', borderRadius: 4,
                      padding: '2px 6px', fontSize: 10, cursor: 'pointer'
                    }}
                  >
                    {(['none', 'horizontal', 'column', 'square', 'arrowhead', 'circle', 'solo'] as FormationType[]).map(f => (
                      <option key={f} value={f}>{FORMATION_LABEL[f]}</option>
                    ))}
                  </select>
                </div>

                {/* スロット領域 */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={() => handleDropOnSquad(squad.id)}
                  style={{
                    background: '#1a1a2e', borderRadius: 6, padding: 8, minHeight: 80,
                    border: dragSource && !dragSource.fromSquadId ? '2px solid #fa0' : '1px solid #333',
                  }}
                >
                  {squad.unitIds.length === 0 ? (
                    <div style={{ fontSize: 10, color: '#666', textAlign: 'center', paddingTop: 16 }}>
                      兵士をドラッグして配置
                    </div>
                  ) : (
                    squad.unitIds.map((unitId, idx) => {
                      const unit = roster.find(u => u.id === unitId)
                      if (!unit) return null
                      return (
                        <div
                          key={unitId}
                          draggable
                          onDragStart={() => handleDragStart(unitId, squad.id)}
                          style={{
                            background: '#2a2a4a', borderRadius: 4, padding: '6px 8px',
                            marginBottom: idx < squad.unitIds.length - 1 ? 4 : 0,
                            cursor: 'grab', fontSize: 10, color: '#ccc',
                            border: idx === 0 ? '1px solid #ffdd00' : '1px solid #444',
                            userSelect: 'none'
                          }}
                        >
                          <span>
                            {idx === 0 && '👑 '}
                            {unit.name} Lv.{unit.level}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* スタートボタン */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
        <button
          style={btn(!canStart, true)}
          disabled={!canStart}
          onClick={() => onStart(squads)}
        >
          ▶ 戦闘開始
        </button>
      </div>

      <div style={{ fontSize: 10, color: '#666', textAlign: 'center', marginTop: 12 }}>
        左のカードを右のスロットへドラッグして配置します / 最初のユニット(👑)がリーダーになります
      </div>
    </div>
  )
}
