import { describe, expect, it } from 'vitest';
import { deriveEmotionFromText } from '@/core/avatar/emotionHeuristics';

describe('deriveEmotionFromText', () => {
  it('空文本返回 neutral', () => {
    expect(deriveEmotionFromText('')).toBe('neutral');
    expect(deriveEmotionFromText('   ')).toBe('neutral');
  });

  it('问号收尾判定为 surprised（优先于其他词）', () => {
    expect(deriveEmotionFromText('你是说这个吗？')).toBe('surprised');
    expect(deriveEmotionFromText('Really?')).toBe('surprised');
    // 问号优先于负面词
    expect(deriveEmotionFromText('抱歉，你说的是这个吗？')).toBe('surprised');
  });

  it('负面词判定为 sad', () => {
    expect(deriveEmotionFromText('抱歉，我无法完成这个操作。')).toBe('sad');
    expect(deriveEmotionFromText('很遗憾，请求失败了')).toBe('sad');
  });

  it('正面词判定为 happy', () => {
    expect(deriveEmotionFromText('好的，马上帮你处理！')).toBe('happy');
    expect(deriveEmotionFromText('任务已经成功完成了')).toBe('happy');
  });

  it('普通陈述返回 neutral', () => {
    expect(deriveEmotionFromText('今天天气不错。')).toBe('neutral');
    expect(deriveEmotionFromText('这个文件在 src 目录下')).toBe('neutral');
  });
});
