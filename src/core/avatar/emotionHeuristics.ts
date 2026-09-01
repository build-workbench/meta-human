/**
 * 情绪启发式推导 — 后端未返回有效情绪标签时的本地兜底。
 *
 * 从回复文本的标点与关键词推导情绪（纯函数，core 层无 React）。
 * 只在 `res.emotion` 缺失或为 neutral 时调用，后端明确给出的情绪永远优先。
 * angry 依赖语气强度，文本启发式容易误判，刻意不参与推导。
 */
import type { EmotionType } from './avatarContract';

const HAPPY_WORDS = [
  '好的',
  '当然',
  '没问题',
  '成功',
  '完成',
  '太棒',
  '很高兴',
  '谢谢',
  '不客气',
  '哈哈',
  '棒',
  '喜欢',
];
const SAD_WORDS = ['抱歉', '对不起', '遗憾', '失败', '无法', '错误', '糟糕', '不好意思'];
const SURPRISE_MARKS = ['？', '?'];

export function deriveEmotionFromText(text: string): EmotionType {
  const content = text.trim();
  if (!content) return 'neutral';

  // 疑问句优先：回复以问号收尾大概率是在反问/确认，惊讶比开心更贴切
  const isQuestion = SURPRISE_MARKS.some((mark) => content.endsWith(mark));
  if (isQuestion) return 'surprised';

  if (SAD_WORDS.some((word) => content.includes(word))) return 'sad';
  if (HAPPY_WORDS.some((word) => content.includes(word))) return 'happy';

  return 'neutral';
}
