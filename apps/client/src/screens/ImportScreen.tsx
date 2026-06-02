import { useState } from 'react'
import type { BattleScenario } from '../game/scenario'
import { parseScenario, SAMPLE_SCENARIO } from '../game/scenario'
import { C } from '../ui/theme'
import { Button } from '../ui/Button'

export interface ImportScreenProps {
  onRun: (scenario: BattleScenario) => void
  onBack: () => void
}

export function ImportScreen({ onRun, onBack }: ImportScreenProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleRun = () => {
    const res = parseScenario(text)
    if (!res.ok) { setError(res.error); return }
    setError(null)
    onRun(res.scenario)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => { setText(String(reader.result ?? '')); setError(null) }
    reader.readAsText(f)
  }

  const loadSample = () => { setText(JSON.stringify(SAMPLE_SCENARIO, null, 2)); setError(null) }

  // α16: シナリオの書き出し（現在の内容、空ならサンプルを .json でダウンロード）
  const handleExport = () => {
    const body = text.trim() ? text : JSON.stringify(SAMPLE_SCENARIO, null, 2)
    const blob = new Blob([body], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'scenario.json'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '12px', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ fontSize: 18 }}>📥 局地戦インポート</h1>
        <Button variant="ghost" onClick={onBack} style={{ fontSize: 12, padding: '6px 12px' }}>← マップへ</Button>
      </div>
      <div style={{ fontSize: 11, color: C.sub, marginBottom: 8, lineHeight: 1.6 }}>
        地形・両軍データ（JSON）を投入して、任意の局地戦をシミュレータで再現します。
        スキル/必殺技/技はカタログIDで参照（例: ultId:"raikou", techniques:["fireball"]）。
        シナリオ検証・バランス調整・Modテストに利用できます。
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <Button variant="default" onClick={loadSample} style={{ fontSize: 12 }}>📄 サンプル読込</Button>
        <label style={{
          fontSize: 12, padding: '8px 14px', borderRadius: 6, background: C.cardHi, color: C.text,
          cursor: 'pointer', fontWeight: 'bold',
        }}>
          📂 ファイル選択
          <input type="file" accept=".json,application/json,text/plain" onChange={handleFile} style={{ display: 'none' }} />
        </label>
        <Button variant="default" onClick={handleExport} style={{ fontSize: 12 }}>📤 書き出し</Button>
      </div>

      <textarea
        value={text}
        onChange={e => { setText(e.target.value); setError(null) }}
        placeholder='ここにシナリオJSONを貼り付け（「📄 サンプル読込」で書式を確認できます）'
        spellCheck={false}
        style={{
          width: '100%', height: 320, background: C.card, color: C.text, border: `1px solid ${error ? C.danger : '#333'}`,
          borderRadius: 6, padding: 10, fontSize: 11, fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5,
        }}
      />

      {error && (
        <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 6, background: '#3a1a1a', color: C.danger, fontSize: 11 }}>
          ❌ {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
        <Button variant="accent" disabled={!text.trim()} onClick={handleRun} style={{ fontSize: 13 }}>
          ▶ 局地戦を実行
        </Button>
      </div>
    </div>
  )
}
