// Q16.16 固定小数点: 実値 = n / 65536
// PoC#1 では体力・攻撃力は整数のまま使用。座標・速度・補正率に使用予定。
export type Fixed = number

const SCALE = 65536

export const fixed = {
  fromInt:  (n: number): Fixed => n * SCALE,
  fromFloat:(n: number): Fixed => Math.round(n * SCALE),
  toFloat:  (f: Fixed):  number => f / SCALE,
  add: (a: Fixed, b: Fixed): Fixed => (a + b) | 0,
  sub: (a: Fixed, b: Fixed): Fixed => (a - b) | 0,
  mul: (a: Fixed, b: Fixed): Fixed => Math.round(a * b / SCALE),
  div: (a: Fixed, b: Fixed): Fixed => Math.round(a * SCALE / b),
  floor:(f: Fixed): number => (f / SCALE) | 0,
}
