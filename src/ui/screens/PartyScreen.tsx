import { itemBonus } from '../../game/engine';
import { ACTIONS } from '../../game/data/actions';
import { CLASSES } from '../../game/data/classes';
import { ITEMS } from '../../game/data/items';
import { CONDITIONS, CONDITION_IDS } from '../../game/gambits';
import { gambitActions, heroStats, heroVitals, learnedSkills, xpToNext } from '../../game/state';
import type { EquipSlot, Gambit, Hero } from '../../game/types';
import { Bar, Panel, Sprite } from '../components';
import { useEngine } from '../useEngine';

const SLOTS: { slot: EquipSlot; label: string }[] = [
  { slot: 'weapon', label: 'Weapon' },
  { slot: 'armor', label: 'Armor' },
];

function GambitEditor({ hero }: { hero: Hero }) {
  const engine = useEngine();
  const cls = CLASSES[hero.classId];
  const actions = gambitActions(hero);
  const update = (gambits: Gambit[]) => engine.setGambits(hero.id, gambits);
  const change = (i: number, patch: Partial<Gambit>) =>
    update(hero.gambits.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...hero.gambits];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    update(next);
  };

  return (
    <div class="gambits">
      <p class="hint">Each turn, the hero uses the first rule that applies. If none apply, the hero does nothing!</p>
      {hero.gambits.map((g, i) => {
        const condition = CONDITIONS[g.condition];
        const action = ACTIONS[g.action];
        const mismatch = condition && action && condition.side !== action.target;
        return (
          <div class={`gambit ${g.enabled ? '' : 'off'} ${mismatch ? 'invalid' : ''}`} key={i}>
            <div class="gambit-main">
              <label class="toggle" title="Enable rule">
                <input type="checkbox" checked={g.enabled} onChange={() => change(i, { enabled: !g.enabled })} />
                <span>{i + 1}</span>
              </label>
              <select
                value={g.condition}
                onChange={(e) => {
                  const condition = (e.target as HTMLSelectElement).value;
                  const side = CONDITIONS[condition].side;
                  // Keep the rule valid: swap to a matching action if the side changed.
                  const keep = ACTIONS[g.action]?.target === side;
                  const action = keep ? g.action : actions.find((a) => ACTIONS[a].target === side) ?? g.action;
                  change(i, { condition, action });
                }}
              >
                {CONDITION_IDS.map((id) => (
                  <option value={id}>{CONDITIONS[id].label}</option>
                ))}
              </select>
            </div>
            <div class="gambit-main">
              <span class="arrow">{'>'}</span>
              <select value={g.action} onChange={(e) => change(i, { action: (e.target as HTMLSelectElement).value })}>
                {actions.map((id) => (
                  <option value={id} disabled={condition && ACTIONS[id].target !== condition.side}>
                    {ACTIONS[id].name}
                  </option>
                ))}
              </select>
              <div class="gambit-tools">
              <button class="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                ▲
              </button>
              <button class="icon-btn" disabled={i === hero.gambits.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                ▼
              </button>
              <button class="icon-btn" onClick={() => update(hero.gambits.filter((_, j) => j !== i))} aria-label="Delete">
                ✕
              </button>
              </div>
            </div>
            {mismatch && <div class="gambit-warn">This action can't target that.</div>}
          </div>
        );
      })}
      {hero.gambits.length < cls.gambitSlots && (
        <button class="btn btn-wide" onClick={() => update([...hero.gambits, { enabled: true, condition: 'foe-any', action: 'attack' }])}>
          + Add rule ({hero.gambits.length}/{cls.gambitSlots})
        </button>
      )}
    </div>
  );
}

function HeroCard({ hero }: { hero: Hero }) {
  const engine = useEngine();
  const { state } = engine;
  const cls = CLASSES[hero.classId];
  const stats = heroStats(hero);
  const learned = learnedSkills(hero);
  const need = xpToNext(hero.level);
  const vitals = heroVitals(hero);

  return (
    <>
      <Panel>
        <div class="hero-head">
          <Sprite sprite={cls.sprite} size={64} />
          <div class="hero-meta">
            <div class="hero-name">{hero.name}</div>
            <div class="muted">
              Lv {hero.level} {cls.name}
            </div>
            <Bar kind="xp" value={hero.xp} max={need} label={`XP ${hero.xp}/${need}`} />
          </div>
        </div>
        <div class="stats">
          <div><span>HP</span>{vitals.hp}/{stats.maxHp}</div>
          <div><span>MP</span>{vitals.mp}/{stats.maxMp}</div>
          <div><span>ATK</span>{stats.atk}</div>
          <div><span>DEF</span>{stats.def}</div>
        </div>
      </Panel>

      <Panel title="Equipment">
        {SLOTS.map(({ slot, label }) => {
          const current = hero.equipment[slot];
          const options = Object.keys(state.inventory).filter((id) => ITEMS[id]?.slot === slot && state.inventory[id] > 0);
          return (
            <label class="equip-stack">
              <span class="equip-label">{label}</span>
              <select
                value={current ?? ''}
                onChange={(e) => engine.equip(hero.id, slot, (e.target as HTMLSelectElement).value || null)}
              >
                {current && <option value={current}>{`${ITEMS[current].name} (${itemBonus(current)})`}</option>}
                {options
                  .filter((id) => id !== current)
                  .map((id) => (
                    <option value={id}>{`${ITEMS[id].name} (${itemBonus(id)})`}</option>
                  ))}
                <option value="">(none)</option>
              </select>
            </label>
          );
        })}
        <p class="hint">Gear changes apply from the next fight. Buy more in Town.</p>
      </Panel>

      <Panel title="Skills">
        <ul class="skills">
          {cls.skills.map(({ skillId, level }) => {
            const action = ACTIONS[skillId];
            const known = learned.includes(skillId);
            return (
              <li class={known ? '' : 'locked'}>
                <div class="skill-name">
                  {action.name}
                  <span class="badge">{known ? (action.mpCost ? `${action.mpCost} MP` : 'Known') : `Lv ${level}`}</span>
                </div>
                <div class="muted">{action.description}</div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Gambits">
        <GambitEditor hero={hero} />
      </Panel>
    </>
  );
}

export function PartyScreen() {
  const engine = useEngine();
  const { state } = engine;
  return (
    <div class="screen">
      <h1 class="screen-title">Party</h1>
      {state.heroes.map((hero) => (
        <HeroCard hero={hero} key={hero.id} />
      ))}
      <Panel title="Items">
        <div class="equip-row">
          <span>Potions</span>
          <span>{state.inventory.potion ?? 0}</span>
        </div>
      </Panel>
      <button
        class="btn btn-danger btn-wide"
        onClick={() => {
          if (confirm('Erase all progress and start over?')) engine.resetProgress();
        }}
      >
        Reset progress
      </button>
    </div>
  );
}
