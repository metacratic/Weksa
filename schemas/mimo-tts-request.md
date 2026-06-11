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
  `mimo-v2.5-tts`.
- `target_language`: code, locale, script, register, and profile refs copied or
  referenced from the accepted realization.
- `voice`: requested provider voice, fallback voice, and selection reason.
- `messages.user_style_instruction`: MiMo natural-language style control derived
  from Weksa delivery intent.
- `messages.assistant_spoken_content`: the exact target-language content to
  synthesize, optionally with MiMo inline tags derived from delivery controls.
- `audio`: format and streaming mode.
- `trace`: source fields, delivery controls used, provider tags used, and
  uncertainties.

## Boundary

MiMo-specific fields must be projection fields. They must not be copied back
into interlingua, target-language ontology, Persona state, or AquaSynth-owned
embedding contracts.

The request may include provider-native style tags when useful, but those tags
are not the source of truth. Weksa's provider-neutral delivery intent and trace
remain the inspectable explanation.

## Language Rule

The assistant spoken content must use the accepted target-language realization.
For `pt-BR`, speak the Portuguese line. For `ja-JP`, speak the Japanese line. For
English, speak the English line. Do not synthesize a natural backtranslation
unless that backtranslation is itself the accepted target-language realization.

## Streaming Rule

Streaming requests should use MiMo's stream-compatible audio format. Non-streaming
fixtures may use an archival format such as `wav`.
