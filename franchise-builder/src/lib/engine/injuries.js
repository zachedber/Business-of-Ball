import { clamp, rand, randFloat, r1 } from './roster';
import { longTermInjuries, shortTermInjuries } from '@/data/eventFlavor';

export function predictInjury(age, seasons, medStaff, trait, rating) {
  let risk = 0.08;
  if (age > 30) risk += (age - 30) * 0.02;
  if (age > 34) risk += (age - 34) * 0.03;
  risk += seasons * 0.005 - medStaff * 0.025;
  if (trait === 'injury_prone') risk *= 2;
  if (trait === 'ironman') risk *= 0.4;
  if (rating > 85) risk *= 0.85;
  return clamp(risk + randFloat(-0.02, 0.02), 0.02, 0.65);
}

export function rollForInjuries(roster, sportsScienceTier, recoveryCenter) {
  const players = Array.isArray(roster) ? roster : [];
  const tier = clamp(Number(sportsScienceTier) || 0, 0, 3);
  const modifier = 1 - (tier * 0.1);

  return players.flatMap((p) => {
    const activeDuration = Number(p?.injuryStatus?.duration) || 0;
    if (activeDuration > 0) return [];

    const baseChance = p?.injuryProne ? 0.15 : 0.05;
    if (Math.random() >= baseChance * modifier) return [];

    const isLongTerm = Math.random() >= 0.8;
    let duration = isLongTerm ? 4 : 1;
    if (recoveryCenter) duration = Math.max(1, duration - 1);

    return [{
      playerId: p.id,
      severity: isLongTerm ? 'long_term' : 'short_term',
      duration,
    }];
  });
}

export function processQuarterInjuries(franchise) {
  const pickArr = arr => arr[Math.floor(Math.random() * arr.length)];
  const injuryNotifs = [];
  let updated = { ...franchise };

  for (const slotKey of ['star1', 'star2', 'corePiece']) {
    const player = updated[slotKey];
    if (!player || !player.injured) continue;

    if (!player.injuryName) {
      const isLong = player.injurySeverity === 'severe' || (player.injuryStatus?.severity === 'long_term');
      player.injuryName = isLong ? pickArr(longTermInjuries) : pickArr(shortTermInjuries);
    }

    const isLongTerm = player.injurySeverity === 'severe' || (player.injuryStatus?.severity === 'long_term');
    if (!isLongTerm) {
      injuryNotifs.push({
        id: `injury_${player.id}_${Date.now()}`,
        severity: 'warning',
        message: `${player.name} is dealing with a ${player.injuryName}. Expected to miss ${player.gamesOut || 'a few'} games.`,
        type: 'player',
      });
      continue;
    }

    const taxi = updated.taxiSquad || [];
    const bestTaxi = [...taxi].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
    if (bestTaxi) {
      injuryNotifs.push({
        id: `injury_${player.id}_${Date.now()}`,
        severity: 'critical',
        message: `${player.name} has suffered a ${player.injuryName} and will miss the remainder of the season. Calling up ${bestTaxi.name} from Taxi Squad.`,
        type: 'player',
      });
      const injuredSnapshot = { ...player };
      updated[slotKey] = { ...bestTaxi, replacingInjured: injuredSnapshot.name, replacingInjuryName: injuredSnapshot.injuryName };
      updated.taxiSquad = taxi.filter(t => t.id !== bestTaxi.id);
      updated.players = [updated.star1, updated.star2, updated.corePiece].filter(Boolean);
      updated.rosterQuality = updated.players.length > 0 ? Math.round(updated.players.reduce((s, p) => s + (p.rating || 0), 0) / updated.players.length) : 0;
      updated.totalSalary = r1(updated.players.reduce((s, p) => s + (p.salary || 0), 0));
    } else {
      injuryNotifs.push({
        id: `injury_${player.id}_${Date.now()}`,
        severity: 'critical',
        message: `${player.name} has suffered a ${player.injuryName} and will miss the remainder of the season. No taxi squad replacement available.`,
        type: 'player',
      });
    }
  }

  return { franchise: updated, notifications: injuryNotifs };
}

export function rollSeasonInjuries(players, games, medicalStaff) {
  return players.map((p) => {
    const risk = predictInjury(p.age, p.seasonsPlayed, medicalStaff, p.trait, p.rating);
    if (Math.random() >= risk) {
      return { ...p, injured: false, injurySeverity: null, gamesOut: 0 };
    }
    const severityRoll = Math.random();
    if (severityRoll < 0.5) return { ...p, injured: true, injurySeverity: 'minor', gamesOut: rand(2, 4) };
    if (severityRoll < 0.85) return { ...p, injured: true, injurySeverity: 'moderate', gamesOut: rand(6, 10) };
    return { ...p, injured: true, injurySeverity: 'severe', gamesOut: games };
  });
}
