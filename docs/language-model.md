# Language Model

Weksa's linguistic model is concept-first.

See [Best Modern Approach](./best-modern-approach.md) for the fuller design
doctrine and examples.

## Translation Path

1. Preserve the source utterance.
2. Decompose it into structured meaning.
3. Apply an alien ontology that may split, collapse, or reweight concepts.
4. Select grammatical commitments required by the target language.
5. Build morpheme plans from roots, derivation, inflection, and compounds.
6. Apply phonological constraints.
7. Apply diachronic history.
8. Render surface text, glosses, and explanation.

## Model Use

LLMs and embedding models are useful for:

- semantic decomposition
- concept clustering
- typological inspiration
- consistency critique
- example generation

They are not the canonical state store. A completion becomes durable only after
it is normalized into explicit language-project state.
