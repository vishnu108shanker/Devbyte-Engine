# DevByte Remotion Renderer

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

This package renders the DevByte vertical video compositions. The renderer
receives script props and an audio-derived frame count from
`services/render.js`; `FreeAlternative` then calculates sound-synchronized
scene and bullet timing at render time.

## Commands

**Install Dependencies**

```console
npm i
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
node ../services/render.js --input ../data/validated_script.json --audio ../data/audio.mp3 --output ../data/video.mp4
```

Run the same renderer through Docker from the repository root:

```console
docker compose run --rm devbyte node services/render.js --input data/validated_script.json --audio data/audio.mp3 --output data/video.mp4
```

## Timing Engine

`src/utils/timing.ts` exports `calculateSceneAndBulletTimings()`. It produces
contiguous hook, body, and CTA scene boundaries from explicit sentence timing
metadata when available. Supported inputs include `sentence_timings`,
`sentence_durations`, `metadata`, and structured or array-based `timings`.
Numeric durations of 60 or fewer are treated as seconds; larger values are
treated as frames.

With missing or partial metadata, the engine uses a word-weighted proportional
fallback based on the hook, each body sentence, and the CTA. Body bullet delays
are cumulative sentence start frames, so visual entry follows the narration
rather than a fixed stagger. The renderer also exposes an `isActive` state for
the currently narrated bullet.

## Bullet Badges

Feature bullets use custom SVG badges in four rotating themes:

- Zap: electric cyan and neon blue
- Neural core: hot pink and neon violet
- Rocket: vivid amber and fiery red
- Sparkle: emerald green and cyan

Each badge is a fixed 76x76 glassmorphic container. The active bullet gets an
accent border, surface glow, and pulse, so output is consistent in headless
Chromium and does not depend on installed emoji fonts.

**Upgrade Remotion**

```console
npx remotion upgrade
```

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
