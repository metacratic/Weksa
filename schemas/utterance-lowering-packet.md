# Utterance Lowering Packet Contract

This is the human-facing schema receipt for lowering one Weksa interlingua
packet into one or more target-language utterance realizations.

Executable schema code does not exist yet. When it does, it must reconcile with
this document and
[Multilingual Utterance Lowering](../docs/multilingual-utterance-lowering.md)
in the same pass.

## Authority

The packet sits after interlingua validation and projected speaker-context
selection. It does not replace either source.

It combines:

- one Weksa interlingua packet
- one projected speaker-local context
- one target-language cultural ontology profile stack per realization
- lowering controls
- one or more target-language realizations

## Required Fields

- `schema_version`: currently `weksa.utterance_lowering.v0`.
- `source_packet_id`: ID of the interlingua packet being lowered.
- `target_agent_id`: speaker identity.
- `agent_state_ref`: source reference for canonical or projected state.
- `projected_context_ref`: source reference for the consumed projection.
- `lowering_controls`: constraints shared by all target lowerers.
- `realizations`: non-empty list of target-language outputs.

## Target Language

Each realization must name its target explicitly:

- `code`: BCP 47-style broad code such as `en`, `pt`, or `ja`.
- `locale`: precise locale where it matters, such as `en-US`, `pt-BR`, or
  `ja-JP`.
- `script`: script or script mix when relevant.
- `register`: target-language stance such as plain, polite, rough, formal,
  technical, or character-specific.
- `cultural_ontology_refs`: ordered profile stack used to inspect address,
  politeness, register, idiom, metaphor, and other culturally loaded
  realization choices.

Portuguese must not use an unqualified `pt` target for reviewed fixtures. Use
`pt-BR` or another named locale. Regional and religious-cultural options should
be modeled as explicit overlays on a base locale profile.

Japanese fixtures must record the politeness/register stance they selected.
Subject omission, honorific pressure, and sentence-final force are not invisible
defaults.

## Output Fields

Each realization should include:

- `spoken_text`
- `visible_action`
- `literal_backgloss`
- `natural_backtranslation`
- `private_interpretation`
- `intended_effect`
- `trace`

`spoken_text` may be empty only when the lowerer chooses a non-speech action.

## Backtranslation Boundary

`literal_backgloss` and `natural_backtranslation` are reviewer aids. They do
not become source meaning, and other target lowerers must not lower from them.

## Trace Requirements

Trace should identify:

- preserved referents
- preserved predications
- projected speaker-context pressures used
- cultural ontology axes used
- target-language register decisions
- target-language risks or unresolved questions

## Downstream Speech Boundary

This packet may feed pronunciation planning or AquaSynth handoff work later, but
it does not contain phoneme-parity, vocal-tract, reference-synth, or realtime
voice artifacts.
