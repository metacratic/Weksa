# Target-Language Cultural Ontology Contract

This is the human-facing schema receipt for target-language cultural ontology
profiles consumed by Weksa utterance lowering.

Executable schema code does not exist yet. When it does, it must reconcile with
this document and the profiles under `data/target-language-ontology/`.

## Authority

A target-language cultural ontology profile owns the realization distinctions
that must be inspected for a human target language before surface text is
chosen.

It owns:

- address and treatment distinctions
- politeness and register pressure
- social stance and directness defaults
- idiom, metaphor, and lexical-locale risks
- script or orthographic choices that carry meaning
- forbidden flattenings for reviewed output

It does not own:

- source meaning
- speaker identity
- private state
- exhaustive grammar
- whole-culture description
- final wording without an interlingua packet

## Required Fields

- `profile_id`: stable profile identifier.
- `language`: target code, locale, and script.
- `scope`: bounded statement of what the profile is and is not.
- `authority`: `owns` and `does_not_own` lists.
- `salience_axes`: named axes the lowerer must inspect.
- `linguistic_affordances`: optional nested typed feature records, following
  `cultural-ontology-profile.md`, when the profile owns dialect, register,
  phonological, lexical, discourse, orthographic, or code-switching pressure.
- `forbidden_flattenings`: mistakes the target lowerer must avoid.

## Salience Axes

Each salience axis should name:

- `relevant_distinctions`: choices the target language or locale makes visible.
- `lowering_questions`: questions reviewers and lowerers should answer before
  accepting an output.

Examples:

- English directness and sarcasm.
- Brazilian Portuguese treatment choice, lexical locale, and regional or
  religious-cultural overlays.
- Japanese politeness, ellipsis, and sentence-final force.

## Fixture Contract

Reviewed multilingual fixtures should cite the profile used by each
realization:

```yaml
target_language:
  code: pt
  locale: pt-BR
  script: Latn
  register: direct technical casual
  cultural_ontology_refs:
    - data/target-language-ontology/pt-BR.yaml
```

The realization trace should name the cultural ontology axes that shaped the
line.

For dialectal, regional, historical, ritual, and contact-language profiles, use
the nested `weksa.cultural_ontology_profile.v0` contract in
`cultural-ontology-profile.md`. Flat string lists are only summaries; typed
feature records own accepted affordance detail.
