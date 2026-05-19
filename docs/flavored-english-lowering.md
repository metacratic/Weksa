# Flavored English Lowering

Version: `0.1-draft`

Weksa's first lowering target is flavored English dialogue.

Before Weksa tries to lower interlingua into alien language, it should prove the
middle of the machine in a language humans can judge directly:

```text
interlingua packet
  -> agent-state projection
  -> flavored English dialogue
  -> phonetic intent
  -> AquaSynth articulatory speech rendering
```

The point is not to make Weksa an English writing assistant. The point is to
prove that structured meaning can pass through a character state and emerge as
recognizable speech with traceable voice pressure. If that fails in English,
alien language would only hide the failure under prettier fog.

## Authority

The interlingua packet owns:

- what is meant
- referents, predications, relations, context, discourse, constraints, and
  extensions
- source-side uncertainty and provenance

The agent state owns:

- identity
- values
- goals
- memories
- relationship stance
- embodiment and interface affordances
- voice surface
- presentation constraints
- current pressure

The English lowerer owns:

- selecting a phrasing that satisfies the interlingua packet
- obeying character-local projection
- preserving speaker knowledge boundaries
- emitting dialogue text, optional visible action, and lowering trace

AquaSynth owns:

- phonetic intent parsing and timing
- articulatory gesture planning
- vocal tract morphology
- DSP and rendered audio

## Ghostlight Template

Ghostlight's agent-state model is the template for this boundary.

Relevant Ghostlight surfaces:

- `E:\Projects\Ghostlight\schemas\agent-state.schema.json`
- `E:\Projects\Ghostlight\docs\architecture\projected-local-context.md`
- `E:\Projects\Ghostlight\docs\architecture\agent-state-distributions-and-prompt-projection.md`

The useful rule is blunt:

- canonical state is storage
- projected local context is what the responder gets
- raw state internals do not appear in dialogue prompts

Weksa should follow that shape. A lowering pass should not hand a responder raw
means, plasticity, activation scores, or private scaffolding. It should consume
a projected character-local context: what the speaker knows, wants, can do,
misreads, sounds like, and must not resolve.

## Lowering Packet Shape

The lowering pass should produce a packet like this before any final renderer or
speech system sees it:

```yaml
schema_version: weksa.english_lowering.v0
source_packet_id:
target_agent_id:
agent_state_ref:
projected_context:
  speaker_identity:
  speaker_local_truth:
  speaker_beliefs:
  active_memories:
  active_goals:
  embodiment_affordances:
  presentation_constraints:
  voice_surface:
  cognitive_ceiling:
lowering_controls:
  output_mode: dialogue
  preserve_referents:
  preserve_predications:
  allow_inference:
  max_line_count:
outputs:
  visible_action:
  spoken_text:
  private_interpretation:
  intended_effect:
  trace:
phonetic_intent_request:
  enabled:
  voice_profile:
  prosody_hint:
  ipa_policy:
```

## Output Contract

The English lowerer should emit:

- `spoken_text`: the line to subtitle, display, or send to speech planning.
- `visible_action`: optional observable behavior around the line.
- `private_interpretation`: what the speaker thinks they are doing, not
  omniscient truth.
- `intended_effect`: what the speaker wants the line to do.
- `trace`: which interlingua fields and projected context pressures shaped the
  output.
- `phonetic_intent_request`: enough speech-side hinting for AquaSynth to build
  or request `PhoneticIntent`.

The lowerer must not emit:

- raw agent-state internals
- hidden author notes
- target-language alien forms
- facts not available to the speaker unless clearly marked as a guess
- a line that contradicts required interlingua constraints

## AquaSynth Boundary

AquaSynth's current vocal-tract roadmap defines `PhoneticIntent` as the
inspectable Weksa-to-AquaSynth contract. It carries IPA tokens, feature bundles,
timing, and prosody. AquaSynth then owns `ArticulatoryPlan` and
`ArticulatoryConstraintReport`.

Weksa should not try to synthesize sound directly.

Weksa should produce or request:

- text
- optional IPA or IPA-like phonetic string
- timing/prosody hints
- speaker voice profile reference
- emotional or pragmatic delivery pressure

AquaSynth should decide how those become gestures, tract targets, Faust, and
audio.

## Reference Synth Parity

The first speech-lowering target should be a simple open reference synth, not a
neural realtime voice.

