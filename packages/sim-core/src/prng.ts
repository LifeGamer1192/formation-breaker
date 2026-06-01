// mulberry32 シード付き疑似乱数生成器
// Math.random() の代わりに使用し、再現性を保証する
export type Prng = () => number

export function mulberry32(seed: number): Prng {
  let s = seed >>> 0
  return (): number => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randInt(rng: Prng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}
