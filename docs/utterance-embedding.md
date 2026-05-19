# Utterance Embedding Handoff

Version: `0.1-draft`

The utterance embedding is the compact learned handoff from Weksa-authored line
intent to AquaSynth voice control.

```text
interlingua packet
  -> projected Ghostlight/Epiphany-shaped character context
  -> flavored English line
  -> speech text embedding
  -> prosody and emphasis hints
  -> character state vector
  -> AquaSynth utterance embedding encoder
  -> utterance embedding
  -> AquaSynth synth driver
```

Weksa does not own the optimizer. Weksa owns the inspected ingredients that make
training possible:

- source interlingua and lowering trace;
- spoken and normalized text;
- speech text embedding reference;
- prosody and emphasis hints;
- projected character-state vector;
- audit projection for semantic preservation and delivery pressure;
- training references and human review notes.

AquaSynth owns:

- the tiny learned utterance-embedding encoder;
- the shared packed-buffer gradient-descent/Adam primitive;
- the synth-driver model that consumes the utterance embedding;
- phonetic feature interpretation, timing, articulation, tract, and DSP;
- audio evaluation.

The point is one learned speech handoff, not two little neural courthouses
arguing about who gets to wear the robe.

## Packet Contract

```yaml
schema_version: weksa.utterance_embedding_handoff.v0
source_output_ref:
speaker_agent_id:
text:
  spoken_text:
  normalized_text:
inputs:
  speech_text_embedding:
    model_id:
    dimensionality:
    values_ref:
  prosody_emphasis_hints:
    dimensionality:
    values:
  character_state_vector:
    source:
    dimensionality:
    values_ref:
utterance_embedding:
  owner: AquaSynth
  model_id:
  version:
  training_set:
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

Early fixtures may inline tiny toy vectors. Real embeddings should use
`values_ref` once the dimensions stop being decorative furniture.

## Audit Projection

The audit projection is not the embedding. It is a human-readable probe of what
the embedding should preserve.

Useful audit families:

- `semantic_preservation`: what source meaning must remain audible.
- `emphasis`: which words or spans carry prominence.
- `prosody`: clipped, rising, flat, hesitant, compressed, etc.
- `character_pressure`: active state pressures shaping delivery.
- `delivery_shape`: pace, pause pattern, intensity, warmth, contempt, tenderness,
  threat, or play.

These labels guide review and training. The learned embedding may find better
internal dimensions, but it does not get to skip accountability.

## Training Loop

First loop:

1. Author or generate an interlingua packet.
2. Project Ghostlight/Epiphany-shaped character context.
3. Lower to English.
4. Generate or attach a speech text embedding.
5. Emit prosody/emphasis hints and a projected character state vector.
6. Human-review whether the line preserves meaning and voice.
7. AquaSynth trains the utterance embedding encoder.
8. AquaSynth feeds the utterance embedding to the synth driver.
9. Compare rendered speech against human notes and reference takes when present.

The same fixture can carry accepted lines, rejected lines, audit projections,
input vectors, downstream AquaSynth evaluation pointers, and notes about why a
candidate failed.

## Non-Goals

- Do not make Weksa emit raw vocal-tract controls.
- Do not make Weksa train its own speech embedding optimizer.
- Do not make AquaSynth infer character psychology from prose alone.
- Do not treat named audit axes as the true latent space.
- Do not make realtime neural voice output the authority.
- Do not hide bad semantic preservation behind pleasant delivery.
