# Metame Casual Pre-2025 Persona Lowering Fixture

This fixture tests whether Weksa can lower neutral interlingua through Metame's
Persona state into casual Discord-style utterances from before 2025.

The point is not to imitate a recent architectural register. The target here is
room-temperature banter: quick self-deprecation, friendly status play, design
jokes, and casual turn-taking.

## Authority

- Speaker authority: Metame Persona `.cc` state.
- Evidence authority: held-out Discord messages authored by Metacrat before
  2025.
- Lowering input: neutral interlingua packets in `interlingua.yaml`.
- Answer key: `ground-truth.yaml`.

The Persona state is referenced, not copied, because the `.cc` document is the
portable speaking-state surface and may contain private memory.

## Fixture Contract

A generator should read `persona-state-ref.yaml`, `interlingua.yaml`, and
`lowering-prompt.md`, then write `generated-output.yaml`. Evaluation compares
generated output against `ground-truth.yaml`.

For benchmark use, the generator must not read `ground-truth.yaml`.
