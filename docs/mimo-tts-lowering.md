# MiMo TTS Lowering

Version: `0.1-draft`

MiMo is an expressive spoken-output target for Weksa interlingua lowering. It is
not the source of meaning, language choice, character state, or delivery truth.

```text
interlingua packet
  -> projected speaker-local context
  -> target-language utterance realization
  -> Weksa delivery intent
  -> MiMo TTS request projection
  -> rendered audio artifact
```

MiMo sits beside written output and AquaSynth handoffs. Written realizations
prove that meaning, register, and cultural ontology survived lowering.
AquaSynth handoffs train or drive GameCult-owned synthesis. MiMo requests let an
external provider speak a Weksa-authored utterance with expressive style control.

## Authority

Weksa owns:

- target-language spoken text selected from interlingua
- target-language register, script, cultural ontology, and trace
- speaker-local delivery pressure
- provider-neutral prosody and emphasis intent
- the MiMo request projection as an export artifact

MiMo owns:

- provider voice selection within the requested language and voice constraints
- interpretation of MiMo natural-language style guidance
- interpretation of MiMo inline audio/style tags
- rendered audio bytes or streaming audio chunks

MiMo does not own:

- source meaning
- target-language cultural ontology
- canonical speaker or Persona state
- Weksa pronunciation plans
- AquaSynth learned embeddings, synth controls, or audio truth

## Projection Rule

The MiMo request must be derived from an accepted target-language realization.
It must not lower directly from English unless English is the selected target
language for that realization.

Natural-language style guidance belongs in the MiMo `user` message. The spoken
target-language text belongs in the MiMo `assistant` message. Inline MiMo tags
may appear in the assistant content only when they are derived from Weksa
delivery intent or explicit target-language realization notes.

## Request Shape

```yaml
schema_version: weksa.mimo_tts_request.v0
source_realization_ref:
speaker_agent_id:
provider:
  id: xiaomi-mimo
  model: mimo-v2.5-tts
target_language:
  code:
  locale:
  script:
  register:
voice:
  requested_voice:
  fallback_voice:
  selection_reason:
messages:
  user_style_instruction:
  assistant_spoken_content:
audio:
  format:
  streaming:
trace:
  source_fields:
  delivery_controls_used:
  provider_tags_used:
  uncertainties:
```

## Delivery Mapping

Weksa should map delivery pressure into provider-neutral labels before emitting
MiMo-specific instructions:

- pace, pause pressure, and urgency
- pitch contour and pitch range
- loudness and attack
- articulation precision
- warmth, threat, tenderness, contempt, play, fatigue, secrecy, formality
- span-level emphasis and pauses

The MiMo projection may turn those labels into director-style guidance or inline
tags, but the trace must preserve the Weksa-owned source controls.

## Language Rule

Weksa should be able to write and speak in any target language whose utterance
realization it can justify. MiMo output for Brazilian Portuguese should consume
the accepted `pt-BR` spoken text. Japanese output should consume accepted
Japanese text. Alien-language output should consume accepted alien rendered
speech or phonetic text only after the language project owns that surface.

Backtranslations are reviewer aids. They must not become MiMo spoken content.

## First Proof

The first proof should use the Nibu warning packet already used by multilingual
lowering:

- emit the accepted English, `pt-BR`, or Japanese realization
- derive a provider-neutral delivery intent from Nibu's projected context
- project that into a MiMo `mimo-v2.5-tts` request
- verify that the request speaks the target text, not the backtranslation
- verify that style guidance is traceable to Weksa delivery controls
