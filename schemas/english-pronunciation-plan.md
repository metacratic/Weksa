# English Pronunciation Plan Contract

This is the human-facing schema receipt for English pronunciation plans.

The plan sits after flavored-English lowering and before downstream speech
systems such as AquaSynth.

## Required Fields

- `schema_version`: currently `weksa.english_pronunciation_plan.v0`.
- `source_output_ref`: file or packet reference for the lowered English output.
- `dialect`: pronunciation target such as `en-US-general`.
- `orthographic_text`: final English text being pronounced.
- `tokens`: token-level pronunciation records.
- `ipa`: broad IPA output.
- `trace`: decisions and uncertainties.

## Token Records

Each token should include:

- `id`
- `text`
- `kind`: `word`, `punctuation`, `boundary`, or `symbol`
- `pronunciation_source`
- `arpabet`
- `ipa`
- `stress`
- `notes`

`arpabet` may be omitted for punctuation and non-CMUdict sources.

## Boundary

This contract does not define phonetic features, articulatory gestures, tract
morphology, or audio. It only defines the pronunciation string and the trace that
explains where it came from.
