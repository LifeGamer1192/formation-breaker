import type { TechniqueRuntime } from '@fb/sim-core'

// ─── 技カタログ（仕様書 技データ）──────────────────────────────────
// 兵士ごとに0-10個。固有ゲージで自動発動。数値はプロトスケール調整。

export interface TechDef extends Omit<TechniqueRuntime, 'gauge' | 'enabled'> {
  desc: string
}

// 数値は新スケール（攻撃~200-300）に合わせた追撃・自己バフ
export const TECHNIQUES: Record<string, TechDef> = {
  throwBlade: {
    id: 'throwBlade', name: '投剣', icon: '🔪', kind: 'bonusAttack',
    attr: 'pierce', power: 180, range: 20, gaugeMax: 100, speed: 5, priority: 5,
    desc: '射程内の最寄り敵へ刺ダメージ（追撃）',
  },
  fireball: {
    id: 'fireball', name: '火炎弾', icon: '🔥', kind: 'bonusAttack',
    attr: 'fire', power: 220, range: 18, gaugeMax: 100, speed: 4, priority: 6,
    desc: '射程内の最寄り敵へ火ダメージ（追撃）',
  },
  warStance: {
    id: 'warStance', name: '猛りの型', icon: '💢', kind: 'selfBuff',
    gaugeMax: 100, speed: 4, priority: 3, durationTicks: 120,
    buffs: [{ target: 'attack', op: 'mul', value: 20 }],
    desc: '一定時間、自分の攻撃力+20%',
  },
}

// 技ID列 → ランタイム（開戦時 gauge0・有効）
export function makeTechniques(ids: string[]): TechniqueRuntime[] {
  return ids.map(id => {
    const d = TECHNIQUES[id]
    const { desc: _desc, ...rt } = d
    return { ...rt, gauge: 0, enabled: true }
  })
}
