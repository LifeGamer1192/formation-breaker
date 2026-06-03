// packages/sim-core/src/geo.ts
var IMPASSABLE = /* @__PURE__ */ new Set(["water", "river", "highmount", "moat", "wall"]);
function isImpassable(t) {
  return IMPASSABLE.has(t);
}
var TERRAIN_SPEED = {
  plain: { plain: 100, forest: 60, mountain: 50, desert: 70, swamp: 40, water: 0, river: 0, highmount: 0, moat: 0, wall: 0 },
  forest: { plain: 80, forest: 100, mountain: 60, desert: 60, swamp: 50, water: 0, river: 0, highmount: 0, moat: 0, wall: 0 },
  cavalry: { plain: 180, forest: 50, mountain: 40, desert: 130, swamp: 30, water: 0, river: 0, highmount: 0, moat: 0, wall: 0 }
};
function dist(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
function angleTo(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}
function stepToward(pos, target, speed) {
  const d = dist(pos, target);
  if (d <= speed) return { ...target };
  const r = speed / d;
  return { x: pos.x + (target.x - pos.x) * r, y: pos.y + (target.y - pos.y) * r };
}

// packages/sim-core/src/layers.ts
function calcEffectiveStats(base, effects) {
  const survivors = /* @__PURE__ */ new Map();
  for (const e of effects) {
    const key = `${e.layer}:${e.target}`;
    const prev = survivors.get(key);
    if (!prev || e.priority > prev.priority) survivors.set(key, e);
  }
  const adds = {};
  const muls = {};
  const sets = {};
  for (const e of survivors.values()) {
    if (e.op === "add") adds[e.target] = (adds[e.target] ?? 0) + e.value;
    if (e.op === "mul") muls[e.target] = (muls[e.target] ?? 0) + e.value;
    if (e.op === "set") {
      const prev = sets[e.target];
      if (!prev || e.priority > prev.priority) sets[e.target] = e;
    }
  }
  const result = { ...base };
  for (const [s, pct] of Object.entries(muls)) {
    result[s] = Math.round(result[s] * (1 + pct / 100));
  }
  for (const [s, v] of Object.entries(adds)) {
    result[s] = result[s] + v;
  }
  for (const [s, e] of Object.entries(sets)) {
    result[s] = e.value;
  }
  return result;
}

// packages/sim-core/src/formation.ts
var FORMATION_LABEL = {
  none: "\uFF08\u306A\u3057\uFF09",
  solo: "\u5358\u72EC",
  horizontal: "\u6A2A\u9663",
  column: "\u7E26\u5217\u9663",
  square: "\u65B9\u9663",
  circle: "\u5186\u9663",
  arrowhead: "\u96C1\u884C"
};
var FORMATION_DESC = {
  none: "\u52B9\u679C\u306A\u3057",
  solo: "1\u4EBA: ATK/SPD/DEF/\u79FB\u52D5 -10%",
  horizontal: "2-6\u4EBA: SPD +20%, DEF -20%",
  column: "2-6\u4EBA: \u79FB\u52D5 +30%",
  square: "4\u4EBA: DEF +30%, \u79FB\u52D5 -30%",
  circle: "4/6\u4EBA: DEF +30%, \u79FB\u52D5 -20%\uFF08\u80CC\u9762\u306B\u5F37\u3044\uFF09",
  arrowhead: "3/5\u4EBA: ATK +10%, DEF -10%, \u79FB\u52D5 +20%"
};
var FORMATION_CONDITION = {
  none: (n) => n >= 1,
  solo: (n) => n === 1,
  horizontal: (n) => n >= 2 && n <= 6,
  column: (n) => n >= 2 && n <= 6,
  square: (n) => n === 4,
  circle: (n) => n === 4 || n === 6,
  arrowhead: (n) => n === 3 || n === 5
};
var FORMATION_FALLDOWN = {
  none: "none",
  solo: "solo",
  horizontal: "solo",
  column: "solo",
  square: "horizontal",
  circle: "horizontal",
  arrowhead: "horizontal"
};
function getEffectiveFormation(formation, aliveCount) {
  let f = formation;
  for (let i = 0; i < 8; i++) {
    if (FORMATION_CONDITION[f](aliveCount)) return f;
    const next = FORMATION_FALLDOWN[f];
    if (next === f) return f;
    f = next;
  }
  return f;
}
var FORMATION_MOVE_MULT = {
  none: 1,
  solo: 0.9,
  // -10%
  horizontal: 1,
  // ±0
  column: 1.3,
  // +30%
  square: 0.7,
  // -30%
  circle: 0.8,
  // -20%
  arrowhead: 1.2
  // +20%
};
var fe = (es) => es.map((e) => ({ ...e, source: "formation" }));
var FORMATION_EFFECTS = {
  none: fe([]),
  solo: fe([
    { layer: "formation", target: "attack", op: "mul", value: -10, priority: 0 },
    { layer: "formation", target: "attackSpeed", op: "mul", value: -10, priority: 0 },
    { layer: "formation", target: "defense", op: "mul", value: -10, priority: 0 }
  ]),
  horizontal: fe([
    { layer: "formation", target: "attackSpeed", op: "mul", value: 20, priority: 0 },
    { layer: "formation", target: "defense", op: "mul", value: -20, priority: 0 }
  ]),
  column: fe([
    // moveSpeed +30% → PoC#3
  ]),
  square: fe([
    { layer: "formation", target: "defense", op: "mul", value: 30, priority: 0 }
    // moveSpeed -30% → PoC#3
  ]),
  circle: fe([
    { layer: "formation", target: "defense", op: "mul", value: 30, priority: 0 }
    // moveSpeed -20% → PoC#3
  ]),
  arrowhead: fe([
    { layer: "formation", target: "attack", op: "mul", value: 10, priority: 0 },
    { layer: "formation", target: "defense", op: "mul", value: -10, priority: 0 }
    // moveSpeed +20% → PoC#3
  ])
};
var SQUAD_SPREAD = 5;
var FORMATION_SLOTS = {
  none: [[0, 0], [-0.5, 0.5], [0.5, 0.5], [0, -0.5], [-0.5, -0.5], [0.5, -0.5]],
  solo: [[0, 0]],
  horizontal: [[0, 0], [-0.9, 0], [0.9, 0], [-1.8, 0], [1.8, 0], [0, 0.7]],
  column: [[0, 0.9], [0, 0], [0, -0.9], [0, -1.8], [0.5, 0.45], [-0.5, 0.45]],
  square: [[-0.55, 0.55], [0.55, 0.55], [-0.55, -0.55], [0.55, -0.55], [0, 0], [0, 1.1]],
  circle: [[0, 0.9], [0.78, 0.45], [0.78, -0.45], [0, -0.9], [-0.78, -0.45], [-0.78, 0.45]],
  arrowhead: [[0, 0.9], [-0.7, 0], [0.7, 0], [-1.4, -0.9], [1.4, -0.9], [0, -0.3]]
};
function getUnitPos(squadPos, squadFacing, formation, unitIndex) {
  const slots = FORMATION_SLOTS[formation] ?? [[0, 0]];
  const [lx, ly] = slots[unitIndex % slots.length];
  const sinF = Math.sin(squadFacing), cosF = Math.cos(squadFacing);
  return {
    x: squadPos.x + (-sinF * lx + cosF * ly) * SQUAD_SPREAD,
    y: squadPos.y + (cosF * lx + sinF * ly) * SQUAD_SPREAD
  };
}

// packages/sim-core/src/stats.ts
function unitBase(unit) {
  return {
    attack: unit.attack,
    defense: unit.defense,
    attackSpeed: unit.attackSpeed,
    maxHp: unit.maxHp
  };
}
function reaches(scope, src, target, leader) {
  if (scope === "squad") return true;
  if (scope === "leader") return leader != null && target.id === leader.id;
  return src.id === target.id;
}
function gatherSquadEffects(target, squadUnits, tick) {
  const leader = squadUnits.find((u) => u.isLeader);
  const out = [];
  for (const src of squadUnits) {
    for (const sk of src.skills) {
      if (sk.untilTick != null && tick >= sk.untilTick) continue;
      const scope = sk.scope ?? "self";
      switch (sk.layer) {
        case "personalSkill":
          if (src.id === target.id) out.push(sk);
          break;
        case "leaderSkill":
          if (src.isLeader && reaches(scope, src, target, leader)) out.push(sk);
          break;
        case "generalSkill":
          if (!src.isLeader && reaches(scope, src, target, leader)) out.push(sk);
          break;
        case "squadSkill":
          if (reaches(scope, src, target, leader)) out.push(sk);
          break;
        default:
          if (src.id === target.id) out.push(sk);
      }
    }
  }
  return out;
}
function getEffectiveStats(unit, squad, ctx = {}) {
  const formation = ctx.aliveCount == null ? squad.formation : getEffectiveFormation(squad.formation, ctx.aliveCount);
  const skillEffects = ctx.squadUnits ? gatherSquadEffects(unit, ctx.squadUnits, ctx.tick ?? 0) : unit.skills.filter((s) => {
    if (s.layer === "leaderSkill" && !unit.isLeader) return false;
    if (s.layer === "generalSkill" && unit.isLeader) return false;
    if (s.untilTick != null && (ctx.tick ?? 0) >= s.untilTick) return false;
    return true;
  });
  const effects = [...skillEffects, ...FORMATION_EFFECTS[formation]];
  return calcEffectiveStats(unitBase(unit), effects);
}

// packages/sim-core/src/facing.ts
var ZONE_LABEL = {
  front: "\u6B63\u9762",
  flank: "\u5074\u9762",
  rear: "\u80CC\u9762"
};
function calcFacingZone(attackerPos, targetPos, targetFacing) {
  const angleToAttacker = angleTo(targetPos, attackerPos);
  let diff = angleToAttacker - targetFacing;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const abs = Math.abs(diff);
  if (abs <= Math.PI / 3) return "front";
  if (abs <= 2 * Math.PI / 3) return "flank";
  return "rear";
}

// packages/sim-core/src/view.ts
function buildUnitView(world) {
  const pos = /* @__PURE__ */ new Map();
  const sideOf = /* @__PURE__ */ new Map();
  for (const squad of world.squads) {
    const aliveIds = squad.unitIds.filter((id) => world.units[id]?.alive);
    const effFormation = getEffectiveFormation(squad.formation, aliveIds.length);
    aliveIds.forEach((id, idx) => {
      pos.set(id, getUnitPos(squad.pos, squad.facing, effFormation, idx));
      sideOf.set(id, squad.side);
    });
  }
  const view = /* @__PURE__ */ new Map();
  for (const squad of world.squads) {
    const aliveIds = squad.unitIds.filter((id) => world.units[id]?.alive);
    for (const id of aliveIds) {
      const myPos = pos.get(id);
      let nearest = null;
      let nearestD = Infinity;
      for (const [otherId, otherPos] of pos) {
        if (sideOf.get(otherId) === squad.side) continue;
        const d = dist(myPos, otherPos);
        if (d < nearestD) {
          nearestD = d;
          nearest = otherPos;
        }
      }
      const facing = nearest ? angleTo(myPos, nearest) : squad.facing;
      view.set(id, { pos: myPos, facing });
    }
  }
  return view;
}

// packages/sim-core/src/attribute.ts
var ATTRIBUTES = {
  slash: { label: "\u65AC", icon: "\u2694\uFE0F", color: "#cccccc", kind: "physical" },
  pierce: { label: "\u523A", icon: "\u{1F5E1}\uFE0F", color: "#99ccff", kind: "physical" },
  strike: { label: "\u6BB4", icon: "\u{1F528}", color: "#ccaa88", kind: "physical" },
  fire: { label: "\u706B", icon: "\u{1F525}", color: "#ff7733", kind: "element" },
  thunder: { label: "\u96F7", icon: "\u26A1", color: "#ffdd00", kind: "element" }
};
var ATTR_IDS = ["slash", "pierce", "strike", "fire", "thunder"];
function armorDefFor(armorDef, attr) {
  return armorDef?.[attr] ?? 0;
}

// packages/sim-core/src/pathfind.ts
var CELL = 10;
var terrainAt = (p, grid) => {
  const c = Math.min(grid[0].length - 1, Math.max(0, Math.floor(p.x / CELL)));
  const r = Math.min(grid.length - 1, Math.max(0, Math.floor(p.y / CELL)));
  return grid[r]?.[c] ?? "plain";
};
var cellOf = (p, grid) => ({
  r: Math.min(grid.length - 1, Math.max(0, Math.floor(p.y / CELL))),
  c: Math.min(grid[0].length - 1, Math.max(0, Math.floor(p.x / CELL)))
});
var center = (r, c) => ({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 });
var passable = (r, c, grid) => r >= 0 && r < grid.length && c >= 0 && c < grid[0].length && !isImpassable(grid[r][c]);
var NB = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
function findPath(startPos, goalPos, grid) {
  const s = cellOf(startPos, grid), g = cellOf(goalPos, grid);
  const cols = grid[0].length;
  const key = (r, c) => r * cols + c;
  const sk = key(s.r, s.c), gk = key(g.r, g.c);
  if (sk === gk) return [center(s.r, s.c)];
  if (!passable(g.r, g.c, grid)) return [];
  const gScore = /* @__PURE__ */ new Map([[sk, 0]]);
  const came = /* @__PURE__ */ new Map();
  const open = [{ k: sk, r: s.r, c: s.c, f: 0 }];
  const closed = /* @__PURE__ */ new Set();
  const h = (r, c) => Math.hypot(r - g.r, c - g.c);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.k === gk) {
      const cells = [gk];
      let k = gk;
      while (came.has(k)) {
        k = came.get(k);
        cells.push(k);
      }
      cells.reverse();
      return cells.map((kk) => center(Math.floor(kk / cols), kk % cols));
    }
    closed.add(cur.k);
    for (const [dr, dc] of NB) {
      const nr = cur.r + dr, nc = cur.c + dc;
      if (!passable(nr, nc, grid)) continue;
      if (dr !== 0 && dc !== 0) {
        if (!passable(cur.r + dr, cur.c, grid) || !passable(cur.r, cur.c + dc, grid)) continue;
      }
      const nk = key(nr, nc);
      if (closed.has(nk)) continue;
      const step = dr !== 0 && dc !== 0 ? Math.SQRT2 : 1;
      const tentative = (gScore.get(cur.k) ?? Infinity) + step;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        came.set(nk, cur.k);
        gScore.set(nk, tentative);
        const f = tentative + h(nr, nc);
        const ex = open.find((o) => o.k === nk);
        if (ex) ex.f = f;
        else open.push({ k: nk, r: nr, c: nc, f });
      }
    }
  }
  return [];
}
function lineBlocked(a, b, grid) {
  const d = dist(a, b);
  const steps = Math.max(1, Math.ceil(d / 3));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    if (isImpassable(terrainAt(p, grid))) return true;
  }
  return false;
}
function steerToward(pos, goal, speed, grid) {
  const moved = (np) => np.x !== pos.x || np.y !== pos.y;
  const advance = (to) => {
    const d = dist(pos, to);
    if (d <= 1e-6) return pos;
    const r = Math.min(1, speed / d);
    const np = { x: pos.x + (to.x - pos.x) * r, y: pos.y + (to.y - pos.y) * r };
    return isImpassable(terrainAt(np, grid)) ? pos : np;
  };
  if (!lineBlocked(pos, goal, grid)) {
    const np = advance(goal);
    if (moved(np)) return np;
  }
  const path = findPath(pos, goal, grid);
  if (path.length < 2) return pos;
  for (let i = path.length - 1; i >= 1; i--) {
    if (!lineBlocked(pos, path[i], grid)) {
      const np = advance(path[i]);
      if (moved(np)) return np;
    }
  }
  return pos;
}

