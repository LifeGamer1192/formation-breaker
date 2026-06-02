// ─── 経路探索（A*・α19: 堀塀の自動回避）─────────────────────────────
// 地形グリッド（各セル10×10ゲーム単位）上で移動不可セルを避ける経路を求める。
// 決定論: 近傍順・優先選択を固定（RNG不使用）。greedy回避(stepAvoiding)では解けない
// 壁の裏側への迂回を可能にする。

import type { Vec2 } from './geo'
import { dist } from './geo'
import type { TerrainType } from './geo'
import { isImpassable } from './geo'

const CELL = 10
// 座標→地形（movement.getTerrainAt と同一定義。循環import回避のためローカル）
const terrainAt = (p: Vec2, grid: TerrainType[][]): TerrainType => {
  const c = Math.min(grid[0].length - 1, Math.max(0, Math.floor(p.x / CELL)))
  const r = Math.min(grid.length - 1, Math.max(0, Math.floor(p.y / CELL)))
  return grid[r]?.[c] ?? 'plain'
}
const cellOf = (p: Vec2, grid: TerrainType[][]) => ({
  r: Math.min(grid.length - 1, Math.max(0, Math.floor(p.y / CELL))),
  c: Math.min(grid[0].length - 1, Math.max(0, Math.floor(p.x / CELL))),
})
const center = (r: number, c: number): Vec2 => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 })
const passable = (r: number, c: number, grid: TerrainType[][]) =>
  r >= 0 && r < grid.length && c >= 0 && c < grid[0].length && !isImpassable(grid[r][c])

// 8近傍（決定論のため固定順）。斜めは両隣が通行可のときのみ（角抜け禁止）
const NB: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]

// start→goal のセル中心列を返す（start/goalセルを含む）。到達不能なら []。
export function findPath(startPos: Vec2, goalPos: Vec2, grid: TerrainType[][]): Vec2[] {
  const s = cellOf(startPos, grid), g = cellOf(goalPos, grid)
  const cols = grid[0].length
  const key = (r: number, c: number) => r * cols + c
  const sk = key(s.r, s.c), gk = key(g.r, g.c)
  if (sk === gk) return [center(s.r, s.c)]
  if (!passable(g.r, g.c, grid)) return []   // 目的セルが壁

  const gScore = new Map<number, number>([[sk, 0]])
  const came = new Map<number, number>()
  const open: { k: number; r: number; c: number; f: number }[] = [{ k: sk, r: s.r, c: s.c, f: 0 }]
  const closed = new Set<number>()
  const h = (r: number, c: number) => Math.hypot(r - g.r, c - g.c)

  while (open.length) {
    // 最小 f を選択（同 f は先入れ優先＝決定論）
    let bi = 0
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i
    const cur = open.splice(bi, 1)[0]
    if (cur.k === gk) {
      // 経路復元
      const cells: number[] = [gk]
      let k = gk
      while (came.has(k)) { k = came.get(k)!; cells.push(k) }
      cells.reverse()
      return cells.map(kk => center(Math.floor(kk / cols), kk % cols))
    }
    closed.add(cur.k)
    for (const [dr, dc] of NB) {
      const nr = cur.r + dr, nc = cur.c + dc
      if (!passable(nr, nc, grid)) continue
      if (dr !== 0 && dc !== 0) {
        // 角抜け禁止: 斜め移動は直交2セルが両方通行可のときのみ
        if (!passable(cur.r + dr, cur.c, grid) || !passable(cur.r, cur.c + dc, grid)) continue
      }
      const nk = key(nr, nc)
      if (closed.has(nk)) continue
      const step = (dr !== 0 && dc !== 0) ? Math.SQRT2 : 1
      const tentative = (gScore.get(cur.k) ?? Infinity) + step
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        came.set(nk, cur.k)
        gScore.set(nk, tentative)
        const f = tentative + h(nr, nc)
        const ex = open.find(o => o.k === nk)
        if (ex) ex.f = f
        else open.push({ k: nk, r: nr, c: nc, f })
      }
    }
  }
  return []
}

// pos→target の直線が移動不可セルを横切るか（一定間隔でサンプル）
export function lineBlocked(a: Vec2, b: Vec2, grid: TerrainType[][]): boolean {
  const d = dist(a, b)
  const steps = Math.max(1, Math.ceil(d / 3))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    if (isImpassable(terrainAt(p, grid))) return true
  }
  return false
}

// 障害物を回避しつつ goal 方向へ speed 分進んだ次位置を返す（移動不可へは進入しない）。
// 直線が通れば直進、塞がれていれば A* 経路の見える最遠ノードへ向かう（LOSスムージング）。
export function steerToward(pos: Vec2, goal: Vec2, speed: number, grid: TerrainType[][]): Vec2 {
  const moved = (np: Vec2) => np.x !== pos.x || np.y !== pos.y
  const advance = (to: Vec2): Vec2 => {
    const d = dist(pos, to)
    if (d <= 1e-6) return pos
    const r = Math.min(1, speed / d)
    const np = { x: pos.x + (to.x - pos.x) * r, y: pos.y + (to.y - pos.y) * r }
    return isImpassable(terrainAt(np, grid)) ? pos : np
  }
  // 直線が通り、かつ実際に1歩進めるなら直進（壁の角を「かすめて」止まるのを避ける）
  if (!lineBlocked(pos, goal, grid)) { const np = advance(goal); if (moved(np)) return np }
  const path = findPath(pos, goal, grid)
  if (path.length < 2) return pos   // 到達不能 → 停止
  // 経路ノードを遠い順に試し、「実際に動ける」最遠ノードへ向かう（角を回り込む）
  for (let i = path.length - 1; i >= 1; i--) {
    if (!lineBlocked(pos, path[i], grid)) { const np = advance(path[i]); if (moved(np)) return np }
  }
  return pos
}
