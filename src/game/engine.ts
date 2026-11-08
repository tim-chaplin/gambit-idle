import { createBattle, stepAction } from './combat';
import { ACTIONS } from './data/actions';
import { ZONES, zoneById } from './data/areas';
import { ITEMS } from './data/items';
import type { Rng } from './rng';
import {
  applyVictory,
  buyItem,
  deserialize,
  equipItem,
  isZoneUnlocked,
  newGame,
  serialize,
  type GameState,
} from './state';
import type { Battle, BattleEvent, EquipSlot, Gambit } from './types';

export const TURN_MS = 2000;
export const AFTER_VICTORY_MS = 2000;
export const AFTER_DEFEAT_MS = 3000;
const SAVE_KEY = 'gambit-idle-save';
const LOG_LIMIT = 40;

export interface LogLine {
  id: number;
  text: string;
  tone?: 'good' | 'bad' | 'info';
}

export interface Toast {
  id: number;
  text: string;
}

/** Live game runtime: owns the state, paces the battle loop, and notifies the UI. */
export class GameEngine {
  state: GameState;
  battle: Battle;
  /** Banner shown between fights, e.g. "Victory! +12 XP". */
  banner: { text: string; tone: 'good' | 'bad' } | null = null;
  log: LogLine[] = [];
  toasts: Toast[] = [];

  private listeners = new Set<() => void>();
  private eventListeners = new Set<(events: BattleEvent[]) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private actionsThisTurn = 1;
  private nextId = 1;

