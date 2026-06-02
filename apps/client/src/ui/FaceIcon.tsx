import { useState } from 'react'
import { useTheme } from './ThemeContext'
import { faceUrl } from '../game/theme'
import type { FaceLike } from '../game/theme'

// 顔グラ表示（α15）。テーマ画像が無い/読込失敗時は色付きプレースホルダにフォールバック。
export function FaceIcon({ unit, size = 48, round = 6 }: { unit: FaceLike; size?: number; round?: number }) {
  const { theme } = useTheme()
  const [failed, setFailed] = useState(false)
  const ally = unit.side === 'ally'
  const base: React.CSSProperties = {
    width: size, height: size, borderRadius: round, flexShrink: 0,
    objectFit: 'cover', background: ally ? '#1a2a44' : '#3a1a1a',
    border: `1px solid ${ally ? '#2a4a7a' : '#7a2a2a'}`,
  }
  if (failed) {
    return (
      <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, color: ally ? '#6af' : '#f66' }}>
        {ally ? '兵' : '敵'}
      </div>
    )
  }
  return <img src={faceUrl(theme, unit)} alt="" style={base} onError={() => setFailed(true)} />
}
