# Runtime and Authoring Split

Weksa must be able to run in time-sensitive contexts such as games. The hot path
should be fast, deterministic, local, and free of required LLM calls.

## Runtime

Runtime consumes structured meaning and compiled language-project data.

```text
structured intent
  -> ontology projection
  -> grammar plan
  -> morphology
  -> phonology
  -> diachrony
  -> surface render
```

Runtime invariants:

- no network dependency
- no required LLM call
- no arbitrary English interpretation in the hot path
- compiled data is immutable during a render pass
- renderer does not invent meaning
- traces can explain which stage made each decision

The game, tool, or host application should send structured intent, not prose
that Weksa must guess at under pressure.

## Authoring

Authoring tools may use neural models for slow, inspectable work:

- semantic decomposition from example English
- candidate ontology entries
- typological inspiration
- register and lexicon proposals
- consistency critique
- test case generation

Model output becomes durable only when normalized into explicit project state.
The model is a workshop tool, not a runtime authority.

## Parallel Renderers

One structured intent may render into multiple surfaces:

```text
structured intent
  -> projected meaning
  -> alien-language renderer
  -> subtitle or gloss renderer
  -> debug/plain renderer
```

For flavor-first settings, subtitles may render from projected meaning instead
of neutral facts. The neutral facts still exist underneath for correctness and
debugging.

