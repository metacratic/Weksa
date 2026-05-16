# Language Project State

This is the intended future state shape for an individual generated language.
It is not executable yet.

## Ownership Families

- `metadata`: language name, world/culture context, authorship, version.
- `ontology`: concept inventory, semantic relations, splits, collapses, salience.
- `interlingua`: source meaning representation accepted by the renderer.
- `grammar`: syntax, agreement, evidentiality, aspect, valence, required
  categories.
- `morphology`: roots, affixes, compounding, derivation, inflection.
- `phonology`: phonemes, syllable shapes, phonotactics, prosody, romanization.
- `diachrony`: proto-forms, sound changes, semantic drift, strata, registers.
- `lexicon`: generated forms, glosses, etymologies, usage constraints.
- `corpus`: example sentences, analyses, translations, provenance.
- `critique`: model or human findings about consistency and plausibility.

## Boundary Rule

The language project should not store raw model completions as truth. A model
completion can be evidence, suggestion, or critique. Accepted language state
must be normalized into the owned families above.
