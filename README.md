# Gambit Idle

An idle/incremental pixel-art JRPG for Android. Recruit a party of heroes, assign classes, loot and upgrade gear, and send them into dungeons. Combat is turn-based and hands-off: instead of picking actions, you program each hero with FF12-style **gambits** (e.g. *"Ally HP < 30% → Cure"*) and watch them fight.

**Stack:** TypeScript + [Preact](https://preactjs.com) (Vite), wrapped for Android with [Capacitor](https://capacitorjs.com). Game rules live in `src/game/` (pure TS, unit-tested); UI in `src/ui/`. Sprites are PNGs in `public/sprites/` (placeholders from `scripts/make-placeholder-sprites.mjs`; replace with real art using the same filenames).

## Development

```sh
npm install
npm run dev            # play in a browser at localhost:5173
npm test               # rules + balance simulation
npm run android:sync   # build web assets and copy them into android/
```

## Testing on a phone

Every push to `main` deploys a playable web build to GitHub Pages (once enabled) and builds a signed APK, published as a GitHub Release.
Download the latest from **[Releases → latest](../../releases/latest)** and install it. Each build upgrades the previous one in place.
