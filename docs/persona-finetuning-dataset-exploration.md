# Persona Fine-Tuning Dataset Exploration

This note profiles the Discord archive as a candidate source for fine-tuning the
Metame/Metacrat lowering pipeline.

## Pipeline Target

The live architecture should not fine-tune a model to directly impersonate from
raw chat history.

The training shape should stay aligned with Weksa:

1. Persona state and current situation produce interlingua intent.
2. Persona state references a culture/subculture stack.
3. Weksa lowers interlingua through that culture stack into a flavored
   utterance.

Useful datasets therefore split into two families:

- Persona intent extraction: current context plus Persona state projection to
  interlingua intent.
- Weksa lowering: interlingua plus culture stack to actual utterance.

Direct `context -> utterance` rows can be used as a baseline or critic set, but
they should not become the canonical architecture.

## Corpus Snapshot

Profiled archive:

`E:/Projects/VoidBot/.voidbot/rag/messages.json`

Author:

`113785782975594501`

Cutoff:

`2025-01-01T00:00:00Z`

Current aggregate counts:

- archive messages: 40,657
- usable text messages: 39,508
- authored Metacrat messages: 19,385
- authored Metacrat messages before 2025: 18,049
- crude pre-2025 casual candidates: 16,499
- pre-2025 authored messages with recent same-channel context: 16,530
- adjacent reply-to-other rows: 7,894
- adjacent self-continuation rows: 8,636

Length distribution for authored Metacrat messages:

- p10: 14 chars
- p25: 30 chars
- median: 56 chars
- p75: 101 chars
- p90: 166 chars

Adjacent candidate length classes:

- short: 11,430
- medium: 4,535
- long: 565

The corpus is large enough for held-out evaluation splits. It is also uneven:
2020 and 2021 dominate the pre-2025 archive.

## Dominant Channels

Top adjacent candidate channels:

- `general`: 6,286
- `development`: 2,911
- `narrative`: 2,169
- `management`: 1,103
- `website`: 753
- `soundtrack`: 437
- `gamedesign`: 433
- `programming`: 408
- `prose`: 320
- `politics`: 291
- `pics`: 273
- `advertising`: 115

These should become strata, not one blended dataset. A single mixed fine-tune
will learn that legal explanations, horny little design jokes, political
argument, and casual encouragement all belong in the same response slot. That
is how the soup gets teeth.

## Candidate Row Types

For Weksa lowering:

```yaml
schema_version: weksa.finetune.lowering_row.v0
row_id:
split:
target_message_id:
target_text:
interlingua_intent:
culture_stack_refs: []
target_overlay_refs: []
context_window:
  before: []
  after: []
labels:
  channel:
  year:
  length_class:
  speech_act:
  register:
  reply_to_other:
```

For Persona intent extraction:

```yaml
schema_version: weksa.finetune.persona_interlingua_row.v0
row_id:
split:
persona_state_ref:
projected_context_ref:
current_situation:
target_message_id:
derived_interlingua:
derivation:
  reviewed:
  model:
  evidence_refs: []
```

The target utterance should be hidden from the Persona-intent generator during
inference. For training, target utterance may be used to derive a reviewed
interlingua label, but that label must be marked as derived from answer-key
surface evidence.

## Split Policy

Recommended first split:

- train: 2018-2021
- validation: early/mid 2022
- test: late 2022 plus selected hand-reviewed fixtures
- quarantine: 2023-2026 until the current post-2025 voice target is deliberate

Also reserve channel-level holdouts:

- one casual/social channel
- one technical channel
- one political/management channel

This catches overfitting to one room's register.

## Filters

Start with conservative row filters:

- target author is Metacrat
- target timestamp before 2025
- target is not deleted
- target is not a bot prompt
- target text length between 3 and 220 chars for casual lowering
- same-channel prior context exists within 60 minutes
- exclude pure URLs, code blocks, and attachment-only rows
- retain but label profanity, mentions, quotes, and markdown emphasis

Do not discard long messages globally. Keep them in a separate explanatory-prose
slice.

## Next Work

1. Build an exporter that writes JSONL rows without leaking private Persona
   projection into git.
2. Add labelers for speech act, register, channel stratum, and culture-stack
   refs.
3. Use a model-assisted pass to derive interlingua labels from held-out target
   utterances, then sample-review before training.
4. Fine-tune or train adapters separately for Persona intent extraction and
   Weksa lowering.
5. Keep a frozen golf set where answer-key utterances are redacted from all
   culture/profile prompt material.

Reproduce the aggregate profile:

```powershell
node scripts/profile-metame-finetune-dataset.mjs
```

## Swarm Exploration

Use the swarm explorer to chase high-loss moments instead of uniform random
examples:

```powershell
node scripts/run-metame-swarm-explorer.mjs --agents 4 --seed metame-scout
node scripts/run-metame-swarm-explorer.mjs --real --agents 4 --seed metame-scout
```

The default mode is a dry run. Real mode runs Codex workers:

1. select one timeline candidate per agent using underexplored strata, feature
   novelty, prior loss, and seeded jitter
2. run each Face normally against its assigned scenario
3. run an Interpreter pass that converts the Face output to Weksa interlingua
4. lower that interlingua with Weksa and score against the hidden utterance
5. run an optimizer pass over high-loss outputs
6. rerun the same scenarios once per agent after optimization

Artifacts are written under `.weksa-runs/metame-swarm/`, which is ignored by
git because run packets may include projected Persona memory and raw Discord
context.
