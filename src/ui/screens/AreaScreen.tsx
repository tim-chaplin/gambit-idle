import { useEffect, useState } from 'preact/hooks';
import { AREAS, zoneById } from '../../game/data/areas';
import { CLASSES } from '../../game/data/classes';
import { heroStats, heroVitals, isPartyWiped, isZoneCleared, isZoneUnlocked } from '../../game/state';
import type { Battle, BattleEvent, Combatant } from '../../game/types';
import { Bar, Panel, Sprite } from '../components';
import { useEngine } from '../useEngine';

interface Float {
  id: number;
  targetId: string;
  text: string;
  kind: 'dmg' | 'heal' | 'info' | 'mp';
}

let floatId = 0;

function BattleView({ battle }: { battle: Battle }) {
  const engine = useEngine();
  const [floats, setFloats] = useState<Float[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [hit, setHit] = useState<string | null>(null);

  useEffect(
    () =>
      engine.onBattleEvents((events: BattleEvent[]) => {
        const added: Float[] = [];
        for (const e of events) {
          if (e.type === 'action') {
            setActing(e.actorId);
            if (e.damage !== undefined) {
              setHit(e.targetId);
              added.push({ id: ++floatId, targetId: e.targetId, text: `${e.damage}`, kind: 'dmg' });
            }
            if (e.heal !== undefined) added.push({ id: ++floatId, targetId: e.targetId, text: `+${e.heal}`, kind: 'heal' });
            if (e.stun) added.push({ id: ++floatId, targetId: e.targetId, text: 'STUN', kind: 'info' });
          } else if (e.type === 'regen') {
            for (const g of e.gains) added.push({ id: ++floatId, targetId: g.id, text: `+${g.mp}`, kind: 'mp' });
          } else if (e.type === 'stunned') {
            added.push({ id: ++floatId, targetId: e.actorId, text: 'zzz', kind: 'info' });
          }
        }
        if (added.length) {
          setFloats((f) => [...f, ...added]);
          setTimeout(() => setFloats((f) => f.filter((x) => !added.includes(x))), 1000);
        }
        setTimeout(() => {
          setActing(null);
          setHit(null);
        }, 350);
      }),
    [engine],
  );

  const unit = (c: Combatant) => {
    const classes = ['unit', c.hp <= 0 ? 'dead' : '', acting === c.id ? 'acting' : '', hit === c.id ? 'hit' : '', c.side];
    return (
      <div class={classes.join(' ')} key={c.id}>
        <div class="unit-sprite">
          <Sprite sprite={c.sprite} size={c.boss ? 96 : 56} class={c.side === 'party' ? 'flip' : ''} />
          {c.stunned > 0 && c.hp > 0 && <span class="status-tag">STUN</span>}
          {floats
            .filter((f) => f.targetId === c.id)
            .map((f) => (
              <span class={`float float-${f.kind}`} key={f.id}>
                {f.text}
              </span>
            ))}
        </div>
        <div class="unit-name">{c.name}</div>
        <Bar kind="hp" value={c.hp} max={c.stats.maxHp} label={c.side === 'party' ? `${c.hp}/${c.stats.maxHp}` : undefined} />
        {c.side === 'party' && <Bar kind="mp" value={c.mp} max={c.stats.maxMp} label={`${c.mp}/${c.stats.maxMp}`} />}
      </div>
    );
  };

  return (
    <div class="stage">
      <div class="stage-top">
        <span>{zoneById(battle.zoneId).name}</span>
        <span>Turn {Math.max(1, battle.turn)}</span>
      </div>
      <button class="btn btn-small retreat" onClick={() => engine.retreat()}>
        Retreat
      </button>
      <div class="row enemies">{battle.combatants.filter((c) => c.side === 'enemy').map(unit)}</div>
      <div class="row party">{battle.combatants.filter((c) => c.side === 'party').map(unit)}</div>
      {engine.banner && <div class={`banner banner-${engine.banner.tone}`}>{engine.banner.text}</div>}
    </div>
  );
}

/** Shown before the party enters combat, so the player can look things over and press Fight. */
function PreBattleView({ onOpenParty }: { onOpenParty: () => void }) {
  const engine = useEngine();
  const { state } = engine;
  const wiped = isPartyWiped(state);
  const unprogrammed = state.heroes.filter((h) => !h.gambits.some((g) => g.enabled));

  return (
    <div class="stage">
      <div class="stage-top">
        <span>{zoneById(state.currentZone).name}</span>
        <span>{state.activity === 'resting' ? 'Resting at the Inn' : 'Ready'}</span>
      </div>
      <div class="stage-center">
        {unprogrammed.length > 0 && (
          <div class="notice">
            {unprogrammed.map((h) => h.name).join(', ')} {unprogrammed.length > 1 ? 'have' : 'has'} no gambits and will just
            stand there.
            <button class="btn btn-small" onClick={onOpenParty}>
              Set up gambits
            </button>
          </div>
        )}
        {wiped && <div class="notice">Your party is too wounded to fight. Rest at the Inn in Town.</div>}
        <button class="btn btn-fight" disabled={wiped} onClick={() => engine.startFighting()}>
          Fight!
        </button>
      </div>
      <div class="row party">
        {state.heroes.map((hero) => {
          const stats = heroStats(hero);
          const { hp, mp } = heroVitals(hero);
          return (
            <div class={`unit party ${hp <= 0 ? 'dead' : ''}`} key={hero.id}>
              <div class="unit-sprite">
                <Sprite sprite={CLASSES[hero.classId].sprite} size={56} class="flip" />
              </div>
              <div class="unit-name">{hero.name}</div>
              <Bar kind="hp" value={hp} max={stats.maxHp} label={`${hp}/${stats.maxHp}`} />
              <Bar kind="mp" value={mp} max={stats.maxMp} label={`${mp}/${stats.maxMp}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AreaScreen({ areaId, onOpenParty }: { areaId: string; onOpenParty: () => void }) {
  const engine = useEngine();
  const area = AREAS.find((a) => a.id === areaId)!;
  const { state } = engine;

  return (
    <div class="screen">
      <h1 class="screen-title">{area.name}</h1>
      {engine.battle && state.activity === 'fighting' ? (
        <BattleView battle={engine.battle} />
      ) : (
        <PreBattleView onOpenParty={onOpenParty} />
      )}
      <Panel title="Battle log">
        <ul class="log">
          {engine.log.slice(0, 6).map((line) => (
            <li key={line.id} class={line.tone ? `log-${line.tone}` : ''}>
              {line.text}
            </li>
          ))}
          {engine.log.length === 0 && <li class="muted">Pick a zone and press Fight!</li>}
        </ul>
      </Panel>
      <Panel title="Zones">
        <div class="zones">
          {area.zones.map((zone, i) => {
            const unlocked = isZoneUnlocked(state, zone.id);
            const cleared = isZoneCleared(state, zone.id);
            const kills = Math.min(state.zoneKills[zone.id] ?? 0, zone.killsToClear);
            const current = state.currentZone === zone.id;
            return (
              <button
                class={`zone ${current ? 'current' : ''} ${zone.boss ? 'boss' : ''}`}
                disabled={!unlocked}
                onClick={() => engine.selectZone(zone.id)}
              >
                <span class="zone-name">
                  {i + 1}. {unlocked ? zone.name : '???'}
                </span>
                <span class="zone-progress">
                  {!unlocked ? 'Locked' : zone.boss ? (cleared ? 'Defeated' : 'BOSS') : cleared ? 'Cleared' : `${kills}/${zone.killsToClear}`}
                </span>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
