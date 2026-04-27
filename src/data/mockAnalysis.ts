import type { Issue } from './mockData'

export type ScenarioId = 1 | 2 | 3 | null

export interface MockAnalysis {
  /** Issues keyed by event ids that exist in scenarioSchedules. */
  issues: Issue[]
  /** Final summary text for the "本次调整说明" modal. */
  summary: string
  /** A short status hint surfaced under the schedule header. */
  hint: string
}

export const mockAnalysisByScenario: Record<1 | 2 | 3, MockAnalysis> = {
  1: {
    issues: [
      {
        eventId: 's1-e4',
        reason:
          '文档整理预计连续 150 分钟，午后认知负荷叠加可能引发疲劳累积',
        suggestion: '在 16:00 后插入 30 分钟轻度活动，帮助脑力恢复',
        insertBreakAfter: true,
        breakDuration: 30,
      },
    ],
    summary:
      '本次调整在长段文档整理后插入一段 30 分钟代谢恢复窗口，让下午的专注力以更平稳的曲线延续到傍晚。',
    hint: '基础闭环：节律平稳，仅一处长段需要插入恢复窗口。',
  },
  2: {
    issues: [
      {
        eventId: 's2-e1',
        reason:
          '上午核心功能开发持续 180 分钟，当前身体电量已降至危险区间（15%）',
        suggestion: '在 12:00 前提早结束并安排 30 分钟轻量午餐与小憩',
        insertBreakAfter: true,
        breakDuration: 30,
      },
      {
        eventId: 's2-e2',
        reason:
          '代码审查与优化连续 240 分钟，远超低电量下的可承受阈值',
        suggestion: '将该任务拆为两段，在中间插入 30 分钟代谢恢复窗口',
        insertBreakAfter: true,
        breakDuration: 30,
      },
    ],
    summary:
      '本次调整针对低电量状态，将连续高强度的工作切分为更短的专注块，并嵌入两段恢复窗口，预期傍晚电量回升至 35% 以上。',
    hint: '高疲劳干预：身体电量过低，建议将连续高强度工作切段。',
  },
  3: {
    issues: [
      {
        eventId: 's3-e3',
        reason:
          '专项研究处于午后认知低谷，120 分钟连续专注易被外部消息打断',
        suggestion: '在该事件前进入"免打扰"模式，事件后预留 15 分钟过渡期',
        insertBreakAfter: true,
        breakDuration: 15,
      },
    ],
    summary:
      '本次调整为下午的专项研究保留了一段静默专注窗口，并在结束后留出 15 分钟过渡时间，避免认知切换造成的能量损耗。',
    hint: '免打扰适配：为下午专项研究保留一段静默认知窗口。',
  },
}

/**
 * Fetch a pre-baked analysis result for the given scenario.
 * Returns null if the scenario id does not have a fixture.
 */
export const getMockAnalysis = (scenario: ScenarioId): MockAnalysis | null => {
  if (scenario === 1 || scenario === 2 || scenario === 3) {
    return mockAnalysisByScenario[scenario]
  }
  return null
}

/** Default fallback when no scenario is active and the network is unavailable. */
export const fallbackMockAnalysis: MockAnalysis = {
  issues: [],
  summary:
    '当前日程未发现明显风险，已为您保留原有节律。智谱不可用时使用本地兜底文案。',
  hint: '本地兜底分析：节律稳定。',
}
