# Weksa

Weksa is a procedural language engine for alien grammars grounded in concept,
culture, and constraint.

The project starts from a blunt rule: English words are not the source of truth.
Meaning is decomposed into an ontology, passed through a worldview, constrained
by grammar, shaped by phonology, distorted by history, and only then rendered as
surface text.

## Ownership Model

- Ontology owns meaning.
- Grammar owns required expression.
- Phonology owns sound shape.
- Diachrony owns historical distortion.
- Renderer owns surface text.
- Persistent state owns durable maps, constraints, decisions, and evidence.

If a future module cannot state what it owns and what invariant it protects, it
does not get to exist. Harsh, but the alternative is a language generator with a
clipboard and delusions of nationhood.

## Scaffold

- `state/map.yaml`: canonical working map.
- `state/scratch.md`: disposable workbench.
- `schemas/`: human-facing state contract receipts.
- `docs/`: architecture, language model, and roadmap.
- `settings/`: setting-specific proving grounds for language projects.

Start with [Best Modern Approach](./docs/best-modern-approach.md) for the core
design doctrine: ontology, roots, morphology, syntax, semantics, interlingua,
diachrony, and model-assisted consistency.

See [Project Model](./docs/project-model.md) for the engine / language project /
setting split, and [Runtime and Authoring Split](./docs/runtime-authoring-split.md)
for the LLM-free hot path.

See [Interlingua Standard](./docs/interlingua-standard.md) for the shared
meaning-packet contract Weksa clients should target.

See [Flavored English Lowering](./docs/flavored-english-lowering.md) for the
first lowering target: interlingua projected through agent state into English
dialogue.

## Implementation Status

No runtime language has been selected yet. The first committed artifact is the
persistent state spine: map, scratch, schemas, docs, and examples. The engine
implementation should be chosen after the pipeline and data ownership are clear.

[Eusocial Interbeing / Zyphos](./settings/eusocial-interbeing/README.md) is the
current higher-priority setting target. [Rust to Dust](./settings/rust-to-dust/README.md)
is preserved as an earlier proving ground, not engine doctrine.
