# Schemas

This folder records Weksa's persistent state contracts in human language.

The repo deliberately starts without executable schema code. Runtime language,
storage backend, and generated type targets are undecided. Until those decisions
are made, this folder is the receipt surface: if a state shape matters enough to
steer the machine, describe its authority here.

## Canonical Surfaces

- [project-state.md](./project-state.md): project map, scratch, decisions,
  evidence, and open questions.
- [language-project-state.md](./language-project-state.md): future per-language
  state for ontology, grammar, morphology, phonology, diachrony, and renderer
  configuration.
- [interlingua-packet.md](./interlingua-packet.md): shared meaning packet
  contract between clients, authoring tools, and language projects.
- [english-lowering-packet.md](./english-lowering-packet.md): packet contract
  for projecting interlingua through agent state into flavored English.
- [english-pronunciation-plan.md](./english-pronunciation-plan.md): plan for
  stringing flavored English into IPA/phoneme sequences before downstream speech.
- [line-expression-vector.md](./line-expression-vector.md): learned vector
  contract for handing prosody, emphasis, and character pressure to downstream
  synth control.

## Source Of Truth

- `state/map.yaml` is the canonical live map for this workspace.
- `state/scratch.md` is temporary working memory.
- `schemas/` explains the contracts.
- Future executable schemas must be generated from or reconciled with these
  receipts in the same pass that introduces them.
