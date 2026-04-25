import { BadRequestException } from '@nestjs/common';
import { CatalogService } from './catalog.service';

describe('CatalogService semantic validation', () => {
  const service = new CatalogService({} as never, {} as never);

  it('rejects duplicate option values', () => {
    expect(() =>
      (
        service as unknown as {
          validatePayloadSemantics: (
            payload: Record<string, unknown>,
            options: Array<{
              name: string;
              values: Array<{ value: string }>;
            }>,
            variants: Array<unknown>,
          ) => void;
        }
      ).validatePayloadSemantics(
        {},
        [
          {
            name: 'Color',
            values: [{ value: 'Black' }, { value: 'black' }],
          },
        ],
        [],
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects malformed variation table row lengths', () => {
    expect(() =>
      (
        service as unknown as {
          validatePayloadSemantics: (
            payload: Record<string, unknown>,
            options: Array<unknown>,
            variants: Array<unknown>,
          ) => void;
        }
      ).validatePayloadSemantics(
        {
          variationGuideTable: {
            title: 'Size chart',
            headers: ['Bust', 'Waist'],
            rows: [{ label: 'S', cells: ['84-88'] }],
          },
        },
        [],
        [],
      ),
    ).toThrow(BadRequestException);
  });

  it('preserves lifecycle status on patch without lifecycleAction', () => {
    const lifecycle = (
      service as unknown as {
        resolveLifecycle: (
          payload: Record<string, unknown>,
          currentStatus?: 'DRAFT' | 'READY_FOR_REVIEW' | 'PUBLISHED',
        ) => { status: string; explicitTransition: boolean; action: string };
      }
    ).resolveLifecycle({}, 'PUBLISHED');

    expect(lifecycle.status).toBe('PUBLISHED');
    expect(lifecycle.explicitTransition).toBe(false);
    expect(lifecycle.action).toBe('KEEP');
  });
});
