import { useState, useRef, useEffect } from 'react';
import { Button, Input } from '@ui5/webcomponents-react';
import { sendChat } from '../api';

export default function ChatPanel({ cardContext = null, cdmEmail = null, onClose }) {
  const [messages, setMessages] = useState([{ role: 'agent', text: "Hi! I'm your CDM AS Tracker assistant. Ask me anything about requests, pricing, or R&R." }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', text: msg }]);
    setSending(true);
    try {
      const reply = await sendChat(msg, cardContext, cdmEmail);
      setMessages(m => [...m, { role: 'agent', text: reply }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'agent', text: `Error: ${e.message}` }]);
    } finally { setSending(false); }
  }

  return (
    <div className="chat-panel">
      <div style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 1rem', borderBottom: '1px solid #e5e5e5', background: '#0070f2', color: '#fff' }}>
        <span style={{ flex: 1, fontWeight: 'bold' }}>{cardContext ? `Chat — ${cardContext}` : 'Global Chat'}</span>
        <Button design="Transparent" style={{ color: '#fff' }} onClick={onClose}>X</Button>
      </div>
      <div className="chat-messages">
        {messages.map((m, i) => <div key={i} className={`chat-bubble ${m.role}`}>{m.text}</div>)}
        <div ref={bottomRef} />
      </div>
      <div className="card-chat-input">
        <Input style={{ flex: 1 }} placeholder="Ask anything..." value={input} onInput={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} disabled={sending} />
        <Button design="Emphasized" onClick={handleSend} disabled={sending || !input.trim()}>Send</Button>
      </div>
    </div>
  );
}
