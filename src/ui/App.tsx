import { useState } from 'preact/hooks';
import { AREAS } from '../game/data/areas';
import { AreaScreen } from './screens/AreaScreen';
import { PartyScreen } from './screens/PartyScreen';
import { TownScreen } from './screens/TownScreen';
import { useEngine } from './useEngine';

declare const __BUILD_ID__: string;

type Screen = { kind: 'party' } | { kind: 'town' } | { kind: 'area'; areaId: string };

export function App() {
  const engine = useEngine();
  const [screen, setScreen] = useState<Screen>({ kind: 'area', areaId: AREAS[0].id });

  const navItems: { label: string; screen: Screen; active: boolean }[] = [
    { label: 'Party', screen: { kind: 'party' }, active: screen.kind === 'party' },
    { label: 'Town', screen: { kind: 'town' }, active: screen.kind === 'town' },
    ...AREAS.map((area) => ({
      label: area.name,
      screen: { kind: 'area', areaId: area.id } as Screen,
      active: screen.kind === 'area' && screen.areaId === area.id,
    })),
  ];

  return (
    <div class="app">
      <nav class="nav">
        <div class="gold" title="Gold">
          <span class="coin" />
          {engine.state.gold}
        </div>
        {navItems.map((item) => (
          <button class={`nav-btn ${item.active ? 'active' : ''}`} onClick={() => setScreen(item.screen)}>
            {item.label}
          </button>
        ))}
        <div class="build">build {__BUILD_ID__}</div>
      </nav>
      <main class="main">
        {screen.kind === 'party' && <PartyScreen />}
        {screen.kind === 'town' && <TownScreen />}
        {screen.kind === 'area' && <AreaScreen areaId={screen.areaId} />}
      </main>
      <div class="toasts">
        {engine.toasts.map((t) => (
          <button class="toast" key={t.id} onClick={() => engine.dismissToast(t.id)}>
            {t.text}
          </button>
        ))}
      </div>
    </div>
  );
}
