import { describe, expect, it, vi } from 'vitest';
import {
  getAvatarViewerModelUrl,
  revokeCustomAvatarObjectUrl,
} from '@/core/avatar/avatarSourceAdapter';

describe('avatarSourceAdapter', () => {
  it('returns a viewer model url only for custom avatar sources', () => {
    expect(getAvatarViewerModelUrl({ kind: 'procedural' })).toBeUndefined();
    expect(
      getAvatarViewerModelUrl({
        kind: 'custom',
        fileName: 'hero.glb',
        modelUrl: 'blob:hero',
      }),
    ).toBe('blob:hero');
  });

  it('revokes object urls only for custom avatar sources', () => {
    const revoke = vi.fn();

    revokeCustomAvatarObjectUrl({ kind: 'procedural' }, revoke);
    revokeCustomAvatarObjectUrl(
      {
        kind: 'custom',
        fileName: 'hero.glb',
        modelUrl: 'blob:hero',
      },
      revoke,
    );

    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:hero');
  });
});
