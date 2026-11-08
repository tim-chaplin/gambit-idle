export interface ZoneDef {
  id: string;
  name: string;
  enemies: string[];
  groupSize: [number, number];
  /** Victories needed to clear the zone and unlock the next one. */
  killsToClear: number;
  boss?: boolean;
}

export interface AreaDef {
  id: string;
  name: string;
  zones: ZoneDef[];
}

export const AREAS: AreaDef[] = [
  {
    id: 'slime-fields',
    name: 'Slime Fields',
    zones: [
      { id: 'sf-1', name: "Meadow's Edge", enemies: ['green-slime'], groupSize: [1, 2], killsToClear: 8 },
      { id: 'sf-2', name: 'Tall Grass', enemies: ['green-slime', 'blue-slime'], groupSize: [1, 3], killsToClear: 12 },
      { id: 'sf-3', name: 'Muddy Hollow', enemies: ['blue-slime', 'mud-slime'], groupSize: [2, 3], killsToClear: 15 },
      { id: 'sf-4', name: 'Bubbling Pools', enemies: ['mud-slime', 'red-slime'], groupSize: [2, 3], killsToClear: 20 },
      { id: 'sf-5', name: 'Royal Puddle', enemies: ['king-slime'], groupSize: [1, 1], killsToClear: 1, boss: true },
    ],
  },
];

export const ZONES = AREAS.flatMap((area) => area.zones.map((zone, index) => ({ ...zone, areaId: area.id, index })));

export function zoneById(id: string) {
  const zone = ZONES.find((z) => z.id === id);
  if (!zone) throw new Error(`Unknown zone ${id}`);
  return zone;
}
