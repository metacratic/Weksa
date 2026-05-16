# Best Modern Approach

Weksa should not be an English word-substitution machine. That old Word2Vec
idea was plausible as a cheap lexifier, but a believable alien language needs
more authority than semantic clustering plus new syllables.

The modern approach is a hybrid:

- use models for semantic decomposition, clustering, generation, and critique
- keep language authority in explicit ontology, grammar, morphology, phonology,
  diachrony, state, and examples

If a model owns the language, the language drifts. If rules own everything, the
language can become sterile. Weksa's job is to make those two pressures useful
without letting either one annex the whole machine.

## Conceptual Ontology

Start with a world model, not English words.

Define what the speakers perceive, value, fear, classify, taboo, ritualize, and
socially enforce. English distinctions can split, collapse, or become irrelevant
when passed through the alien ontology.

Useful axes:

- agency: animate, machine, ancestor, weather, collective
- visibility: seen, inferred, dreamed, ritually known
- time: cyclic, seasonal, ancestral, immediate
- social relation: kin, oath-bound, enemy, host, stranger
- environment: aquatic, fungal, orbital, subterranean, migratory

Embeddings and LLMs can cluster English concepts, but the ontology decides what
the target language actually cares about. The ontology is the pressure chamber;
English is just one input gas.

Example concept split:

```text
English: water

Alien ontology:
  life-water: potable/shared water that sustains the group
  boundary-water: dangerous water marking territorial edge
  sky-water: rain, omen-bearing and seasonal
  body-water: blood, sap, egg-fluid, and related internal liquids
```

Example concept collapse:

```text
English: debt, promise, remembered injury

Alien ontology:
  one concept family: unclosed social pressure
```

## Root Generation

Generate roots from a phonotactic grammar, not random syllables.

Root generation should know:

- phoneme inventory
- legal syllable shapes
- stress or tone behavior
- root length constraints
- semantic domain pressure
- historical proto-form constraints
- taboo or register restrictions

Example phonotactic seed:

```text
syllable shapes: CV, CVC, CVN
constraints:
  voiced stops absent
  liquids appear only in ritual or archaic strata
  word-final nasals mark old collective nouns
  high vowels are common in proximity/deixis roots
```

Semantic clustering can assign nearby meanings related root shapes, but with
restraint. A language where every fire word starts with the same obvious chunk
feels like a toy. A faint family resemblance is better than a nametag.

Example root family:

```text
root: tal
domain: witness/perception
core: to become responsible by seeing

derived:
  tal-en: witness-person
  tal-ru: visible evidence
  mi-tal: to refuse responsibility for what was seen
```

## Morphology

Morphology is where alienness can become structural instead of cosmetic.

Decide what the language obligatorily marks. Human languages already vary
wildly here; alien ones can push harder, as long as the pressure follows from
the world and speakers.

Possible obligatory categories:

- evidence source: seen, inferred, told, dreamed, mathematically derived
- ecological role: edible, symbiotic, poisonous, sacred, tool-like
- social relation: kin, oath-bound, temporary ally, outside-oath, rival
- phase: becoming, stable, decaying, returning
- possession: detachable, bodily, inherited, stolen, mutually-constituting
- risk or taboo: safe to name, indirect name required, silence required

Example morphology sketch:

```text
root: kan = shared life-water

kan-a     water as present resource
kan-ir    water as owed or withheld
kan-oth   water witnessed as contaminated
kan-ma    water in reciprocal stewardship
```

The morphology should make speakers say the things their culture cannot ignore.

## Syntax

Pick a structural spine, then bend it intentionally.

Syntax should not merely encode English with different word order. It should
interact with the ontology and morphology.

Possible choices:

- verb-final clauses with topic-first discourse
- evidentials hosted on the clause edge
- noun incorporation for routine actions
- no adjective class; qualities are stative verbs
- relative clauses replaced by chained participles
- questions marked by evidential mismatch rather than word order
- switch-reference markers for social or perceptual continuity

Example:

```text
English:
  I saw the stranger steal water.

Syntax pressure:
  witnessed-event clause
  outside-oath agent
  shared-resource patient
  speaker takes report obligation by seeing
```

The output should not just mean "I saw X steal Y." It should encode that seeing
created responsibility.

## Lexical Semantics

Words should have concept cards, not one-line English replacements.

Each root or lexical item should track:

- core meaning
- domain
- metaphorical extensions
- contrast set
- taboo or ritual usage
- derived forms
- examples
- false friends with English glosses

Example concept card:

```text
root: tal
domain: perception / witness
core: to become responsible by seeing

extensions:
  legal witnessing
  omen recognition
  public acknowledgment

contrast:
  passive noticing without social force is a different root

derived:
  tal-en: witness-person
  tal-ru: visible evidence
  mi-tal: to refuse to acknowledge what was seen

false friend:
  not equivalent to English "see"
```

This is how Weksa avoids making a dictionary of costumes.

## Interlingua

Do not translate English directly into alien words. Translate English into a
structured meaning representation first.

Example source:

```text
I saw the stranger steal water.
```

Example interlingua:

```json
{
  "event": "steal",
  "agent": {
    "role": "stranger",
    "social_status": "outside_oath"
  },
  "patient": {
    "concept": "water",
    "ecological_status": "shared_life_resource"
  },
  "witness": "speaker",
  "evidence": "direct_visual",
  "moral_frame": "obligation_to_report",
  "tense_aspect": "completed"
}
```

Then render that through the alien ontology and grammar. The interlingua is the
translation hinge: it lets English stop being the hidden skeleton of the target
language.

## Diachrony

Believability comes from history, not just design.

Generate or record:

- older forms
- sound changes
- semantic drift
- fossilized compounds
- register splits
- loan strata
- taboo replacements
- irregular sacred forms

Example:

```text
proto-form: kana = saltwater
sound change: unstressed final vowels drop
modern form: kan

ritual preservation:
  kana-thul = ancestral tide oath

semantic drift:
  inland dialect extends kan to mean debt because salt transport was tribute-bound
```

A language without accidents feels designed because it is. Diachrony is how the
machine earns scars instead of painting them on.

## Model-Assisted Consistency

Use models as critics and assistants, not as the source of truth.

Good model jobs:

- decompose source text into candidate interlingua
- suggest ontology splits and collapses
- propose metaphorical extensions
- generate example sentences from explicit grammar
- find places where output is just English in disguise
- compare the system to known typological patterns
- identify overloaded morphology or unmotivated categories
- stress-test a lexicon for contradictions

Useful critique prompts:

```text
Find places where this grammar preserves English assumptions.
```

```text
Which obligatory categories lack cultural or communicative pressure?
```

```text
Generate 30 sentences from this grammar and identify contradictions in the
glosses, morphology, or ontology.
```

```text
Compare this language state to known typological patterns without making it
merely human.
```

Model output should become durable only after review and normalization into the
explicit language project state. Raw completions are evidence or suggestions,
not law.

## Practical System Shape

A strong Weksa implementation will likely need:

- ontology store
- phonotactic generator
- morphology engine
- grammar renderer
- diachrony engine
- model prompt layer for decomposition and critique
- embedding or retrieval layer for concept clustering
- corpus generator
- consistency checker

Those pieces should appear only when their authority is clear. The durable
pipeline is:

```text
source text
  -> interlingua
  -> alien ontology
  -> grammar
  -> morphology
  -> phonology
  -> diachrony
  -> renderer
  -> surface text + gloss + trace
```

That gets Weksa something grounded, generative, and strange for reasons deeper
than apostrophes.
