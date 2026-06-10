# Metame Casual Pre-2025 Persona Lowering Fixture

This fixture tests whether Metame can produce speaker-state-conditioned
interlingua through VoidBot Persona projection, and whether Weksa can lower that
interlingua through a Metacrat casual cultural profile into Discord-style
utterances from before 2025.

The point is not to imitate a recent architectural register. The target here is
room-temperature banter: quick self-deprecation, friendly status play, design
jokes, and casual turn-taking.

## Authority

- Speaker intent authority: Metame Persona `.cc` state, projected by VoidBot.
- Persona culture-stack reference:
  `examples/persona-lowering/metame-casual-pre2025/metame-cultural-stack.yaml`.
- Reusable cultural ontology store:
  `data/cultural-ontology/`.
- Surface lowering authority:
  `data/target-language-ontology/en-US-metacrat-casual-pre2025.yaml`.
- Evidence authority: held-out Discord messages authored by Metacrat before
  2025.
- Fixture scene input: neutral interlingua packets in `interlingua.yaml`.
- Answer key: `ground-truth.yaml`.

The Persona state is referenced, not copied, because the `.cc` document is the
portable speaking-state surface and may contain private memory.

## Fixture Contract

A real golf run has two stages:

1. Metame-as-Persona reads a temporary current situation through VoidBot
   projector machinery and emits Weksa interlingua only.
2. Weksa reads the Persona-referenced culture stack and lowers that interlingua
   through reusable culture/subculture profiles plus the casual en-US Discord
   target overlay.

Use `scripts/run-metame-persona-golf.mjs`:

```powershell
node scripts/run-metame-persona-golf.mjs --limit 1
node scripts/run-metame-persona-golf.mjs --real --item engineer-vibes
```

Dry runs use the answer key as an oracle only to verify harness plumbing. Real
runs write per-item prompts, interlingua, lowered output, and evaluation under
`runs/<run-id>/`.

For benchmark use, the generator must not read `ground-truth.yaml`.