// packages/sim-core/src/movement.ts
var MOVE_SCALE = 1 / 3;
var DEMO_TERRAIN = [
  ["river", "river", "plain", "plain", "plain", "wall", "plain", "mountain", "plain", "plain"],
  // 行0: 障害物
  ["plain", "plain", "forest", "forest", "plain", "plain", "plain", "mountain", "plain", "plain"],
  // 行1: スポーン(開通)
  ["plain", "forest", "plain", "moat", "plain", "plain", "forest", "plain", "plain", "plain"],
  // 行2: 障害物
  ["plain", "plain", "plain", "plain", "plain", "mountain", "forest", "plain", "plain", "plain"],
  // 行3: スポーン(開通)
  ["plain", "plain", "plain", "plain", "plain", "plain", "wall", "plain", "plain", "plain"],
  // 行4: 障害物
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"]
  // 行5: スポーン(開通)
];
function getTerrainAt(pos, grid = DEMO_TERRAIN) {
  const col = Math.min(9, Math.max(0, Math.floor(pos.x / 10)));
  const row = Math.min(5, Math.max(0, Math.floor(pos.y / 10)));
  return grid[row]?.[col] ?? "plain";
}
function tickSquad(squad, allSquads, aliveCount, grid) {
  if (squad.moveQueue.length === 0) {
    const enemies = allSquads.filter((s) => s.side !== squad.side);
    if (enemies.length > 0) {
      const nearest = enemies.reduce(
        (a, b) => dist(squad.pos, a.pos) < dist(squad.pos, b.pos) ? a : b
      );
      if (dist(squad.pos, nearest.pos) < 30) {
        return { ...squad, facing: angleTo(squad.pos, nearest.pos) };
      }
    }
    return squad;
  }
  const target = squad.moveQueue[0];
  const terrain = getTerrainAt(squad.pos, grid);
  const pct = isImpassable(terrain) ? 100 : TERRAIN_SPEED[squad.movementType][terrain] ?? 100;
  const effFormation = getEffectiveFormation(squad.formation, aliveCount);
  const formMult = FORMATION_MOVE_MULT[effFormation];
  const effectiveSpeed = squad.moveSpeed * pct / 100 * formMult * MOVE_SCALE;
  const newPos = steerToward(squad.pos, target, effectiveSpeed, grid);
  const newFacing = newPos.x === squad.pos.x && newPos.y === squad.pos.y ? angleTo(squad.pos, target) : angleTo(squad.pos, newPos);
  const arrived = dist(newPos, target) < effectiveSpeed * 0.6;
  return {
    ...squad,
    pos: newPos,
    facing: newFacing,
    moveQueue: arrived ? squad.moveQueue.slice(1) : squad.moveQueue
  };
}
function fillUlt(squad) {
  if (!squad.ult) return squad;
  const next = Math.min(squad.ult.gaugeMax, (squad.ultGauge ?? 0) + squad.ult.ultSpeed);
  return next === squad.ultGauge ? squad : { ...squad, ultGauge: next };
}
var WALL_THRESHOLD = 60;
var WALL_RATE = 3;
var WALL_RANGE = 13;
function tickTerrainDestruction(world, grid) {
  const dmg = { ...world.terrainDmg ?? {} };
  const log = [];
  let newGrid = null;
  const allyPos = world.squads.filter((s) => s.side === "ally" && s.unitIds.some((id) => world.units[id]?.alive)).map((s) => s.pos);
  if (allyPos.length === 0) return { terrain: grid, terrainDmg: dmg, log };
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const t = grid[r][c];
      if (t !== "moat" && t !== "wall") continue;
      const center2 = { x: c * 10 + 5, y: r * 10 + 5 };
      if (!allyPos.some((p) => dist(p, center2) <= WALL_RANGE)) continue;
      const key = `${r},${c}`;
      const nd = (dmg[key] ?? 0) + WALL_RATE;
      dmg[key] = nd;
      if (nd >= WALL_THRESHOLD) {
        if (!newGrid) newGrid = grid.map((row) => [...row]);
        newGrid[r][c] = "plain";
        log.push(`[T${world.tick}] \u653B\u6483\u5074\u304C${t === "wall" ? "\u5840" : "\u5800"}\u3092\u7834\u58CA\u3057\u305F`);
      }
    }
  }
  return { terrain: newGrid ?? grid, terrainDmg: dmg, log };
}
function nearestEnemySquad(squad, allSquads, units) {
  const enemies = allSquads.filter((s) => s.side !== squad.side && s.unitIds.some((id) => units[id]?.alive));
  if (enemies.length === 0) return null;
  return enemies.reduce((a, b) => dist(squad.pos, a.pos) < dist(squad.pos, b.pos) ? a : b);
}
function squadRange(squad, units) {
  const ranges = squad.unitIds.map((id) => units[id]).filter((u) => u?.alive).map((u) => u.range);
  return ranges.length ? Math.max(...ranges) : 10;
}
function stepAvoiding(pos, angle, speed, grid) {
  const offsets = [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6, 2, -2];
  for (const off of offsets) {
    const a = angle + off;
    const np = { x: pos.x + Math.cos(a) * speed, y: pos.y + Math.sin(a) * speed };
    if (np.x < 2 || np.x > 98 || np.y < 2 || np.y > 58) continue;
    if (!isImpassable(getTerrainAt(np, grid))) return np;
  }
  return pos;
}
function aiMove(squad, allSquads, units, aliveCount, grid) {
  const target = nearestEnemySquad(squad, allSquads, units);
  if (!target) return squad;
  const d = dist(squad.pos, target.pos);
  const facing = angleTo(squad.pos, target.pos);
  const desired = Math.max(2, squadRange(squad, units) - 2);
  const terrain = getTerrainAt(squad.pos, grid);
  const pct = isImpassable(terrain) ? 100 : TERRAIN_SPEED[squad.movementType][terrain] ?? 100;
  const speed = squad.moveSpeed * pct / 100 * FORMATION_MOVE_MULT[getEffectiveFormation(squad.formation, aliveCount)] * MOVE_SCALE;
  if (d > desired + 0.5) {
    const np = steerToward(squad.pos, target.pos, Math.min(speed, d - desired), grid);
    const nf = np.x === squad.pos.x && np.y === squad.pos.y ? facing : angleTo(squad.pos, np);
    return { ...squad, pos: np, facing: nf };
  }
  if (squad.ai === "rear" && d < desired * 0.7) {
    return { ...squad, pos: stepAvoiding(squad.pos, facing + Math.PI, speed, grid), facing };
  }
  return { ...squad, facing };
}
var SEP_DIST = 7;
function applySeparation(squads, units) {
  const pos = squads.map((s) => ({ ...s.pos }));
  const alive = squads.map((s) => s.unitIds.some((id) => units[id]?.alive));
  for (let i = 0; i < squads.length; i++) {
    if (!alive[i]) continue;
    for (let j = i + 1; j < squads.length; j++) {
      if (!alive[j]) continue;
      const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
      const d = Math.hypot(dx, dy);
      if (d >= SEP_DIST) continue;
      const overlap = SEP_DIST - d;
      const ux = d > 0.01 ? dx / d : 1, uy = d > 0.01 ? dy / d : 0;
      const push = overlap * 0.25;
      pos[i].x -= ux * push;
      pos[i].y -= uy * push;
      pos[j].x += ux * push;
      pos[j].y += uy * push;
    }
  }
  return squads.map((s, i) => alive[i] ? { ...s, pos: { x: Math.min(98, Math.max(2, pos[i].x)), y: Math.min(58, Math.max(2, pos[i].y)) } } : s);
}
var FIELD_MX = 8;
var FIELD_MY = 8;
function clampToField(squads, units) {
  return squads.map((s) => {
    if (!s.unitIds.some((id) => units[id]?.alive)) return s;
    const x = Math.min(100 - FIELD_MX, Math.max(FIELD_MX, s.pos.x));
    const y = Math.min(60 - FIELD_MY, Math.max(FIELD_MY, s.pos.y));
    return x === s.pos.x && y === s.pos.y ? s : { ...s, pos: { x, y } };
  });
}
function tickMovement(world) {
  const grid = world.terrain ?? DEMO_TERRAIN;
  let squads = world.squads.map((s) => {
    const alive = s.unitIds.filter((id) => world.units[id]?.alive).length;
    if (alive === 0) return s;
    if (s.moveDisabledUntil != null && world.tick < s.moveDisabledUntil) return fillUlt(s);
    const moved = s.ai ? aiMove(s, world.squads, world.units, alive, grid) : tickSquad(s, world.squads, alive, grid);
    return fillUlt(moved);
  });
  squads = applySeparation(squads, world.units);
  squads = clampToField(squads, world.units);
  const dz = tickTerrainDestruction({ ...world, squads }, grid);
  return {
    ...world,
    squads,
    terrain: dz.terrain,
    terrainDmg: dz.terrainDmg,
    log: dz.log.length ? [...world.log, ...dz.log].slice(-200) : world.log
  };
}

