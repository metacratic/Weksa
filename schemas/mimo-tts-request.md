# MiMo TTS Request Contract

This is the human-facing schema receipt for a Weksa-to-MiMo speech synthesis
request projection.

The packet sits after target-language utterance lowering. It is an export
artifact for Xiaomi MiMo speech synthesis, not canonical Weksa meaning and not
an AquaSynth handoff.

## Required Fields

- `schema_version`: currently `weksa.mimo_tts_request.v0`.
- `source_realization_ref`: accepted Weksa target-language realization being
  spoken.
- `speaker_agent_id`: speaker identity.
- `provider`: provider ID and model ID, initially `xiaomi-mimo` and
  `mimo-v2.5-tts-voicedesign`.
- `target_language`: code, locale, script, register, and profile refs copied or
  referenced from the accepted realization.
- `voice_design`: voice description, source controls, projected context refs,
  and forbidden traits.
- `messages.user_voice_design_instruction`: MiMo natural-language voice design
  and style control derived from Weksa delivery intent.
- `messages.assistant_spoken_content`: the exact target-language content to
  synthesize, optionally with MiMo inline tags derived from delivery controls.
- `audio`: format, text-preview optimization setting, and streaming mode.
- `trace`: source fields, delivery controls used, provider tags used, and
  uncertainties.

## Boundary

MiMo-specific fields must be projection fields. They must not be copied back
into interlingua, target-language ontology, Persona state, or AquaSynth-owned
embedding contracts.

The request may include provider-native style tags when useful, but those tags
are not the source of truth. Weksa's provider-neutral delivery intent and trace
remain the inspectable explanation.

The request should not perform a fresh raw Persona-state interpretation. It
should reference the projected speaker context and delivery controls already
used by utterance lowering, then translate those into MiMo's voice design and
style-control surface.

For authoritative Weksa output, text-preview optimization should normally be
disabled or omitted. If enabled for exploration, the result must be marked as a
non-authoritative preview because the provider may alter the spoken text.

## Language Rule

The assistant spoken content must use the accepted target-language realization.
For `pt-BR`, speak the Portuguese line. For `ja-JP`, speak the Japanese line. For
English, speak the English line. Do not synthesize a natural backtranslation
unless that backtranslation is itself the accepted target-language realization.

## Streaming Rule

Streaming requests should use MiMo's stream-compatible audio format.
VoiceDesign streaming may be compatibility-mode rather than true low-latency
streaming depending on provider support. Non-streaming fixtures may use an
archival format such as `wav`.
