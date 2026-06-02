import { useState, useEffect } from 'react'
import { MAP_NODES } from '../game/campaign'
import type { MapNode } from '../game/campaign'
import { C } from '../ui/theme'
import { Button } from '../ui/Button'
import { useTheme } from '../ui/ThemeContext'
import { THEME_IDS, THEME_LABEL } from '../game/theme'
import { parseMod, saveMod, clearSavedMod, activeModName, SAMPLE_MOD } from '../game/mod'
import { isCloudEnabled, getIdentity, linkEmail, signInWithEmail, signInWithOAuth } from '../game/supabase'

// 🔗 クロス端末アカウント連携（α17）。匿名→メール紐付け / 別端末でサインイン。
function AccountPanel() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [ident, setIdent] = useState<{ email: string | null; isAnonymous: boolean } | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => { getIdentity().then(setIdent) }, [])
  if (!isCloudEnabled()) return null
  const done = (r: { ok: boolean; error?: string }, okText: string) =>
    setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: '❌ ' + (r.error ?? '失敗') })
  return (
    <div style={{ maxWidth: 420, margin: '12px auto 0', background: C.panel, borderRadius: 8, padding: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 'bold', color: C.ally }}>🔗 アカウント連携（クロス端末）</span>
        <span style={{ fontSize: 9, color: ident?.email ? C.green : C.sub }}>{ident?.email ? ident.email : '匿名'}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="メールアドレス"
          style={{ fontSize: 11, padding: 5, background: '#11131f', color: '#cde', border: `1px solid ${C.sub}`, borderRadius: 5 }} />
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="パスワード"
          style={{ fontSize: 11, padding: 5, background: '#11131f', color: '#cde', border: `1px solid ${C.sub}`, borderRadius: 5 }} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        <Button variant="accent" onClick={() => linkEmail(email, pw).then(r => done(r, '✅ このアカウントに連携しました'))} style={{ fontSize: 11, padding: '5px 10px' }}>連携</Button>
        <Button variant="default" onClick={() => signInWithEmail(email, pw).then(r => { done(r, '✅ サインインしました'); if (r.ok) setTimeout(() => location.reload(), 500) })} style={{ fontSize: 11, padding: '5px 10px' }}>サインイン</Button>
        <Button variant="default" onClick={() => signInWithOAuth('google')} style={{ fontSize: 11, padding: '5px 10px' }}>Google</Button>
      </div>
      <div style={{ fontSize: 9, color: C.sub, marginTop: 5 }}>連携後、別端末で同じメール/パスワードでサインインすると進行を引き継げます。</div>
      {msg && <div style={{ fontSize: 10, color: msg.ok ? C.green : C.danger, marginTop: 5 }}>{msg.text}</div>}
    </div>
  )
}

