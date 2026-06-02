// ─── 実効ステータス計算（描画・戦闘両方から呼ばれる） ──────────────────
import type { UnitState, SquadState } from './types'
import type { LayerEffect, EffectiveStats, EffectScope } from './layers'
import { calcEffectiveStats } from './layers'
import { FORMATION_EFFECTS, getEffectiveFormation } from './formation'

function unitBase(unit: UnitState): EffectiveStats {
  return {
    attack:      unit.attack,
    defense:     unit.defense,
    attackSpeed: unit.attackSpeed,
    maxHp:       unit.maxHp,
  }
}

// スキルが source から target に届くか（適用範囲）
function reaches(scope: EffectScope, src: UnitState, target: UnitState, leader: UnitState | undefined): boolean {
  if (scope === 'squad')  return true
  if (scope === 'leader') return leader != null && target.id === leader.id
  return src.id === target.id // self
}

/**
 * 隊全体のスキル効果を集約し、target に届くものだけ返す（仕様書 L197-213）。
 *   個人スキル: 自分のみ
 *   リーダースキル: source がリーダーの時、自分（=リーダー）のみ
 *   一般スキル: source が非リーダーの時、scope に従って届く
 *   隊スキル: source がリーダー/一般どちらでも、scope に従って届く
 *   装備その他: source 自身（self）
 * 時限条件（untilTick）が切れた効果は除外。
 */
function gatherSquadEffects(target: UnitState, squadUnits: UnitState[], tick: number): LayerEffect[] {
  const leader = squadUnits.find(u => u.isLeader)
  const out: LayerEffect[] = []
  for (const src of squadUnits) {
    for (const sk of src.skills) {
      if (sk.untilTick != null && tick >= sk.untilTick) continue
      const scope = sk.scope ?? 'self'
      switch (sk.layer) {
        case 'personalSkill': // 個人: 常時、自分のみ
          if (src.id === target.id) out.push(sk)
          break
        case 'leaderSkill':   // リーダー任命中のみ有効。届く範囲は scope に従う（例: 大将の号令=隊全体）
          if (src.isLeader && reaches(scope, src, target, leader)) out.push(sk)
          break
        case 'generalSkill':  // 非リーダー時のみ有効。scope に従う
          if (!src.isLeader && reaches(scope, src, target, leader)) out.push(sk)
          break
        case 'squadSkill':    // 常時有効。scope に従う
          if (reaches(scope, src, target, leader)) out.push(sk)
          break
        default: // equipment / ultimate / technique / base 等は self
          if (src.id === target.id) out.push(sk)
      }
    }
  }
  return out
}

export interface EffContext {
  aliveCount?: number       // 実効陣形（フォールダウン）判定用の生存数
  squadUnits?: UnitState[]  // 同一隊の生存ユニット（隊/リーダー宛スキルの集約用）
  tick?:       number       // 時限スキルの判定用
}

/**
 * 実効ステータスを返す。
 * - aliveCount: 人数条件に応じた実効陣形（フォールダウン後）の補正を適用
 * - squadUnits: 渡すと隊全体のスキルを適用範囲に従って集約（一般/隊スキルが隊に届く）
 * - tick: 時限スキル（untilTick）の判定
 * いずれも省略時は単体・選択陣形で計算（後方互換）。
 */
export function getEffectiveStats(unit: UnitState, squad: SquadState, ctx: EffContext = {}): EffectiveStats {
  const formation = ctx.aliveCount == null
    ? squad.formation
    : getEffectiveFormation(squad.formation, ctx.aliveCount)

  const skillEffects = ctx.squadUnits
    ? gatherSquadEffects(unit, ctx.squadUnits, ctx.tick ?? 0)
    : unit.skills.filter(s => {
        // 後方互換: 単体計算時は従来の leader/general フィルタのみ
        if (s.layer === 'leaderSkill'  && !unit.isLeader) return false
        if (s.layer === 'generalSkill' &&  unit.isLeader) return false
        if (s.untilTick != null && (ctx.tick ?? 0) >= s.untilTick) return false
        return true
      })

  const effects = [...skillEffects, ...FORMATION_EFFECTS[formation]]
  return calcEffectiveStats(unitBase(unit), effects)
}
