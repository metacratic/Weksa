# Roadmap

## Now

- Keep the persistent state spine small and readable.
- Stabilize the interlingua packet standard before runtime code.
- Decide the first language-project state format after the interlingua boundary
  is clear.
- Build a hand-authored toy language project before automating generation.
- Use Rust to Dust as the first proving ground while keeping Weksa
  setting-neutral.

## First Prototype

- Validate one minimal interlingua packet.
- Parse or load one language project definition.
- Accept a Weksa interlingua packet.
- Render glossed output through grammar, morphology, phonology, and diachrony.
- Emit a trace explaining which stage made each decision.
- Keep runtime LLM-free; model use belongs in authoring and critique.

## Later

- Add model-assisted semantic decomposition from English.
- Add embeddings for concept clustering.
- Add model critique against the explicit language state.
- Add corpus generation and consistency checks.
