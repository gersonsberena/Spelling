import { test } from "node:test";
import assert from "node:assert/strict";
import { Fsrs, Rating, grade, masteryFor, DEFAULT_PARAMETERS } from "../lib/fsrs.mjs";

const f = new Fsrs();

test("FSRS-6 shape: 21 parameters, decay from w[20]", () => {
  assert.equal(DEFAULT_PARAMETERS.length, 21);
  assert.equal(f.decay, -0.1542);
  assert.throws(() => new Fsrs([1, 2, 3]), /21 parameters/);
});

test("retrievability decays with elapsed time and is 1 at zero", () => {
  assert.equal(f.retrievability(10, 0), 1);
  assert.ok(f.retrievability(10, 30) < f.retrievability(10, 7));
});

test("a more stable memory decays more slowly", () => {
  assert.ok(f.retrievability(100, 30) > f.retrievability(5, 30));
});

test("better ratings give longer first intervals", () => {
  const iv = [1, 2, 3, 4].map((r) => f.review(null, r).intervalDays);
  assert.deepEqual(iv, [...iv].sort((a, b) => a - b), `${iv}`);
});

test("intervals are never shorter than a day", () => {
  for (const s of [0.001, 0.1, 1]) assert.ok(f.interval(s) >= 1);
});

test("difficulty stays within 1..10 under repeated extremes", () => {
  let st = f.review(null, Rating.Again);
  for (let i = 0; i < 50; i++) st = f.review(st, Rating.Again, 1);
  assert.ok(st.difficulty <= 10 && st.difficulty >= 1);
  for (let i = 0; i < 50; i++) st = f.review(st, Rating.Easy, 10);
  assert.ok(st.difficulty <= 10 && st.difficulty >= 1);
});

test("a lapse shortens the interval", () => {
  let st = f.review(null, Rating.Good);
  st = f.review(st, Rating.Good, 5);
  const before = st.intervalDays;
  const after = f.review(st, Rating.Again, 5).intervalDays;
  assert.ok(after < before, `${after} < ${before}`);
});

test("lapses are counted, reps always increment", () => {
  let st = f.review(null, Rating.Good);
  st = f.review(st, Rating.Again, 3);
  assert.equal(st.reps, 2);
  assert.equal(st.lapses, 1);
});

test("grade maps a near miss to Hard and a total miss to Again", () => {
  assert.equal(grade({ correct: false, editDistance: 1 }), Rating.Hard);
  assert.equal(grade({ correct: false, editDistance: 4 }), Rating.Again);
});

test("hints and heavy replaying downgrade a correct answer", () => {
  assert.equal(grade({ correct: true, hintsUsed: 1 }), Rating.Hard);
  assert.equal(grade({ correct: true, replays: 3 }), Rating.Hard);
  assert.equal(grade({ correct: true }), Rating.Good);
});

test("a fast clean answer earns Easy", () => {
  assert.equal(
    grade({ correct: true, latencyMs: 800, medianLatencyMs: 4000 }),
    Rating.Easy,
  );
});

test("mastery graduates and lapses back", () => {
  assert.equal(masteryFor({ intervalDays: 1, rating: 3, reps: 1 }), "learning");
  assert.equal(masteryFor({ intervalDays: 5, rating: 3, reps: 2 }), "review");
  assert.equal(masteryFor({ intervalDays: 40, rating: 3, reps: 5 }), "mastered");
  assert.equal(
    masteryFor({ intervalDays: 1, rating: 1, reps: 6, previous: "mastered" }),
    "lapsed",
  );
});

test("a word answered well repeatedly reaches mastered", () => {
  let st = f.review(null, Rating.Good);
  for (let i = 0; i < 6; i++) st = f.review(st, Rating.Good, st.intervalDays);
  assert.equal(st.mastery, "mastered");
  assert.ok(st.intervalDays >= 21, `${st.intervalDays}`);
});

test("same-day repeat uses short-term stability, not the elapsed-day path", () => {
  const st = f.review(null, Rating.Good);
  const same = f.review(st, Rating.Good, 0);
  assert.equal(same.stability, f.shortTermStability(st.stability, Rating.Good));
});
