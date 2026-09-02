/**
 * 长回复分段肢体动作测试。
 *
 * 覆盖：句切分、首句优先后端 action、按句语义推导、相邻去重、短回复不介入、
 * 调度器按时刻触发、新一轮取消旧调度、stop 后不再触发。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  planSpeechActions,
  splitReplyIntoSentences,
  startSegmentedSpeechActions,
  stopSegmentedSpeechActions,
} from '@/core/avatar/speechActionPlanner';

describe('splitReplyIntoSentences', () => {
  it('按中英文句末标点切分并保留标点', () => {
    expect(splitReplyIntoSentences('你好。很高兴见到你！你好吗？')).toEqual([
      '你好。',
      '很高兴见到你！',
      '你好吗？',
    ]);
    expect(splitReplyIntoSentences('Hi there. How are you?')).toEqual([
      'Hi there.',
      'How are you?',
    ]);
  });

  it('英文句末标点后需跟空白才切分（3.14 不被切开）', () => {
    // 小数点误切会让后续句子的时间估算整体错位，必须保证
    expect(splitReplyIntoSentences('Pi is 3.14. It is useful.')).toEqual([
      'Pi is 3.14.',
      'It is useful.',
    ]);
    // 已知可接受粒度：Mr. 这类缩写会被当成句末（"Mr." + "Smith is here."）。
    // 区分缩写需要缩写词表，收益仅是多触发一次点头动作，不值得为此增加复杂度。
    expect(splitReplyIntoSentences('Mr. Smith is here.')).toEqual(['Mr.', 'Smith is here.']);
  });

  it('无句末标点时整段算一句', () => {
    expect(splitReplyIntoSentences('好的')).toEqual(['好的']);
    expect(splitReplyIntoSentences('这是一个很长的句子没有标点')).toEqual([
      '这是一个很长的句子没有标点',
    ]);
  });

  it('空文本返回空数组', () => {
    expect(splitReplyIntoSentences('')).toEqual([]);
    expect(splitReplyIntoSentences('   ')).toEqual([]);
  });
});

describe('planSpeechActions', () => {
  it('单句回复返回空数组（不介入，保持原有单次动作）', () => {
    expect(planSpeechActions('好的。', 'wave')).toEqual([]);
    expect(planSpeechActions('你好')).toEqual([]);
    expect(planSpeechActions('')).toEqual([]);
  });

  it('多句回复首句优先用后端给的 action', () => {
    const plan = planSpeechActions('你好。今天天气不错。', 'wave');
    expect(plan.length).toBe(2);
    expect(plan[0].action).toBe('wave');
    expect(plan[0].atMs).toBe(0);
  });

  it('后端给 idle 时首句本地推导', () => {
    const plan = planSpeechActions('你好。今天天气不错。', 'idle');
    expect(plan[0].action).not.toBe('idle');
  });

  it('后端给白名单外的值时首句归一化后不为 idle 才采用', () => {
    // jump 会被 normalizeAvatarAction 降级为 idle，因此首句走本地推导
    const plan = planSpeechActions('你好。今天天气不错。', 'jump');
    expect(plan[0].action).not.toBe('idle');
    expect(plan[0].action).not.toBe('jump');
  });

  it('按句语义推导动作：问句思考 / 感叹肯定 / 否定摇头', () => {
    const plan = planSpeechActions('第一句。你觉得呢？这不行。真的很好！');
    // 首句命中轮转默认（nod），后续按语义
    expect(plan).toHaveLength(4);
    expect(plan[1].action).toBe('think');
    expect(plan[2].action).toBe('shakeHead');
    expect(plan[3].action).toBe('nod');
  });

  it('相邻句动作不重复', () => {
    // 前两句都是普通陈述，默认轮转会给出 nod → greet，不会连着两次 nod
    const plan = planSpeechActions('第一句陈述。第二句陈述。第三句陈述。');
    for (let i = 1; i < plan.length; i += 1) {
      expect(plan[i].action).not.toBe(plan[i - 1].action);
    }
  });

  it('atMs 随句子长度递增', () => {
    const plan = planSpeechActions('短句。这是一个明显更长的句子用来验证时间递增。再来一句。');
    expect(plan[0].atMs).toBe(0);
    expect(plan[1].atMs).toBeGreaterThan(plan[0].atMs);
    expect(plan[2].atMs).toBeGreaterThan(plan[1].atMs);
  });
});

describe('startSegmentedSpeechActions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopSegmentedSpeechActions();
  });

  afterEach(() => {
    stopSegmentedSpeechActions();
    vi.useRealTimers();
  });

  it('按规划时刻逐句触发 playAnimation', () => {
    const play = vi.fn();
    const reply = '第一句。第二句。第三句。';
    const plan = planSpeechActions(reply);

    startSegmentedSpeechActions(reply, play);

    expect(play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(plan[0].atMs);
    expect(play).toHaveBeenNthCalledWith(1, plan[0].action);
    vi.advanceTimersByTime(plan[1].atMs - plan[0].atMs);
    expect(play).toHaveBeenNthCalledWith(2, plan[1].action);
    vi.advanceTimersByTime(plan[2].atMs - plan[1].atMs);
    expect(play).toHaveBeenNthCalledWith(3, plan[2].action);
  });

  it('新一轮调度会取消上一轮残留定时器，避免旧动作串台', () => {
    const playA = vi.fn();
    const playB = vi.fn();

    startSegmentedSpeechActions('第一句。第二句。第三句。', playA);
    vi.advanceTimersByTime(100); // 只够首句（atMs=0），后续两句在 720ms / 1440ms
    expect(playA).toHaveBeenCalledTimes(1);

    startSegmentedSpeechActions('换话题了。真的换了。', playB);
    vi.advanceTimersByTime(60000);

    // 旧调度的后续动作不再触发
    expect(playA).toHaveBeenCalledTimes(1);
    expect(playB).toHaveBeenCalledTimes(2);
  });

  it('stop 之后不再触发任何动作', () => {
    const play = vi.fn();
    const stop = startSegmentedSpeechActions('第一句。第二句。', play);

    stop(); // 首句定时器（atMs=0）尚未执行即被取消
    vi.advanceTimersByTime(60000);

    expect(play).not.toHaveBeenCalled();
  });

  it('短回复返回空操作 stop，不排任何定时器', () => {
    const play = vi.fn();
    const stop = startSegmentedSpeechActions('好的。', play);

    vi.advanceTimersByTime(60000);
    expect(play).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });
});
