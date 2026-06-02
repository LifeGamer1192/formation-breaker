import { useState } from 'react'
import { FORMATION_LABEL, ATTRIBUTES } from '@fb/sim-core'
import type { FormationType } from '@fb/sim-core'
import type { RosterUnit, SquadSetup } from '../game/types'
import { ULTIMATES } from '../game/ultimate'
import { TECHNIQUES } from '../game/technique'

// ホバー時の詳細全ステータス（native title）
function unitTooltip(u: RosterUnit): string {
  const lines: string[] = []
  lines.push(`${u.name}（${u.kind === 'unique' ? 'ユニーク' : '一般'}${u.isLeader ? '・リーダー' : ''}）`)
  lines.push(`Lv.${u.level}  EXP ${u.exp}/${u.level * 100}`)
  lines.push(`HP ${u.hp}/${u.maxHp}`)
  lines.push(`攻撃 ${u.attack}  防御 ${u.defense}  攻撃速度 ${u.attackSpeed}  射程 ${u.range}`)
  lines.push(`攻撃属性 ${ATTRIBUTES[u.attackAttr ?? 'slash'].label}  側面${u.flankMod}%  背面${u.rearMod}%`)
  if (u.armorDef && Object.keys(u.armorDef).length)
    lines.push('属性防御 ' + Object.entries(u.armorDef).map(([a, v]) => `${ATTRIBUTES[a as keyof typeof ATTRIBUTES].label}+${v}`).join(' '))
  if (u.traitName) lines.push(`特性 ${u.traitName}`)
  if (u.ultId && ULTIMATES[u.ultId]) lines.push(`必殺技 ${ULTIMATES[u.ultId].name}`)
  if (u.techniques?.length) lines.push('技 ' + u.techniques.map(t => TECHNIQUES[t.id]?.name ?? t.name).join('・'))
  return lines.join('\n')
}
import { MERCENARY_COST, autoArrange } from '../game/army'
import { EQUIP_DEFS, SLOTS, SLOT_LABEL } from '../game/equipment'
import type { OwnedEquip, EquipSlot } from '../game/equipment'
import { ITEM_DEFS, MAX_ITEMS_PER_SQUAD } from '../game/item'
import type { OwnedItem } from '../game/item'
import { C } from '../ui/theme'
import { Button } from '../ui/Button'
import { FaceIcon } from '../ui/FaceIcon'

export interface FormationScreenProps {
  roster: RosterUnit[]
  gold: number
  potions: number
  inventory: OwnedEquip[]
  items: OwnedItem[]
  initialSquads?: SquadSetup[]
  onHire: () => void
  onUsePotion: (unitId: string) => void
  onDelete: (unitId: string) => void
  onStart: (squads: SquadSetup[]) => void
  onSaveGhost: (squads: SquadSetup[]) => void
}

const FORMATIONS: FormationType[] = ['none', 'horizontal', 'column', 'square', 'arrowhead', 'circle', 'solo']

const DEFAULT_SQUADS: SquadSetup[] = [
  { id: 'squad-1', name: '前衛', unitIds: [], formation: 'horizontal' },
  { id: 'squad-2', name: '中衛', unitIds: [], formation: 'column' },
  { id: 'squad-3', name: '後衛', unitIds: [], formation: 'square' },
]

