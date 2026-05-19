# Flavored English Lowering

Version: `0.1-draft`

Weksa's first lowering target is flavored English dialogue.

Before Weksa tries to lower interlingua into alien language, it should prove the
middle of the machine in a language humans can judge directly:

```text
interlingua packet
  -> agent-state projection
  -> flavored English dialogue
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

The lowerer must not emit:

- raw agent-state internals
- hidden author notes
- target-language alien forms
- facts not available to the speaker unless clearly marked as a guess
- a line that contradicts required interlingua constraints

## Speech Boundary

Speech synthesis belongs downstream. AquaSynth is busy proving IPA, phoneme, and
vocal-tract parity; Weksa should not duplicate that work.

Weksa's first deliverable is the English line and traceable projection context.
When speech work needs it, AquaSynth can consume `spoken_text` and decide how to
lower it into its own phonetic and articulatory contracts.

Weksa still owns the optional pronunciation plan for English output: tokenizing
the line, choosing word pronunciations, preserving stress, and stringing broad
IPA together. See [English Pronunciation Lowering](./english-pronunciation-lowering.md).

Weksa should also emit a learned line-expression vector when training data and
encoder support exist. That vector is the intended compact handoff for prosody,
emphasis, and character delivery pressure. See
[Line Expression Vector](./line-expression-vector.md).

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
4. Check whether the line still satisfies the interlingua packet.
5. Check whether the line sounds like Nibu for the right reasons.

If the line only sounds like generic snark, it fails. If it sounds like Nibu but
does not preserve the interlingua meaning, it also fails. Cute failure is still
failure. It just has better boots.
