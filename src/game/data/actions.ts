/** Everything a gambit can do: class skills and consumable items. */
export interface ActionDef {
  id: string;
  name: string;
  description: string;
  kind: 'skill' | 'item';
  target: 'foe' | 'ally';
  mpCost: number;
  /** Damage multiplier applied to attack. */
  power?: number;
  stun?: boolean;
  heal?: number;
}

export const ACTIONS: Record<string, ActionDef> = {
  attack: {
    id: 'attack',
    name: 'Attack',
    kind: 'skill',
    target: 'foe',
    mpCost: 0,
    power: 1,
    description: 'A basic weapon strike.',
  },
  'shield-bash': {
    id: 'shield-bash',
    name: 'Shield Bash',
    kind: 'skill',
    target: 'foe',
    mpCost: 4,
    power: 0.8,
    stun: true,
    description: 'A weaker hit that stuns, so the target skips its next action. Costs 4 MP.',
  },
  potion: {
    id: 'potion',
    name: 'Potion',
    kind: 'item',
    target: 'ally',
    mpCost: 0,
    heal: 40,
    description: 'Restores 40 HP. Single use.',
  },
};
