import { describe, expect, it, vi } from 'vitest';
import {
  getAvatarViewerModelUrl,
  revokeCustomAvatarObjectUrl,
} from '@/core/avatar/avatarSourceAdapter';
import { DEFAULT_AVATAR_MODEL_URL } from '@/core/avatar/constants';

describe('avatarSourceAdapter', () => {
  it('returns a viewer model url for custom and builtin avatar sources', () => {
    expect(getAvatarViewerModelUrl({ kind: 'procedural' })).toBeUndefined();
    expect(getAvatarViewerModelUrl({ kind: 'builtin' })).toBe(DEFAULT_AVATAR_MODEL_URL);
    expect(DEFAULT_AVATAR_MODEL_URL).toMatch(/models\/RobotExpressive\.glb$/);
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
    revokeCustomAvatarObjectUrl({ kind: 'builtin' }, revoke);
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
