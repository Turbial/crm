import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Send, Zap, CheckCircle, Clock, User,
  Building2, ChevronRight, AlertCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'

const CHANNEL_BADGE = {
  email: 'blue', sms: 'green', whatsapp: 'green',
  telegram: 'purple', web: 'gray', internal: 'gray', messenger: 'purple',
}
const STATUS_BADGE = { open: 'blue', pending: 'yellow', resolved: 'green', snoozed: 'gray' }
const PRIORITY_BADGE = { urgent: 'red', high: 'yellow', normal: 'gray', low: 'gray' }

function RelTime({ iso }) {
  if (!iso) return null
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  let label
  if (mins < 1) label = 'just now'
  else if (mins < 60) label = `${mins}m ago`
  else if (mins < 1440) label = `${Math.floor(mins / 60)}h ago`
  else label = d.toLocaleDateString()
  return <span className="msg-time">{label}</span>
}

function ActionCard({ card }) {
  if (!card || Object.keys(card).length === 0) return null
  if (card.proposed) {
    return (
      <div className="action-card action-card-proposed">
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          <AlertCircle size={12} color="var(--warning)" />
          <strong style={{ fontSize: 11 }}>Proposed: {card.intent}</strong>
        </div>
        {card.missing_fields?.length > 0 && (
          <p style={{ fontSize: 11, color: 'var(--warning)' }}>
            Missing: {card.missing_fields.join(', ')}
          </p>
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
          <CheckCircle size={12} color="var(--success)" />
          <strong style={{ fontSize: 11 }}>Action completed</strong>
        </div>
      </div>
    )
  }
  if (card.status === 'waiting_approval') {
    return (
      <div className="action-card action-card-approval">
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Clock size={12} color="var(--accent)" />
          <strong style={{ fontSize: 11 }}>Queued for approval</strong>
        </div>
      </div>
    )
  }
  return null
}

function Bubble({ msg }) {
  const isUser = msg.sender_type === 'human'
  const isSystem = msg.sender_type === 'system'
  const card = msg.metadata?.card

  if (isSystem) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="bubble bubble-system">{msg.body}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 2 }}>
      {!isUser && (
        <span style={{ fontSize: 11, color: 'var(--text-xs)', marginLeft: 2 }}>
          {msg.sender_name || msg.sender_type}
        </span>
      )}
      <div
        className={`bubble ${isUser ? 'bubble-user' : 'bubble-agent'}`}
        style={{ maxWidth: '72%' }}
      >
        {msg.body}
        {card && <ActionCard card={card} />}
      </div>
      <RelTime iso={msg.created_at} />
    </div>
  )
}

