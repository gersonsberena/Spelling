import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyAttempt, damerauLevenshtein } from "../lib/classifier.mjs";

const p = (target, submitted, ctx) => classifyAttempt(target, submitted, ctx).patterns;

test("a correct answer has no patterns", () => {
  const r = classifyAttempt("necessary", "necessary");
  assert.deepEqual(r, { correct: true, editDistance: 0, patterns: [] });
});

test("case and punctuation are ignored", () => {
  assert.ok(classifyAttempt("necessary", "  Necessary ").correct);
});

test("transposition costs one edit, not two", () => {
  assert.equal(damerauLevenshtein("freind", "friend"), 1);
});

test("detects transposition, and ie/ei when that is what was swapped", () => {
  assert.deepEqual(p("friend", "freind"), ["ie_ei", "transposition"]);
  assert.deepEqual(p("receive", "recieve"), ["ie_ei", "transposition"]);
});

test("detects a missing doubled consonant", () => {
  assert.ok(p("necessary", "necesary").includes("double_consonant"));
  assert.ok(p("accommodate", "acommodate").includes("double_consonant"));
});

test("detects an added doubled consonant", () => {
  assert.ok(p("separate", "sepparate").includes("double_consonant"));
});

test("detects suffix doubling failures", () => {
  assert.ok(p("running", "runing").includes("suffix_doubling"));
  assert.ok(p("beginning", "begining").includes("suffix_doubling"));
});

test("detects silent-e errors in both directions", () => {
  assert.ok(p("hope", "hop").includes("silent_e"));
  assert.ok(p("hoping", "hopeing").includes("silent_e"));
});

test("detects plural rule errors", () => {
  assert.ok(p("babies", "babys").includes("plural_rule"));
  assert.ok(p("knives", "knifs").includes("plural_rule"));
  assert.ok(p("potatoes", "potatos").includes("plural_rule"));
});

test("detects dropped silent letters", () => {
  assert.ok(p("knife", "nife").includes("silent_letter"));
  assert.ok(p("wrist", "rist").includes("silent_letter"));
  assert.ok(p("thumb", "thum").includes("silent_letter"));
});

test("detects prefix boundary errors", () => {
  assert.ok(p("misspell", "mispell").includes("prefix"));
  assert.ok(p("dissatisfied", "disatisfied").includes("prefix"));
});

test("separates vowel from consonant substitution", () => {
  assert.ok(p("separate", "seperate").includes("vowel_substitution"));
  assert.ok(p("advice", "advise").includes("consonant_substitution"));
});

test("phonetic spellings that no structural rule explains", () => {
  assert.ok(p("phone", "fone").includes("phonetic"));
});

test("a homophone is reported alone — the learner spelled a real word", () => {
  const r = classifyAttempt("there", "their", { homophones: ["their", "they're"] });
  assert.equal(r.correct, false);
  assert.deepEqual(r.patterns, ["homophone"]);
});

test("a fast adjacent-key slip is a typo, reported alone", () => {
  const r = classifyAttempt("cat", "car", { latencyMs: 400, medianLatencyMs: 4000 });
  assert.deepEqual(r.patterns, ["typo"]);
});

test("the same slip taken slowly is not excused as a typo", () => {
  const r = classifyAttempt("cat", "car", { latencyMs: 9000, medianLatencyMs: 4000 });
  assert.ok(!r.patterns.includes("typo"));
});

test("without latency data nothing is written off as a typo", () => {
  assert.ok(!p("cat", "car").includes("typo"));
});

test("a non-adjacent key is never a typo however fast", () => {
  const r = classifyAttempt("cat", "cap", { latencyMs: 100, medianLatencyMs: 5000 });
  assert.ok(!r.patterns.includes("typo"));
});

test("edit distance is reported for the FSRS Hard grade boundary", () => {
  assert.equal(classifyAttempt("necessary", "necesary").editDistance, 1);
  assert.ok(classifyAttempt("necessary", "nesesary").editDistance > 1);
});

test("output is always sorted", () => {
  for (const [t, s] of [["necessary","necesary"],["running","runing"],["friend","freind"]]) {
    const out = classifyAttempt(t, s).patterns;
    assert.deepEqual(out, [...out].sort());
  }
});
