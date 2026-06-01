// ─── デザイントークン（全画面共通） ───────────────────────────────────────
export const C = {
  // Background
  bg:      '#0a0a14',    // ルート背景（最背面）
  panel:   '#0d0d1a',    // パネル背景
  card:    '#1a1a2e',    // カード通常背景
  cardHi:  '#2a2a4a',    // カード選択・ホバー背景

  // Text
  text:    '#ddd',       // 通常テキスト
  sub:     '#888',       // サブテキスト
  muted:   '#555',       // ミュートテキスト

  // Team & Accent
  ally:    '#48aaff',    // 味方アクセント（水色）
  enemy:   '#ff6644',    // 敵アクセント（橙赤）
  gold:    '#ffcc00',    // ゴールド・リーダー
  green:   '#4caf50',    // 成功・グリーン
  warn:    '#fa0',       // 警告・アンバー
  danger:  '#f44',       // 危険・レッド

  // Canvas specific
  terrain: {
    plain:   '#4a7a30',
    forest:  '#1e5010',
    mountain:'#7a7060',
    desert:  '#b8922a',
    swamp:   '#3a5a3a',
  },
} as const
