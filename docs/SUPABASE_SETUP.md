# Supabase クラウドゴースト共有 セットアップ手順

ゴーストをクラウドにアップロード／取得して、他プレイヤーと非同期対戦するための設定です。
**未設定でもアプリは完全に動作します**（ローカル保存＋共有コードのインポート/エクスポート）。
クラウド共有を有効にしたい場合のみ、以下を設定してください。

## 1. Supabase プロジェクトを作成

1. https://supabase.com にアクセスしてサインイン
2. 「New project」でプロジェクトを作成（リージョンは近い場所を推奨）
3. データベースのパスワードは任意（クライアントからは使いません）

## 2. テーブルを作成

ダッシュボードの **SQL Editor** で以下を実行：

```sql
create table public.cloud_ghosts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  data jsonb not null,
  created_at timestamptz default now()
);

-- 行レベルセキュリティを有効化
alter table public.cloud_ghosts enable row level security;

-- プロトタイプ用: 認証なしで誰でも read / insert 可（delete は不可）
create policy "public read"   on public.cloud_ghosts for select using (true);
create policy "public insert" on public.cloud_ghosts for insert with check (true);
```

> 注: プロトタイプ用に匿名で読み書き可能にしています。本番では本人認証・レート制限・
> 不正データ対策（PoC#4 のコマンド検証連携）を追加する想定です。

## 2.5 クラウドセーブ（本人認証・α10）を使う場合

クラウドセーブ（本人だけが自分のセーブを保存/復元）を有効にするには、以下も設定します。
不要なら省略可（未設定でもアプリは動作し、クラウドセーブUIは「未設定」表示になります）。

### a) 匿名サインインを有効化
ダッシュボードの **Authentication → Sign In / Providers → Anonymous Sign-ins** を **ON** にします。
（メール不要で各ブラウザに固有IDを割り当て、本人のセーブを識別します）

### b) セーブ用テーブルを作成（SQL Editor）
```sql
create table public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table public.saves enable row level security;

-- 本人（auth.uid()）の行だけ read/insert/update 可
create policy "own save select" on public.saves for select using (auth.uid() = user_id);
create policy "own save insert" on public.saves for insert with check (auth.uid() = user_id);
create policy "own save update" on public.saves for update using (auth.uid() = user_id);
```

設定後、ゲームのマップ画面の「☁️ クラウドセーブ」が「接続済み」になり、保存/復元できます。
キャンペーン進捗は自動でもクラウドにバックアップされます。

## 3. API キーを取得

ダッシュボードの **Project Settings → API** から以下を控えます：

- **Project URL**（例: `https://xxxxxxxx.supabase.co`）
- **anon public** key（公開用キー。クライアントに埋め込んで問題ない種類）

## 4. ローカルに設定

`apps/client/.env.local.example` をコピーして `apps/client/.env.local` を作成し、値を記入：

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=（anon public key）
```

> `.env.local` は `.gitignore` 済みでリポジトリには含まれません。

開発サーバーを再起動すると、ゴースト画面の「☁️ クラウドのゴースト」が有効になります。

## 5. Vercel（本番）に設定

Vercel プロジェクトの **Settings → Environment Variables** に同じ2つを追加：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

追加後、再デプロイすると本番でもクラウド共有が有効になります。

## 動作確認

1. 編成画面で「👻 ゴースト登録」
2. ゴースト画面の保存済みゴースト行で「☁️」→ クラウドにアップロード
3. 別のブラウザ／端末でアプリを開き、ゴースト画面の「🔄 取得」→ 一覧に出る
4. 「⬇️ 保存」でローカルに取り込み、「⚔️ 挑戦」で対戦
