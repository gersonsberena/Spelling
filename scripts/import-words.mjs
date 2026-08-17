// One-time import: reads the CSV word bank and upserts it into Supabase.
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import-words
//
// Requires the service role key (not the anon key) because RLS only grants
// the anon client select/update, not insert — see supabase/migration.sql.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

// supabase-js always spins up a realtime client, which needs a global
// WebSocket implementation -- Node 20 doesn't have one built in (Node 22+
// does). We don't use realtime here, but the constructor still requires it.
import WebSocketImpl from "ws";
if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocketImpl;
}

const DEFAULT_CSV_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "wordlist.csv"
);
const CSV_PATH = process.env.WORDS_CSV_PATH || DEFAULT_CSV_PATH;

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const csvText = readFileSync(CSV_PATH, "utf8");
const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });

console.log(`Parsed ${rows.length} rows from ${CSV_PATH}`);

const wordsPayload = rows.map((row) => ({
  word: row.word,
  part_of_speech: row.part_of_speech,
  definition: row.definition,
  sample_sentence: row.sample_sentence || null,
  grade_level: row.grade_level ? parseInt(row.grade_level, 10) : null,
  source: row.source || null,
}));

const BATCH_SIZE = 200;

for (let i = 0; i < wordsPayload.length; i += BATCH_SIZE) {
  const batch = wordsPayload.slice(i, i + BATCH_SIZE);
  const { data, error } = await supabase
    .from("words")
    .upsert(batch, { onConflict: "word" })
    .select("id, word");

  if (error) {
    console.error(`Failed to upsert batch starting at row ${i}:`, error.message);
    process.exit(1);
  }

  const statsPayload = data.map((w) => ({ word_id: w.id }));
  const { error: statsError } = await supabase
    .from("word_stats")
    .upsert(statsPayload, { onConflict: "word_id", ignoreDuplicates: true });

  if (statsError) {
    console.error(`Failed to seed word_stats for batch starting at row ${i}:`, statsError.message);
    process.exit(1);
  }

  console.log(`Imported ${Math.min(i + BATCH_SIZE, wordsPayload.length)} / ${wordsPayload.length}`);
}

console.log("Done.");
