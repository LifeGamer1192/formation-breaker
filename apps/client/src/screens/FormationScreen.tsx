import { useState } from 'react'
import { FORMATION_LABEL } from '@fb/sim-core'
import type { FormationType } from '@fb/sim-core'
import type { RosterUnit, SquadSetup } from '../game/types'
import { C } from '../ui/theme'
import { Button } from '../ui/Button'

export interface FormationScreenProps {
  roster: RosterUnit[]
  onStart: (squads: SquadSetup[]) => void
}

const FORMATIONS: FormationType[] = ['none', 'horizontal', 'column', 'square', 'arrowhead', 'circle', 'solo']

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

  // 不変更新で隊から取り外し（必要なら）→ 指定隊に追加
  const moveUnit = (unitId: string, fromSquadId: string | undefined, toSquadId: string | null) => {
    setSquads(prev => prev.map(s => {
      let unitIds = s.unitIds
      // 元の隊から削除
      if (fromSquadId === s.id) {
        unitIds = unitIds.filter(id => id !== unitId)
      }
      // 新しい隊に追加（最大5名・重複防止）
      if (toSquadId === s.id && !unitIds.includes(unitId) && unitIds.length < 5) {
        unitIds = [...unitIds, unitId]
      }
      return unitIds === s.unitIds ? s : { ...s, unitIds }
    }))
  }

  const handleDropOnSquad = (squadId: string) => {
    if (!dragSource) return
    moveUnit(dragSource.unitId, dragSource.fromSquadId, squadId)
    setDragSource(null)
  }

  const handleDropOnBench = () => {
    if (!dragSource) return
    moveUnit(dragSource.unitId, dragSource.fromSquadId, null)
    setDragSource(null)
  }

  // 削除ボタン（ベンチに戻す）
  const removeFromSquad = (unitId: string, squadId: string) => {
    moveUnit(unitId, squadId, null)
  }

  const setFormation = (squadId: string, f: FormationType) => {
    setSquads(prev => prev.map(s => s.id === squadId ? { ...s, formation: f } : s))
  }

  const canStart = squads.some(s => s.unitIds.length > 0)

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '12px', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>⚔️ 隊編成</h1>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        {/* 左: 所持兵士（ベンチ） */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 14, color: C.warn, marginBottom: 8 }}>📋 兵士一覧</h2>
          <div
            onDragOver={handleDragOver}
            onDrop={handleDropOnBench}
            style={{
              background: C.panel, borderRadius: 8, padding: 12, minHeight: 300,
              border: dragSource?.fromSquadId ? `2px dashed ${C.green}` : '1px solid #333',
              transition: 'border 0.15s',
            }}
          >
            {benchUnits.length === 0 ? (
              <div style={{ fontSize: 11, color: C.sub, textAlign: 'center', paddingTop: 12 }}>
                全員配置済
              </div>
            ) : (
              benchUnits.map(unit => {
                const isDragging = dragSource?.unitId === unit.id && !dragSource.fromSquadId
                return (
                  <div
                    key={unit.id}
                    draggable
                    onDragStart={() => handleDragStart(unit.id)}
                    onDragEnd={() => setDragSource(null)}
                    style={{
                      background: C.card, borderRadius: 6, padding: '8px 10px',
                      marginBottom: 6, cursor: 'grab', fontSize: 11, color: C.text,
                      border: '1px solid #333', userSelect: 'none',
                      opacity: isDragging ? 0.5 : 1,
                      transform: isDragging ? 'scale(0.95)' : 'scale(1)',
                      transition: 'opacity 0.12s, transform 0.12s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>
                        <b>{unit.name}</b>
                        {unit.isLeader && ' 👑'}
                      </span>
                      <span style={{ color: C.sub }}>Lv.{unit.level}</span>
                    </div>
                    <div style={{ fontSize: 9, color: '#999' }}>
                      HP {unit.maxHp} / ATK {unit.attack} / DEF {unit.defense}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* 右: 隊スロット */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 14, color: C.ally, marginBottom: 8 }}>🏰 隊構成</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {squads.map(squad => {
              const canAccept = dragSource && dragSource.fromSquadId !== squad.id && squad.unitIds.length < 5
              return (
                <div key={squad.id} style={{ background: C.panel, borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 'bold', color: C.ally }}>
                      {squad.name} ({squad.unitIds.length}/5)
                    </span>
                    <select
                      value={squad.formation}
                      onChange={e => setFormation(squad.id, e.target.value as FormationType)}
                      style={{
                        background: C.cardHi, color: C.text, border: 'none', borderRadius: 4,
                        padding: '2px 6px', fontSize: 10, cursor: 'pointer'
                      }}
                    >
                      {FORMATIONS.map(f => (
                        <option key={f} value={f}>{FORMATION_LABEL[f]}</option>
                      ))}
                    </select>
                  </div>

                  {/* スロット領域 */}
                  <div
                    onDragOver={handleDragOver}
                    onDrop={() => handleDropOnSquad(squad.id)}
                    style={{
                      background: canAccept ? '#1a1a00' : C.card, borderRadius: 6, padding: 8, minHeight: 80,
                      border: canAccept ? `2px dashed ${C.warn}` : '1px solid #333',
                      transition: 'background 0.15s, border 0.15s',
                    }}
                  >
                    {squad.unitIds.length === 0 ? (
                      <div style={{ fontSize: 10, color: C.sub, textAlign: 'center', paddingTop: 16 }}>
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
                            onDragEnd={() => setDragSource(null)}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              background: C.cardHi, borderRadius: 4, padding: '6px 8px',
                              marginBottom: idx < squad.unitIds.length - 1 ? 4 : 0,
                              cursor: 'grab', fontSize: 10, color: C.text,
                              border: idx === 0 ? `1px solid ${C.gold}` : '1px solid #444',
                              userSelect: 'none'
                            }}
                          >
                            <span>
                              {idx === 0 && '👑 '}
                              {unit.name} Lv.{unit.level}
                            </span>
                            <button
                              onClick={() => removeFromSquad(unitId, squad.id)}
                              title="ベンチに戻す"
                              style={{
                                background: 'transparent', border: 'none', color: C.danger,
                                cursor: 'pointer', fontSize: 13, fontWeight: 'bold', padding: '0 4px',
                                lineHeight: 1,
                              }}
                            >×</button>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* バリデーションメッセージ */}
      {!canStart && (
        <div style={{ fontSize: 11, color: C.warn, textAlign: 'center', marginBottom: 8 }}>
          ⚠ 最低1名を隊に配置してください
        </div>
      )}

      {/* スタートボタン */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
        <Button variant="accent" disabled={!canStart} onClick={() => onStart(squads)}>
          ▶ 戦闘開始
        </Button>
      </div>

      <div style={{ fontSize: 10, color: C.sub, textAlign: 'center', marginTop: 12 }}>
        左のカードを右のスロットへドラッグして配置 / 最初のユニット(👑)がリーダー / ×で取り外し
      </div>
    </div>
  )
}
