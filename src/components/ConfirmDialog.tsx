import Modal from './Modal'

interface Props {
  open: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'cyan'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title = '请确认',
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'danger',
  onConfirm,
  onCancel,
}: Props) {
  const confirmBg = variant === 'danger' ? '#FF4444' : '#00D4FF'
  const confirmFg = variant === 'danger' ? '#FFFFFF' : '#0D0F14'

  return (
    <Modal open={open} onClose={onCancel} title={title} sheet={false}>
      <div className="space-y-4">
        <p className="text-[14px] text-text-1 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-10 rounded-xl bg-bg-2 text-text-2 text-[14px] font-medium hover:text-text-1 transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-10 rounded-xl text-[14px] font-semibold transition-opacity hover:opacity-90"
            style={{ background: confirmBg, color: confirmFg }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
