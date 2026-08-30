import { test } from "node:test";
import assert from "node:assert/strict";
import { countSyllables } from "../lib/syllables.mjs";

test("counts common words", () => {
  const cases = [
    ["cat", 1], ["dog", 1], ["make", 1], ["hope", 1],
    ["apple", 2], ["table", 2], ["running", 2], ["little", 2],
    ["beautiful", 3], ["necessary", 4], ["separate", 3],
    ["occasion", 3], ["definitely", 4], ["accommodate", 4],
  ];
  for (const [word, expected] of cases) {
    assert.equal(countSyllables(word), expected, `${word}`);
  }
});

test("plural and past-tense endings are not their own syllable", () => {
  assert.equal(countSyllables("hopes"), 1);
  assert.equal(countSyllables("hoped"), 1);
});

test("but they are after a sibilant or t/d", () => {
  assert.equal(countSyllables("wishes"), 2);
  assert.equal(countSyllables("wanted"), 2);
});

test("never returns less than one for a real word", () => {
  for (const w of ["a", "I", "rhythm", "strengths"]) {
    assert.ok(countSyllables(w) >= 1, w);
  }
});

test("empty and non-alphabetic input", () => {
  assert.equal(countSyllables(""), 0);
  assert.equal(countSyllables("123"), 0);
});
