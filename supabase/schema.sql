-- ─── Formation Breaker クラウドスキーマ（α17: サーバー権威ゴースト）──────────
-- cloud_ghosts: ゴーストデータ。verified=true は Edge Function(verify-ghost) が
-- 決定論再シミュで照合した結果のみ（service_role が挿入＝RLSバイパス）。
-- クライアントから直接挿入できるのは verified=false の未検証ゴーストのみ。

create table if not exists public.cloud_ghosts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  data       jsonb not null,
  verified   boolean not null default false,
  winner     text,
  ticks      int,
  created_at timestamptz default now()
);

alter table public.cloud_ghosts enable row level security;

-- 誰でも閲覧可（ゴースト一覧）
create policy "ghosts read all" on public.cloud_ghosts
  for select using (true);

-- 認証ユーザーは未検証ゴーストのみ挿入可（verified=true は Edge Function 経由のみ）
create policy "ghosts insert unverified" on public.cloud_ghosts
  for insert to authenticated with check (verified = false);

-- saves: 本人のクラウドセーブ（α10・RLSで本人の行のみ）
create table if not exists public.saves (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz default now()
);
alter table public.saves enable row level security;
create policy "saves own row" on public.saves
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
