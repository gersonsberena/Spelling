import { test } from "node:test";
import assert from "node:assert/strict";
import { findTarget, maskSentence } from "../lib/sentence.mjs";

test("finds the exact word", () => {
  const s = "It is necessary to bring a coat.";
  const t = findTarget(s, "necessary");
  assert.equal(s.slice(t.start, t.end), "necessary");
});

test("finds an inflected form", () => {
  const t = findTarget("She was running to the store.", "run");
  assert.equal(t.matched, "running");
});

test("finds a y -> ies plural", () => {
  const t = findTarget("The babies were asleep.", "baby");
  assert.equal(t.matched, "babies");
});

test("finds an f -> ves plural", () => {
  const t = findTarget("Both knives were sharp.", "knife");
  assert.equal(t.matched, "knives");
});

test("does not match inside a longer word", () => {
  assert.equal(findTarget("He was uncatchable.", "cat"), null);
});

test("returns null when the word is absent", () => {
  assert.equal(findTarget("Nothing here.", "necessary"), null);
});

test("masking hides the answer and preserves length", () => {
  const s = "It is necessary to bring a coat.";
  const t = findTarget(s, "necessary");
  const masked = maskSentence(s, t.start, t.end);
  assert.ok(!masked.includes("necessary"));
  assert.equal(masked.length, s.length);
  assert.equal(masked, "It is _________ to bring a coat.");
});