export function FormationScreen({ roster, gold, potions, inventory, items, initialSquads, onHire, onUsePotion, onDelete, onStart, onSaveGhost }: FormationScreenProps) {
  const [ghostSaved, setGhostSaved] = useState(false)
  // 前回の編成を引き継ぐ（存在しない兵士IDは除去してサニタイズ）
  const [squads, setSquads] = useState<SquadSetup[]>(() => {
    const rosterIds = new Set(roster.map(u => u.id))
    const src = initialSquads && initialSquads.length > 0 ? initialSquads : DEFAULT_SQUADS
    return src.map(s => ({ ...s, unitIds: s.unitIds.filter(id => rosterIds.has(id)) }))
  })

  // 装備の割当変更（uid 重複を避けるため、他隊が使用中の uid は選べない）
  const setEquipSlot = (squadId: string, slot: EquipSlot, uid: string) => {
    setSquads(prev => prev.map(s => {
      if (s.id !== squadId) return s
      const equip = { ...(s.equip ?? {}) }
      if (uid === '') delete equip[slot]
      else equip[slot] = uid
      return { ...s, equip }
    }))
  }

  // 装備アイテムの割当変更（隊ごと最大2・他隊使用中 uid は選べない）
  const setItemSlot = (squadId: string, idx: number, uid: string) => {
    setSquads(prev => prev.map(s => {
      if (s.id !== squadId) return s
      const arr = [...(s.itemUids ?? [])]
      if (uid === '') arr.splice(idx, 1)
      else arr[idx] = uid
      return { ...s, itemUids: arr.filter(Boolean).slice(0, MAX_ITEMS_PER_SQUAD) }
    }))
  }

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

  // オート編成: 現在の隊定義（id/name/formation）を維持して unitIds を再割当
  const handleAuto = () => {
    setSquads(prev => autoArrange(roster, prev.map(s => ({ id: s.id, name: s.name, formation: s.formation }))))
  }

  const canStart = squads.some(s => s.unitIds.length > 0)

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '12px', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontSize: 18 }}>⚔️ 隊編成</h1>
          <Button variant="accent" onClick={handleAuto} style={{ fontSize: 12, padding: '5px 12px' }}>
            🎲 オート編成
          </Button>
        </div>
        <span style={{
          background: C.card, borderRadius: 16, padding: '4px 12px',
          fontSize: 13, fontWeight: 'bold', color: C.gold, border: `1px solid ${C.gold}44`
        }}>
          💰 {gold}　🧪 {potions}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        {/* 左: 所持兵士（ベンチ） */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={{ fontSize: 14, color: C.warn }}>📋 兵士一覧</h2>
            <Button
              variant="accent"
              disabled={gold < MERCENARY_COST}
              onClick={onHire}
              style={{ fontSize: 11, padding: '4px 10px' }}
            >
              💰 傭兵を雇う（{MERCENARY_COST}）
            </Button>
          </div>
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
                    title={unitTooltip(unit)}
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
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <FaceIcon unit={unit} size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>
                        {unit.kind === 'unique'
                          ? <span title="ユニーク（一体限り）" style={{ color: C.gold }}>★</span>
                          : <span title="一般" style={{ color: C.sub }}>◇</span>}
                        {' '}<b>{unit.name}</b>
                        {unit.isLeader && ' 👑'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: C.sub }}>Lv.{unit.level}</span>
                        {unit.hp < unit.maxHp && potions > 0 && (
                          <button
                            onClick={e => { e.stopPropagation(); onUsePotion(unit.id) }}
                            title="回復薬を使う（最大50%回復）"
                            style={{ background: 'transparent', border: 'none', color: C.green, cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}
                          >🧪</button>
                        )}
                        {!unit.forced && (
                          <button
                            onClick={e => { e.stopPropagation(); onDelete(unit.id) }}
                            title="兵士を削除"
                            style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}
                          >🗑</button>
                        )}
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: '#999' }}>
                      HP <span style={{ color: unit.hp < unit.maxHp ? C.danger : '#999' }}>{unit.hp}</span>/{unit.maxHp} / ATK {unit.attack} / DEF {unit.defense}
                      {unit.traitName && <span style={{ color: '#9c6', marginLeft: 4 }}>◆{unit.traitName}</span>}
                    </div>
                    </div>
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
                            title={unitTooltip(unit)}
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

                  {/* 装備ロードアウト（隊単位・α3） */}
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {SLOTS.map(slot => {
                      const selUid = squad.equip?.[slot] ?? ''
                      // この隊が選べる装備: 当該スロット かつ 他隊未使用（自隊の現選択は含む）
                      const usedByOthers = new Set(
                        squads.filter(s => s.id !== squad.id)
                          .flatMap(s => SLOTS.map(sl => s.equip?.[sl]).filter(Boolean) as string[])
                      )
                      const opts = inventory.filter(o =>
                        EQUIP_DEFS[o.defId]?.slot === slot && !usedByOthers.has(o.uid))
                      return (
                        <select
                          key={slot}
                          value={selUid}
                          onChange={e => setEquipSlot(squad.id, slot, e.target.value)}
                          title={SLOT_LABEL[slot]}
                          style={{
                            background: selUid ? '#142814' : C.card, color: selUid ? C.green : C.sub,
                            border: '1px solid #333', borderRadius: 4, padding: '1px 3px', fontSize: 9,
                            cursor: 'pointer', maxWidth: 92,
                          }}
                        >
                          <option value="">{SLOT_LABEL[slot]}：なし</option>
                          {opts.map(o => {
                            const d = EQUIP_DEFS[o.defId]
                            return <option key={o.uid} value={o.uid}>{d.icon}{d.name} Lv{o.level}</option>
                          })}
                        </select>
                      )
                    })}
                  </div>

                  {/* 装備アイテム（隊単位・最大2・α12） */}
                  <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {Array.from({ length: MAX_ITEMS_PER_SQUAD }).map((_, idx) => {
                      const selUid = squad.itemUids?.[idx] ?? ''
                      // 全隊で使用中の uid は除外（現在の選択だけは残す）＝1アイテム1隊
                      const usedAll = new Set(squads.flatMap(s => s.itemUids ?? []))
                      const opts = items.filter(o => !usedAll.has(o.uid) || o.uid === selUid)
                      return (
                        <select
                          key={idx}
                          value={selUid}
                          onChange={e => setItemSlot(squad.id, idx, e.target.value)}
                          title={`装備アイテム${idx + 1}`}
                          style={{
                            background: selUid ? '#2a1a30' : C.card, color: selUid ? '#d9f' : C.sub,
                            border: '1px solid #333', borderRadius: 4, padding: '1px 3px', fontSize: 9,
                            cursor: 'pointer', maxWidth: 110,
                          }}
                        >
                          <option value="">アイテム{idx + 1}：なし</option>
                          {opts.map(o => {
                            const d = ITEM_DEFS[o.defId]
                            return <option key={o.uid} value={o.uid} title={d.desc}>{d.icon}{d.name}</option>
                          })}
                        </select>
                      )
                    })}
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
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 12 }}>
        <Button variant="accent" disabled={!canStart} onClick={() => onStart(squads)}>
          ▶ 戦闘開始
        </Button>
        <Button
          variant="default"
          disabled={!canStart}
          onClick={() => { onSaveGhost(squads); setGhostSaved(true) }}
          style={{ fontSize: 12 }}
        >
          👻 ゴースト登録
        </Button>
        {ghostSaved && <span style={{ fontSize: 11, color: C.green }}>✅ 登録しました</span>}
      </div>

      <div style={{ fontSize: 10, color: C.sub, textAlign: 'center', marginTop: 12 }}>
        左のカードを右のスロットへドラッグして配置 / 最初のユニット(👑)がリーダー / ×で取り外し
      </div>
    </div>
  )
}
