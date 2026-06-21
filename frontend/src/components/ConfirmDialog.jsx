import Modal from './Modal'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
  isLoading,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>Cancel</button>
          <button
            className={`btn btn-${variant}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      {message && <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{message}</p>}
    </Modal>
  )
}
