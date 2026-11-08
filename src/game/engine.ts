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
  innTick,
  isPartyRested,
  isPartyWiped,
  isZoneUnlocked,
  newGame,
  saveBattleVitals,
  serialize,
  type GameState,
} from './state';
import type { Battle, BattleEvent, EquipSlot, Gambit } from './types';

export const TURN_MS = 2000;
export const AFTER_VICTORY_MS = 2000;
export const AFTER_DEFEAT_MS = 3000;
/** Pause for the between-rounds regen step. */
export const REGEN_STEP_MS = 600;
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

/** Live game runtime: owns the state, paces the battle and inn loops, and notifies the UI. */
export class GameEngine {
  state: GameState;
  /** The current fight; null unless the party is fighting. */
  battle: Battle | null = null;
  /** Banner shown between fights, e.g. "Victory! +12 XP". */
  banner: { text: string; tone: 'good' | 'bad' } | null = null;
  log: LogLine[] = [];
  toasts: Toast[] = [];

  private listeners = new Set<() => void>();
  private eventListeners = new Set<(events: BattleEvent[]) => void>();
  private navigateListeners = new Set<(screen: 'town') => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private actionsThisTurn = 1;
  private nextId = 1;

  constructor(
    private rng: Rng = Math.random,
    private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeStorage(),
  ) {
    this.state = deserialize(this.storage?.getItem(SAVE_KEY) ?? null);
    if (!isZoneUnlocked(this.state, this.state.currentZone)) this.state.currentZone = ZONES[0].id;
    // Resume whatever the party was doing when the game was closed.
    if (this.state.activity === 'fighting') {
      if (isPartyWiped(this.state)) this.state.activity = 'resting';
      else this.battle = createBattle(this.state, this.state.currentZone, this.rng);
    }
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  onBattleEvents(fn: (events: BattleEvent[]) => void) {
    this.eventListeners.add(fn);
    return () => void this.eventListeners.delete(fn);
  }

  /** Lets the UI follow the party when the game moves it, e.g. to the Inn after a wipe. */
  onNavigate(fn: (screen: 'town') => void) {
    this.navigateListeners.add(fn);
    return () => void this.navigateListeners.delete(fn);
  }

  start() {
    if (!this.timer) this.schedule(TURN_MS / 2);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // --- Player actions -------------------------------------------------------

  /** Picks a zone. If the party is already fighting, it moves there straight away. */
  selectZone(zoneId: string) {
    if (!isZoneUnlocked(this.state, zoneId) || zoneId === this.state.currentZone) return;
    this.state.currentZone = zoneId;
    if (this.state.activity === 'fighting') {
      this.leaveBattle();
      this.addLog(`Travelled to ${zoneById(zoneId).name}.`, 'info');
      this.newBattle();
    }
    this.save();
  }

  /** Sends the party into the selected zone. */
  startFighting() {
    if (this.state.activity === 'fighting') return;
    if (isPartyWiped(this.state)) {
      this.toast('Your party is too wounded to fight. Rest at the Inn first.');
      return;
    }
    this.state.activity = 'fighting';
    this.addLog(`Entered ${zoneById(this.state.currentZone).name}.`, 'info');
    this.newBattle();
    this.save();
    this.restartTimer(TURN_MS / 2);
  }

  /** Leaves combat, keeping current HP/MP. */
  retreat() {
    if (this.state.activity !== 'fighting') return;
    this.leaveBattle();
    this.state.activity = 'idle';
    this.addLog('The party retreated.', 'info');
    this.save();
  }

  /** Checks the party into the inn to recover over time. */
  rest() {
    if (this.state.activity === 'resting') return;
    this.leaveBattle();
    this.state.activity = 'resting';
    this.addLog('The party checked into the Inn.', 'info');
    this.save();
    this.restartTimer(TURN_MS);
  }

  /** Leaves the inn without starting a fight. */
  leaveInn() {
    if (this.state.activity !== 'resting') return;
    this.state.activity = 'idle';
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
    this.battle = null;
    this.banner = null;
    this.log = [];
    this.toasts = [];
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

  private restartTimer(ms: number) {
    this.stop();
    this.schedule(ms);
  }

  private tick() {
    const { activity } = this.state;
    if (activity === 'fighting') this.schedule(this.fightTick());
    else if (activity === 'resting') this.schedule(this.innTick());
    else this.schedule(TURN_MS);
  }

  /** Advances combat by one action and returns the delay until the next tick. */
  private fightTick(): number {
    if (!this.battle || this.battle.outcome === 'victory') {
      this.newBattle();
      return TURN_MS / 2;
    }
    if (this.battle.outcome === 'defeat') {
      // The wiped party is carried to the inn.
      this.battle = null;
      this.banner = null;
      this.state.activity = 'resting';
      this.toast('Your party was carried to the Inn to recover.');
      this.save();
      for (const fn of this.navigateListeners) fn('town');
      return TURN_MS;
    }

    const events = stepAction(this.battle, this.state, this.rng);
    // A new turn just started: spread its actions evenly across one turn's duration.
    if (events.some((e) => e.type === 'turn')) this.actionsThisTurn = this.battle.queue.length + 1;
    this.describe(events);
    for (const fn of this.eventListeners) fn(events);

    let delay = events.some((e) => e.type === 'regen') ? REGEN_STEP_MS : TURN_MS / this.actionsThisTurn;
    if (this.battle.outcome === 'victory') {
      this.onVictory();
      delay = AFTER_VICTORY_MS;
    } else if (this.battle.outcome === 'defeat') {
      this.onDefeat();
      delay = AFTER_DEFEAT_MS;
    }
    this.emit();
    return delay;
  }

  private innTick(): number {
    if (!isPartyRested(this.state)) {
      innTick(this.state);
      if (isPartyRested(this.state)) {
        this.addLog('The party is fully rested.', 'good');
        this.toast('Your party is fully rested.');
      }
      this.save();
    }
    return TURN_MS;
  }

  private newBattle() {
    this.banner = null;
    this.battle = createBattle(this.state, this.state.currentZone, this.rng);
    this.actionsThisTurn = 1;
    this.emit();
  }

  /** Ends the current fight early, keeping the damage taken so far. */
  private leaveBattle() {
    if (this.battle && !this.battle.outcome) saveBattleVitals(this.state, this.battle);
    this.battle = null;
    this.banner = null;
  }

  private onVictory() {
    const battle = this.battle!;
    const zone = zoneById(battle.zoneId);
    saveBattleVitals(this.state, battle);
    const result = applyVictory(this.state, battle);
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
    saveBattleVitals(this.state, this.battle!);
    this.banner = { text: 'Party defeated...', tone: 'bad' };
    this.addLog('The party was defeated and carried to the Inn.', 'bad');
    this.save();
  }

  private describe(events: BattleEvent[]) {
    const name = (id: string) => this.battle?.combatants.find((c) => c.id === id)?.name ?? '?';
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
        this.addLog(`${name(e.actorId)} has no gambit to follow and waits.`, 'bad');
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
