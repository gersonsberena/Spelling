// Runs as the Vercel build command. Writes config.js from environment
// variables so the real Supabase URL/anon key never has to be committed.
// For local dev, just copy config.example.js to config.js by hand instead.

import { writeFileSync } from "node:fs";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.");
  process.exit(1);
}

const contents = `window.SUPABASE_CONFIG = {\n  url: ${JSON.stringify(url)},\n  anonKey: ${JSON.stringify(anonKey)},\n};\n`;

writeFileSync("config.js", contents, "utf8");
console.log("Wrote config.js from environment variables.");
