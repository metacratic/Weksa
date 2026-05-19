# Line Expression Vector Contract

This is the human-facing schema receipt for Weksa line-expression vectors.

The vector sits after flavored-English lowering and before AquaSynth synth
control. It is the learned representation of a character's line: meaning,
emphasis, prosody, and delivery pressure in one compact artifact.

## Required Fields

- `schema_version`: currently `weksa.line_expression_vector.v0`.
- `source_output_ref`: lowered English output reference.
- `speaker_agent_id`: speaker identity.
- `encoder`: model ID and version metadata.
- `text`: spoken and normalized text.
- `vector`: dimensionality and either inline values or `values_ref`.
- `audit_projection`: human-readable probe of what the vector is intended to
  preserve.
- `trace`: notes and uncertainties.

## Boundary

The vector is not canonical character state. It is a derived runtime/training
artifact.

The audit projection is not the true latent space. It is a review surface for
humans, tests, and training data.

## Downstream

AquaSynth may consume the vector through its own decoder. Weksa does not define
the synth-control schema here.
