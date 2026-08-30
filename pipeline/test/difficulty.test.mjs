import { test } from "node:test";
import assert from "node:assert/strict";
import { difficultyScore, assignBand, BANDS } from "../lib/difficulty.mjs";

test("common short words score lower than rare long ones", () => {
  const cat = difficultyScore({ word: "cat", frequencyRank: 800 });
  const obs = difficultyScore({ word: "obsequious", frequencyRank: 90000 });
  assert.ok(cat < obs, `${cat} < ${obs}`);
});

test("scores stay within 0..100", () => {
  for (const w of ["a", "cat", "necessary", "antidisestablishmentarianism"]) {
    for (const rank of [undefined, 1, 500, 100000]) {
      const s = difficultyScore({ word: w, frequencyRank: rank });
      assert.ok(s >= 0 && s <= 100, `${w}/${rank} -> ${s}`);
    }
  }
});

test("assigns a real band", () => {
  for (const w of ["cat", "necessary", "obsequious"]) {
    assert.ok(BANDS.includes(assignBand({ word: w })), w);
  }
});

test("easy words land in early bands, hard words in late ones", () => {
  const easy = assignBand({ word: "cat", frequencyRank: 300 });
  const hard = assignBand({ word: "obsequious", frequencyRank: 95000 });
  assert.ok(BANDS.indexOf(easy) < BANDS.indexOf(hard), `${easy} vs ${hard}`);
});

test("a published list assignment overrides the score", () => {
  assert.equal(
    assignBand({ word: "obsequious", frequencyRank: 99000, listBand: "grade_1_2" }),
    "grade_1_2",
  );
});

test("an unknown band is rejected rather than silently accepted", () => {
  assert.throws(() => assignBand({ word: "cat", listBand: "grade_99" }), /unknown band/);
});

test("missing frequency still produces a usable spread", () => {
  const easy = difficultyScore({ word: "cat" });
  const hard = difficultyScore({ word: "accommodate" });
  assert.ok(hard > easy, `${hard} > ${easy}`);
});
