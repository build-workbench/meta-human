/**
 * 长回复分段肢体动作 — 避免长回答播报期间角色僵直。
 *
 * 现状问题：`handleDialogueResponse` 只在回复到达时播一次 `res.action`，
 * 而 `DigitalHumanEngine.playAnimation` 默认 ~3s 后回 idle。长回复（几十上百字）
 * 播报可持续十几秒，前几秒有动作、后面全程僵直。
 *
 * 策略：把回复按句末标点切分，按字数估算每句的播报时刻，逐句触发一个动作。
 * 短回复（单句）完全不介入，保持原有的单次 playAnimation 行为。
 *
 * 纯函数规划 + 薄调度器（core 层，不引入 React）。
 */
import type { AvatarAction } from './avatarContract';
import { normalizeAvatarAction } from './avatarContract';

/** 每字播报时长估算（毫秒），用于推算每句的触发时刻。 */
const MS_PER_CHAR = 180;
/** 至少这么多句才分段；短回复保持原有单次动作，不做多余编排。 */
const MIN_SENTENCES = 2;
/** 无语义线索时在这两个温和动作间轮转，避免全程同一个动作显得机械。 */
const DEFAULT_ROTATION: readonly AvatarAction[] = ['nod', 'greet'];

/** 中文句末标点：出现即切分。 */
const CJK_SENTENCE_END = '。！？；';
/** 英文句末标点：需后跟空白或位于文本末尾才算切分，避免把 3.14 / Mr. Smith 切开。 */
const ASCII_SENTENCE_END = '.!?;';

const QUESTION_MARK = /[？?]/;
const EXCLAMATION_MARK = /[！!]/;
const NEGATIVE_WORDS = ['不', '没', '无法', '失败', '错误', '抱歉', '遗憾'];

/**
 * 按句末标点切分回复，保留标点、丢弃空白片段。
 * 无句末标点（如纯短句 "好的"）时整段算一句。
 */
export function splitReplyIntoSentences(text: string): string[] {
  const content = text.trim();
  if (!content) return [];

  const sentences: string[] = [];
  let current = '';

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    current += char;

    const next = content[i + 1];
    const isCjkEnd = CJK_SENTENCE_END.includes(char);
    const isAsciiEnd = ASCII_SENTENCE_END.includes(char) && (next === undefined || /\s/.test(next));

    if (isCjkEnd || isAsciiEnd) {
      const trimmed = current.trim();
      if (trimmed) sentences.push(trimmed);
      current = '';
    }
  }

  const tail = current.trim();
  if (tail) sentences.push(tail);

  return sentences;
}

/** 单句 → 动作：问句思考、感叹肯定、否定摇头、其余轮转默认动作。 */
function deriveSentenceAction(sentence: string, rotationIndex: number): AvatarAction {
  if (QUESTION_MARK.test(sentence)) return 'think';
  if (NEGATIVE_WORDS.some((word) => sentence.includes(word))) return 'shakeHead';
  if (EXCLAMATION_MARK.test(sentence)) return 'nod';
  return DEFAULT_ROTATION[rotationIndex % DEFAULT_ROTATION.length];
}

export interface PlannedSpeechAction {
  /** 相对回复开始时刻的延迟（毫秒）。 */
  atMs: number;
  action: AvatarAction;
}

/**
 * 规划长回复的分段动作序列。
 *
 * - 首句优先用后端给的 action（语义最准），后端给 idle/非法值时才本地推导
 * - 后续句按句内语义推导，并与上一句去重（相同则退回轮转默认）
 * - 句子数不足 `MIN_SENTENCES` 时返回空数组，调用方保持原有单次动作
 */
export function planSpeechActions(
  replyText: string,
  backendAction?: string,
): PlannedSpeechAction[] {
  const sentences = splitReplyIntoSentences(replyText);
  if (sentences.length < MIN_SENTENCES) return [];

  const preferred = backendAction ? normalizeAvatarAction(backendAction) : 'idle';

  const plan: PlannedSpeechAction[] = [];
  let atMs = 0;
  let rotationIndex = 0;
  let previous: AvatarAction | null = null;

  for (let i = 0; i < sentences.length; i += 1) {
    let action: AvatarAction;
    if (i === 0 && preferred !== 'idle') {
      action = preferred;
    } else {
      action = deriveSentenceAction(sentences[i], rotationIndex);
      rotationIndex += 1;
      // 与上句重复则退回轮转默认，避免连续两段看起来一模一样
      if (action === previous) {
        action = DEFAULT_ROTATION[rotationIndex % DEFAULT_ROTATION.length];
        rotationIndex += 1;
      }
    }
    previous = action;
    plan.push({ atMs, action });
    atMs += Math.max(sentences[i].length * MS_PER_CHAR, 1);
  }

  return plan;
}

type AnimationPlayer = (name: string) => void;

let activeTimers: ReturnType<typeof setTimeout>[] = [];

/** 取消上一轮残留的分段调度（换话题 / 打断时防止旧动作串台）。 */
export function stopSegmentedSpeechActions(): void {
  for (const timer of activeTimers) clearTimeout(timer);
  activeTimers = [];
}

/**
 * 按 `planSpeechActions` 的规划逐句触发动作。
 *
 * 返回 stop 函数；新一轮开始前会先调 `stopSegmentedSpeechActions`，
 * 因此这里只需管理自己的 timer 列表。
 */
export function startSegmentedSpeechActions(
  replyText: string,
  playAnimation: AnimationPlayer,
  backendAction?: string,
): () => void {
  const plan = planSpeechActions(replyText, backendAction);
  if (plan.length === 0) return () => {};

  stopSegmentedSpeechActions();
  activeTimers = plan.map(({ atMs, action }) => setTimeout(() => playAnimation(action), atMs));

  return stopSegmentedSpeechActions;
}
