# MiMo TTS Lowering

Version: `0.1-draft`

MiMo VoiceDesign is an expressive spoken-output target for Weksa interlingua
lowering. It is not the source of meaning, language choice, character state, or
delivery truth.

```text
interlingua packet
  -> projected speaker-local context
  -> target-language utterance realization
  -> Weksa delivery intent from the same projection
  -> MiMo TTS VoiceDesign request projection
  -> rendered audio artifact
```

MiMo sits beside written output and AquaSynth handoffs. Written realizations
prove that meaning, register, and cultural ontology survived lowering.
AquaSynth handoffs train or drive GameCult-owned synthesis. MiMo VoiceDesign
requests let an external provider speak a Weksa-authored utterance with a
generated voice derived from the same projected Persona state, delivery controls,
and trace that produced the utterance.

The MiMo pass is choreography and provider flavor. It is not a second Persona
projection pass and it does not re-interpret raw Persona state after the line has
already been lowered.

## Authority

Weksa owns:

- target-language spoken text selected from interlingua
- target-language register, script, cultural ontology, and trace
- projected speaker-local context used for the utterance
- speaker-local delivery pressure derived during utterance lowering
- provider-neutral prosody and emphasis intent
- the MiMo request projection as an export artifact

MiMo owns:

- generation of a provider voice from the requested voice design description
- interpretation of MiMo natural-language voice/style guidance
- interpretation of MiMo inline audio/style tags
- rendered audio bytes or streaming audio chunks

MiMo does not own:

- source meaning
- target-language cultural ontology
- canonical speaker or Persona state
- fresh Persona-state interpretation
- Weksa pronunciation plans
- AquaSynth learned embeddings, synth controls, or audio truth

## Projection Rule

The MiMo request must be derived from an accepted target-language realization and
the same projected speaker-local context that created it. It must not lower
directly from English unless English is the selected target language for that
realization. It must not read raw Persona state to discover a different voice
after Weksa has already chosen the utterance.

Natural-language voice design and style guidance belongs in the MiMo `user`
message. The spoken target-language text belongs in the MiMo `assistant`
message. Inline MiMo tags may appear in the assistant content only when they are
derived from Weksa delivery intent or explicit target-language realization notes.

## Request Shape

```yaml
schema_version: weksa.mimo_tts_request.v0
source_realization_ref:
speaker_agent_id:
provider:
  id: xiaomi-mimo
  model: mimo-v2.5-tts-voicedesign
target_language:
  code:
  locale:
  script:
  register:
performance_register:
  label:
  medium:
  delivery_archetype:
voice_design:
  description:
  source_controls:
  projected_context_refs:
  forbidden_traits:
messages:
  user_voice_design_instruction:
  assistant_spoken_content:
audio:
  format:
  optimize_text_preview:
  streaming:
trace:
  source_fields:
  delivery_controls_used:
  provider_tags_used:
  uncertainties:
```

## Delivery Mapping

`target_language.register` is the linguistic/social register of the accepted
realization. It is not a provider style knob. For MiMo, Weksa should derive an
explicit `performance_register` from the same projection so speech choreography
can say "anime visual-novel heroine warning" without pretending English itself
has that register.

Weksa should map the utterance's existing projected Persona pressure into
provider-neutral delivery labels before emitting MiMo-specific instructions:

- pace, pause pressure, and urgency
- pitch contour and pitch range
- loudness and attack
- articulation precision
- warmth, threat, tenderness, contempt, play, fatigue, secrecy, formality
- span-level emphasis and pauses

The MiMo projection may turn those labels into a concise VoiceDesign prompt or
inline tags, but the trace must preserve the Weksa-owned source controls.

Persona presentation details such as youth-coded, loli-coded, product-voice, or
other culturally loaded styling may enter the MiMo request only when they are
already present in the projected context or accepted delivery intent. They should
be described as presentation/cultural coding and kept subordinate to agency,
personality, affect, and scene purpose. They must not become sexualized content
or a generic anime voice pasted over the line.

For Weksa-authored dialogue, `optimize_text_preview` should normally be `false`
or omitted. MiMo should speak the accepted target-language realization, not
rewrite it. Text polishing is only allowed for explicit preview/prototyping
passes that are marked non-authoritative.

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
- project that into a MiMo `mimo-v2.5-tts-voicedesign` request
- verify that the request speaks the target text, not the backtranslation
- verify that style guidance is traceable to Weksa delivery controls