// packages/sim-core/src/combat.ts
function wallBetween(a, b, grid) {
  const g = grid ?? DEMO_TERRAIN;
  const d = dist(a, b);
  const steps = Math.max(1, Math.ceil(d / 3));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (getTerrainAt({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, g) === "wall") return true;
  }
  return false;
}
function findSquad(world, unitId) {
  return world.squads.find((s) => s.unitIds.includes(unitId));
}
function squadAlive(squad, units) {
  return squad.unitIds.map((id) => units[id]).filter((u) => u?.alive);
}
function checkOutcome(units) {
  const us = Object.values(units);
  const sideDefeated = (side) => {
    const anyAlive = us.some((u) => u.alive && u.side === side);
    const cmd = us.find((u) => u.side === side && u.isCommander);
    if (cmd && !cmd.alive) return { defeated: true, byCommander: true };
    return { defeated: !anyAlive, byCommander: false };
  };
  const ally = sideDefeated("ally");
  const enemy = sideDefeated("enemy");
  if (!ally.defeated && !enemy.defeated) return { finished: false, winner: null, reason: null };
  if (enemy.defeated && !ally.defeated) return { finished: true, winner: "ally", reason: enemy.byCommander ? "commander" : "wipe" };
  return { finished: true, winner: "enemy", reason: ally.byCommander ? "commander" : "wipe" };
}
var LEARN_DURATION = 1200;
var SKILL_LAYERS = /* @__PURE__ */ new Set(["personalSkill", "generalSkill", "leaderSkill", "squadSkill"]);
function applyLearn(world, units, engaged) {
  for (const sl of world.squads) {
    const myUnits = sl.unitIds.map((id) => units[id]).filter((u) => u?.alive);
    if (!myUnits.some((u) => u.canLearn)) continue;
    const enemyId = engaged[sl.id];
    if (!enemyId) continue;
    const enemy = world.squads.find((s) => s.id === enemyId);
    if (!enemy) continue;
    const copied = [];
    for (const id of enemy.unitIds) {
      const eu = world.units[id];
      if (!eu?.alive) continue;
      for (const sk of eu.skills) {
        if (!SKILL_LAYERS.has(sk.layer)) continue;
        if (sk.source === "\u5B66\u3073") continue;
        if (sk.untilTick != null && world.tick >= sk.untilTick) continue;
        copied.push({
          layer: "squadSkill",
          target: sk.target,
          op: sk.op,
          value: sk.value,
          priority: sk.priority ?? 0,
          source: "\u5B66\u3073",
          scope: "squad",
          untilTick: world.tick + LEARN_DURATION
        });
      }
    }
    for (const u of myUnits) {
      units[u.id] = { ...units[u.id], skills: [...units[u.id].skills.filter((s) => s.source !== "\u5B66\u3073"), ...copied] };
    }
  }
}
function tickCombat(world, rng) {
  if (world.finished) return world;
  const view = buildUnitView(world);
  const units = {};
  for (const [k, v] of Object.entries(world.units)) units[k] = { ...v };
  const newLog = [];
  const attackEvents = [];
  const engaged = {};
  for (const unit of Object.values(units)) {
    if (!unit.alive) continue;
    const squad = findSquad(world, unit.id);
    const sa = squadAlive(squad, world.units);
    const eff = getEffectiveStats(unit, squad, { aliveCount: sa.length, squadUnits: sa, tick: world.tick });
    units[unit.id].gauge += eff.attackSpeed;
    if (unit.regen) units[unit.id].hp = Math.min(unit.maxHp, units[unit.id].hp + unit.regen);
  }
  for (const unit of Object.values(units)) {
    if (!unit.alive || units[unit.id].gauge < unit.gaugeMax) continue;
    const attView = view.get(unit.id);
    if (!attView) continue;
    const attackerPos = attView.pos;
    const attSquad = findSquad(world, unit.id);
    const attSa = squadAlive(attSquad, world.units);
    const attEff = getEffectiveStats(unit, attSquad, { aliveCount: attSa.length, squadUnits: attSa, tick: world.tick });
    const enemies = Object.values(units).filter((u) => {
      if (!u.alive || u.side === unit.side) return false;
      const tv = view.get(u.id);
      if (tv === void 0 || dist(attackerPos, tv.pos) > unit.range) return false;
      if (unit.side === "ally" && wallBetween(attackerPos, tv.pos, world.terrain)) return false;
      return true;
    });
    if (enemies.length === 0) continue;
    const target = enemies[Math.floor(rng() * enemies.length)];
    const targetView = view.get(target.id);
    const targetPos = targetView.pos;
    const defSquad = findSquad(world, target.id);
    const defSa = squadAlive(defSquad, world.units);
    const defEff = getEffectiveStats(target, defSquad, { aliveCount: defSa.length, squadUnits: defSa, tick: world.tick });
    const atkAttr = unit.attrOverride && world.tick < unit.attrOverride.untilTick ? unit.attrOverride.attr : unit.attackAttr ?? "slash";
    const attrDef = defEff.defense + armorDefFor(target.armorDef, atkAttr);
    const zone = calcFacingZone(attackerPos, targetPos, targetView.facing);
    const facingMod = zone === "front" ? 0 : zone === "flank" ? target.flankMod ?? -30 : target.rearMod ?? -50;
    const adjDef = Math.max(0, Math.round(attrDef * (1 + facingMod / 100)));
    const dmg = Math.max(1, attEff.attack - adjDef);
    const newHp = Math.max(0, target.hp - dmg);
    const icon = ATTRIBUTES[atkAttr].icon;
    const zoneStr = zone !== "front" ? `[${ZONE_LABEL[zone]} DEF${adjDef}]` : `[DEF${adjDef}]`;
    newLog.push(
      `[T${world.tick + 1}] ${unit.name}(${icon}ATK${attEff.attack}) \u2192 ${target.name}${zoneStr}: ${dmg}dmg (${target.hp}\u2192${newHp})`
    );
    units[target.id].hp = newHp;
    units[target.id].alive = newHp > 0;
    units[unit.id].gauge -= unit.gaugeMax;
    attackEvents.push({ from: unit.id, to: target.id, attr: atkAttr, ranged: unit.range >= 20, dmg });
    engaged[attSquad.id] = defSquad.id;
    engaged[defSquad.id] = attSquad.id;
  }
  applyLearn(world, units, engaged);
  for (const unit of Object.values(units)) {
    if (!unit.alive || !unit.techniques || unit.techniques.length === 0) continue;
    let techs = unit.techniques.map((t) => ({ ...t, gauge: Math.min(t.gaugeMax, t.gauge + t.speed) }));
    const ready = techs.filter((t) => t.enabled && t.gauge >= t.gaugeMax).sort((a, b) => b.priority - a.priority);
    for (const t of ready) {
      let fired = false;
      if (t.kind === "selfBuff") {
        const until = world.tick + (t.durationTicks ?? 100);
        const fx = (t.buffs ?? []).map((b) => ({
          layer: "technique",
          target: b.target,
          op: b.op,
          value: b.value,
          priority: 0,
          source: t.name,
          scope: "self",
          untilTick: until
        }));
        units[unit.id].skills = [...units[unit.id].skills, ...fx];
        newLog.push(`[T${world.tick + 1}] \u{1F3AF}${unit.name}: ${t.icon}${t.name}`);
        fired = true;
      } else if (t.kind === "bonusAttack") {
        const myPos = view.get(unit.id)?.pos;
        let best = null;
        if (myPos) {
          for (const u of Object.values(units)) {
            if (!u.alive || u.side === unit.side) continue;
            const tv = view.get(u.id);
            if (!tv) continue;
            const d = dist(myPos, tv.pos);
            if (d <= (t.range ?? 0) && (!best || d < best.d)) best = { id: u.id, d };
          }
        }
        if (best) {
          const tgt = units[best.id];
          const sq = world.squads.find((s) => s.unitIds.includes(tgt.id));
          const sa = squadAlive(sq, world.units);
          const defEff = getEffectiveStats(tgt, sq, { aliveCount: sa.length, squadUnits: sa, tick: world.tick });
          const attr = t.attr ?? "slash";
          const attrDef = defEff.defense + armorDefFor(tgt.armorDef, attr);
          const dmg = Math.max(1, (t.power ?? 0) - attrDef);
          units[best.id].hp = Math.max(0, tgt.hp - dmg);
          units[best.id].alive = units[best.id].hp > 0;
          newLog.push(`[T${world.tick + 1}] \u{1F3AF}${unit.name}: ${t.icon}${t.name} ${ATTRIBUTES[attr].icon}\u2192${tgt.name} ${dmg}dmg`);
          fired = true;
        }
      }
      if (fired) {
        techs = techs.map((x) => x.id === t.id ? { ...x, gauge: x.gauge - x.gaugeMax } : x);
        break;
      }
    }
    units[unit.id].techniques = techs;
  }
  for (const unit of Object.values(units)) {
    if (!unit.alive || !unit.isElephant || unit.left) continue;
    if (unit.hp * 2 <= unit.maxHp) {
      units[unit.id] = { ...units[unit.id], alive: false, left: true };
      newLog.push(`[T${world.tick + 1}] \u{1F418}${unit.name} \u306F\u534A\u6570\u3092\u5272\u308A\u6226\u7DDA\u96E2\u8131\u3057\u305F`);
    }
  }
  const outcome = checkOutcome(units);
  if (outcome.finished && outcome.winner) {
    const tag = outcome.reason === "commander" ? "\uFF08\u5927\u5C06\u8A0E\u3061\u53D6\u308A\uFF09" : "";
    newLog.push(outcome.winner === "ally" ? `\u{1F3C6} \u5473\u65B9\u306E\u52DD\u5229\uFF01${tag}` : `\u{1F480} \u6575\u306E\u52DD\u5229\uFF01${tag}`);
  }
  return {
    ...world,
    tick: world.tick + 1,
    units,
    log: [...world.log, ...newLog].slice(-200),
    finished: outcome.finished,
    winner: outcome.winner,
    attacks: attackEvents
  };
}
function executeUltimate(world, squadId, targetPos) {
  if (world.finished) return world;
  const caster = world.squads.find((s) => s.id === squadId);
  if (!caster || !caster.ult) return world;
  if ((caster.ultGauge ?? 0) < caster.ult.gaugeMax) return world;
  return applyUltEffect(world, caster, caster.ult, targetPos, true);
}
function executeUltimateWith(world, squadId, ult, targetPos) {
  if (world.finished) return world;
  const caster = world.squads.find((s) => s.id === squadId);
  if (!caster) return world;
  return applyUltEffect(world, caster, ult, targetPos, false);
}
function applyUltEffect(world, caster, ult, targetPos, resetGauge) {
  const view = buildUnitView(world);
  const units = {};
  for (const [k, v] of Object.entries(world.units)) units[k] = { ...v };
  const newLog = [];
  let newTerrain = world.terrain;
  let disable = null;
  const aliveOf = (sq) => sq.unitIds.map((id) => world.units[id]).filter((u) => u?.alive);
  if (ult.kind === "aoeDamage") {
    let center2 = targetPos;
    if (!center2) {
      const enemySquads = world.squads.filter((s) => s.side !== caster.side && aliveOf(s).length > 0);
      if (enemySquads.length === 0) return world;
      const near = enemySquads.reduce((a, b) => dist(caster.pos, a.pos) < dist(caster.pos, b.pos) ? a : b);
      center2 = near.pos;
    }
    if (dist(caster.pos, center2) > ult.range + ult.radius) return world;
    const attr = ult.attr ?? "fire";
    let hit = 0;
    for (const u of Object.values(units)) {
      if (!u.alive || u.side === caster.side) continue;
      const uv = view.get(u.id);
      if (!uv || dist(uv.pos, center2) > ult.radius) continue;
      const sq = world.squads.find((s) => s.unitIds.includes(u.id));
      const sa = aliveOf(sq);
      const defEff = getEffectiveStats(u, sq, { aliveCount: sa.length, squadUnits: sa, tick: world.tick });
      const attrDef = defEff.defense + armorDefFor(u.armorDef, attr);
      const dmg = Math.max(1, (ult.power ?? 0) - attrDef);
      units[u.id].hp = Math.max(0, u.hp - dmg);
      units[u.id].alive = units[u.id].hp > 0;
      hit++;
    }
    if (hit === 0) return world;
    newLog.push(`[T${world.tick}] \u2728${caster.name}: ${ult.icon}${ult.name}\uFF01 ${ATTRIBUTES[attr].icon}\u7BC4\u56F2${hit}\u4F53\u306B\u547D\u4E2D`);
  } else if (ult.kind === "squadBuff") {
    const until = world.tick + (ult.durationTicks ?? 200);
    const buffEffects = (ult.buffs ?? []).map((b) => ({
      layer: "ultimate",
      target: b.target,
      op: b.op,
      value: b.value,
      priority: 0,
      source: ult.name,
      scope: "self",
      untilTick: until
    }));
    for (const u of aliveOf(caster)) {
      units[u.id] = { ...units[u.id], skills: [...units[u.id].skills, ...buffEffects] };
    }
    newLog.push(`[T${world.tick}] \u2728${caster.name}: ${ult.icon}${ult.name}\uFF01 \u968A\u3092\u5F37\u5316\uFF08${((ult.durationTicks ?? 200) / 20).toFixed(0)}\u79D2\uFF09`);
  } else if (ult.kind === "heal") {
    const amount = Math.max(0, ult.power ?? 0);
    const targets = ult.radius > 0 ? world.squads.filter((s) => s.side === caster.side && dist(caster.pos, s.pos) <= ult.range + ult.radius) : [caster];
    let healed = 0;
    for (const sq of targets) {
      for (const u of aliveOf(sq)) {
        const before = units[u.id].hp;
        const after = Math.min(u.maxHp, before + amount);
        if (after > before) {
          units[u.id].hp = after;
          healed++;
        }
      }
    }
    if (healed === 0) return world;
    const scope = ult.radius > 0 ? "\u7BC4\u56F2\u56DE\u5FA9" : "\u81EA\u968A\u56DE\u5FA9";
    newLog.push(`[T${world.tick}] \u2728${caster.name}: ${ult.icon}${ult.name}\uFF01 ${scope}\uFF08${healed}\u4F53 +${amount}\uFF09`);
  } else if (ult.kind === "terrain") {
    let center2 = targetPos;
    if (!center2) {
      const enemySquads = world.squads.filter((s) => s.side !== caster.side && aliveOf(s).length > 0);
      if (enemySquads.length === 0) return world;
      center2 = enemySquads.reduce((a, b) => dist(caster.pos, a.pos) < dist(caster.pos, b.pos) ? a : b).pos;
    }
    if (dist(caster.pos, center2) > ult.range + ult.radius) return world;
    const type = ult.terrainType ?? "wall";
    const grid = (world.terrain ?? DEMO_TERRAIN).map((row) => [...row]);
    let changed = 0;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cx = c * 10 + 5, cy = r * 10 + 5;
        if (dist({ x: cx, y: cy }, center2) <= ult.radius && grid[r][c] !== type) {
          grid[r][c] = type;
          changed++;
        }
      }
    }
    if (changed === 0) return world;
    newTerrain = grid;
    newLog.push(`[T${world.tick}] \u2728${caster.name}: ${ult.icon}${ult.name}\uFF01 \u5730\u5F62\u3092${type}\u3078\uFF08${changed}\u30DE\u30B9\uFF09`);
  } else if (ult.kind === "attrChange") {
    const attr = ult.attr ?? "fire";
    const until = world.tick + (ult.durationTicks ?? 200);
    for (const u of aliveOf(caster)) {
      units[u.id] = { ...units[u.id], attrOverride: { attr, untilTick: until } };
    }
    newLog.push(`[T${world.tick}] \u2728${caster.name}: ${ult.icon}${ult.name}\uFF01 \u653B\u6483\u5C5E\u6027\u2192${ATTRIBUTES[attr].icon}\uFF08${((ult.durationTicks ?? 200) / 20).toFixed(0)}\u79D2\uFF09`);
  } else if (ult.kind === "elephantDisable") {
    let center2 = targetPos;
    if (!center2) {
      const enemySquads = world.squads.filter((s) => s.side !== caster.side && aliveOf(s).length > 0);
      if (enemySquads.length === 0) return world;
      center2 = enemySquads.reduce((a, b) => dist(caster.pos, a.pos) < dist(caster.pos, b.pos) ? a : b).pos;
    }
    if (dist(caster.pos, center2) > ult.range + ult.radius) return world;
    const ids = /* @__PURE__ */ new Set();
    for (const s of world.squads) {
      if (s.side === caster.side) continue;
      if (dist(center2, s.pos) > ult.radius) continue;
      if (!s.unitIds.some((id) => world.units[id]?.alive && world.units[id]?.isElephant)) continue;
      ids.add(s.id);
    }
    if (ids.size === 0) return world;
    disable = { ids, until: world.tick + (ult.durationTicks ?? 100) };
    newLog.push(`[T${world.tick}] \u2728${caster.name}: ${ult.icon}${ult.name}\uFF01 \u8C61${ids.size}\u968A\u3092\u79FB\u52D5\u4E0D\u53EF\uFF08${((ult.durationTicks ?? 100) / 20).toFixed(0)}\u79D2\uFF09`);
  }
  const squads = world.squads.map((s) => {
    let ns = s;
    if (resetGauge && s.id === caster.id) ns = { ...ns, ultGauge: 0 };
    if (disable && disable.ids.has(s.id)) ns = { ...ns, moveDisabledUntil: disable.until };
    return ns;
  });
  const outcome = checkOutcome(units);
  if (outcome.finished && outcome.winner) {
    const tag = outcome.reason === "commander" ? "\uFF08\u5927\u5C06\u8A0E\u3061\u53D6\u308A\uFF09" : "";
    newLog.push(outcome.winner === "ally" ? `\u{1F3C6} \u5473\u65B9\u306E\u52DD\u5229\uFF01${tag}` : `\u{1F480} \u6575\u306E\u52DD\u5229\uFF01${tag}`);
  }
  return { ...world, units, squads, terrain: newTerrain, log: [...world.log, ...newLog].slice(-200), finished: outcome.finished, winner: outcome.winner };
}

