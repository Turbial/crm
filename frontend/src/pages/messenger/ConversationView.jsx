import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, Zap } from 'lucide-react'
import { get, post } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'

function Bubble({ msg }) {
  const cls = msg.sender_type === 'human' ? 'bubble bubble-user'
    : msg.sender_type === 'system' ? 'bubble bubble-system'
    : 'bubble bubble-agent'
  return (
    <div className={cls}>
      {msg.sender_type !== 'human' && <strong style={{ display: 'block', fontSize: 11, marginBottom: 4, opacity: .7 }}>{msg.sender_name || msg.sender_type}</strong>}
      {msg.body}
    </div>
  )
}

export default function ConversationView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [aiText, setAiText] = useState('')
  const messagesEnd = useRef(null)

  const { data: convo } = useQuery({ queryKey: ['conversation', id], queryFn: () => get(`/conversations/${id}`) })
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['convo-messages', id],
    queryFn: () => get(`/conversations/${id}/messages`, { limit: 100 }),
    refetchInterval: 5000,
  })

  const sendMsg = useMutation({
    mutationFn: body => post(`/conversations/${id}/messages`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['convo-messages', id] }); setText('') },
  })

  const aiChat = useMutation({
    mutationFn: body => post('/messenger-ai/chat', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['convo-messages', id] }); setAiText('') },
  })

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const resolve = useMutation({
    mutationFn: () => post(`/conversations/${id}/resolve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversation', id] }),
  })

  if (isLoading) return <Spinner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/messenger')}><ArrowLeft size={16} /></button>
        <div style={{ flex: 1 }}>
          <span className="font-semibold">{convo?.subject || `Conversation #${id.slice(0, 8)}`}</span>
          {convo && <Badge label={convo.status} style={{ marginLeft: 8 }} />}
        </div>
        {convo?.status === 'open' && (
          <button className="btn btn-secondary btn-sm" onClick={() => resolve.mutate()}>Resolve</button>
        )}
      </div>

      {/* Messages */}
      <div className="card" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 16 }}>
        {messages.map(m => <Bubble key={m.id} msg={m} />)}
        <div ref={messagesEnd} />
      </div>

      {/* Input: direct message */}
      <div className="card mt-4" style={{ padding: 12 }}>
        <div className="flex gap-2 mb-2">
          <input className="form-input" value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && text.trim() && sendMsg.mutate({ body: text, sender_type: 'human' })}
            placeholder="Add a message…" style={{ flex: 1 }} />
          <button className="btn btn-primary btn-icon" disabled={!text.trim() || sendMsg.isPending}
            onClick={() => sendMsg.mutate({ body: text, sender_type: 'human' })}>
            <Send size={15} />
          </button>
        </div>
        <div className="flex gap-2">
          <input className="form-input" value={aiText} onChange={e => setAiText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && aiText.trim() && aiChat.mutate({ text: aiText, conversation_id: id })}
            placeholder="AI command (e.g. create task, update lead status)…" style={{ flex: 1 }} />
          <button className="btn btn-accent btn-icon" disabled={!aiText.trim() || aiChat.isPending}
            onClick={() => aiChat.mutate({ text: aiText, conversation_id: id })}>
            <Zap size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