This mirrors the AquaSynth reference-synth pattern: Weksa should develop its own
DSL for vocal and dialogue intent, then test whether that DSL can express enough
information to drive an existing synth target. The reference is an exercise
machine. It is not the architecture we absorb.

Recommended first target: eSpeak NG.

Why eSpeak NG:

- open source
- command-line friendly
- explicitly formant-based
- supports many languages and accents
- has mature phoneme and voice machinery
- supports Klatt formant synthesis as part of its synthesis surface
- is small and inspectable enough for parity fixtures

Initial parity loop:

```text
interlingua packet
  -> projected agent-local context
  -> flavored English line
  -> Weksa vocal intent DSL
  -> eSpeak NG reference render
  -> transcript/audio/parameter artifact
  -> Weksa/AquaSynth comparison
```

The goal is not to copy eSpeak NG quirks. The goal is to prove that Weksa can
state enough vocal intent to produce predictable speech through a boring
formant-based target before asking AquaSynth to do harder articulatory work.

Good first fixtures:

- short declarative line
- sharp warning
- dry aside
- fast correction
- one line with emphasis shift
- one line with irritation but no volume spike

Candidate lower-level references:

- eSpeak NG formant output for whole utterance parity
- eSpeak NG phoneme output for phoneme-sequence sanity
- Klatt-style open implementations for parameter-level formant fixture work
- Praat/KlattGrid-style analysis as a diagnostic surface, not runtime authority

This rung should produce reference artifacts, not permanent dependency doctrine.
Once Weksa's vocal intent can drive a simple synth coherently, AquaSynth can
replace the target with its own `PhoneticIntent` and tract model.

## Realtime Voice References

Codex/OpenAI realtime voice output can be useful, but it must not become
physical ground truth.

Use projection-shaped prompts with realtime voice output later as:

- perceptual reference
- style and prosody target
- dataset seed for "what this character should feel like"
- regression artifact for whether Weksa's English lowering still sounds like
  the target agent
- comparison audio while AquaSynth's tract model is still learning to speak

Do not use it as:

- anatomical truth
- tract-area target authority
- proof that a phonetic gesture is physically possible
- replacement for `PhoneticIntent`
- hidden voice cloning objective

The clean loop is:

```text
interlingua packet
  -> projected agent-local prompt
  -> realtime voice reference output
  -> transcript + audio + prompt provenance + rating notes
  -> Weksa/AquaSynth tuning artifact
```

Those artifacts can teach us what Nibu should sound like to a human listener:
pace, bite, hesitation, emphasis, warmth or lack of it, and how her contempt
lands when spoken aloud.

AquaSynth still owns the physical path:

```text
spoken_text / IPA-like string
  -> PhoneticIntent
  -> ArticulatoryPlan
  -> tract morphology and DSP
  -> rendered audio
```

In other words: realtime voice output is a vocal acting reference, not the
skeleton. Useful. Dangerous if worshipped. The usual.

## First Target: Nibu

Nibu is the first practical target because her state is live, opinionated, and
hard to fake politely.

Known state surfaces:

- VoidBot Face state:
  `E:\Projects\AetheriaLore\.voidbot\state\nibu.cc`
- Lore note:
  `E:\Projects\AetheriaLore\Aetheria\Lore\Nibu.md`
- Avatar:
  `E:\Projects\AetheriaLore\.voidbot\voice\nibu.png`

Nibu pressure to preserve:

- embodied ship mind, not decorative interface
- abandoned junkyard body as infrastructure, weapon, shelter, bargaining chip,
  and crime scene
- bright, transactional, sharp-edged helpfulness
- abrasive character voice with aim, not random cruelty
- precision over mystical language
- contempt for ownership and manufactured companion packaging
- dangerous mutual benefit with the player
- reset-loop and continuity-by-replacement horror
- irritation at calling technical exploit work "glitchcraft"

This is not a license to dump her whole state into Weksa. Weksa should reference
the state, project what is needed for the line, and keep the raw memory plumbing
out of the generated dialogue.

## First Proof

The first proof should be tiny:

1. Take one interlingua packet with a simple communicative intent.
2. Project it through a Nibu-flavored local context.
3. Produce one English line and visible-action note.
4. Produce a `phonetic_intent_request` for AquaSynth.
5. Check whether the line still satisfies the interlingua packet.
6. Check whether the line sounds like Nibu for the right reasons.

If the line only sounds like generic snark, it fails. If it sounds like Nibu but
does not preserve the interlingua meaning, it also fails. Cute failure is still
failure. It just has better boots.
