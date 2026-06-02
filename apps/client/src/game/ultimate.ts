import type { UltimateRuntime } from '@fb/sim-core'

// ─── 必殺技カタログ（仕様書 必殺技データ）──────────────────────────
// 数値はプロトスケールに調整（本番準拠は α7）。象無効化は対象(象)未実装のため後続。

export interface UltCatalogEntry extends UltimateRuntime {
  desc: string
  perLevelPower?: number   // aoeDamage のレベル成長
}

// 数値は仕様書「必殺技データ」準拠（α11リスケール）
export const ULTIMATES: Record<string, UltCatalogEntry> = {
  raikou: {
    id: 'raikou', name: '雷光', icon: '🌩️', kind: 'aoeDamage',
    attr: 'thunder', power: 800, range: 25, radius: 15,
    ultSpeed: 2, gaugeMax: 100, perLevelPower: 20,
    desc: '指定地点に落雷。範囲内の敵に雷ダメージ（攻撃力800）',
  },
  senjin: {
    id: 'senjin', name: '戦陣鼓舞', icon: '📣', kind: 'squadBuff',
    range: 50, radius: 0, ultSpeed: 1, gaugeMax: 100, durationTicks: 200,
    buffs: [
      { target: 'attack', op: 'add', value: 50 },
      { target: 'attackSpeed', op: 'mul', value: 10 },
    ],
    desc: '一定時間、自隊の攻撃力+50・攻撃速度+10%',
  },
  iyashi: {
    id: 'iyashi', name: '癒しの光', icon: '💚', kind: 'heal',
    power: 1500, range: 50, radius: 0, ultSpeed: 1, gaugeMax: 100, perLevelPower: 50,
    desc: '自隊の生存兵を1500回復（戦死者は蘇生しない）',
  },
}

// ultId（兵士の持つ必殺技）→ 隊にセットする UltimateRuntime を解決
export function resolveUltimate(ultId: string | undefined, level = 1): UltimateRuntime | undefined {
  if (!ultId) return undefined
  const def = ULTIMATES[ultId]
  if (!def) return undefined
  const { desc: _desc, perLevelPower, ...rt } = def
  // power を持つ種別（aoeDamage=威力 / heal=回復量）はレベルで成長
  if ((rt.kind === 'aoeDamage' || rt.kind === 'heal') && perLevelPower) {
    return { ...rt, power: (rt.power ?? 0) + perLevelPower * (Math.max(1, level) - 1) }
  }
  return { ...rt }
}
