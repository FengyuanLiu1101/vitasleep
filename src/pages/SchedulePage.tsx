import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Lightbulb, Plus, Sparkles } from 'lucide-react'
import AppBar from '../components/AppBar'
import EventCard from '../components/EventCard'
import EventEditForm, { type EventDraft } from '../components/EventEditForm'
import SyncBar from '../components/SyncBar'
import ConfirmDialog from '../components/ConfirmDialog'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import Typewriter from '../components/Typewriter'
import { useAppStore, nowHHmm } from '../store/useAppStore'
import type { DisplayItem, Event, Issue } from '../data/mockData'
import { scenarioSchedules } from '../data/mockData'
import callZhipu, { analyzeWithZhipu } from '../lib/zhipuClient'
import { isHealthySchedule } from '../lib/mockAnalysis'
import {
  createEvent as fsCreateEvent,
  patchEvent as fsPatchEvent,
  deleteEvent as fsDeleteEvent,
  diffEvents,
  eventDedupeKey,
  getFeishuToken,
  listPrimaryEvents,
} from '../lib/feishuClient'

type ToastVariant = 'cyan' | 'green'

interface SummaryModalState {
  open: boolean
  text: string
  loading: boolean
  error: string | null
}

const minutesToHHmm = (mins: number) => {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}
const hhmmToMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

let manualIdSeq = 0
const newManualId = () => `m-${Date.now()}-${manualIdSeq++}`

const buildSummaryPrompt = (
  acceptedSuggestions: Array<{
    event?: string
    time?: string
    suggestion: string
    breakDuration: number
  }>,
): string => `\
用户接受了以下日程调整建议：
${JSON.stringify(acceptedSuggestions)}
请用两句话总结本次调整的原因和预期效果，语气积极，中文回答。
请用不同于上次的角度和句式总结，当前时间戳：${Date.now()}`

