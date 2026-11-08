import { createContext } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import type { GameEngine } from '../game/engine';

export const EngineContext = createContext<GameEngine | null>(null);

/** Returns the engine and re-renders the component whenever game state changes. */
export function useEngine(): GameEngine {
  const engine = useContext(EngineContext);
  if (!engine) throw new Error('useEngine must be used inside EngineContext');
  const [, setVersion] = useState(0);
  useEffect(() => engine.subscribe(() => setVersion((v) => v + 1)), [engine]);
  return engine;
}
