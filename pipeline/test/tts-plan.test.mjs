import { test } from "node:test";
import assert from "node:assert/strict";
import { planClips, estimateCharacters } from "../tts/plan.mjs";
import { audioTextHash } from "../lib/hash.mjs";

const word = {
  id: 1, word: "necessary",
  definition: "Needed in order to achieve a result.",
  sample_sentence: "It is necessary to bring a coat.",
};

test("plans three clips per fully populated word", () => {
  const { clips } = planClips([word], "v1");
  assert.deepEqual(clips.map((c) => c.kind), ["word", "definition", "sentence"]);
});

test("skips clips whose text is already synthesized", () => {
  const existing = new Set([audioTextHash("v1", "necessary")]);
  const { clips, skipped } = planClips([word], "v1", existing);
  assert.equal(skipped, 1);
  assert.deepEqual(clips.map((c) => c.kind), ["definition", "sentence"]);
});

test("a second run after a full first run costs nothing", () => {
  const first = planClips([word], "v1");
  const hashes = new Set(first.clips.map((c) => c.text_hash));
  const second = planClips([word], "v1", hashes);
  assert.equal(second.clips.length, 0);
  assert.equal(second.skipped, 3);
});

test("editing a definition re-synthesizes only that clip", () => {
  const hashes = new Set(planClips([word], "v1").clips.map((c) => c.text_hash));
  const edited = { ...word, definition: "Required to achieve a result." };
  const { clips } = planClips([edited], "v1", hashes);
  assert.deepEqual(clips.map((c) => c.kind), ["definition"]);
});

test("a pronunciation override is what gets synthesized", () => {
  const { clips } = planClips(
    [{ id: 2, word: "epitome", tts_override_text: "eh-PIT-oh-mee" }],
    "v1",
  );
  assert.equal(clips[0].text, "eh-PIT-oh-mee");
  assert.equal(clips[0].text_hash, audioTextHash("v1", "eh-PIT-oh-mee"));
});

test("missing definition or sentence produces fewer clips, not empty ones", () => {
  const { clips } = planClips([{ id: 3, word: "cat" }], "v1");
  assert.equal(clips.length, 1);
  assert.equal(clips[0].kind, "word");
});

test("warns about a homophone with nothing to disambiguate it", () => {
  const { warnings } = planClips(
    [{ id: 4, word: "their", homophone_group: "there" }],
    "v1",
  );
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /homophone with no definition/);
});

test("different voices need their own clips", () => {
  const v1 = new Set(planClips([word], "v1").clips.map((c) => c.text_hash));
  assert.equal(planClips([word], "v2", v1).clips.length, 3);
});

test("storage paths are unique per clip", () => {
  const { clips } = planClips([word], "v1");
  assert.equal(new Set(clips.map((c) => c.storage_path)).size, clips.length);
});

test("character estimate sums the synthesized text", () => {
  const { clips } = planClips([word], "v1");
  assert.equal(estimateCharacters(clips), clips.reduce((n, c) => n + c.text.length, 0));
});
