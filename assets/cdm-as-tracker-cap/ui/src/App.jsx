import { useState, useEffect } from 'react';
import { Button, ShellBar, ShellBarItem } from '@ui5/webcomponents-react';
import RRCard from './components/RRCard';
import PricingCard from './components/PricingCard';
import ActiveRequestsCard from './components/ActiveRequestsCard';
import JiraO2ICard from './components/JiraO2ICard';
import ChatPanel from './components/ChatPanel';
import { getCardLayouts, saveCardLayout } from './api';

const DEFAULT_LAYOUTS = [
  { cardId: 'rr-reference',    visible: true, sortOrder: 0 },
  { cardId: 'pricing',         visible: true, sortOrder: 1 },
  { cardId: 'active-requests', visible: true, sortOrder: 2 },
  { cardId: 'jira-o2i',        visible: true, sortOrder: 3 },
];

const CARD_LABELS = {
  'rr-reference':    'R&R Reference',
  'pricing':         'Pricing',
  'active-requests': 'Active Requests',
  'jira-o2i':        'JIRA O2I',
};

// Minimal current-user detection via dummy auth header inspection
// In dummy mode, CAP returns user info in the response; we use a simple default.
const currentUser = 'alex';
const isManager   = false; // Set true for morgan in a real session
const isAdmin     = false; // Set true for pricingadmin

export default function App() {
  const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS);
  const [showManageSpace, setShowManageSpace] = useState(false);
  const [pendingLayouts, setPendingLayouts] = useState(null);
  const [chat, setChat] = useState(null); // { cardContext } | null
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCardLayouts()
      .then(data => {
        if (data && data.length > 0) {
          const loaded = DEFAULT_LAYOUTS.map(def => {
            const found = data.find(d => d.cardId === def.cardId);
            return found
              ? { cardId: def.cardId, visible: found.visible, sortOrder: found.sortOrder }
              : def;
          });
          setLayouts(loaded.sort((a, b) => a.sortOrder - b.sortOrder));
        }
      })
      .catch(() => { /* use defaults */ });
  }, []);

  function openManageSpace() {
    setPendingLayouts(layouts.map(l => ({ ...l })));
    setShowManageSpace(true);
  }

  function toggleVisible(cardId) {
    setPendingLayouts(pl => pl.map(l => l.cardId === cardId ? { ...l, visible: !l.visible } : l));
  }

  function moveCard(cardId, dir) {
    setPendingLayouts(pl => {
      const idx = pl.findIndex(l => l.cardId === cardId);
      if (dir === 'up' && idx === 0) return pl;
      if (dir === 'down' && idx === pl.length - 1) return pl;
      const next = [...pl];
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((l, i) => ({ ...l, sortOrder: i }));
    });
  }

  async function handleSaveSpace() {
    setSaving(true);
    try {
      await saveCardLayout(pendingLayouts);
      setLayouts(pendingLayouts.sort((a, b) => a.sortOrder - b.sortOrder));
      setShowManageSpace(false);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  const visibleCards = layouts.filter(l => l.visible).sort((a, b) => a.sortOrder - b.sortOrder);

  function renderCard(cardId) {
    const toggle = () => setChat(c => c?.cardContext === cardId ? null : { cardContext: cardId });
    switch (cardId) {
      case 'rr-reference':    return <RRCard key={cardId} onChatToggle={toggle} />;
      case 'pricing':         return <PricingCard key={cardId} isAdmin={isAdmin} onChatToggle={toggle} />;
      case 'active-requests': return <ActiveRequestsCard key={cardId} isManager={isManager} currentUser={currentUser} onChatToggle={toggle} />;
      case 'jira-o2i':        return <JiraO2ICard key={cardId} onChatToggle={toggle} />;
      default:                return null;
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f7' }}>
      {/* ── Top Nav ──────────────────────────────────────────────────── */}
      <ShellBar
        primaryTitle="CDM AS Tracker"
        secondaryTitle={`Logged in as ${currentUser}`}
        logo={<img alt="SAP" src="https://www.sap.com/content/dam/application/shared/logos/sap-logo-svg.svg" style={{ height: 24 }} />}
      >
        <ShellBarItem
          icon="add"
          text="New Request"
          onClick={() => {
            // Trigger new request via ActiveRequestsCard — find and click via event
            document.dispatchEvent(new CustomEvent('cdm:new-request'));
          }}
        />
        <ShellBarItem icon="action-settings" text="Manage Space" onClick={openManageSpace} />
        <ShellBarItem
          icon="discussion"
          text="Global Chat"
          onClick={() => setChat(c => c?.cardContext === null ? null : { cardContext: null })}
        />
      </ShellBar>

      {/* ── Main Card Grid ───────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
        gap: '1.5rem',
        padding: '1.5rem',
        maxWidth: 1600,
        margin: '0 auto',
      }}>
        {visibleCards.map(l => renderCard(l.cardId))}
      </div>

      {/* ── Manage Space Panel ───────────────────────────────────────── */}
      {showManageSpace && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
        }}>
          <div style={{
            background: '#fff', width: 360, height: '100vh', boxShadow: '-4px 0 16px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center' }}>
              <span style={{ flex: 1, fontWeight: 700, fontSize: '1.1rem' }}>Manage Space</span>
              <Button design="Transparent" onClick={() => setShowManageSpace(false)}>✕</Button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
                Toggle visibility and reorder cards in your Space.
              </p>
              {(pendingLayouts || []).map((l, i) => (
                <div key={l.cardId} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem', borderRadius: 8,
                  background: l.visible ? '#f0f5ff' : '#fafafa',
                  marginBottom: '0.5rem', border: '1px solid #e5e5e5',
                }}>
                  <input
                    type="checkbox"
                    checked={l.visible}
                    onChange={() => toggleVisible(l.cardId)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <span style={{ flex: 1 }}>{CARD_LABELS[l.cardId]}</span>
                  <button
                    disabled={i === 0}
                    onClick={() => moveCard(l.cardId, 'up')}
                    style={{ border: 'none', background: 'transparent', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1 }}
                  >▲</button>
                  <button
                    disabled={i === pendingLayouts.length - 1}
                    onClick={() => moveCard(l.cardId, 'down')}
                    style={{ border: 'none', background: 'transparent', cursor: i === pendingLayouts.length - 1 ? 'default' : 'pointer', opacity: i === pendingLayouts.length - 1 ? 0.3 : 1 }}
                  >▼</button>
                </div>
              ))}
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e5e5', display: 'flex', gap: '0.5rem' }}>
              <Button design="Emphasized" disabled={saving} onClick={handleSaveSpace} style={{ flex: 1 }}>
                Save
              </Button>
              <Button onClick={() => setShowManageSpace(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Global / Card Chat Panel ─────────────────────────────────── */}
      {chat !== null && (
        <ChatPanel
          cardContext={chat.cardContext}
          cdmEmail={currentUser}
          onClose={() => setChat(null)}
        />
      )}
    </div>
  );
}
