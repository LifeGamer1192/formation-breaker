// ─── 兵士単位の位置・向きの一括計算（combat と描画で共有） ───────────────
// 各兵士の「実座標」と「向き」を tick 開始時に確定する。
// 向きは「最寄りの生存敵兵士を向く」。敵がいなければ所属隊の向きを継承。
// これにより攻撃側・守備側ともに兵士個別の向きで正面/側面/背面が判定される。

import type { WorldState } from './types'
import type { Vec2 } from './geo'
import { dist, angleTo } from './geo'
import { getUnitPos, getEffectiveFormation } from './formation'

export interface UnitView { pos: Vec2; facing: number }

export function buildUnitView(world: WorldState): Map<string, UnitView> {
  // Step1: 全生存兵士の実座標を確定
  const pos = new Map<string, Vec2>()
  const sideOf = new Map<string, 'ally' | 'enemy'>()
  for (const squad of world.squads) {
    const aliveIds = squad.unitIds.filter(id => world.units[id]?.alive)
    // 実効陣形（フォールダウン後）で配置 → 見た目とステ補正が一致する
    const effFormation = getEffectiveFormation(squad.formation, aliveIds.length)
    aliveIds.forEach((id, idx) => {
      pos.set(id, getUnitPos(squad.pos, squad.facing, effFormation, idx))
      sideOf.set(id, squad.side)
    })
  }

  // Step2: 各兵士の向きを「最寄りの生存敵兵士」基準で確定
  const view = new Map<string, UnitView>()
  for (const squad of world.squads) {
    const aliveIds = squad.unitIds.filter(id => world.units[id]?.alive)
    for (const id of aliveIds) {
      const myPos = pos.get(id)!
      let nearest: Vec2 | null = null
      let nearestD = Infinity
      for (const [otherId, otherPos] of pos) {
        if (sideOf.get(otherId) === squad.side) continue
        const d = dist(myPos, otherPos)
        if (d < nearestD) { nearestD = d; nearest = otherPos }
      }
      const facing = nearest ? angleTo(myPos, nearest) : squad.facing
      view.set(id, { pos: myPos, facing })
    }
  }
  return view
}
