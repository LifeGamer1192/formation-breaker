// ─── 向き判定（正面・側面・背面） ─────────────────────────────────────────
// 仕様書 L152: 攻撃側の位置と向き、守備側の位置と向きに応じて判定
// 仕様書 L94-95: 側面・背面補正は基本 0%〜-100%

import type { Vec2 } from './geo'
import { angleTo } from './geo'

export type FacingZone = 'front' | 'flank' | 'rear'

export const ZONE_LABEL: Record<FacingZone, string> = {
  front: '正面', flank: '側面', rear: '背面',
}

/**
 * 攻撃者が守備者の「正面・側面・背面」どこにいるかを返す。
 * targetFacing: 守備者の向き（進行/注目方向、ラジアン）
 * - 正面: ±60° 以内
 * - 側面: 60°〜120°
 * - 背面: >120°
 */
export function calcFacingZone(
  attackerPos: Vec2,
  targetPos:   Vec2,
  targetFacing: number,
): FacingZone {
  const angleToAttacker = angleTo(targetPos, attackerPos)
  let diff = angleToAttacker - targetFacing
  while (diff >  Math.PI) diff -= 2 * Math.PI
  while (diff < -Math.PI) diff += 2 * Math.PI
  const abs = Math.abs(diff)
  if (abs <= Math.PI / 3)      return 'front'
  if (abs <= 2 * Math.PI / 3)  return 'flank'
  return 'rear'
}
