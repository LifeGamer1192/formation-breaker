import type { LayerEffect, UnitState } from '@fb/sim-core'

// ─── スキル定義（仕様書 L197-213）─────────────────────────────────────
// 4区分: 個人/リーダー/一般/隊。適用範囲: self/squad/leader。
// α4 では EffectiveStats（攻撃/防御/攻撃速度/最大HP）に効くスキルを実装。
// 射程/リジェネ/地形/移動など他系統への効果は後続で各システムに接続する。

export interface SkillDef {
  id:      string
  name:    string
  icon:    string
  layer:   'personalSkill' | 'leaderSkill' | 'generalSkill' | 'squadSkill'
  desc:    string
  effects: LayerEffect[]
}

function fx(
  layer: SkillDef['layer'],
  name: string,
  scope: 'self' | 'squad' | 'leader',
  parts: { target: LayerEffect['target']; op: LayerEffect['op']; value: number }[],
  untilTick?: number,
): LayerEffect[] {
  return parts.map(p => ({
    layer, target: p.target, op: p.op, value: p.value,
    priority: 0, source: name, scope, untilTick,
  }))
}

export const SKILLS: Record<string, SkillDef> = {
  // リーダースキル: リーダー任命中、隊全体に強力なバフ
  rally: {
    id: 'rally', name: '大将の号令', icon: '📯', layer: 'leaderSkill',
    desc: 'リーダー任命中、隊全体の攻撃力+10%・防御力+10%',
    effects: fx('leaderSkill', '大将の号令', 'squad', [
      { target: 'attack', op: 'mul', value: 10 },
      { target: 'defense', op: 'mul', value: 10 },
    ]),
  },
  // 隊スキル: 誰が持っていても、隊全体に常時
  ironwall: {
    id: 'ironwall', name: '鉄壁の構え', icon: '🛡️', layer: 'squadSkill',
    desc: '隊全体の防御力+15%（常時）',
    effects: fx('squadSkill', '鉄壁の構え', 'squad', [
      { target: 'defense', op: 'mul', value: 15 },
    ]),
  },
  // 一般スキル: 非リーダーの時だけ、隊全体を鼓舞
  warcry: {
    id: 'warcry', name: '血の鼓動', icon: '🥁', layer: 'generalSkill',
    desc: '非リーダー時、隊全体の攻撃力+12%',
    effects: fx('generalSkill', '血の鼓動', 'squad', [
      { target: 'attack', op: 'mul', value: 12 },
    ]),
  },
  // 個人スキル: 自分のみ、常時
  unyielding: {
    id: 'unyielding', name: '不屈', icon: '💪', layer: 'personalSkill',
    desc: '自分の最大HP+15%',
    effects: fx('personalSkill', '不屈', 'self', [
      { target: 'maxHp', op: 'mul', value: 15 },
    ]),
  },
  // 個人スキル: 自分のみ、戦闘開始10秒間（200tick）
  blitz: {
    id: 'blitz', name: '電光石火', icon: '⚡', layer: 'personalSkill',
    desc: '戦闘開始10秒間、自分の攻撃速度+25%',
    effects: fx('personalSkill', '電光石火', 'self', [
      { target: 'attackSpeed', op: 'mul', value: 25 },
    ], 200),
  },
}

// ─── 表示用: 兵士の保持スキルと現在の有効状態 ─────────────────────
export interface SkillMark { name: string; icon: string; active: boolean }

const LAYER_OF_SOURCE = new Map(
  Object.values(SKILLS).map(s => [s.name, { layer: s.layer, icon: s.icon }]),
)

// 兵士が持つスキルを source 単位で集約し、現在有効かを返す
export function skillMarks(unit: UnitState, tick: number): SkillMark[] {
  const seen = new Map<string, SkillMark>()
  for (const e of unit.skills) {
    const meta = LAYER_OF_SOURCE.get(e.source)
    if (!meta) continue // 装備など非スキルは除外
    if (seen.has(e.source)) continue
    let active = true
    if (meta.layer === 'leaderSkill'  && !unit.isLeader) active = false
    if (meta.layer === 'generalSkill' &&  unit.isLeader) active = false
    if (e.untilTick != null && tick >= e.untilTick) active = false
    seen.set(e.source, { name: e.source, icon: meta.icon, active })
  }
  return [...seen.values()]
}
