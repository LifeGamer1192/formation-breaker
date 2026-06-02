// ─── PixiJS 戦場レンダラー（α10: Canvas2D から移行）──────────────────
// 既存 drawBattlefield と同一の見た目を Pixi の Graphics/Text で再現する。
import { Application, Container, Graphics, Text } from 'pixi.js'
import { buildUnitView, SQUAD_SPREAD } from '@fb/sim-core'
import type { WorldState, TerrainType } from '@fb/sim-core'

const SCALE = 6
const CW = 600
const CH = 360
const TILE_PX = 60
const UNIT_R = 9
const DEPLOY_MAX_X = 40

const TERRAIN_COLOR: Record<TerrainType, string> = {
  plain: '#4a7a30', forest: '#1e5010', mountain: '#7a7060', desert: '#b8922a', swamp: '#3a5a3a',
  water: '#1f3a78', river: '#2f63c8', highmount: '#4a4038', moat: '#243a5e', wall: '#4a4a4a',
}
const IMPASSABLE = new Set<TerrainType>(['water', 'river', 'highmount', 'moat', 'wall'])

const gx = (x: number) => x * SCALE
const gy = (y: number) => y * SCALE

export interface DmgFloat { id: string; x: number; y: number; dmg: number; age: number; side: 'ally' | 'enemy' }

export interface RenderState {
  world: WorldState
  selectedId: string | null
  isReplay: boolean
  isDeploy: boolean
  damageFloats: DmgFloat[]
}

export class PixiBattlefield {
  readonly app: Application
  private gfx = new Graphics()
  private textLayer = new Container()

  static async create(): Promise<PixiBattlefield> {
    const app = new Application()
    await app.init({ width: CW, height: CH, background: '#0a0a14', antialias: true })
    return new PixiBattlefield(app)
  }

  private constructor(app: Application) {
    this.app = app
    app.stage.addChild(this.gfx)
    app.stage.addChild(this.textLayer)
  }

  get canvas(): HTMLCanvasElement { return this.app.canvas }

  destroy() { this.app.destroy(true, { children: true, texture: true }) }

  private text(str: string, x: number, y: number, size: number, color: string, o?: { ax?: number; ay?: number; alpha?: number; bold?: boolean }) {
    const t = new Text({ text: str, style: { fontFamily: 'sans-serif', fontSize: size, fontWeight: o?.bold ? 'bold' : 'normal', fill: color } })
    t.x = x; t.y = y
    t.anchor.set(o?.ax ?? 0, o?.ay ?? 0)
    if (o?.alpha != null) t.alpha = o.alpha
    this.textLayer.addChild(t)
  }

