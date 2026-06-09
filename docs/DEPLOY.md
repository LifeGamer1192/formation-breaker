# デプロイ手順（GitHub Pages）

公開URL: **https://lifegamer1192.github.io/formation-breaker/**

GitHub Pages のプロジェクトページ（サブパス `/formation-breaker/`）で配信する。
`vite.config.ts` は build 時のみ `base: '/formation-breaker/'` を付与し、テーマ画像等の
絶対URLは `import.meta.env.BASE_URL` 起点（theme.ts / pixiBattlefield）で base 配下を指す。

## 再デプロイ（変更を反映する）

```bash
# 1) ビルド
npm run build                      # apps/client/dist に出力（base=/formation-breaker/）

# 2) dist を gh-pages ブランチへ公開
cd apps/client/dist
cp index.html 404.html             # SPA 用フォールバック
touch .nojekyll                    # Jekyll 無効化（assets/ をそのまま配信）
rm -rf .git && git init -q && git checkout -q -b gh-pages
git add -A && git commit -q -m "deploy"
git push -f https://github.com/LifeGamer1192/formation-breaker.git gh-pages
rm -rf .git
cd ../../..
```

Pages は gh-pages ブランチ（path `/`）をソースに設定済み。push 後 1〜2分で反映される。

## 注意
- テーマ画像/アイコンは `assets/`（publicDir）→ dist にコピーされ `/formation-breaker/...` で配信。
- Supabase は未設定でも動作（クラウド機能のみ無効）。本番で使う場合は環境変数を設定。
- menu（一覧）: `lifegamer1192.github.io/menu.html` に Formation Breaker のカードを掲載済み。
