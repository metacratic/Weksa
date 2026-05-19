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
- optional AquaSynth `PhoneticIntent` request metadata

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

## Speech Bridge

`phonetic_intent_request` is optional but should be present when the output is
intended for AquaSynth.

It may include:

- `enabled`
- `voice_profile`
- `prosody_hint`
- `ipa_policy`
- `timing_hint`
- `delivery_pressure`

This is a request to AquaSynth, not a rendered audio contract.

## Reference Audio Artifacts

Realtime voice outputs may be attached as reference artifacts for tuning.

Suggested fields:

- `reference_audio.provider`
- `reference_audio.voice`
- `reference_audio.prompt_ref`
- `reference_audio.transcript`
- `reference_audio.audio_ref`
- `reference_audio.rating_notes`
- `reference_audio.allowed_use`

Allowed use should distinguish:

- `style_reference`
- `prosody_reference`
- `regression_reference`
- `physical_ground_truth_forbidden`

Reference audio must not replace `phonetic_intent_request` or AquaSynth's
articulatory reports.