  render(s: RenderState) {
    const { world, selectedId, isReplay, isDeploy, damageFloats } = s
    const g = this.gfx
    g.clear()
    for (const c of this.textLayer.removeChildren()) c.destroy()

    // ── 地形タイル ──
    const grid = world.terrain ?? []
    grid.forEach((row, ri) => row.forEach((terrain, ci) => {
      const x = ci * TILE_PX, y = ri * TILE_PX
      g.rect(x, y, TILE_PX, TILE_PX).fill(TERRAIN_COLOR[terrain]).stroke({ width: 1, color: '#000000', alpha: 0.09 })
      if (IMPASSABLE.has(terrain)) {
        for (let o = -TILE_PX; o < TILE_PX; o += 10) {
          g.moveTo(x + o, y).lineTo(x + o + TILE_PX, y + TILE_PX).stroke({ width: 2, color: '#ffffff', alpha: 0.2 })
        }
      }
    }))

    // ── 配置ゾーン ──
    if (isDeploy) {
      g.rect(0, 0, DEPLOY_MAX_X * SCALE, CH).fill({ color: '#48aaff', alpha: 0.09 })
      g.rect(2, 2, DEPLOY_MAX_X * SCALE - 4, CH - 4).stroke({ width: 2, color: '#48aaff', alpha: 0.53 })
      this.text('配置ゾーン（隊を選択→クリックで配置）', 6, 4, 11, '#9cf', { bold: true })
    }

    const view = buildUnitView(world)

    for (const squad of world.squads) {
      const aliveIds = squad.unitIds.filter(id => world.units[id]?.alive)
      if (aliveIds.length === 0) continue

      const px = gx(squad.pos.x), py = gy(squad.pos.y)
      const isAlly = squad.side === 'ally'
      const isFront = squad.name === '前衛'
      const baseColor = isAlly ? (isFront ? '#48aaff' : '#88ccff') : (isFront ? '#ff6644' : '#ff9977')
      const isSelected = squad.id === selectedId

      // 射程円（隊の攻撃リーチを一目で表示・生存兵の最大 range = 装備/アイテム加算込み）
      const reach = Math.max(0, ...aliveIds.map(id => world.units[id]?.range ?? 0))
      if (reach > 0) {
        const rPx = reach * SCALE
        const ringAlpha = isSelected ? 0.85 : 0.35
        // 破線リング（24分割の点線で「射程」と一目で分かる見た目に）
        const SEG = 24
        for (let i = 0; i < SEG; i += 2) {
          const a1 = (i / SEG) * Math.PI * 2
          const a2 = ((i + 1) / SEG) * Math.PI * 2
          g.moveTo(px + Math.cos(a1) * rPx, py + Math.sin(a1) * rPx)
            .arc(px, py, rPx, a1, a2)
            .stroke({ width: isSelected ? 2 : 1, color: baseColor, alpha: ringAlpha })
        }
        if (isSelected) g.circle(px, py, rPx).fill({ color: baseColor, alpha: 0.05 })
      }

      // 移動予定ライン
      if (squad.moveQueue.length > 0) {
        let prev = { x: px, y: py }
        for (const wp of squad.moveQueue) {
          const w = { x: gx(wp.x), y: gy(wp.y) }
          g.moveTo(prev.x, prev.y).lineTo(w.x, w.y).stroke({ width: 1.5, color: baseColor, alpha: 0.53 })
          g.moveTo(w.x - 5, w.y - 5).lineTo(w.x + 5, w.y + 5).stroke({ width: 2, color: baseColor, alpha: 0.53 })
          g.moveTo(w.x + 5, w.y - 5).lineTo(w.x - 5, w.y + 5).stroke({ width: 2, color: baseColor, alpha: 0.53 })
          prev = w
        }
      }

      // 向きゾーン扇形
      const zoneAlpha = isSelected ? 0.25 : 0.12
      const ZONE_R = SQUAD_SPREAD * SCALE + 24
      const arc = (a1: number, a2: number, c: string) => {
        g.moveTo(px, py).arc(px, py, ZONE_R, squad.facing + a1, squad.facing + a2).fill({ color: c, alpha: zoneAlpha })
      }
      arc(-Math.PI / 3, Math.PI / 3, '#44ff44')
      arc(Math.PI / 3, 2 * Math.PI / 3, '#ffff44')
      arc(-2 * Math.PI / 3, -Math.PI / 3, '#ffff44')
      arc(2 * Math.PI / 3, Math.PI, '#ff4444')
      arc(-Math.PI, -2 * Math.PI / 3, '#ff4444')

      // 中心クロスヘア
      const chA = isSelected ? 0.93 : 0.33
      g.moveTo(px - 5, py).lineTo(px + 5, py).stroke({ width: 1.5, color: baseColor, alpha: chA })
      g.moveTo(px, py - 5).lineTo(px, py + 5).stroke({ width: 1.5, color: baseColor, alpha: chA })

      // 各兵士
      aliveIds.forEach(unitId => {
        const unit = world.units[unitId]
        const uv = view.get(unitId)
        if (!uv) return
        const ux = gx(uv.pos.x), uy = gy(uv.pos.y)
        const facing = uv.facing
        const hpPct = Math.max(0, unit.hp / unit.maxHp)

        // 向き三角形
        const noseLen = UNIT_R + 7, baseW = 0.55
        g.poly([
          ux + Math.cos(facing) * noseLen, uy + Math.sin(facing) * noseLen,
          ux + Math.cos(facing + Math.PI / 2) * UNIT_R * baseW, uy + Math.sin(facing + Math.PI / 2) * UNIT_R * baseW,
          ux + Math.cos(facing - Math.PI / 2) * UNIT_R * baseW, uy + Math.sin(facing - Math.PI / 2) * UNIT_R * baseW,
        ]).fill({ color: '#ffffff', alpha: 0.87 })

        // 背面マーカー
        const back = facing + Math.PI
        g.moveTo(
          ux + Math.cos(back) * (UNIT_R - 1) + Math.cos(back + Math.PI / 2) * UNIT_R * 0.5,
          uy + Math.sin(back) * (UNIT_R - 1) + Math.sin(back + Math.PI / 2) * UNIT_R * 0.5,
        ).lineTo(
          ux + Math.cos(back) * (UNIT_R - 1) + Math.cos(back - Math.PI / 2) * UNIT_R * 0.5,
          uy + Math.sin(back) * (UNIT_R - 1) + Math.sin(back - Math.PI / 2) * UNIT_R * 0.5,
        ).stroke({ width: 2, color: '#ff3333', alpha: 0.67 })

        if (isSelected) g.circle(ux, uy, UNIT_R + 3).stroke({ width: 2, color: '#ffffff' })

        // 本体（HP連動アルファ）
        g.circle(ux, uy, UNIT_R).fill({ color: baseColor, alpha: (100 + hpPct * 155) / 255 }).stroke({ width: 1.5, color: baseColor })

        if (unit.isLeader) g.circle(ux, uy - UNIT_R - 3, 3).fill('#ffdd00')
        if (unit.isCommander) g.circle(ux, uy, UNIT_R + 5).stroke({ width: 2, color: '#ff3344' })
        if (unit.isElephant) this.text('🐘', ux, uy - UNIT_R - 7, 11, '#fff', { ax: 0.5, ay: 0.5 })  // α14: 象マーク

        // HPバー
        const barW = 14, barX = ux - barW / 2, barY = uy + UNIT_R + 3
        g.rect(barX, barY, barW, 2).fill('#333333')
        g.rect(barX, barY, barW * hpPct, 2).fill(hpPct > 0.5 ? '#44dd44' : hpPct > 0.25 ? '#ffaa00' : '#ff4444')
      })

      if (isSelected) this.text(`${isAlly ? '味' : '敵'}${squad.name}`, px, py - 4, 9, baseColor, { ax: 0.5, ay: 1, bold: true })
    }

    // ── ダメージフロート ──
    for (const f of damageFloats) {
      const alpha = Math.max(0, 1 - f.age / 20)
      const yOff = f.age * 0.4
      this.text(`-${f.dmg}`, gx(f.x) + 4, gy(f.y) - yOff, 12, f.side === 'ally' ? '#ffff55' : '#ff5555', { ax: 0.5, ay: 0.5, alpha, bold: true })
    }

    // ── リプレイ帯 ──
    if (isReplay) {
      g.rect(0, 0, CW, 22).fill({ color: '#ff8800', alpha: 0.27 })
      this.text('⏪ REPLAY', CW / 2, 11, 12, '#ffaa00', { ax: 0.5, ay: 0.5, bold: true })
    }
  }
}
