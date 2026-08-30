# 08 — AI Features

Scope AI narrowly. It is a feature of the paid tier, not the architecture of the
app, and every generated token that reaches a child needs to be safe, on-level,
and cheap.

## Sentence generation

The headline paid feature: use the word in a sentence.

**Generate per word, cache forever — not per request.** The word bank is fixed,
so a sentence generated once serves every user who ever sees that word. Cost
becomes a bounded one-time content expense rather than a per-user variable.

```
request sentence for (word, level)
   │
   ├─ cached row for (word_id, level)? ──► return it
   │
   └─ miss ──► LLM generate (n=3 candidates)
                 ├─ safety moderation
                 ├─ reading-level check
                 ├─ contains-the-word check (inflections allowed)
                 ├─ does-not-define-by-spelling check
                 └─ store + return
```

Generate the full bank ahead of launch and treat live generation as the
exception, used for user-uploaded words and for the paid "regenerate" control.

### Prompt constraints

Every generated sentence must:

- Contain the target word, in any inflected form
- Be at or below the target reading level (short clauses, common vocabulary
  around the target word — the *target* is the hard part, nothing else should be)
- Make the word's meaning inferable from context — this is a teaching sentence,
  not a filler sentence
- Contain no proper nouns, brands, or references that date
- Contain nothing violent, sexual, frightening, medical, or political
- Never spell the word out letter by letter, and never contain a homophone of it

Generate three candidates and pick the best by automated checks; fall back to the
curated sentence if none pass. Never ship an unvalidated generated sentence.

### Storage

```sql
create table generated_sentences (
  id          bigint generated always as identity primary key,
  word_id     bigint not null references words (id) on delete cascade,
  level       text not null,
  sentence    text not null,
  model       text not null,
  moderated_at timestamptz,
  approved    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (word_id, level, sentence)
);
```

Cached sentences get audio pre-generated the same way stock content does (doc
05), so the AI feature is also offline-capable.

## Upload enrichment

When a paid user imports a bare word list — which is what every import actually
is — the words have no definition, no part of speech, and no sentence. Without
enrichment the imported list cannot use the bee format at all, which makes
imports feel broken.

On import, for each word:

1. Look it up in the existing `words` table first — most school-list words are
   already there, and a hit costs nothing
2. On a miss, generate part of speech, a level-appropriate definition, a
   sentence, and IPA
3. Moderate
4. Synthesize audio (metered against the user's daily TTS allowance)
5. Mark the row `source = 'user'` so it never leaks into the shared bank

Deduplicating against the existing bank first is what keeps upload costs near
zero in practice.

## Photo / OCR import

The feature parents actually want: photograph the list sent home on Monday.

- `VNRecognizeTextRequest` (Vision) on device — free, private, no upload of a
  photo containing a child's name and classroom
- Present the extracted words for confirmation and editing before import; OCR on
  a photographed worksheet is never clean
- Strip anything that is not a word (headers, dates, the teacher's name, page
  numbers)
- Then run upload enrichment above

Doing OCR on device rather than server-side is both cheaper and materially better
for privacy, given what is likely to be in the frame.

## Moderation

Every piece of generated or user-supplied text passes moderation before it is
stored or spoken:

- A moderation API pass on generated sentences and on uploaded words
- A blocklist for slurs and profanity that does not rely on a third-party service
  being up
- Reject rather than sanitize — a partially censored sentence is worse than
  falling back to the curated one
- Log rejections with the input for review; a spike is a signal about either the
  prompt or an abusive user

Uploaded words are visible only to the uploading account. There is no path from a
user upload into the shared bank without human review.

## What not to build

- **AI-generated definitions as the primary source.** Hallucinated definitions in
  a learning app are a serious problem, and WordNet is right there. Use the LLM
  to *rewrite* a sourced definition to a reading level, not to invent one.
- **A chatbot tutor.** Open-ended chat with a child is a compliance and safety
  surface far out of proportion to its value here.
- **AI pronunciation scoring** in v1. Speech recognition on children's voices is
  unreliable enough to be actively discouraging.

## Cost control

- Cache-first on everything; the cache hit rate on stock content should exceed
  99% after launch
- Server-side entitlement check before any generation call (doc 03)
- Per-account daily caps, enforced in the Edge Function
- Cap output tokens hard — a sentence is 20 tokens, not 200
- Alert on daily spend crossing a threshold; a runaway loop in an import job is
  the realistic failure mode