// packages/sim-core/src/command.ts
function applyCommand(world, cmd) {
  switch (cmd.type) {
    case "moveSet":
      return { ...world, squads: world.squads.map((s) => s.id === cmd.squadId ? { ...s, moveQueue: [...cmd.waypoints] } : s) };
    case "moveAppend":
      return { ...world, squads: world.squads.map((s) => s.id === cmd.squadId ? { ...s, moveQueue: [...s.moveQueue, cmd.waypoint] } : s) };
    case "moveCancel":
      return { ...world, squads: world.squads.map((s) => s.id === cmd.squadId ? { ...s, moveQueue: [] } : s) };
    case "formation":
      return { ...world, squads: world.squads.map((s) => s.id === cmd.squadId ? { ...s, formation: cmd.formation } : s) };
    case "ultimate":
      return executeUltimate(world, cmd.squadId, cmd.targetPos);
    case "ultItem":
      return executeUltimateWith(world, cmd.squadId, cmd.ult, cmd.targetPos);
    case "technique": {
      const u = world.units[cmd.unitId];
      if (!u || !u.techniques) return world;
      return { ...world, units: { ...world.units, [cmd.unitId]: {
        ...u,
        techniques: u.techniques.map((t) => t.id === cmd.techId ? { ...t, enabled: cmd.enabled } : t)
      } } };
    }
  }
}

