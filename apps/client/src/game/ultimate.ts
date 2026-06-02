import type { UltimateRuntime } from '@fb/sim-core'

// ─── 必殺技カタログ（仕様書 必殺技データ）──────────────────────────
// 数値はプロトスケールに調整（本番準拠は α7）。象無効化は対象(象)未実装のため後続。

export interface UltCatalogEntry extends UltimateRuntime {
  desc: string
  perLevelPower?: number   // aoeDamage のレベル成長
}

export const ULTIMATES: Record<string, UltCatalogEntry> = {
  raikou: {
    id: 'raikou', name: '雷光', icon: '🌩️', kind: 'aoeDamage',
    attr: 'thunder', power: 90, range: 60, radius: 18,
    ultSpeed: 1.6, gaugeMax: 100, perLevelPower: 5,
    desc: '最寄りの敵隊へ落雷。範囲内の敵に雷ダメージ',
  },
  senjin: {
    id: 'senjin', name: '戦陣鼓舞', icon: '📣', kind: 'squadBuff',
    range: 50, radius: 0, ultSpeed: 1.4, gaugeMax: 100, durationTicks: 200,
    buffs: [
      { target: 'attack', op: 'mul', value: 30 },
      { target: 'attackSpeed', op: 'mul', value: 10 },
    ],
    desc: '一定時間、自隊の攻撃力+30%・攻撃速度+10%',
  },
}

// ultId（兵士の持つ必殺技）→ 隊にセットする UltimateRuntime を解決
export function resolveUltimate(ultId: string | undefined, level = 1): UltimateRuntime | undefined {
  if (!ultId) return undefined
  const def = ULTIMATES[ultId]
  if (!def) return undefined
  const { desc: _desc, perLevelPower, ...rt } = def
  if (rt.kind === 'aoeDamage' && perLevelPower) {
    return { ...rt, power: (rt.power ?? 0) + perLevelPower * (Math.max(1, level) - 1) }
  }
  return { ...rt }
}
