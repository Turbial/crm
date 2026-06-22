import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, Send, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { post } from '../api'

const EXAMPLES = [
  'Create a lead for John Smith at Acme Corp',
  'Update Acme deal status to won',
  'Create a task: finalize the proposal',
  'Add a note to the TechStart lead',
]

function ActionCard({ card }) {
  if (!card || Object.keys(card).length === 0) return null
  if (card.proposed) {
    return (
      <div className="action-card action-card-proposed">
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
          <AlertCircle size={11} color="var(--warning)" />
          <strong style={{ fontSize: 11 }}>Proposed: {card.intent}</strong>
        </div>
        {card.missing_fields?.length > 0 && (
          <p style={{ fontSize: 11, color: 'var(--warning)' }}>Missing: {card.missing_fields.join(', ')}</p>
        )}
        {card.action_key && (
          <code style={{ fontSize: 10, background: 'rgba(0,0,0,.06)', borderRadius: 4, padding: '1px 5px', display: 'block', marginTop: 3 }}>
            {card.action_key}
          </code>
        )}
      </div>
    )
  }
  if (card.status === 'completed') {
    return (
      <div className="action-card action-card-success">
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <CheckCircle size={11} color="var(--success)" />
          <strong style={{ fontSize: 11 }}>Action completed</strong>
        </div>
      </div>
    )
  }
  if (card.status === 'waiting_approval') {
    return (
      <div className="action-card action-card-approval">
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Clock size={11} color="var(--accent)" />
          <strong style={{ fontSize: 11 }}>Queued for approval</strong>
        </div>
      </div>
    )
  }
  return null
}

export default function AICommandPanel({ open, onClose }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [convId, setConvId] = useState(null)
  const inputRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const chat = useMutation({
    mutationFn: body => post('/messenger/ai/chat', body),
    onSuccess: data => {
      setConvId(data.conversation_id)
      setMessages(prev => [...prev, {
        id: data.assistant_message_id || Date.now(),
        role: 'assistant',
        text: data.assistant_text,
        intent: data.intent,
        confidence: data.confidence,
        card: data.card,
      }])
    },
    onError: err => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'error',
        text: err.message || 'Command failed',
      }])
    },
  })

  function submit() {
    const t = text.trim()
    if (!t || chat.isPending) return
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: t }])
    setText('')
    chat.mutate({ text: t, conversation_id: convId || null, auto_execute: true })
  }

  if (!open) return null

  return (
    <>
      <div className="ai-panel-overlay" onClick={onClose} />
      <div className="ai-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <Sparkles size={16} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>AI Assistant</span>
          <span style={{ fontSize: 11, color: 'var(--text-xs)', marginRight: 4 }}>⌘J</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={15} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 ? (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                Control CRM and PM with plain language. Actions run automatically.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {EXAMPLES.map(ex => (
                  <button
                    key={ex}
                    className="btn btn-ghost"
                    style={{ textAlign: 'left', fontSize: 12, padding: '7px 10px', justifyContent: 'flex-start', border: '1px solid var(--border-subtle)', borderRadius: 8 }}
                    onClick={() => { setText(ex); inputRef.current?.focus() }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(m => {
              if (m.role === 'user') {
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ background: 'var(--text)', color: '#fff', borderRadius: '12px 12px 3px 12px', padding: '8px 12px', fontSize: 13, maxWidth: '82%', lineHeight: 1.5 }}>
                      {m.text}
                    </div>
                  </div>
                )
              }
              if (m.role === 'error') {
                return (
                  <div key={m.id} style={{ display: 'flex' }}>
                    <div style={{ background: 'var(--danger-soft)', border: '1px solid #fca5a5', borderRadius: '3px 12px 12px 12px', padding: '8px 12px', fontSize: 13, maxWidth: '82%', color: 'var(--danger)', lineHeight: 1.5 }}>
                      {m.text}
                    </div>
                  </div>
                )
              }
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px 12px 12px 12px', padding: '8px 12px', fontSize: 13, maxWidth: '82%', lineHeight: 1.5 }}>
                    {m.text}
                    {m.card && <ActionCard card={m.card} />}
                  </div>
                  {m.intent && m.intent !== 'unknown' && (
                    <span className="intent-chip">
                      {m.intent} · {Math.round((m.confidence || 0) * 100)}%
                    </span>
                  )}
                </div>
              )
            })
          )}

          {chat.isPending && (
            <div style={{ display: 'flex' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px 12px 12px 12px', padding: '10px 14px' }}>
                <span className="spinner-sm" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              className="form-input"
              style={{ flex: 1, fontSize: 13 }}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
              placeholder="Type a command… (Enter to send)"
              disabled={chat.isPending}
            />
            <button
              className="btn btn-accent btn-icon"
              disabled={!text.trim() || chat.isPending}
              onClick={submit}
            >
              <Send size={14} />
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-xs)', marginTop: 6 }}>
            Results are saved to Messenger. History resets on refresh.
          </p>
        </div>
      </div>
    </>
  )
}
