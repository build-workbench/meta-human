/**
 * Scene 冒烟测试。
 *
 * 验证场景编排：drei 组件全部 mock，确认渲染不抛错、
 * autoRotate 透传给 OrbitControls、modelScene 分支切换。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as THREE from 'three';
import { Scene } from '@/components/viewer/Scene';

const { orbitProps } = vi.hoisted(() => ({
  orbitProps: {} as Record<string, unknown>,
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: (props: Record<string, unknown>) => {
    Object.assign(orbitProps, props);
    return <div data-testid="orbit-controls" />;
  },
  PerspectiveCamera: () => <div data-testid="camera" />,
  Environment: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="environment">{children}</div>
  ),
  Lightformer: () => <div data-testid="lightformer" />,
  Sparkles: () => <div data-testid="sparkles" />,
  ContactShadows: () => <div data-testid="contact-shadows" />,
}));

vi.mock('@/hooks', () => ({
  usePrefersReducedMotion: () => false,
}));

vi.mock('@/components/viewer/CyberAvatar', () => ({
  CyberAvatar: () => <div data-testid="cyber-avatar" />,
}));

vi.mock('@/components/viewer/ModelAvatar', () => ({
  ModelAvatar: () => <div data-testid="model-avatar" />,
}));

vi.mock('@/components/viewer/KeyboardControls', () => ({
  KeyboardControls: () => <div data-testid="keyboard-controls" />,
}));

describe('Scene', () => {
  beforeEach(() => {
    Object.keys(orbitProps).forEach((k) => delete orbitProps[k]);
  });

  it('渲染完整场景（默认程序化头像）', () => {
    render(<Scene />);
    expect(screen.getByTestId('cyber-avatar')).toBeInTheDocument();
    expect(screen.getByTestId('keyboard-controls')).toBeInTheDocument();
    expect(screen.getByTestId('orbit-controls')).toBeInTheDocument();
    expect(screen.getByTestId('camera')).toBeInTheDocument();
    expect(screen.getByTestId('environment')).toBeInTheDocument();
    expect(screen.getByTestId('sparkles')).toBeInTheDocument();
    expect(screen.getByTestId('contact-shadows')).toBeInTheDocument();
  });

  it('autoRotate 透传给 OrbitControls', () => {
    render(<Scene autoRotate />);
    expect(orbitProps.autoRotate).toBe(true);
    expect(orbitProps.autoRotateSpeed).toBe(0.5);
  });

  it('提供 model 时使用模型头像而非程序化头像', () => {
    const model = {
      group: new THREE.Group(),
      morphs: {},
      clipMap: {},
      timeUniform: { value: 0 },
    } as unknown as import('@/core/avatar/avatarModelPrepare').PreparedAvatarModel;
    render(<Scene model={model} />);
    expect(screen.queryByTestId('cyber-avatar')).not.toBeInTheDocument();
    expect(screen.getByTestId('model-avatar')).toBeInTheDocument();
    expect(screen.getByTestId('keyboard-controls')).toBeInTheDocument();
  });
});
