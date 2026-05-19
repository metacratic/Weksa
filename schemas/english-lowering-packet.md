# English Lowering Packet Contract

This is the human-facing schema receipt for lowering Weksa interlingua into
character-flavored English dialogue.

Executable schema code does not exist yet. When it does, it must reconcile with
this document and [Flavored English Lowering](../docs/flavored-english-lowering.md)
in the same pass.

## Authority

The packet sits after interlingua validation and before final dialogue or speech
rendering.

It combines:

- one Weksa interlingua packet
- one projected agent-local context
- lowering controls
- English output

It does not replace the interlingua packet or the agent state.

## Required Fields

- `schema_version`: currently `weksa.english_lowering.v0`.
- `source_packet_id`: ID of the interlingua packet being lowered.
- `target_agent_id`: speaker identity.
- `agent_state_ref`: source reference for the canonical state or state envelope.
- `projected_context`: character-local operating context.
- `lowering_controls`: constraints for the lowering pass.
- `outputs`: generated English and trace.

## Projected Context

Projected context should be positive context only. Include what the speaker can
know, believe, remember, want, and express.

Do not include:

- private state for other participants
- raw numeric state variables
- hidden author notes
- future branch outcomes
- unaudited model guesses as fact

## Output Fields

`outputs` should include:

- `spoken_text`
- `visible_action`
- `private_interpretation`
- `intended_effect`
- `trace`

`spoken_text` may be empty only when the lowerer chooses a non-speech action.

## Downstream Speech Boundary

This packet may be handed to AquaSynth later, but it does not contain
phoneme-parity, vocal-tract, reference-synth, or realtime voice artifacts.

Weksa owns the English projection. AquaSynth owns speech lowering.
