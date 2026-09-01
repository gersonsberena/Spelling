import { test } from "node:test";
import assert from "node:assert/strict";
import { audioTextHash, audioStoragePath } from "../lib/hash.mjs";

test("hash matches the audio_assets.text_hash check constraint", () => {
  assert.match(audioTextHash("v1", "necessary"), /^[0-9a-f]{64}$/);
});

test("same text and voice is stable", () => {
  assert.equal(audioTextHash("v1", "necessary"), audioTextHash("v1", "necessary"));
});

test("changing the text changes the hash — this is what prevents stale audio", () => {
  assert.notEqual(
    audioTextHash("v1", "Needed to achieve a result."),
    audioTextHash("v1", "Needed in order to achieve a result."),
  );
});

test("different voices do not collide", () => {
  assert.notEqual(audioTextHash("v1", "necessary"), audioTextHash("v2", "necessary"));
});

test("the voice/text separator is not forgeable by text alone", () => {
  // Without a delimiter, ("ab","c") and ("a","bc") would hash identically.
  assert.notEqual(audioTextHash("ab", "c"), audioTextHash("a", "bc"));
});

test("storage path shards on the hash prefix", () => {
  const h = audioTextHash("v1", "necessary");
  assert.equal(audioStoragePath("v1", h), `audio/v1/${h.slice(0, 2)}/${h}.m4a`);
});
