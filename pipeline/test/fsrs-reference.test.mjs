import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Fsrs } from "../lib/fsrs.mjs";

/**
 * The port is only worth anything if it matches the real algorithm. These cases
 * come from running py-fsrs itself — see fixtures/README.md.
 */
const ref = JSON.parse(
  readFileSync(new URL("./fixtures/fsrs-reference.json", import.meta.url), "utf8"),
);
const f = new Fsrs();
const EPSILON = 1e-9;

test("decay and factor match the reference", () => {
  assert.ok(Math.abs(f.decay - ref.decay) < EPSILON);
  assert.ok(Math.abs(f.factor - ref.factor) < EPSILON);
});

test(`all ${ref.cases.length} reference cases match py-fsrs`, () => {
  for (const c of ref.cases) {
    let mine;
    switch (c.fn) {
      case "initial_stability": mine = f.initialStability(c.rating); break;
      case "initial_difficulty": mine = f.initialDifficulty(c.rating); break;
      case "retrievability": mine = f.retrievability(c.stability, c.elapsed); break;
      case "interval": mine = f.interval(c.stability); break;
      case "next_difficulty": mine = f.nextDifficulty(c.difficulty, c.rating); break;
      case "short_term_stability":
        mine = f.shortTermStability(c.stability, c.rating); break;
      case "next_stability":
        mine = f.nextStability(c.difficulty, c.stability, c.retrievability, c.rating);
        break;
      default:
        throw new Error(`unknown reference case: ${c.fn}`);
    }
    assert.ok(
      Math.abs(mine - c.v) < EPSILON,
      `${c.fn} ${JSON.stringify(c)}: got ${mine}, reference ${c.v}`,
    );
  }
});
