import { Role } from './types';

const shuffle = <T,>(arr: T[]) => {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const buildRolePool = (playerCount: number): Role[] => {
  if (playerCount < 4) return Array.from({ length: playerCount }, () => 'townie');

  const mafiaCount = playerCount >= 9 ? 2 : 1;
  const pool: Role[] = Array.from({ length: mafiaCount }, () => 'mafia');

  if (playerCount >= 5) pool.push('doctor');
  if (playerCount >= 6) pool.push('detective');
  if (playerCount >= 7) pool.push('gossip');

  while (pool.length < playerCount) pool.push('townie');
  return shuffle(pool);
};

export function distributeRoles(playerIds: string[]) {
  const pool = buildRolePool(playerIds.length);
  return playerIds.map((id, idx) => ({ id, role: pool[idx] }));
}