  constructor(
    private rng: Rng = Math.random,
    private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeStorage(),
  ) {
    this.state = deserialize(this.storage?.getItem(SAVE_KEY) ?? null);
    if (!isZoneUnlocked(this.state, this.state.currentZone)) this.state.currentZone = ZONES[0].id;
    this.battle = createBattle(this.state, this.state.currentZone, this.rng);
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  onBattleEvents(fn: (events: BattleEvent[]) => void) {
    this.eventListeners.add(fn);
    return () => void this.eventListeners.delete(fn);
  }

  start() {
    if (!this.timer) this.schedule(TURN_MS / 2);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // --- Player actions -------------------------------------------------------

  setZone(zoneId: string) {
    if (!isZoneUnlocked(this.state, zoneId) || zoneId === this.state.currentZone) return;
    this.state.currentZone = zoneId;
    this.addLog(`Travelled to ${zoneById(zoneId).name}.`, 'info');
    this.newBattle();
    this.save();
  }

  buy(itemId: string) {
    if (!buyItem(this.state, itemId)) return;
    this.save();
  }

  equip(heroId: string, slot: EquipSlot, itemId: string | null) {
    if (!equipItem(this.state, heroId, slot, itemId)) return;
    this.save();
  }

  setGambits(heroId: string, gambits: Gambit[]) {
    const hero = this.state.heroes.find((h) => h.id === heroId);
    if (!hero) return;
    hero.gambits = gambits;
    this.save();
  }

  dismissToast(id: number) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.emit();
  }

  resetProgress() {
    this.storage?.removeItem(SAVE_KEY);
    this.state = newGame();
    this.log = [];
    this.toasts = [];
    this.newBattle();
    this.save();
  }

  save() {
    try {
      this.storage?.setItem(SAVE_KEY, serialize(this.state));
    } catch {
      // Storage can be unavailable (private mode, quota); the game keeps running in memory.
    }
    this.emit();
  }

  // --- Loop -----------------------------------------------------------------

  private schedule(ms: number) {
    this.timer = setTimeout(() => this.tick(), ms);
  }

  private tick() {
    if (this.battle.outcome) {
      this.newBattle();
      this.schedule(TURN_MS / Math.max(1, this.battle.combatants.length));
      return;
    }

    const events = stepAction(this.battle, this.state, this.rng);
    // A new turn just started: spread its actions evenly across one turn's duration.
    if (events.some((e) => e.type === 'turn')) this.actionsThisTurn = this.battle.queue.length + 1;
    this.describe(events);
    for (const fn of this.eventListeners) fn(events);

    if (this.battle.outcome === 'victory') this.onVictory();
    else if (this.battle.outcome === 'defeat') this.onDefeat();

    const delay = this.battle.outcome
      ? this.battle.outcome === 'victory'
        ? AFTER_VICTORY_MS
        : AFTER_DEFEAT_MS
      : TURN_MS / this.actionsThisTurn;
    this.emit();
    this.schedule(delay);
  }

  private newBattle() {
    this.banner = null;
    this.battle = createBattle(this.state, this.state.currentZone, this.rng);
    this.actionsThisTurn = 1;
    this.emit();
  }

  private onVictory() {
    const zone = zoneById(this.battle.zoneId);
    const result = applyVictory(this.state, this.battle);
    this.banner = { text: `Victory! +${result.xp} XP  +${result.gold} G`, tone: 'good' };
    this.addLog(`Victory! Gained ${result.xp} XP and ${result.gold} gold.`, 'good');

    for (const lv of result.levelUps) {
      const hero = this.state.heroes.find((h) => h.id === lv.heroId)!;
      this.toast(`${hero.name} reached level ${lv.level}!`);
      for (const skillId of lv.learned) {
        this.toast(`${hero.name} learned ${ACTIONS[skillId].name}! Add it to a gambit in Party.`);
      }
    }

    if (result.zoneCleared) {
      if (zone.boss) {
        this.toast(`${zone.name} conquered! A new hero will join here in a future update.`);
      } else {
        const next = ZONES.find((z) => z.areaId === zone.areaId && z.index === zone.index + 1);
        if (next) {
          this.toast(`${next.name} unlocked!`);
          // Push forward automatically the first time a zone is cleared.
          this.state.currentZone = next.id;
          this.addLog(`Pressing on to ${next.name}.`, 'info');
        }
      }
    }
    this.save();
  }

  private onDefeat() {
    this.banner = { text: 'Party defeated...', tone: 'bad' };
    this.addLog('The party was defeated.', 'bad');
    const zone = zoneById(this.battle.zoneId);
    const prev = ZONES.find((z) => z.areaId === zone.areaId && z.index === zone.index - 1);
    if (prev) {
      // Fall back so an idle party keeps earning instead of wiping forever.
      this.state.currentZone = prev.id;
      this.addLog(`Retreated to ${prev.name}.`, 'info');
    }
    this.save();
  }

  private describe(events: BattleEvent[]) {
    const name = (id: string) => this.battle.combatants.find((c) => c.id === id)?.name ?? '?';
    for (const e of events) {
      if (e.type === 'action') {
        const who = name(e.actorId);
        if (e.heal !== undefined) {
          const target = e.targetId === e.actorId ? '' : ` on ${name(e.targetId)}`;
          this.addLog(`${who} uses ${e.actionName}${target}, restoring ${e.heal} HP.`);
        } else {
          const verb = e.actionId === 'attack' ? 'attacks' : `uses ${e.actionName} on`;
          const stun = e.stun ? ' Stunned!' : '';
          this.addLog(`${who} ${verb} ${name(e.targetId)} for ${e.damage}.${stun}`);
        }
      } else if (e.type === 'stunned') {
        this.addLog(`${name(e.actorId)} is stunned and can't act.`);
      } else if (e.type === 'defeated') {
        this.addLog(`${name(e.targetId)} is defeated!`, 'info');
      } else if (e.type === 'idle') {
        this.addLog(`${name(e.actorId)} waits.`);
      }
    }
  }

  private addLog(text: string, tone?: LogLine['tone']) {
    this.log = [{ id: this.nextId++, text, tone }, ...this.log].slice(0, LOG_LIMIT);
  }

  private toast(text: string) {
    const id = this.nextId++;
    this.toasts = [...this.toasts, { id, text }];
    setTimeout(() => this.dismissToast(id), 6000);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }
}

function safeStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Display helper: "+3 ATK" style summary for equipment. */
export function itemBonus(itemId: string): string {
  const item = ITEMS[itemId];
  if (!item) return '';
  if (item.atk) return `+${item.atk} ATK`;
  if (item.def) return `+${item.def} DEF`;
  if (item.consumable) return ACTIONS[itemId]?.description ?? '';
  return '';
}
