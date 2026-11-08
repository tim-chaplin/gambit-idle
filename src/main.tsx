import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import { render } from 'preact';
import { GameEngine } from './game/engine';
import { App } from './ui/App';
import { EngineContext } from './ui/useEngine';
import './ui/style.css';

const engine = new GameEngine();
engine.start();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') engine.save();
});

render(
  <EngineContext.Provider value={engine}>
    <App />
  </EngineContext.Provider>,
  document.getElementById('app')!,
);
