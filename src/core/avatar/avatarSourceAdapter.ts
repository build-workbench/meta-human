import type { AvatarSource } from '@/store/digitalHumanStore';

export function getAvatarViewerModelUrl(avatarSource: AvatarSource): string | undefined {
  return avatarSource.kind === 'custom' ? avatarSource.modelUrl : undefined;
}

export function revokeCustomAvatarObjectUrl(
  avatarSource: AvatarSource,
  revokeObjectUrl: (url: string) => void,
): void {
  if (avatarSource.kind === 'custom') {
    revokeObjectUrl(avatarSource.modelUrl);
  }
}
