import { test } from "node:test";
import assert from "node:assert/strict";
import { wordErrorPatterns } from "../lib/patterns.mjs";

const has = (word, pattern) => wordErrorPatterns(word).includes(pattern);

test("double consonants", () => {
  assert.ok(has("necessary", "double_consonant"));
  assert.ok(has("accommodate", "double_consonant"));
  assert.ok(!has("separate", "double_consonant"));
});

test("suffix doubling", () => {
  assert.ok(has("running", "suffix_doubling"));
  assert.ok(has("beginning", "suffix_doubling"));
  assert.ok(!has("reading", "suffix_doubling"));
});

test("ie / ei", () => {
  assert.ok(has("receive", "ie_ei"));
  assert.ok(has("believe", "ie_ei"));
  assert.ok(!has("because", "ie_ei"));
});

test("silent letters", () => {
  assert.ok(has("knife", "silent_letter"));
  assert.ok(has("wrist", "silent_letter"));
  assert.ok(has("thumb", "silent_letter"));
  assert.ok(has("rhythm", "silent_letter"));
  assert.ok(!has("table", "silent_letter"));
});

test("silent terminal e, but not consonant+le", () => {
  assert.ok(has("hope", "silent_e"));
  assert.ok(has("write", "silent_e"));
  assert.ok(!has("table", "silent_e"), "the -le in table is pronounced");
  assert.ok(!has("apple", "silent_e"));
});

test("prefix boundary doubling", () => {
  assert.ok(has("dissatisfied", "prefix"));
  assert.ok(has("misspell", "prefix"));
  assert.ok(has("unnatural", "prefix"));
});

test("plural rules", () => {
  assert.ok(has("babies", "plural_rule"));
  assert.ok(has("knives", "plural_rule"));
  assert.ok(has("potatoes", "plural_rule"));
});

test("consonant substitution risk", () => {
  assert.ok(has("phone", "consonant_substitution"));
  assert.ok(has("city", "consonant_substitution"));
  assert.ok(has("unique", "consonant_substitution"));
});

test("schwa-prone endings", () => {
  assert.ok(has("importance", "vowel_substitution"));
  assert.ok(has("dependent", "vowel_substitution"));
  assert.ok(has("calendar", "vowel_substitution"));
});

test("homophone flag comes from the group, not the spelling", () => {
  assert.ok(!wordErrorPatterns("their").includes("homophone"));
  assert.ok(wordErrorPatterns("their", { homophoneGroup: "there" }).includes("homophone"));
});

test("attempt-only categories never appear on a word", () => {
  const forbidden = ["phonetic", "transposition", "typo"];
  for (const w of ["necessary", "receive", "knife", "babies", "phone"]) {
    for (const f of forbidden) {
      assert.ok(!wordErrorPatterns(w).includes(f), `${w} / ${f}`);
    }
  }
});

test("output is sorted and deduplicated", () => {
  const p = wordErrorPatterns("accommodate");
  assert.deepEqual(p, [...new Set(p)].sort());
});
