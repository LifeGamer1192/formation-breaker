import type { UltimateRuntime } from '@fb/sim-core'

// ─── 必殺技アイテム（消費・α12）─────────────────────────────────────
// 仕様書「必殺技アイテム」：所持していると戦闘中に消費して、隊のゲージとは無関係に
// 必殺技効果を発動できる。発動は ultItem コマンド（必殺技ランタイムを内包）で記録され
// リプレイ再現される。アイテムの個数は GameState.ultItems（defId→個数）で管理する。

export interface UltItemDef {
  id:    string
  name:  string
  icon:  string
  desc:  string
  ult:   UltimateRuntime   // 発動する必殺技ランタイム（gaugeMax/ultSpeed はゲージ非依存のため 0）
}

// gaugeMax=0 / ultSpeed=0：ゲージ管理を介さず即時発動するための明示値。
export const ULT_ITEMS: Record<string, UltItemDef> = {
  fireJar: {
    id: 'fireJar', name: '火炎の壺', icon: '🏺',
    desc: '最寄りの敵隊へ火の範囲ダメージ（攻撃力700・半径18）',
    ult: {
      id: 'item_fireJar', name: '火炎の壺', icon: '🏺', kind: 'aoeDamage',
      attr: 'fire', power: 700, range: 40, radius: 18, gaugeMax: 0, ultSpeed: 0,
    },
  },
  thunderJar: {
    id: 'thunderJar', name: '雷神の壺', icon: '⚱️',
    desc: '最寄りの敵隊へ雷の範囲ダメージ（攻撃力900・半径14）',
    ult: {
      id: 'item_thunderJar', name: '雷神の壺', icon: '⚱️', kind: 'aoeDamage',
      attr: 'thunder', power: 900, range: 40, radius: 14, gaugeMax: 0, ultSpeed: 0,
    },
  },
  warHorn: {
    id: 'warHorn', name: '進軍の角笛', icon: '📯',
    desc: '自隊の攻撃力+30%・攻撃速度+15%（10秒）',
    ult: {
      id: 'item_warHorn', name: '進軍の角笛', icon: '📯', kind: 'squadBuff',
      range: 0, radius: 0, gaugeMax: 0, ultSpeed: 0, durationTicks: 200,
      buffs: [
        { target: 'attack', op: 'mul', value: 30 },
        { target: 'attackSpeed', op: 'mul', value: 15 },
      ],
    },
  },
  healWater: {
    id: 'healWater', name: '治癒の聖水', icon: '💧',
    desc: '周囲（半径20）の味方全隊を1200回復（範囲回復・戦死者は蘇生しない）',
    ult: {
      id: 'item_healWater', name: '治癒の聖水', icon: '💧', kind: 'heal',
      power: 1200, range: 0, radius: 20, gaugeMax: 0, ultSpeed: 0,
    },
  },
  moatScroll: {
    id: 'moatScroll', name: '落とし穴の符', icon: '🕳️',
    desc: '最寄りの敵地点を堀に変え進路を妨害（半径14のマスを堀に）',
    ult: {
      id: 'item_moatScroll', name: '落とし穴の符', icon: '🕳️', kind: 'terrain',
      terrainType: 'moat', range: 40, radius: 14, gaugeMax: 0, ultSpeed: 0,
    },
  },
  thunderOil: {
    id: 'thunderOil', name: '雷の塗油', icon: '⚡',
    desc: '一定時間（12秒）、自隊の通常攻撃を雷属性に変える（弱点突き）',
    ult: {
      id: 'item_thunderOil', name: '雷の塗油', icon: '⚡', kind: 'attrChange',
      attr: 'thunder', range: 0, radius: 0, gaugeMax: 0, ultSpeed: 0, durationTicks: 240,
    },
  },
  elephantGong: {
    id: 'elephantGong', name: '象封じの銅鑼', icon: '🔔',
    desc: '最寄りの敵地点（半径35）で象を含む敵隊を5秒間移動不可にする',
    ult: {
      id: 'item_elephantGong', name: '象封じの銅鑼', icon: '🔔', kind: 'elephantDisable',
      range: 100, radius: 35, gaugeMax: 0, ultSpeed: 0, durationTicks: 100,
    },
  },
}

// defId → 発動する UltimateRuntime を解決
export function resolveUltItem(defId: string): UltimateRuntime | undefined {
  const def = ULT_ITEMS[defId]
  return def ? { ...def.ult } : undefined
}

// 初期所持（defId→個数）
export function makeInitialUltItems(): Record<string, number> {
  return { fireJar: 2, warHorn: 1, healWater: 1, moatScroll: 1, thunderOil: 1, elephantGong: 1 }
}
