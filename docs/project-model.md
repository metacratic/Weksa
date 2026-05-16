# Project Model

Weksa is the conlang engine, not the setting and not any one alien language.

The engine must stay language-neutral. It should support many language projects
with different ontologies, grammars, phonologies, morphologies, histories, and
rendering needs.

## Layers

```text
Weksa engine
  -> language project
  -> setting surface
```

## Weksa Engine

The engine owns generic pipeline contracts:

- structured meaning input
- ontology projection
- grammar planning
- morphology
- phonology
- diachrony
- deterministic rendering
- trace and gloss output

The engine must not assume that every language has aesthetic honor, empire
politics, reptilian speakers, battle broadcasts, or any other setting-specific
truth.

## Language Project

A language project owns one constructed language's live state:

- ontology
- phonetics and phonology
- grammar
- morphology
- lexicon
- diachrony
- registers
- renderer configuration
- accepted examples and tests

Names, exonyms, endonyms, and surface forms should fall out of this layer when
possible. Early naming is allowed only as a scratch convenience, not as durable
truth.

## Setting Surface

A setting owns story, species, politics, scenes, cultural pressure, and the
contexts where a language is used.

Setting material can motivate a language project, but it does not become engine
doctrine. The engine should learn from the pressure without inheriting the
setting's bones.

## Rust to Dust

Rust to Dust is Weksa's first proving ground. It needs a language project whose
speakers treat aesthetic devotion as moral honor and whose empire absorbs human
culture through commerce, prestige, and media rather than ordinary military
conquest.

That pressure is useful because it forces Weksa to handle ontology before words.
It is not a license to hard-code Rust to Dust into Weksa.

