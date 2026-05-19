# Interlingua Standard

Version: `0.1-draft`

The Weksa interlingua is the language-neutral meaning contract between clients,
setting surfaces, authoring tools, language projects, ontology projection, and
renderers.

It is not English. It is not a grammar tree. It is not a target-language
ontology. It is the smallest structured packet that says what is meant, who is
involved, what the context is, and which facts are stable enough for a language
project to reinterpret.

## Objective

Give every Weksa client one shared way to submit meaning without forcing all
settings through one worldview.

The interlingua should support:

- game telemetry and commentary intents
- naming briefs for places, species, institutions, artifacts, and ecological
  structures
- dialogue and narration authoring
- corpus examples
- model-assisted semantic decomposition
- deterministic runtime rendering
- traceable ontology projection

## Prior Art

Weksa should learn from existing semantic annotation work without becoming a
research format clone.

- AMR gives a useful model for abstract graph meaning that is not a surface parse.
- UMR extends that direction with cross-linguistic and document-level concerns
  such as coreference, temporal relations, modal dependencies, aspect, and
  multilingual diversity.
- FrameNet keeps scenes and roles central.
- Universal Dependencies shows a useful governance pattern: common categories
  with language-specific extensions when needed.

Weksa's difference is purpose. It is a rendering contract for constructed
languages and alien ontologies, not a general-purpose annotation benchmark.

## Ownership

The interlingua owns:

- referents
- events, states, and relations
- roles between referents and predicates
- time, aspect, modality, evidence, and polarity when known
- discourse function and speaker intent
- context needed for rendering
- provenance and confidence
- extension slots with explicit namespaces

The interlingua does not own:

- target-language concept splits or collapses
- grammar obligations
- morphology
- phonology
- diachronic history
- final wording
- culture-specific metaphors unless the source meaning explicitly contains them

Those belong downstream.

## Design Principles

- Meaning before words.
- Graph before sentence.
- Explicit uncertainty beats fake precision.
- Use common fields for common meaning.
- Use namespaced extensions for client or setting pressure.
- Extensions are evidence, not authority, until a language project consumes them.
- Runtime packets must be deterministic and serializable.
- The renderer must be able to trace every target-language decision back to a
  packet field, ontology rule, or language-project rule.

## Packet Shape

The canonical packet is an object with these top-level families:

```yaml
interlingua_version:
packet_id:
kind:
provenance:
context:
discourse:
referents:
predications:
relations:
constraints:
extensions:
trace:
```

Only `interlingua_version`, `packet_id`, `kind`, and at least one semantic
payload family are required. The rest should be present when known.

## Top-Level Fields

### `kind`

The packet's broad use case.

Initial values:

- `utterance`
- `name_request`
- `commentary_intent`
- `narration`
- `dialogue_line`
- `corpus_example`
- `debug_probe`

### `provenance`

Where the packet came from.

```yaml
provenance:
  source_type: authored | model_decomposition | game_telemetry | imported_corpus
  source_ref:
  author:
  created_at:
  confidence:
```

### `context`

World and situation information that is not itself the main semantic claim.

```yaml
context:
  setting:
  scene:
  time:
  location:
  participants:
  audience:
  medium:
```

### `discourse`

Why this packet is being said, rendered, or named.

```yaml
discourse:
  speech_act:
  intent:
  tone:
  register_hint:
  addressee:
  audience_function:
```

This is not target-language register. It is source-side communicative pressure.

### `referents`

Entities, groups, locations, abstract objects, institutions, ecological actors,
routes, memories, artifacts, and other nodes that can participate in meaning.

```yaml
referents:
  - id:
    kind:
    label:
    ontology_hint:
    animacy:
    agency:
    number:
    definiteness:
    salience:
    attributes:
    extensions:
```

Initial broad kinds:

- `person`
- `group`
- `organism`
- `place`
- `artifact`
- `institution`
- `ecology`
- `route`
- `memory`
- `event`
- `abstract`

### `predications`

Events, states, processes, properties, and frame-like scenes.

```yaml
predications:
  - id:
    predicate:
    frame:
    aspect:
    tense:
    polarity:
    modality:
    evidentiality:
    roles:
      agent:
      patient:
      experiencer:
      instrument:
      source:
      goal:
      location:
      beneficiary:
    attributes:
    extensions:
```

`predicate` is a broad source-side claim. `frame` is optional but recommended
when a scene model is known. Roles may use common names or namespaced frame
roles.

### `relations`

Edges that are not naturally owned by one predication.

```yaml
relations:
  - type:
    from:
    to:
    attributes:
    extensions:
```

Initial relation families:

- `coreference`
- `part_of`
- `member_of`
- `located_at`
- `near`
- `before`
- `after`
- `causes`
- `enables`
- `prevents`
- `owns`
- `owes`
- `knows`
- `names`
- `represents`
- `contrasts_with`

### `constraints`

Hard requirements the downstream renderer must respect.

```yaml
constraints:
  preserve_referents:
  preserve_relations:
  required_outputs:
  forbidden_outputs:
  max_latency_ms:
  deterministic:
```

These are engineering and content constraints, not ontology rules.

### `extensions`

Namespaced setting or client data.

```yaml
extensions:
  zyphos.memory_relation:
  zyphos.boundary_permeability:
  rtd.aesthetic_reading:
  game.priority:
```

Extension rules:

- Namespaces must be explicit.
- Extensions must not replace common fields when common fields are sufficient.
- A downstream language project may choose to ignore an extension.
- If an extension becomes broadly required across clients, promote it into the
  standard in a later version.

### `trace`

Optional authoring/debug data.

```yaml
trace:
  notes:
  decomposition_steps:
  uncertainty:
  rejected_readings:
```

Runtime may strip `trace` from compiled packets when latency or size matters.

## Minimal Examples

### Name Request

```yaml
interlingua_version: 0.1-draft
packet_id: zyphos-name-001
kind: name_request
provenance:
  source_type: authored
context:
  setting: Eusocial Interbeing
referents:
  - id: target
    kind: ecology
    label: disconnected tree network
  - id: namer
    kind: group
    label: Airawa imperial surveyor
relations:
  - type: names
    from: namer
    to: target
extensions:
  zyphos.memory_relation: severed_from_saturated_substrate
  zyphos.boundary_permeability: hidden_refusal
```

### Commentary Intent

```yaml
interlingua_version: 0.1-draft
packet_id: rtd-commentary-001
kind: commentary_intent
context:
  setting: Rust to Dust
  medium: broadcast
discourse:
  speech_act: commentary
  audience_function: spectacle
referents:
  - id: actor
    kind: person
  - id: target
    kind: person
predications:
  - id: event
    predicate: eliminate
    frame: combat
    roles:
      agent: actor
      patient: target
extensions:
  rtd.aesthetic_reading:
    form: raw
    spectacle_value: high
```

## Promotion Rule

The interlingua should stay boring. When a new requirement appears:

1. Put it in a namespaced extension.
2. Use it in at least two real packets.
3. Ask which invariant it protects.
4. Promote it only if multiple clients or language projects need it.

No generic bucket earns permanence by sounding useful. That is how a schema
becomes a junk drawer with a hat.

## References

- [Abstract Meaning Representation 1.0 Specification](https://www.isi.edu/results/publications/14628/abstract-meaning-representation-amr-1-0-specification/)
- [Uniform Meaning Representation release paper](https://aclanthology.org/2024.lrec-main.229.pdf)
- [Global FrameNet](https://www.globalframenet.org/)
- [Universal Dependencies Guidelines](https://universaldependencies.org/guidelines)