export default function SchedulePage() {
  const scheduleEvents = useAppStore((s) => s.scheduleEvents)
  const originalEvents = useAppStore((s) => s.originalEvents)
  const analysisResults = useAppStore((s) => s.analysisResults)
  const acceptedIds = useAppStore((s) => s.acceptedIds)
  const ignoredEventIds = useAppStore((s) => s.ignoredEventIds)
  const scheduleConfirmed = useAppStore((s) => s.scheduleConfirmed)
  const isAnalyzing = useAppStore((s) => s.isAnalyzing)
  const analysisError = useAppStore((s) => s.analysisError)
  const energyLevel = useAppStore((s) => s.energyLevel)
  const demoMode = useAppStore((s) => s.demoMode)
  const activeScenario = useAppStore((s) => s.activeScenario)
  const lastSyncTime = useAppStore((s) => s.lastSyncTime)
  const lastSyncSnapshot = useAppStore((s) => s.lastSyncSnapshot)

  const setScheduleEvents = useAppStore((s) => s.setScheduleEvents)
  const setOriginalEvents = useAppStore((s) => s.setOriginalEvents)
  const addEvent = useAppStore((s) => s.addEvent)
  const updateEvent = useAppStore((s) => s.updateEvent)
  const deleteEvent = useAppStore((s) => s.deleteEvent)
  const setAnalysisResults = useAppStore((s) => s.setAnalysisResults)
  const acceptIssue = useAppStore((s) => s.acceptIssue)
  const ignoreIssue = useAppStore((s) => s.ignoreIssue)
  const setScheduleConfirmed = useAppStore((s) => s.setScheduleConfirmed)
  const setIsAnalyzing = useAppStore((s) => s.setIsAnalyzing)
  const setAnalysisError = useAppStore((s) => s.setAnalysisError)
  const setLastSyncTime = useAppStore((s) => s.setLastSyncTime)
  const setLastSyncSnapshot = useAppStore((s) => s.setLastSyncSnapshot)
  const appendLog = useAppStore((s) => s.appendLog)

  // Local UI state
  const [bannerVisible, setBannerVisible] = useState(false)
  const [bannerMsg, setBannerMsg] = useState('日程已同步至飞书日历')
  const [toast, setToast] = useState<{ msg: string; variant: ToastVariant } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [pulling, setPulling] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [summary, setSummary] = useState<SummaryModalState>({
    open: false,
    text: '',
    loading: false,
    error: null,
  })

  const showToast = (msg: string, variant: ToastVariant = 'cyan') =>
    setToast({ msg, variant })

  // Always re-run analysis when scheduleEvents reference changes. Uses the
  // unified analyzeWithZhipu helper which already handles 15s timeout, JSON
  // parsing, and falls back to scenario-specific mock fixtures on any failure.
  const analysisRunIdRef = useRef(0)
  const runAnalysis = useCallback(
    async (events: Event[]) => {
      const runId = ++analysisRunIdRef.current
      setIsAnalyzing(true)
      setAnalysisError(null)
      const result = await analyzeWithZhipu({
        events,
        energyLevel,
        scenario: activeScenario,
        demoMode,
      })
      if (analysisRunIdRef.current !== runId) return
      setAnalysisResults(result.issues)
      if (result.source === 'zhipu') {
        appendLog({
          level: 'INFO',
          message: `智谱分析完成：${result.issues.length} 处风险`,
        })
      } else if (result.source === 'mock-scenario') {
        if (result.error) setAnalysisError(result.error)
        appendLog({
          level: result.error ? 'WARN' : 'INFO',
          message: result.error
            ? `智谱不可用，已加载场景 Mock 数据（${result.issues.length} 处）`
            : `演示模式：加载场景 Mock 数据（${result.issues.length} 处）`,
        })
      } else {
        if (result.error) setAnalysisError(result.error)
        appendLog({
          level: 'WARN',
          message: `本地兜底分析（${result.issues.length} 处）`,
        })
      }
      setIsAnalyzing(false)
    },
    [
      energyLevel,
      activeScenario,
      demoMode,
      setAnalysisError,
      setAnalysisResults,
      setIsAnalyzing,
      appendLog,
    ],
  )

  // Re-analyze whenever the schedule changes (mount, edit, add, delete, scenario, pull).
  useEffect(() => {
    runAnalysis(scheduleEvents)
  }, [scheduleEvents, runAnalysis])

  // Build the visible timeline: events + accepted break inserts.
  const timeline = useMemo<
    Array<{
      item: DisplayItem
      issue?: Issue
      accepted: boolean
      ignored: boolean
      inserted: boolean
    }>
  >(() => {
    const list: Array<{
      item: DisplayItem
      issue?: Issue
      accepted: boolean
      ignored: boolean
      inserted: boolean
    }> = []
    for (const ev of scheduleEvents) {
      const issue = analysisResults.find((i) => i.eventId === ev.id)
      const accepted = acceptedIds.includes(ev.id)
      const ignored = ignoredEventIds.includes(ev.id)
      list.push({ item: ev, issue, accepted, ignored, inserted: false })
      if (issue?.insertBreakAfter && accepted) {
        const startMin = hhmmToMin(ev.endTime)
        const breakDur = issue.breakDuration ?? 30
        list.push({
          item: {
            id: `break-${ev.id}`,
            type: 'rest',
            title: `恢复休息 ${breakDur} 分钟`,
            startTime: minutesToHHmm(startMin),
            endTime: minutesToHHmm(startMin + breakDur),
            subtitle: '代谢恢复窗口',
          },
          accepted: true,
          ignored: false,
          inserted: true,
        })
      }
    }
    return list
  }, [scheduleEvents, analysisResults, acceptedIds, ignoredEventIds])

  const acceptedSuggestions = useMemo(
    () =>
      analysisResults
        .filter((i) => acceptedIds.includes(i.eventId))
        .map((i) => {
          const ev = scheduleEvents.find((e) => e.id === i.eventId)
          return {
            event: ev?.title ?? i.eventId,
            time: ev?.startTime,
            suggestion: i.suggestion,
            breakDuration: i.breakDuration,
          }
        }),
    [analysisResults, acceptedIds, scheduleEvents],
  )

  const handleAccept = (issue: Issue) => {
    acceptIssue(issue.eventId)
    appendLog({ level: 'DONE', message: `已接受建议：${issue.suggestion}` })
  }
  const handleIgnore = (issue: Issue) => {
    ignoreIssue(issue.eventId)
    appendLog({ level: 'WARN', message: `已忽略建议：${issue.eventId}` })
  }

  const handleSaveEdit = (id: string, draft: EventDraft) => {
    updateEvent(id, draft)
    setEditingId(null)
    appendLog({
      level: 'INFO',
      message: `已修改事件：${draft.title} (${draft.startTime}-${draft.endTime})`,
    })
  }
  const handleAddSubmit = (draft: EventDraft) => {
    const ev: Event = { id: newManualId(), source: 'manual', ...draft }
    addEvent(ev)
    setAdding(false)
    appendLog({
      level: 'INFO',
      message: `已新增事件：${draft.title} (${draft.startTime}-${draft.endTime})`,
    })
  }
  const handleDeleteConfirm = () => {
    if (!deleteTarget) return
    const target = scheduleEvents.find((e) => e.id === deleteTarget)
    deleteEvent(deleteTarget)
    setDeleteTarget(null)
    setEditingId(null)
    appendLog({
      level: 'WARN',
      message: `已删除事件：${target?.title ?? deleteTarget}`,
    })
  }

  const defaultNewDraft = useMemo<EventDraft>(() => {
    if (scheduleEvents.length === 0)
      return { title: '', startTime: '09:00', endTime: '10:00', type: 'flexible' }
    const last = scheduleEvents[scheduleEvents.length - 1]
    const start = hhmmToMin(last.endTime) + 30
    return {
      title: '',
      startTime: minutesToHHmm(start),
      endTime: minutesToHHmm(start + 60),
      type: 'flexible',
    }
  }, [scheduleEvents])

  const handlePull = async () => {
    setPulling(true)
    try {
      if (demoMode || !getFeishuToken()) {
        await new Promise((r) => setTimeout(r, 1000))
        // In demo mode just reload the current scenario or initial dataset.
        const scenarioId = useAppStore.getState().activeScenario
        const next = scenarioId
          ? scenarioSchedules[scenarioId]
          : useAppStore.getState().scheduleEvents
        setScheduleEvents(next.map((e) => ({ ...e })))
        setOriginalEvents(next.map((e) => ({ ...e })))
        setLastSyncTime(nowHHmm())
        showToast('日程已更新（演示模式）', 'green')
        appendLog({ level: 'INFO', message: '从飞书拉取日程（演示模式）' })
      } else {
        const events = await listPrimaryEvents()
        setScheduleEvents(events)
        setOriginalEvents(events.map((e) => ({ ...e })))
        setLastSyncTime(nowHHmm())
        showToast('日程已更新', 'green')
        appendLog({
          level: 'DONE',
          message: `从飞书拉取日程：${events.length} 项`,
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('拉取失败：' + msg.slice(0, 40))
      appendLog({ level: 'ERROR', message: '飞书拉取失败：' + msg })
    } finally {
      setPulling(false)
    }
  }

  const handlePush = async () => {
    setPushing(true)
    // Capture the pre-push state so we can offer "撤销上次同步" afterward.
    const eventsBefore = scheduleEvents.map((e) => ({ ...e }))
    const originalBefore = originalEvents.map((e) => ({ ...e }))
    try {
      if (demoMode || !getFeishuToken()) {
        await new Promise((r) => setTimeout(r, 1000))
        const stamp = nowHHmm()
        setLastSyncTime(stamp)
        setLastSyncSnapshot({
          eventsBefore,
          originalBefore,
          createdFeishuIds: [],
          createdLocalIds: [],
          syncedAt: stamp,
          demo: true,
        })
        showToast('已同步至飞书日历（演示模式）', 'green')
        appendLog({ level: 'DONE', message: '推送到飞书完成（演示模式）' })
      } else {
        const { creates, updates, deletes } = diffEvents(
          scheduleEvents,
          originalEvents,
        )
        const createdFeishuIds: string[] = []
        const createdLocalIds: string[] = []
        for (const ev of creates) {
          const fid = await fsCreateEvent(ev)
          if (fid) {
            updateEvent(ev.id, { feishuEventId: fid, source: 'feishu' })
            createdFeishuIds.push(fid)
            createdLocalIds.push(ev.id)
          }
        }
        for (const ev of updates) await fsPatchEvent(ev)
        for (const fid of deletes) await fsDeleteEvent(fid)

        const stamp = nowHHmm()
        setOriginalEvents(
          useAppStore.getState().scheduleEvents.map((e) => ({ ...e })),
        )
        setLastSyncTime(stamp)
        setLastSyncSnapshot({
          eventsBefore,
          originalBefore,
          createdFeishuIds,
          createdLocalIds,
          syncedAt: stamp,
          demo: false,
        })
        showToast('已同步至飞书日历', 'green')
        appendLog({
          level: 'DONE',
          message: `推送完成：新增${creates.length} / 更新${updates.length} / 删除${deletes.length}（已记录 ${createdFeishuIds.length} 个 event_id 用于撤销）`,
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      showToast('推送失败：' + msg.slice(0, 40))
      appendLog({ level: 'ERROR', message: '飞书推送失败：' + msg })
    } finally {
      setPushing(false)
    }
  }

  const [undoing, setUndoing] = useState(false)
  const handleUndoSync = async () => {
    if (!lastSyncSnapshot || undoing) return
    setUndoing(true)
    try {
      if (!lastSyncSnapshot.demo) {
        // Best-effort: delete every event we created during the last push.
        // patch/delete operations from that push are *not* reversed because
        // we don't keep their pre-state on the server side.
        for (let i = 0; i < lastSyncSnapshot.createdFeishuIds.length; i++) {
          const fid = lastSyncSnapshot.createdFeishuIds[i]
          const localId = lastSyncSnapshot.createdLocalIds[i]
          const beforeMatch = lastSyncSnapshot.eventsBefore.find(
            (e) => e.id === localId,
          )
          const dedupeKey = beforeMatch ? eventDedupeKey(beforeMatch) : undefined
          try {
            await fsDeleteEvent(fid, dedupeKey)
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            appendLog({
              level: 'WARN',
              message: `撤销时删除事件失败 (${fid})：${msg.slice(0, 80)}`,
            })
          }
        }
      }
      setScheduleEvents(lastSyncSnapshot.eventsBefore.map((e) => ({ ...e })))
      setOriginalEvents(
        lastSyncSnapshot.originalBefore.map((e) => ({ ...e })),
      )
      setScheduleConfirmed(false)
      setLastSyncSnapshot(null)
      showToast('已撤销上次同步', 'green')
      appendLog({
        level: 'WARN',
        message: lastSyncSnapshot.demo
          ? '已撤销上次同步（演示模式）'
          : `已撤销上次同步（删除 ${lastSyncSnapshot.createdFeishuIds.length} 个事件）`,
      })
    } finally {
      setUndoing(false)
    }
  }

  const canConfirm = acceptedIds.length > 0 && !scheduleConfirmed

  const openSummary = async () => {
    if (!canConfirm) return
    setSummary({ open: true, text: '', loading: true, error: null })
    try {
      const prompt = buildSummaryPrompt(acceptedSuggestions)
      const text = await callZhipu([{ role: 'user', content: prompt }])
      setSummary({ open: true, text: text.trim(), loading: false, error: null })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSummary({
        open: true,
        text: `本次共采纳 ${acceptedIds.length} 条建议，预计在保留全部固定事项的前提下为身体腾出恢复窗口，缓解连续高强度工作造成的电量下滑。`,
        loading: false,
        error: msg,
      })
    }
  }

  const handleConfirmWrite = async () => {
    setScheduleConfirmed(true)
    if (!demoMode && getFeishuToken()) {
      try {
        for (const row of timeline) {
          if (!row.inserted) continue
          const item = row.item
          if (item.type !== 'rest') continue
          const ev: Event = {
            id: item.id,
            title: item.title,
            startTime: item.startTime,
            endTime: item.endTime,
            type: 'flexible',
            source: 'manual',
          }
          await fsCreateEvent(ev)
        }
        appendLog({ level: 'DONE', message: '已写入飞书日历' })
        setBannerMsg('已同步至飞书日历')
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        appendLog({ level: 'ERROR', message: '飞书写入失败：' + msg })
        setBannerMsg('飞书写入失败（详见日志）')
      }
    } else {
      appendLog({ level: 'DONE', message: '日程已同步（演示模式）' })
      setBannerMsg('日程已同步至飞书日历')
    }
    setSummary((s) => ({ ...s, open: false }))
    setBannerVisible(true)
  }

  return (
    <div className="pb-32">
      <AppBar title="日程优化" showEnergy />

      <div className="px-4 space-y-4">
        <SyncBar
          lastSyncTime={lastSyncTime}
          pulling={pulling}
          pushing={pushing}
          onPull={handlePull}
          onPush={handlePush}
          onUndo={lastSyncSnapshot ? handleUndoSync : undefined}
          undoing={undoing}
        />

        <section>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] text-text-2 font-medium">今日日程</h2>
              {analysisError && !isAnalyzing && (
                <span className="text-[11px] text-yellow-1">本地模拟</span>
              )}
              {isAnalyzing && (
                <span className="text-[11px] text-cyan-1">分析中…</span>
              )}
            </div>
          </div>

          <div>
            {timeline.length === 0 && !adding && (
              <div className="text-center py-10 text-text-3 text-[13px]">
                今日暂无事件
              </div>
            )}
            {timeline.map((row, i) => {
              const isEditing =
                row.item.type !== 'rest' && editingId === row.item.id
              if (isEditing) {
                const target = scheduleEvents.find((e) => e.id === row.item.id)
                if (!target) return null
                return (
                  <EventEditForm
                    key={'edit-' + target.id}
                    initial={target}
                    delay={i * 30}
                    onSave={(d) => handleSaveEdit(target.id, d)}
                    onCancel={() => setEditingId(null)}
                    onDelete={() => setDeleteTarget(target.id)}
                  />
                )
              }
              return (
                <EventCard
                  key={row.item.id}
                  item={row.item}
                  delay={i * 30}
                  issue={row.issue}
                  accepted={row.accepted && !row.inserted}
                  ignored={row.ignored}
                  inserted={row.inserted}
                  analyzing={isAnalyzing}
                  onAccept={
                    row.issue ? () => handleAccept(row.issue!) : undefined
                  }
                  onIgnore={
                    row.issue ? () => handleIgnore(row.issue!) : undefined
                  }
                  onEdit={
                    row.item.type !== 'rest'
                      ? () => {
                          setEditingId(row.item.id)
                          setAdding(false)
                        }
                      : undefined
                  }
                />
              )
            })}

            {adding ? (
              <EventEditForm
                defaultDraft={defaultNewDraft}
                onSave={handleAddSubmit}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAdding(true)
                  setEditingId(null)
                }}
                className="ml-[56px] flex items-center justify-center gap-1 w-[calc(100%-56px)] h-11 rounded-2xl border border-dashed border-text-3 text-text-2 text-[13px] hover:text-cyan-1 hover:border-cyan-1/60 transition-colors"
              >
                <Plus size={14} />
                添加事件
              </button>
            )}
          </div>
        </section>

        {analysisResults.length === 0 &&
        !isAnalyzing &&
        isHealthySchedule(scheduleEvents, energyLevel) ? (
          <div
            className="rounded-2xl p-4 flex gap-3 animate-fade-up border"
            style={{
              animationDelay: '300ms',
              background: 'rgba(109, 191, 109, 0.08)',
              borderColor: 'rgba(109, 191, 109, 0.35)',
            }}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2D3A2D] flex items-center justify-center">
              <CheckCircle2 size={16} className="text-[#6DBF6D]" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] text-[#6DBF6D] font-medium leading-relaxed">
                当前状态良好，无需调整
              </p>
              <p className="text-[12px] text-text-2 leading-relaxed mt-0.5">
                身体电量充足，且日程中已包含恢复型事件，请保持当前节律。
              </p>
            </div>
          </div>
        ) : (
          <div
            className="bg-bg-1 rounded-2xl p-4 flex gap-3 animate-fade-up"
            style={{ animationDelay: '300ms' }}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-1/15 flex items-center justify-center">
              <Lightbulb size={16} className="text-cyan-1" />
            </div>
            <p className="text-[13px] text-text-2 leading-relaxed">
              {analysisResults.length > 0
                ? '检测到您连续专注工作后身体电量下降，建议安排短暂休息以维持长期效率。'
                : '当前日程未发现明显风险，保持节律即可。'}
            </p>
          </div>
        )}

        <div
          className="space-y-2.5 animate-fade-up"
          style={{ animationDelay: '350ms' }}
        >
          <button
            type="button"
            onClick={openSummary}
            disabled={!canConfirm}
            className="w-full h-12 rounded-xl font-semibold text-[15px] transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            style={{
              background: scheduleConfirmed
                ? '#1E2128'
                : canConfirm
                ? '#00D4FF'
                : '#1E2128',
              color: scheduleConfirmed
                ? '#6DBF6D'
                : canConfirm
                ? '#0D0F14'
                : '#4A5060',
            }}
          >
            {scheduleConfirmed ? '✓ 已同步' : '确认同步'}
          </button>
          <button
            type="button"
            onClick={() => {
              appendLog({ level: 'INFO', message: '用户忽略了本次建议' })
              showToast('已忽略所有建议')
            }}
            className="w-full h-10 text-[13px] text-text-2 hover:text-text-1 transition-colors"
          >
            忽略
          </button>
        </div>
      </div>

      <Toast
        message={'✓ ' + bannerMsg}
        visible={bannerVisible}
        onHide={() => setBannerVisible(false)}
        variant="green"
        position="top"
        duration={3000}
      />
      <Toast
        message={toast?.msg ?? ''}
        visible={!!toast}
        onHide={() => setToast(null)}
        variant={toast?.variant ?? 'cyan'}
        position="bottom-right"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除事件"
        message={
          deleteTarget
            ? `确认删除「${
                scheduleEvents.find((e) => e.id === deleteTarget)?.title ??
                '未命名'
              }」？此操作不可撤销。`
            : ''
        }
        variant="danger"
        confirmText="确认"
        cancelText="取消"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal
        open={summary.open}
        onClose={() =>
          !summary.loading && setSummary((s) => ({ ...s, open: false }))
        }
        title="本次调整说明"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-cyan-1">
            <Sparkles size={14} />
            <span className="text-[12px]">由智谱 GLM-4 生成</span>
          </div>
          <div className="bg-bg-2 rounded-xl p-4 min-h-[80px] text-[14px] text-text-1 leading-relaxed">
            {summary.loading ? (
              <span className="text-text-2 text-[13px]">生成中…</span>
            ) : (
              <Typewriter text={summary.text} speedMs={50} />
            )}
          </div>
          {summary.error && (
            <p className="text-[11px] text-text-3">
              智谱不可用，已使用本地兜底文案。原因：{summary.error.slice(0, 80)}
            </p>
          )}
          <button
            type="button"
            disabled={summary.loading}
            onClick={handleConfirmWrite}
            className="w-full h-11 rounded-xl bg-cyan-1 text-bg-0 font-semibold text-[14px] disabled:opacity-50"
          >
            确认写入日历
          </button>
        </div>
      </Modal>
    </div>
  )
}
