/**
 * One-off generator for src/data/food-run-levels.json.
 * Builds each level from left-to-right "segments" (flat ground, pits,
 * steps, enemies, syrup, power-ups…) using a seeded RNG so the output is
 * stable. After generating, the JSON is the source of truth — hand-edit it
 * freely. Re-running this script OVERWRITES the JSON.
 *
 *   node scripts/generate-food-run-levels.mjs
 *
 * Fairness rules (player jump rise ≈ 111px, distance ≈ 178px):
 *   - platform rises ≤ 70px (still reachable during a sugar crash)
 *   - pit gaps ≤ 140px
 *   - syrup never sits right before a jump
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const GROUND_Y = 480;
const FOOD_GROUND_Y = 452;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORLDS = [
  {
    id: "picnic",
    foods: ["apple", "strawberry", "sandwich", "watermelon"],
    enemies: ["rotten"],
    best: { kind: "burger", name: "Super Mega Burger" },
    names: ["Picnic Time!", "Apple Hill", "Sandwich Steps", "Juice Pond Jump", "The Big Picnic"],
  },
  {
    id: "pizza",
    foods: ["pizza", "taco", "pancake", "apple"],
    enemies: ["rotten", "chili"],
    best: { kind: "pizza", name: "Ultimate Golden Pizza" },
    names: ["Pizza Palace Door", "Taco Tuesday", "Saucy Hops", "Spicy Chili Run", "Pizza Party"],
  },
  {
    id: "candy",
    foods: ["donut", "cupcake", "lollipop", "strawberry"],
    enemies: ["chili", "monster"],
    best: { kind: "cake", name: "Rainbow Tower Cake" },
    names: ["Candy Gate", "Donut Drop", "Sticky Syrup Swamp", "Cupcake Climb", "Candy Castle"],
  },
  {
    id: "icecream",
    foods: ["icecream", "sushi", "donut", "strawberry"],
    enemies: ["rotten", "chili", "monster"],
    best: { kind: "sundae", name: "Mega Ice Cream Sundae" },
    names: ["Ice Cream Beach", "Sprinkle Steps", "Sushi Surprise", "Milkshake Mountain", "The Grand Rainbow Feast"],
  },
];

function buildLevel(i) {
  const world = WORLDS[Math.floor(i / 5)];
  const within = i % 5;
  const r = rng(1000 + i * 7919);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];

  const lv = {
    name: world.names[within],
    world: world.id,
    width: 0,
    height: 540,
    spawn: { x: 60, y: GROUND_Y - 36 },
    platforms: [],
    pits: [],
    syrup: [],
    foods: [],
    energy: [],
    sugar: [],
    enemies: [],
    best: { x: 0, y: GROUND_Y, kind: world.best.kind, name: world.best.name },
  };

  let x = 0;
  let foodIdx = 0;
  const food = (fx, fy) => {
    lv.foods.push({ x: Math.round(fx), y: Math.round(fy), kind: world.foods[foodIdx++ % world.foods.length] });
  };
  const ground = (len) => {
    const last = lv.platforms[lv.platforms.length - 1];
    if (last && last.y === GROUND_Y && last.x + last.w === x) last.w += len;
    else lv.platforms.push({ x, y: GROUND_Y, w: len, h: 60 });
  };
  const pitW = () => Math.round(90 + Math.min(50, i * 3) + r() * 10);
  const enemySpeed = () => Math.round(50 + i * 4 + r() * 15);

  const seg = {
    flat(len = 300, n = 2) {
      ground(len);
      for (let k = 0; k < n; k++) food(x + ((k + 1) * len) / (n + 1), FOOD_GROUND_Y);
      x += len;
    },
    pit() {
      ground(60);
      x += 60;
      const g = pitW();
      lv.pits.push({ x, y: 500, w: g, h: 40 });
      food(x + g * 0.5, 392);
      x += g;
      ground(80);
      x += 80;
    },
    doublePit() {
      ground(60);
      x += 60;
      const g1 = pitW();
      lv.pits.push({ x, y: 500, w: g1, h: 40 });
      food(x + g1 / 2, 395);
      x += g1;
      ground(110);
      food(x + 55, FOOD_GROUND_Y);
      x += 110;
      const g2 = pitW();
      lv.pits.push({ x, y: 500, w: g2, h: 40 });
      food(x + g2 / 2, 395);
      x += g2;
      ground(80);
      x += 80;
    },
    steps() {
      const len = 560;
      ground(len);
      const p1 = { x: x + 90, y: 410, w: 130, h: 22 };
      const p2 = { x: x + 270, y: 340, w: 130, h: 22 };
      lv.platforms.push(p1, p2);
      food(p1.x + 65, p1.y - 28);
      food(p2.x + 40, p2.y - 28);
      food(p2.x + 95, p2.y - 28);
      food(x + 480, FOOD_GROUND_Y);
      x += len;
    },
    tower() {
      const len = 640;
      ground(len);
      const ps = [
        { x: x + 80, y: 410, w: 120, h: 22 },
        { x: x + 240, y: 340, w: 120, h: 22 },
        { x: x + 400, y: 270, w: 140, h: 22 },
      ];
      lv.platforms.push(...ps);
      food(ps[0].x + 60, ps[0].y - 28);
      food(ps[1].x + 60, ps[1].y - 28);
      food(ps[2].x + 45, ps[2].y - 28);
      food(ps[2].x + 100, ps[2].y - 28);
      x += len;
    },
    hop() {
      ground(60);
      x += 60;
      const gap = 110 + Math.min(20, i);
      const pw = 100;
      const total = gap * 2 + pw;
      lv.pits.push({ x, y: 500, w: total, h: 40 });
      const p = { x: x + gap, y: 430, w: pw, h: 22 };
      lv.platforms.push(p);
      food(p.x + pw / 2, p.y - 28);
      food(x + gap / 2, 380);
      food(x + gap + pw + gap / 2, 380);
      x += total;
      ground(80);
      x += 80;
    },
    enemy() {
      const len = 480;
      ground(len);
      const type = pick(world.enemies);
      lv.enemies.push({ type, x: x + len / 2, y: GROUND_Y, min: x + 90, max: x + len - 90, speed: enemySpeed() });
      food(x + 40, FOOD_GROUND_Y);
      food(x + len / 2, 395);
      food(x + len - 40, FOOD_GROUND_Y);
      x += len;
    },
    enemyHigh() {
      // enemy below + a safe platform route above
      const len = 560;
      ground(len);
      const type = pick(world.enemies);
      lv.enemies.push({ type, x: x + len / 2, y: GROUND_Y, min: x + 110, max: x + len - 110, speed: enemySpeed() });
      const p = { x: x + 170, y: 410, w: 220, h: 22 };
      lv.platforms.push(p);
      food(p.x + 50, p.y - 28);
      food(p.x + 170, p.y - 28);
      food(x + 40, FOOD_GROUND_Y);
      x += len;
    },
    syrup() {
      const len = 440;
      ground(len);
      lv.syrup.push({ x: x + 100, y: GROUND_Y - 8, w: 240, h: 10 });
      food(x + 160, FOOD_GROUND_Y);
      food(x + 280, FOOD_GROUND_Y);
      x += len;
    },
    energy() {
      ground(200);
      lv.energy.push({ x: x + 120, y: 450 });
      x += 200;
      // a long runway full of food to zoom through
      seg.flat(560, 4);
    },
    sugar() {
      const len = 380;
      ground(len);
      lv.sugar.push({ x: x + 200, y: 446 });
      food(x + 60, FOOD_GROUND_Y);
      x += len;
    },
  };

  // start
  seg.flat(360, 1);

  // difficulty-based segment pool
  const pool = ["flat", "pit", "steps", "enemy"];
  if (i >= 2) pool.push("hop", "syrup");
  if (i >= 4) pool.push("doublePit", "enemyHigh");
  if (i >= 6) pool.push("tower", "enemy");
  if (i >= 10) pool.push("doublePit", "hop", "enemyHigh");
  if (world.id === "candy") pool.push("syrup", "syrup");

  const count = 4 + Math.floor(i / 3);
  const plan = [];
  for (let k = 0; k < count; k++) {
    let s = pick(pool);
    // avoid repeating the same segment twice in a row
    if (plan.length && plan[plan.length - 1] === s) s = pick(pool);
    plan.push(s);
  }
  // power-ups from Ira's sketch
  if (i >= 1) plan.splice(1 + Math.floor(r() * (plan.length - 1)), 0, "energy");
  if (i >= 2) plan.splice(Math.floor(plan.length / 2) + 1, 0, "sugar");
  if (world.id === "candy" || i === 19) plan.splice(plan.length - 1, 0, "sugar");
  // first level is a gentle tutorial: flat → pit → sugar → steps → enemy
  if (i === 0) plan.splice(0, plan.length, "pit", "sugar", "steps", "enemy");

  for (const s of plan) seg[s]();

  // finish: the Best Food in the World on its pedestal
  ground(560);
  food(x + 80, FOOD_GROUND_Y);
  lv.best.x = x + 340;
  x += 560;
  lv.width = x;
  return lv;
}

const levels = [];
for (let i = 0; i < 20; i++) levels.push(buildLevel(i));
// final level: the Grand Rainbow Feast!
levels[19].best.kind = "feast";
levels[19].best.name = "The Grand Rainbow Feast";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "src", "data", "food-run-levels.json");
writeFileSync(out, JSON.stringify({ levels }, null, 2) + "\n");
console.log(
  `wrote ${levels.length} levels → ${out}\n` +
    levels.map((l, k) => `  ${k + 1}. ${l.name} (${l.world}) width=${l.width} foods=${l.foods.length} energy=${l.energy.length} sugar=${l.sugar.length} enemies=${l.enemies.length}`).join("\n"),
);
