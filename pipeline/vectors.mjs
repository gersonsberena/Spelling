#!/usr/bin/env node
/**
 * Export the shared test vectors the Swift port is validated against.
 *
 *   npm run vectors
 *
 * The FSRS cases are the py-fsrs ground truth (see test/fixtures/README.md), so
 * the Swift implementation is checked against the real algorithm rather than
 * against our JavaScript. The end-to-end review sequences and the classifier
 * cases come from our implementations, which the JS suite covers.
 *
 * Both languages read the same file. If Swift and JavaScript ever disagree, one
 * of them is wrong — which is the point.
 */

import { writeFileSync, readFileSync } from "node:fs";
import { Fsrs, Rating, grade, masteryFor } from "./lib/fsrs.mjs";
import { classifyAttempt } from "./lib/classifier.mjs";

const OUT = new URL("../ios/SpellingCore/Tests/SpellingCoreTests/Vectors/", import.meta.url);
const reference = JSON.parse(
  readFileSync(new URL("./test/fixtures/fsrs-reference.json", import.meta.url), "utf8"),
);

const f = new Fsrs();

// Multi-review sequences, so the Swift port is checked on accumulated state and
// not only on single function calls.
const SEQUENCES = [
  { name: "steady good", ratings: [3, 3, 3, 3, 3, 3] },
  { name: "lapse then recover", ratings: [3, 3, 1, 3, 3, 3] },
  { name: "always again", ratings: [1, 1, 1, 1] },
  { name: "easy run", ratings: [4, 4, 4, 4] },
  { name: "mixed", ratings: [3, 2, 4, 1, 3, 2, 3] },
  { name: "same day repeats", ratings: [3, 3, 3], sameDay: true },
];

const sequences = SEQUENCES.map(({ name, ratings, sameDay }) => {
  let state = null;
  const steps = [];
  for (const rating of ratings) {
    const elapsed = sameDay ? 0 : (state?.intervalDays ?? 0);
    state = f.review(state, rating, elapsed);
    steps.push({
      rating,
      elapsedDays: elapsed,
      stability: state.stability,
      difficulty: state.difficulty,
      intervalDays: state.intervalDays,
      reps: state.reps,
      lapses: state.lapses,
      mastery: state.mastery,
    });
  }
  return { name, steps };
});

const GRADE_CASES = [
  { correct: false, editDistance: 4 },
  { correct: false, editDistance: 1 },
  { correct: true, hintsUsed: 1 },
  { correct: true, replays: 3 },
  { correct: true },
  { correct: true, latencyMs: 800, medianLatencyMs: 4000 },
  { correct: true, latencyMs: 3800, medianLatencyMs: 4000 },
];

const CLASSIFIER_CASES = [
  ["necessary", "necessary", {}],
  ["necessary", "necesary", {}],
  ["accommodate", "acommodate", {}],
  ["separate", "sepparate", {}],
  ["separate", "seperate", {}],
  ["running", "runing", {}],
  ["beginning", "begining", {}],
  ["friend", "freind", {}],
  ["receive", "recieve", {}],
  ["hope", "hop", {}],
  ["hoping", "hopeing", {}],
  ["babies", "babys", {}],
  ["knives", "knifs", {}],
  ["potatoes", "potatos", {}],
  ["knife", "nife", {}],
  ["wrist", "rist", {}],
  ["thumb", "thum", {}],
  ["misspell", "mispell", {}],
  ["dissatisfied", "disatisfied", {}],
  ["unnatural", "unatural", {}],
  ["advice", "advise", {}],
  ["phone", "fone", {}],
  ["there", "their", { homophones: ["their", "they're"] }],
  ["cat", "car", { latencyMs: 400, medianLatencyMs: 4000 }],
  ["cat", "car", { latencyMs: 9000, medianLatencyMs: 4000 }],
  ["cat", "car", {}],
  ["cat", "cap", { latencyMs: 100, medianLatencyMs: 5000 }],
  ["necessary", "  Necessary ", {}],
];

write("fsrs.json", {
  _generated: "npm run vectors — do not edit by hand",
  decay: f.decay,
  factor: f.factor,
  reference: reference.cases,
  sequences,
  grades: GRADE_CASES.map((input) => ({ input, rating: grade(input) })),
  mastery: [
    { intervalDays: 1, rating: 3, reps: 1, previous: null },
    { intervalDays: 5, rating: 3, reps: 2, previous: "learning" },
    { intervalDays: 40, rating: 3, reps: 5, previous: "review" },
    { intervalDays: 1, rating: 1, reps: 6, previous: "mastered" },
    { intervalDays: 1, rating: 1, reps: 2, previous: "learning" },
  ].map((input) => ({ input, mastery: masteryFor(input) })),
});

write("classifier.json", {
  _generated: "npm run vectors — do not edit by hand",
  cases: CLASSIFIER_CASES.map(([target, submitted, ctx]) => ({
    target,
    submitted,
    context: ctx,
    ...classifyAttempt(target, submitted, ctx),
  })),
});

function write(name, data) {
  const path = new URL(name, OUT);
  writeFileSync(path, `${JSON.stringify(data, null, 1)}\n`);
  console.error(`wrote ${name}`);
}
