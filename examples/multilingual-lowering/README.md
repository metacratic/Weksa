# Multilingual Lowering Examples

These examples prove that Weksa can lower one structured utterance intent into
multiple target-language realizations without using English as the hidden pivot.

```text
interlingua packet
  -> projected speaker-local context
  -> English / pt-BR / Japanese realization set
  -> evaluation
```

Fixtures pass when each target preserves the same source meaning, obeys the
same projected speaker context, and records target-language realization choices
clearly enough to review.

## Fixtures

- [nibu-proof-001](./nibu-proof-001/): Nibu warns the player away from an unsafe
  damaged ship control in English, Brazilian Portuguese, and Japanese.
