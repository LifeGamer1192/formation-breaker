import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Ghost } from './types'

// 認証情報は .env.local / Vercel 環境変数から読む（リポジトリには残さない）
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const TABLE = 'cloud_ghosts'

let _client: SupabaseClient | null = null

// Supabase が設定済みか
export function isCloudEnabled(): boolean {
  return !!(URL && KEY)
}

// クライアント遅延生成（未設定なら null）
function getClient(): SupabaseClient | null {
  if (!isCloudEnabled()) return null
  if (!_client) _client = createClient(URL!, KEY!)
  return _client
}

export interface CloudGhost {
  id: string
  name: string
  data: Ghost
  created_at: string
}

// ゴーストをクラウドにアップロード
export async function uploadGhost(ghost: Ghost): Promise<{ ok: boolean; error?: string }> {
  const client = getClient()
  if (!client) return { ok: false, error: 'Supabase未設定' }
  try {
    const { error } = await client.from(TABLE).insert({ name: ghost.name, data: ghost })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

// 新着順にクラウドゴーストを取得
export async function fetchCloudGhosts(limit = 20): Promise<CloudGhost[]> {
  const client = getClient()
  if (!client) return []
  try {
    const { data, error } = await client
      .from(TABLE)
      .select('id, name, data, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data as CloudGhost[]
  } catch {
    return []
  }
}
