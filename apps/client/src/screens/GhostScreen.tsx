import { useState } from 'react'
import type { Ghost } from '../game/types'
import { loadGhosts, deleteGhost, saveGhost, encodeGhost, decodeGhost } from '../game/ghost'
import { C } from '../ui/theme'
import { Button } from '../ui/Button'

export interface GhostScreenProps {
  onChallenge: (ghost: Ghost) => void
  onBack: () => void
}

export function GhostScreen({ onChallenge, onBack }: GhostScreenProps) {
  const [ghosts, setGhosts] = useState<Ghost[]>(() => loadGhosts())
  const [exportCode, setExportCode] = useState<string | null>(null)
  const [importText, setImportText] = useState('')
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const refresh = () => setGhosts(loadGhosts())

  const handleDelete = (id: string) => {
    deleteGhost(id)
    refresh()
  }

  const handleExport = (ghost: Ghost) => {
    setExportCode(encodeGhost(ghost))
  }

  const handleImport = () => {
    const ghost = decodeGhost(importText)
    if (!ghost) {
      setImportMsg({ ok: false, text: '❌ 無効なコードです' })
      return
    }
    saveGhost(ghost)
    setImportText('')
    setImportMsg({ ok: true, text: `✅ 「${ghost.name}」をインポートしました` })
    refresh()
  }

  const unitCount = (g: Ghost) => g.squads.reduce((sum, s) => sum + s.unitIds.length, 0)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 18 }}>👻 ゴースト対戦</h1>
        <Button variant="ghost" onClick={onBack} style={{ fontSize: 12, padding: '6px 12px' }}>← マップへ</Button>
      </div>

      {/* ゴースト一覧 */}
      <div style={{ background: C.panel, borderRadius: 8, padding: 12, marginBottom: 12 }}>
        <h2 style={{ fontSize: 13, color: C.ally, marginBottom: 8 }}>保存済みゴースト（{ghosts.length}）</h2>
        {ghosts.length === 0 ? (
          <div style={{ fontSize: 11, color: C.sub, textAlign: 'center', padding: '16px 0' }}>
            まだゴーストがありません。編成画面で「👻 ゴースト登録」するか、下のコードをインポートしてください。
          </div>
        ) : (
          ghosts.map(g => (
            <div key={g.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: C.card, borderRadius: 6, padding: '8px 10px', marginBottom: 6,
            }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: C.text }}>{g.name}</div>
                <div style={{ fontSize: 9, color: C.sub }}>
                  {g.squads.length}隊 / {unitCount(g)}名
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <Button variant="accent" onClick={() => onChallenge(g)} style={{ fontSize: 11, padding: '5px 10px' }}>⚔️ 挑戦</Button>
                <Button variant="default" onClick={() => handleExport(g)} style={{ fontSize: 11, padding: '5px 8px' }}>📋</Button>
                <Button variant="danger" onClick={() => handleDelete(g.id)} style={{ fontSize: 11, padding: '5px 8px' }}>🗑</Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* エクスポートコード表示 */}
      {exportCode && (
        <div style={{ background: C.panel, borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h2 style={{ fontSize: 13, color: C.gold }}>📋 共有コード（コピーして渡してください）</h2>
            <Button variant="ghost" onClick={() => setExportCode(null)} style={{ fontSize: 11, padding: '2px 8px' }}>✕</Button>
          </div>
          <textarea
            readOnly
            value={exportCode}
            onFocus={e => e.currentTarget.select()}
            style={{
              width: '100%', height: 70, background: C.card, color: C.text, border: '1px solid #333',
              borderRadius: 6, padding: 8, fontSize: 10, fontFamily: 'monospace', resize: 'vertical',
            }}
          />
        </div>
      )}

      {/* インポート */}
      <div style={{ background: C.panel, borderRadius: 8, padding: 12 }}>
        <h2 style={{ fontSize: 13, color: C.warn, marginBottom: 6 }}>📥 ゴーストをインポート</h2>
        <textarea
          value={importText}
          onChange={e => { setImportText(e.target.value); setImportMsg(null) }}
          placeholder="共有コードを貼り付け"
          style={{
            width: '100%', height: 60, background: C.card, color: C.text, border: '1px solid #333',
            borderRadius: 6, padding: 8, fontSize: 10, fontFamily: 'monospace', resize: 'vertical',
            marginBottom: 6,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button variant="accent" disabled={!importText.trim()} onClick={handleImport} style={{ fontSize: 12, padding: '6px 14px' }}>
            インポート
          </Button>
          {importMsg && (
            <span style={{ fontSize: 11, color: importMsg.ok ? C.green : C.danger }}>{importMsg.text}</span>
          )}
        </div>
      </div>
    </div>
  )
}
