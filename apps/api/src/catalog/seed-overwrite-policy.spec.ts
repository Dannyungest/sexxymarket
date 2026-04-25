import { resolveSeedOverwriteDecision } from './seed-overwrite-policy';

describe('seed overwrite policy', () => {
  it('creates when product does not exist', () => {
    expect(
      resolveSeedOverwriteDecision({
        exists: false,
        forceSeedUpdate: false,
        isAuthoredProduct: false,
      }),
    ).toBe('create');
  });

  it('skips authored product even when force update is true', () => {
    expect(
      resolveSeedOverwriteDecision({
        exists: true,
        forceSeedUpdate: true,
        isAuthoredProduct: true,
      }),
    ).toBe('skip');
  });

  it('skips existing product by default when force is off', () => {
    expect(
      resolveSeedOverwriteDecision({
        exists: true,
        forceSeedUpdate: false,
        isAuthoredProduct: false,
      }),
    ).toBe('skip');
  });

  it('updates existing non-authored product when force is enabled', () => {
    expect(
      resolveSeedOverwriteDecision({
        exists: true,
        forceSeedUpdate: true,
        isAuthoredProduct: false,
      }),
    ).toBe('update');
  });
});
