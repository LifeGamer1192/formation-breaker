// ─── Edge Function: ゴースト結果のサーバー権威検証（α17・Deno）────────────
// クライアントが提出した (初期World, replay, 主張する勝者) を sim-core で再シミュして照合。
// 一致した結果だけ verified=true で保存する（改ざんした勝敗は決定論再生と一致せず却下）。
// sim-core はクライアントと同一の純TSコードをバンドルしたものを共有する。
//
// デプロイ: supabase functions deploy verify-ghost
// 事前に `npm run build:edge`（ルート）で _shared/sim-core.mjs を最新化すること。

import { createClient } from 'npm:@supabase/supabase-js@2'
// @ts-ignore  Deno はローカル .mjs を直接 import 可能
import { verifyReplay } from '../_shared/sim-core.mjs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// deno-lint-ignore no-explicit-any
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST のみ' }, 405)

  let payload: any
  try { payload = await req.json() } catch { return json({ error: 'JSON 解析失敗' }, 400) }

  const { name, ghost, initialWorld, replay, claimedWinner } = payload ?? {}
  if (!ghost || !initialWorld || !replay || claimedWinner === undefined) {
    return json({ error: 'name/ghost/initialWorld/replay/claimedWinner が必要' }, 400)
  }

  // ── 決定論再シミュで照合（不正対策の核）──
  let result
  try { result = verifyReplay(initialWorld, replay, claimedWinner) }
  catch (e) { return json({ error: '再シミュ失敗: ' + String(e) }, 400) }
  if (!result.valid) {
    return json({ verified: false, reason: result.reason, actualWinner: result.actualWinner }, 422)
  }

  // ── 検証通過 → service_role で verified 行を保存（RLS バイパスはサーバーのみ）──
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ verified: true, stored: false, note: 'サーバー鍵未設定のため保存スキップ' })

  const admin = createClient(url, serviceKey)
  const { error } = await admin.from('cloud_ghosts').insert({
    name: String(name ?? ghost.name ?? 'ghost'),
    data: ghost,
    verified: true,
    winner: claimedWinner,
    ticks: result.actualTick,
  })
  if (error) return json({ verified: true, stored: false, error: error.message }, 500)
  return json({ verified: true, stored: true, ticks: result.actualTick })
})
