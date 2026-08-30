import { test } from "node:test";
import assert from "node:assert/strict";
import { enrichWord } from "../lib/enrich.mjs";

const base = { word: "necessary", definition: "Needed.", sample_sentence: "It is necessary today." };

test("derives syllables, patterns, and the mask", () => {
  const { word } = enrichWord(base);
  assert.equal(word.syllables, 4);
  assert.ok(word.error_patterns.includes("double_consonant"));
  assert.equal(base.sample_sentence.slice(word.sentence_mask_start, word.sentence_mask_end), "necessary");
});

test("blank source fields become null, not empty strings", () => {
  const { word } = enrichWord({ word: "cat", part_of_speech: "  ", ipa: "" });
  assert.equal(word.part_of_speech, null);
  assert.equal(word.ipa, null);
});

test("a published band overrides the computed one", () => {
  assert.equal(enrichWord({ ...base, list_band: "grade_1_2" }).band, "grade_1_2");
});

test("warns when the target is missing from its sentence", () => {
  const { warnings } = enrichWord({ ...base, sample_sentence: "Nothing relevant here." });
  assert.ok(warnings.some((w) => /not found in its sample sentence/.test(w)));
});

test("flags a homophone that has no definition — it cannot be answered from audio", () => {
  const { warnings } = enrichWord({ word: "their", homophone_group: "there", definition: "" });
  assert.ok(warnings.some((w) => /HOMOPHONE WITHOUT A DEFINITION/.test(w)));
});

test("a homophone gets the homophone pattern", () => {
  const { word } = enrichWord({ word: "their", homophone_group: "there", definition: "Belonging to them." });
  assert.ok(word.error_patterns.includes("homophone"));
});

test("rejects a row with no word", () => {
  assert.throws(() => enrichWord({ word: "  " }), /no word/);
});