// 🧩 Mod 差し替えパネル（α16）。適用/解除は再読込で全UIへ確実に反映。
function ModPanel() {
  const [text, setText] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const active = activeModName()
  const apply = () => {
    const r = parseMod(text)
    if (!r.ok) { setMsg({ ok: false, text: '❌ ' + r.error }); return }
    saveMod(r.mod)
    setMsg({ ok: true, text: `✅ 「${r.mod.name}」を適用します（再読込）` })
    setTimeout(() => location.reload(), 400)
  }
  const reset = () => { clearSavedMod(); setTimeout(() => location.reload(), 200) }
  return (
    <div style={{ maxWidth: 420, margin: '12px auto 0', background: C.panel, borderRadius: 8, padding: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 'bold', color: C.ally }}>🧩 Mod（カタログ差し替え）</span>
        <span style={{ fontSize: 9, color: active ? C.green : C.sub }}>{active ? `適用中: ${active}` : 'built-in'}</span>
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Mod の JSON を貼り付け"
        style={{ width: '100%', height: 64, fontSize: 10, fontFamily: 'monospace', background: '#11131f', color: '#cde', border: `1px solid ${C.sub}`, borderRadius: 6, padding: 6, boxSizing: 'border-box', resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <Button variant="accent" onClick={apply} style={{ fontSize: 11, padding: '5px 10px' }}>適用</Button>
        <Button variant="default" onClick={() => setText(JSON.stringify(SAMPLE_MOD, null, 2))} style={{ fontSize: 11, padding: '5px 10px' }}>サンプル</Button>
        <Button variant="default" onClick={reset} style={{ fontSize: 11, padding: '5px 10px' }}>解除（built-in）</Button>
      </div>
      {msg && <div style={{ fontSize: 10, color: msg.ok ? C.green : C.danger, marginTop: 5 }}>{msg.text}</div>}
    </div>
  )
}

// ⚙️ グラフィックテーマ切り替えパネル（α15）
function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'absolute', top: 0, right: 0 }}>
      <button onClick={() => setOpen(o => !o)} title="グラフィックテーマ"
        style={{ background: C.panel, color: C.text, border: `1px solid ${C.sub}`, borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 14 }}>⚙️</button>
      {open && (
        <div style={{ position: 'absolute', top: 32, right: 0, background: C.panel, border: `1px solid ${C.sub}`, borderRadius: 8, padding: 10, width: 160, zIndex: 10 }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 6 }}>グラフィックテーマ</div>
          {THEME_IDS.map(id => (
            <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 0', cursor: 'pointer' }}>
              <input type="radio" name="fb-theme" checked={theme === id} onChange={() => setTheme(id)} />
              {THEME_LABEL[id]}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export interface MapScreenProps {
  clearedNodes: string[]
  frontier: string[]
  tokens: number
  onSelectNode: (nodeId: string) => void
  onOpenGhost: () => void
  onOpenImport: () => void
  cloudEnabled: boolean
  cloudUserId: string | null
  cloudMsg: { ok: boolean; text: string } | null
  onCloudSave: () => void
  onCloudLoad: () => void
}

type NodeState = 'cleared' | 'available' | 'locked'

// レイアウト座標（col/row → px）
const COL_W = 200
const ROW_H = 96
const PAD_X = 40
const PAD_Y = 30
const cx = (n: MapNode) => PAD_X + n.col * COL_W + 70
const cy = (n: MapNode) => PAD_Y + n.row * ROW_H + 36

export function MapScreen({ clearedNodes, frontier, tokens, onSelectNode, onOpenGhost, onOpenImport, cloudEnabled, cloudUserId, cloudMsg, onCloudSave, onCloudLoad }: MapScreenProps) {
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
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '12px', minHeight: '100vh', position: 'relative' }}>
      <ThemeSwitch />
      <h1 style={{ fontSize: 18, marginBottom: 4, textAlign: 'center' }}>🗺️ キャンペーン（分岐マップ）</h1>
      <div style={{ fontSize: 10, color: C.sub, textAlign: 'center', marginBottom: 8 }}>
        攻略済 {clearedNodes.length} / {total}
        <span style={{ color: C.gold }}>🪙 {tokens} トークン</span>　※一度進むと後戻りはできません
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

      {/* クラウドセーブ（本人認証・α10） */}
      <div style={{ maxWidth: 420, margin: '16px auto 0', background: C.panel, borderRadius: 8, padding: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 'bold', color: C.ally }}>☁️ クラウドセーブ</span>
          <span style={{ fontSize: 9, color: cloudUserId ? C.green : C.sub }}>
            {!cloudEnabled ? '未設定' : cloudUserId ? '接続済み' : 'サインイン中…'}
          </span>
        </div>
        {!cloudEnabled ? (
          <div style={{ fontSize: 10, color: C.sub }}>
            docs/SUPABASE_SETUP.md の手順で認証を有効にするとクラウドセーブが使えます。
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="default" disabled={!cloudUserId} onClick={onCloudSave} style={{ fontSize: 11, padding: '5px 10px' }}>⬆️ 保存</Button>
              <Button variant="default" disabled={!cloudUserId} onClick={onCloudLoad} style={{ fontSize: 11, padding: '5px 10px' }}>⬇️ 復元</Button>
            </div>
            {cloudMsg && (
              <div style={{ fontSize: 10, color: cloudMsg.ok ? C.green : C.danger, marginTop: 5 }}>{cloudMsg.text}</div>
            )}
          </>
        )}
      </div>

      <AccountPanel />
      <ModPanel />
    </div>
  )
}