export default function ConversationView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [aiText, setAiText] = useState('')
  const [inputTab, setInputTab] = useState('message')
  const [lastAi, setLastAi] = useState(null)
  const bottomRef = useRef(null)

  const { data: convo, isLoading: convoLoading } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => get(`/conversations/${id}`),
  })

  const { data: messages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ['convo-messages', id],
    queryFn: () => get(`/conversations/${id}/messages`, { limit: 100 }),
    refetchInterval: 5000,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMsg = useMutation({
    mutationFn: body => post(`/conversations/${id}/messages`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['convo-messages', id] })
      setText('')
    },
  })

  const aiChat = useMutation({
    mutationFn: body => post('/messenger/ai/chat', body),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['convo-messages', id] })
      setAiText('')
      setLastAi(data)
    },
  })

  const resolve = useMutation({
    mutationFn: () => post(`/conversations/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversation', id] }),
  })

  if (convoLoading || msgsLoading) return <Spinner />

  function sendDirect() {
    if (!text.trim()) return
    sendMsg.mutate({ body: text, sender_type: 'human' })
  }

  function sendAi() {
    if (!aiText.trim()) return
    aiChat.mutate({ text: aiText, conversation_id: id, auto_execute: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexShrink: 0 }}>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => navigate('/messenger')}>
          <ArrowLeft size={15} />
        </button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            {convo?.subject || `Conversation #${id.slice(0, 8)}`}
          </span>
          {convo && <Badge label={convo.channel} color={CHANNEL_BADGE[convo.channel] || 'gray'} />}
          {convo && <Badge label={convo.status} color={STATUS_BADGE[convo.status] || 'gray'} />}
          {convo?.priority && convo.priority !== 'normal' && (
            <Badge label={convo.priority} color={PRIORITY_BADGE[convo.priority] || 'gray'} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {convo?.status === 'open' && (
            <button
              className="btn btn-secondary btn-sm"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate()}
            >
              <CheckCircle size={13} /> Resolve
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, gap: 14, overflow: 'hidden' }}>
        {/* Messages + Input */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div className="card chat-messages" style={{ flex: 1, overflowY: 'auto' }}>
            {messages.map(m => <Bubble key={m.id} msg={m} />)}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="card" style={{ padding: 12, marginTop: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
              <button
                className={`btn btn-sm ${inputTab === 'message' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setInputTab('message')}
                style={{ fontSize: 12 }}
              >
                Message
              </button>
              <button
                className={`btn btn-sm ${inputTab === 'ai' ? 'btn-accent' : 'btn-ghost'}`}
                onClick={() => setInputTab('ai')}
                style={{ fontSize: 12 }}
              >
                <Zap size={12} /> AI Command
              </button>
            </div>

            {inputTab === 'message' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  style={{ flex: 1 }}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDirect() } }}
                  placeholder="Type a message… (Enter to send)"
                />
                <button
                  className="btn btn-primary btn-icon"
                  disabled={!text.trim() || sendMsg.isPending}
                  onClick={sendDirect}
                >
                  <Send size={14} />
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    value={aiText}
                    onChange={e => setAiText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAi() } }}
                    placeholder="e.g. create a task, update lead status, add a note…"
                  />
                  <button
                    className="btn btn-accent btn-icon"
                    disabled={!aiText.trim() || aiChat.isPending}
                    onClick={sendAi}
                  >
                    {aiChat.isPending ? <span className="spinner-sm" /> : <Zap size={14} />}
                  </button>
                </div>
                {lastAi && lastAi.intent && lastAi.intent !== 'unknown' && (
                  <div style={{ marginTop: 7, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="intent-chip">
                      {lastAi.intent} · {Math.round((lastAi.confidence || 0) * 100)}%
                    </span>
                    {lastAi.action_key && (
                      <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lastAi.action_key}</code>
                    )}
                  </div>
                )}
                {aiChat.isError && (
                  <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>
                    {aiChat.error?.message || 'AI command failed'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="detail-sidebar">
          <div className="sidebar-section-title" style={{ marginTop: 0 }}>Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-xs)', display: 'block', marginBottom: 3 }}>Channel</span>
              <Badge label={convo?.channel || '—'} color={CHANNEL_BADGE[convo?.channel] || 'gray'} />
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-xs)', display: 'block', marginBottom: 2 }}>Status</span>
              <span style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{convo?.status || '—'}</span>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-xs)', display: 'block', marginBottom: 2 }}>Priority</span>
              <span style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{convo?.priority || 'normal'}</span>
            </div>
            {convo?.sla_due_at && (
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-xs)', display: 'block', marginBottom: 2 }}>SLA Due</span>
                <span style={{
                  fontSize: 12,
                  color: new Date(convo.sla_due_at) < new Date() ? 'var(--danger)' : 'var(--text)',
                }}>
                  {new Date(convo.sla_due_at).toLocaleString()}
                </span>
              </div>
            )}
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-xs)', display: 'block', marginBottom: 2 }}>Created</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {convo?.created_at ? new Date(convo.created_at).toLocaleString() : '—'}
              </span>
            </div>
          </div>

          {(convo?.lead_id || convo?.contact_id || convo?.company_id) && (
            <>
              <div className="sidebar-section-title">Linked to</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {convo.lead_id && (
                  <Link
                    to={`/crm/leads/${convo.lead_id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--accent)' }}
                  >
                    <User size={13} /> Lead <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
                  </Link>
                )}
                {convo.contact_id && (
                  <Link
                    to={`/crm/contacts/${convo.contact_id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--accent)' }}
                  >
                    <User size={13} /> Contact <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
                  </Link>
                )}
                {convo.company_id && (
                  <Link
                    to={`/crm/companies/${convo.company_id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--accent)' }}
                  >
                    <Building2 size={13} /> Company <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