// packages/sim-core/src/fixed.ts
var SCALE = 65536;
var fixed = {
  fromInt: (n) => n * SCALE,
  fromFloat: (n) => Math.round(n * SCALE),
  toFloat: (f) => f / SCALE,
  add: (a, b) => a + b | 0,
  sub: (a, b) => a - b | 0,
  mul: (a, b) => Math.round(a * b / SCALE),
  div: (a, b) => Math.round(a * SCALE / b),
  floor: (f) => f / SCALE | 0
};

// packages/sim-core/src/prng.ts
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = s + 1831565813 >>> 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// packages/sim-core/src/replay.ts
function stepWorld(world, commands, rng) {
  let w = world;
  for (const cmd of commands) if (cmd.tick === w.tick) w = applyCommand(w, cmd);
  w = tickMovement(w);
  w = tickCombat(w, rng);
  return w;
}
function runReplay(initialWorld, replay, maxTicks) {
  const rng = mulberry32(replay.seed);
  const limit = maxTicks ?? replay.tickCount;
  let w = initialWorld;
  for (let i = 0; i < limit && !w.finished; i++) {
    const cmds = replay.commands.filter((c) => c.tick === w.tick);
    w = stepWorld(w, cmds, rng);
  }
  return w;
}
function verifyReplay(initialWorld, replay, claimedWinner) {
  for (const c of replay.commands) {
    if (typeof c.tick !== "number" || c.tick < 0 || c.tick > replay.tickCount) {
      return { valid: false, actualWinner: null, actualTick: 0, reason: `\u30B3\u30DE\u30F3\u30C9tick\u304C\u7BC4\u56F2\u5916: ${c.tick}` };
    }
  }
  const final = runReplay(initialWorld, replay);
  const valid = final.winner === claimedWinner;
  return {
    valid,
    actualWinner: final.winner,
    actualTick: final.tick,
    reason: valid ? void 0 : `\u52DD\u8005\u4E0D\u4E00\u81F4: \u4E3B\u5F35=${claimedWinner} / \u518D\u751F=${final.winner}`
  };
}
export {
  ATTRIBUTES,
  ATTR_IDS,
  DEMO_TERRAIN,
  FORMATION_CONDITION,
  FORMATION_DESC,
  FORMATION_EFFECTS,
  FORMATION_FALLDOWN,
  FORMATION_LABEL,
  FORMATION_MOVE_MULT,
  FORMATION_SLOTS,
  IMPASSABLE,
  MOVE_SCALE,
  SQUAD_SPREAD,
  TERRAIN_SPEED,
  ZONE_LABEL,
  angleTo,
  applyCommand,
  armorDefFor,
  buildUnitView,
  calcEffectiveStats,
  calcFacingZone,
  dist,
  executeUltimate,
  executeUltimateWith,
  findPath,
  fixed,
  getEffectiveFormation,
  getEffectiveStats,
  getTerrainAt,
  getUnitPos,
  isImpassable,
  lineBlocked,
  mulberry32,
  randInt,
  runReplay,
  steerToward,
  stepToward,
  stepWorld,
  tickCombat,
  tickMovement,
  verifyReplay
};
