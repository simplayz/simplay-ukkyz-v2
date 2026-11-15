import { getStructureDefinition, type PlacedStructure } from "./catalogue";
import type { TerrainScores } from "./terrain";

export const TICK_MS = 15_000;
export const MAX_LAZY_TICKS = 64;
export const LOCK_MS = 72 * 60 * 60 * 1000;

export type SimulationTotals = {
  income: number;
  upkeep: number;
  food: number;
  power: number;
  defence: number;
  prestige: number;
  netIncome: number;
  structureCount: number;
};

export function computeTotals(structures: readonly PlacedStructure[], scores: TerrainScores): SimulationTotals {
  let income = 0;
  let upkeep = 0;
  let food = 0;
  let power = 0;
  let rawDefence = 0;
  let prestige = 0;

  for (const placed of structures) {
    const definition = getStructureDefinition(placed.type);
    const level = Math.max(1, placed.level ?? 1);
    const levelScale = 1 + (level - 1) * 0.35;
    const affinity = Math.max(0, Math.min(1, scores[definition.affinity]));
    const terrainScale = 0.65 + affinity * 0.7;
    income += definition.income * terrainScale * levelScale;
    upkeep += definition.upkeep * (1 + (level - 1) * 0.22);
    food += definition.food * (definition.food > 0 ? terrainScale : 1) * levelScale;
    power += definition.power * (definition.power > 0 ? terrainScale : 1) * levelScale;
    rawDefence += definition.defence * (0.8 + scores.defence * 0.65) * levelScale;
    prestige += definition.prestige * levelScale;
  }

  income = Math.round(income);
  upkeep = Math.round(upkeep);
  food = Math.round(food);
  power = Math.round(power);
  prestige = Math.round(prestige);
  const deficitPenalty = (power < 0 ? 0.28 : 0) + (food < 0 ? 0.22 : 0);
  const netIncome = Math.round((income - upkeep) * (1 - Math.min(0.65, deficitPenalty)));
  const defence = Math.round((rawDefence + scores.defence * 34) * (1 + scores.slope * 0.22));
  return { income, upkeep, food, power, defence, prestige, netIncome, structureCount: structures.length };
}

export type TickState = { credits: number; lastTickAt: Date | string; totals: SimulationTotals };
export type TickResult = { credits: number; lastTickAt: Date; ticks: number; accrued: number; capped: boolean };

export function applyTicks(state: TickState, now = new Date()): TickResult {
  const previous = state.lastTickAt instanceof Date ? state.lastTickAt : new Date(state.lastTickAt);
  const elapsed = Math.max(0, now.getTime() - previous.getTime());
  const availableTicks = Math.floor(elapsed / TICK_MS);
  const ticks = Math.min(MAX_LAZY_TICKS, availableTicks);
  const accrued = ticks * state.totals.netIncome;
  return {
    credits: Math.max(0, state.credits + accrued),
    lastTickAt: new Date(previous.getTime() + ticks * TICK_MS),
    ticks,
    accrued,
    capped: availableTicks > MAX_LAZY_TICKS,
  };
}

export type AssaultInput = {
  seed: number;
  defence: number;
  power: number;
  prestige: number;
  structureCount: number;
};

export type AssaultPhase = {
  phase: "Reconnaissance" | "Bombardment" | "Breach" | "Resolution";
  attacker: number;
  defender: number;
  narrative: string;
};

export type AssaultReport = {
  seed: number;
  enemy: string;
  enemyStrength: number;
  phases: AssaultPhase[];
  victory: boolean;
  reward: number;
  loss: number;
  finalDefence: number;
};

function randomStep(state: { value: number }): number {
  state.value = (state.value + 0x6d2b79f5) | 0;
  let t = state.value;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}

export function resolveAssault(input: AssaultInput): AssaultReport {
  const random = { value: input.seed | 0 };
  const enemyNames = ["Glass Jackals", "Northline Compact", "Red Meridian", "Orchid Fleet", "Kestrel Syndicate"];
  const enemy = enemyNames[Math.floor(randomStep(random) * enemyNames.length)];
  const enemyStrength = Math.round(34 + randomStep(random) * 48 + input.prestige * 0.62 + input.structureCount * 1.8);
  let defence = Math.max(4, input.defence + Math.max(0, input.power) * 0.12);
  const phases: AssaultPhase[] = [];

  const reconAttack = Math.round(enemyStrength * (0.18 + randomStep(random) * 0.12));
  const reconDefence = Math.round(defence * (0.17 + randomStep(random) * 0.13));
  defence = Math.max(0, defence - Math.max(0, reconAttack - reconDefence) * 0.12);
  phases.push({ phase: "Reconnaissance", attacker: reconAttack, defender: reconDefence, narrative: reconDefence >= reconAttack ? "Radar picks out the raider screen; approach vectors are mapped." : "Scouts cross the drainage lines before the claim can triangulate them." });

  const bombardment = Math.round(enemyStrength * (0.3 + randomStep(random) * 0.18));
  const interception = Math.round(defence * (0.2 + randomStep(random) * 0.18) + Math.max(0, input.power) * 0.1);
  const bombardmentDamage = Math.max(2, bombardment - interception);
  defence = Math.max(0, defence - bombardmentDamage * 0.28);
  phases.push({ phase: "Bombardment", attacker: bombardment, defender: interception, narrative: interception >= bombardment ? "Point defence holds the barrage outside the structure ring." : `The barrage lands; ${bombardmentDamage} pressure reaches the perimeter.` });

  const breach = Math.round(enemyStrength * (0.38 + randomStep(random) * 0.2));
  const line = Math.round(defence * (0.34 + randomStep(random) * 0.2));
  defence = Math.max(0, defence + line * 0.08 - breach * 0.3);
  phases.push({ phase: "Breach", attacker: breach, defender: line, narrative: line >= breach ? "Guard teams counterattack at the rampart and close the breach." : "The assault line folds inward toward the command grid." });

  const finalPush = Math.round(enemyStrength * (0.42 + randomStep(random) * 0.22));
  const lastStand = Math.round(defence * (0.45 + randomStep(random) * 0.25));
  const victory = lastStand >= finalPush && defence > 0;
  defence = Math.max(0, defence + (victory ? lastStand * 0.06 : -finalPush * 0.2));
  phases.push({ phase: "Resolution", attacker: finalPush, defender: lastStand, narrative: victory ? "The raiders break formation and abandon the parcel." : "The claim is overrun; the surviving crews withdraw to the reception shelter." });

  return {
    seed: input.seed,
    enemy,
    enemyStrength,
    phases,
    victory,
    reward: victory ? Math.round(450 + enemyStrength * 11 + input.prestige * 4) : 0,
    loss: victory ? 0 : Math.round(280 + enemyStrength * 8),
    finalDefence: Math.round(defence),
  };
}
