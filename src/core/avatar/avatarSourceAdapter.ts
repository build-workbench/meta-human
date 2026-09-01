import type { AvatarSource } from '@/store/digitalHumanStore';
import { DEFAULT_AVATAR_MODEL_URL } from './constants';

export function getAvatarViewerModelUrl(avatarSource: AvatarSource): string | undefined {
  if (avatarSource.kind === 'custom') return avatarSource.modelUrl;
  if (avatarSource.kind === 'builtin') return DEFAULT_AVATAR_MODEL_URL;
  return undefined;
}

export function revokeCustomAvatarObjectUrl(
  avatarSource: AvatarSource,
  revokeObjectUrl: (url: string) => void,
): void {
  if (avatarSource.kind === 'custom') {
    revokeObjectUrl(avatarSource.modelUrl);
  }
}
