import { MAP_NODES } from '../game/campaign'
import type { MapNode } from '../game/campaign'
import { C } from '../ui/theme'
import { Button } from '../ui/Button'

export interface MapScreenProps {
  clearedNodes: string[]
  frontier: string[]
  onSelectNode: (nodeId: string) => void
  onOpenGhost: () => void
  onOpenImport: () => void
}

type NodeState = 'cleared' | 'available' | 'locked'

// レイアウト座標（col/row → px）
const COL_W = 200
const ROW_H = 96
const PAD_X = 40
const PAD_Y = 30
const cx = (n: MapNode) => PAD_X + n.col * COL_W + 70
const cy = (n: MapNode) => PAD_Y + n.row * ROW_H + 36

export function MapScreen({ clearedNodes, frontier, onSelectNode, onOpenGhost, onOpenImport }: MapScreenProps) {
  const nodes = Object.values(MAP_NODES)
  const total = nodes.length
  const stateOf = (id: string): NodeState =>
    clearedNodes.includes(id) ? 'cleared' : frontier.includes(id) ? 'available' : 'locked'

  const complete = frontier.length === 0 && clearedNodes.length > 0
  const maxCol = Math.max(...nodes.map(n => n.col))
  const maxRow = Math.max(...nodes.map(n => n.row))
  const width = PAD_X * 2 + maxCol * COL_W + 140
  const height = PAD_Y * 2 + maxRow * ROW_H + 72

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '12px', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 18, marginBottom: 4, textAlign: 'center' }}>🗺️ キャンペーン（分岐マップ）</h1>
      <div style={{ fontSize: 10, color: C.sub, textAlign: 'center', marginBottom: 8 }}>
        攻略済 {clearedNodes.length} / {total}　※一度進むと後戻りはできません
      </div>

      {/* 分岐マップ（接続線 + ノード） */}
      <div style={{ position: 'relative', width, height, margin: '0 auto', maxWidth: '100%', overflowX: 'auto' }}>
        {/* 接続線（SVG） */}
        <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, zIndex: 0 }}>
          {nodes.flatMap(n => n.next.map(nid => {
            const m = MAP_NODES[nid]
            if (!m) return null
            const lit = clearedNodes.includes(n.id) // クリア済から伸びる線は明るく
            return (
              <line key={`${n.id}-${nid}`} x1={cx(n)} y1={cy(n)} x2={cx(m)} y2={cy(m)}
                stroke={lit ? C.green : '#444'} strokeWidth={lit ? 3 : 2} />
            )
          }))}
        </svg>

        {nodes.map(n => {
          const st = stateOf(n.id)
          const left = PAD_X + n.col * COL_W
          const top = PAD_Y + n.row * ROW_H
          return (
            <div key={n.id} style={{
              position: 'absolute', left, top, width: 140, zIndex: 1,
              background: C.panel, borderRadius: 8, padding: 8, textAlign: 'center',
              border: st === 'available' ? `2px solid ${C.ally}` : '1px solid #333',
              opacity: st === 'locked' ? 0.5 : 1,
              boxShadow: st === 'available' ? `0 0 10px ${C.ally}55` : 'none',
            }}>
              <div style={{ fontSize: 18 }}>
                {st === 'cleared' ? '🏰' : st === 'available' ? '⚔️' : '❓'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 'bold', color: st === 'available' ? C.ally : C.text }}>
                {n.battle.name}
              </div>
              <div style={{ fontSize: 9, color: C.sub, marginBottom: 6 }}>
                敵{n.battle.enemies.squads.length}隊 {n.battle.enemies.units.length}名
                {st === 'cleared' && <span style={{ color: C.green }}> ・攻略済</span>}
              </div>
              <Button
                variant={st === 'available' ? 'accent' : 'default'}
                disabled={st !== 'available'}
                onClick={() => onSelectNode(n.id)}
                style={{ fontSize: 11, padding: '5px 10px' }}
              >
                {st === 'cleared' ? '✅ 攻略済' : st === 'available' ? '▶ 出撃' : '🔒'}
              </Button>
            </div>
          )
        })}
      </div>

      {complete && (
        <div style={{
          marginTop: 24, padding: 16, borderRadius: 8, background: '#1a3a1a',
          textAlign: 'center', color: C.green, fontSize: 15, fontWeight: 'bold'
        }}>
          🎉 全キャンペーン完了！
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
        <Button variant="default" onClick={onOpenGhost} style={{ fontSize: 13 }}>
          👻 ゴースト対戦へ
        </Button>
        <Button variant="default" onClick={onOpenImport} style={{ fontSize: 13 }}>
          📥 局地戦インポート
        </Button>
      </div>
    </div>
  )
}
