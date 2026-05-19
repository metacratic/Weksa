# Line Expression Vector

Version: `0.1-draft`

The line expression vector is Weksa's learned handoff from flavored English
lowering to downstream voice control.

```text
interlingua packet
  -> projected agent-local context
  -> flavored English line
  -> Weksa line-expression encoder
  -> line expression vector
  -> AquaSynth synth-control decoder
```

The goal is two small learned artifacts in a tight loop:

1. Weksa learns to encode a character's line as a compact expression vector.
2. AquaSynth learns to decode that vector into synth-control intent.

No giant oracle gets to own the seam. No hidden theatrical mush. Just a line,
its meaning, its speaker context, and a learned vector with enough audit surface
to tell whether it is lying.

## Authority

Weksa owns:

- interlingua packet
- projected agent-local context
- flavored English line
- line-expression vector generation
- audit projections for meaning, emphasis, and character pressure

AquaSynth owns:

- mapping expression vectors to synthesis controls
- consuming pronunciation or IPA plans when Weksa provides them
- phonetic feature interpretation
- timing, articulation, tract, and DSP
- audio evaluation

## Vector Contract

The vector is dense and model-owned, but the packet around it must be explicit.

```yaml
schema_version: weksa.line_expression_vector.v0
source_output_ref:
speaker_agent_id:
encoder:
  model_id:
  version:
  training_set:
text:
  spoken_text:
  normalized_text:
vector:
  dimensionality:
  values_ref:
audit_projection:
  semantic_preservation:
  emphasis:
  prosody:
  character_pressure:
  delivery_shape:
training_refs:
  positive_examples:
  negative_examples:
trace:
  notes:
  uncertainties:
```

`values_ref` may point to an external binary or JSON artifact once the vector is
large. Early fixtures may inline tiny toy vectors.

## Audit Projection

The audit projection is not the vector. It is a human-readable probe of what the
vector is supposed to contain.

Useful audit families:

- `semantic_preservation`: what source meaning must remain audible.
- `emphasis`: which words or spans carry prominence.
- `prosody`: clipped, rising, flat, hesitant, compressed, etc.
- `character_pressure`: active state pressures shaping delivery.
- `delivery_shape`: pace, pause pattern, intensity, warmth, contempt, tenderness,
  threat, or play.

These are labels for review and training. The learned vector is allowed to find
better internal dimensions, but it does not get to skip accountability.

## Training Loop

First loop:

1. Author or generate an interlingua packet.
2. Project agent-local context.
3. Lower to English.
4. Human-review whether the line preserves meaning and voice.
5. Encode the reviewed line into a line-expression vector.
6. AquaSynth decodes the vector into synth-control intent.
7. Compare rendered speech against human notes and reference takes when present.
8. Feed corrections back into the Weksa encoder and AquaSynth decoder.

The same fixture can carry:

- accepted line
- rejected line
- why the rejected line failed
- audit projection
- vector artifact
- downstream AquaSynth evaluation pointer

## Non-Goals

- Do not make Weksa emit raw vocal-tract controls.
- Do not make AquaSynth infer character psychology from prose.
- Do not treat named audit axes as the true latent space.
- Do not make realtime neural voice output the authority.
- Do not hide bad semantic preservation behind pleasant delivery.
