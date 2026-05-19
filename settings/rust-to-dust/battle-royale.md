# Battle Royale

The battle royale is one public view into Rust to Dust, not the whole setting.

It is a controlled imperial event designed to discover, display, and promote
human combat prowess. The aliens do not treat it as the real war for humanity's
future. They treat it as spectacle, talent development, cultural tourism, and
proof that humans may be crude but are not empty.

Aliens who enter these events in mechs or heavy armor are tourists buying an
experience, not respected warrior exemplars. Their culture reads that kind of
overmatch as inelegant. The alien who arrives lightly equipped, even against
human firepower, is more dangerous because they are actually pursuing honor
through visible mastery.

## Broadcast

An in-universe alien TV channel commentates on what players are doing. The
player hears or sees the alien-language broadcast with English subtitles.

The correct runtime model is not English-to-alien translation. The game should
emit a Weksa interlingua packet for commentary intent. Weksa should render alien
broadcast output, and a subtitle renderer should render English from the same
packet or from the alien-projected meaning.

```text
game telemetry
  -> commentary intent
  -> imperial cultural projection
  -> alien broadcast render
  -> flavor-first English subtitle
```

## Flavor-First Subtitles

Subtitles should usually reflect the imperial reading of events, not a neutral
sports-stat description.

Neutral fact:

```json
{
  "type": "elimination",
  "actor": "human_player_17",
  "target": "human_player_04",
  "method": "knife",
  "context": "ambush"
}
```

Possible imperial subtitle:

```text
Local contender 17 performs a charming low-tool eviction. The crowd appreciates
the sincerity.
```

The subtitle remains legible, but it teaches the player that the empire's frame
has already touched the facts.

## Commentary Ontology

The broadcast surface should care about:

- spectacle value
- aesthetic form
- combat elegance
- vulgarity
- sincerity
- aesthetic promise
- tourist appeal
- inelegant overmatch
- chosen constraint
- human authenticity
- imperial amusement
- whether resistance reads as threat, folk art, or breakout talent
