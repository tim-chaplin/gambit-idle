# Gambit Idle

An idle/incremental pixel-art JRPG for Android. Recruit a party of heroes, assign classes, loot and upgrade gear, and send them into dungeons. Combat is turn-based and hands-off: instead of picking actions, you program each hero with FF12-style **gambits** (e.g. *"Ally HP < 30% → Cure"*) and watch them fight.

**Stack:** TypeScript + [Phaser](https://phaser.io) (Vite), wrapped for Android with [Capacitor](https://capacitorjs.com). Web and iOS ports reuse the same code.

## Development

```sh
npm install
npm run dev            # play in a browser at localhost:5173
npm run android:sync   # build web assets and copy them into android/
```

## Testing on a phone

Every push to `main` builds a signed APK and publishes it as a GitHub Release.
Download the latest from **[Releases → latest](../../releases/latest)** and install it. Each build upgrades the previous one in place.
