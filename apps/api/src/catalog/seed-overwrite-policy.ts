export type SeedOverwriteDecision = 'create' | 'skip' | 'update';

export function resolveSeedOverwriteDecision(params: {
  exists: boolean;
  forceSeedUpdate: boolean;
  isAuthoredProduct: boolean;
}): SeedOverwriteDecision {
  const { exists, forceSeedUpdate, isAuthoredProduct } = params;
  if (!exists) return 'create';
  if (isAuthoredProduct) return 'skip';
  if (!forceSeedUpdate) return 'skip';
  return 'update';
}
