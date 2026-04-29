import { useState } from 'react';
import { Card, CardHeader, Table, TableRow, TableCell, TableHeaderRow, TableHeaderCell, Button, Dialog } from '@ui5/webcomponents-react';
import { useOData } from '../hooks/useOData';
import { getDeliveredRequests, generateJiraTicket, advanceStatus } from '../api';

function daysSince(d) { return d ? Math.floor((Date.now() - new Date(d)) / 86400000) + 'd' : '—'; }

export default function JiraO2ICard({ onChatToggle }) {
  const { data, loading, refresh } = useOData(getDeliveredRequests);
  const [ticketModal, setTicketModal] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleGenerate(r) {
    setBusy(true);
    try { const body = await generateJiraTicket(r.ID); setTicketModal({ requestId: r.ID, requestTitle: r.requestTitle, body }); }
    catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function handleInvoiced() {
    setBusy(true);
    try { await advanceStatus(ticketModal.requestId, 'Invoiced', 'JIRA ticket submitted'); setTicketModal(null); refresh(); }
    catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Card>
        <CardHeader titleText="JIRA O2I" subtitleText={`${data.length} ready`}
          action={<div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button icon="refresh" design="Transparent" onClick={refresh} />
            <Button icon="discussion" design="Transparent" onClick={onChatToggle} />
          </div>}
        />
        {loading ? <p style={{ padding: '1rem' }}>Loading...</p> : (
          <Table>
            <TableHeaderRow slot="headerRow">
              <TableHeaderCell>Title</TableHeaderCell><TableHeaderCell>Customer</TableHeaderCell>
              <TableHeaderCell>Code</TableHeaderCell><TableHeaderCell>Delivered</TableHeaderCell>
              <TableHeaderCell>Age</TableHeaderCell><TableHeaderCell></TableHeaderCell>
            </TableHeaderRow>
            {data.map(r => (
              <TableRow key={r.ID}>
                <TableCell>{r.requestTitle}</TableCell><TableCell>{r.customerName}</TableCell>
                <TableCell>{r.serviceCode}</TableCell>
                <TableCell>{r.deliveryDate ? new Date(r.deliveryDate).toLocaleDateString() : '—'}</TableCell>
                <TableCell>{daysSince(r.createdAt)}</TableCell>
                <TableCell><Button design="Emphasized" disabled={busy} onClick={() => handleGenerate(r)}>Generate Ticket</Button></TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </Card>
      {ticketModal && (
        <Dialog open headerText={`JIRA Ticket — ${ticketModal.requestTitle}`}>
          <div style={{ padding: '1rem' }}>
            <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: 4, whiteSpace: 'pre-wrap', fontSize: '0.85rem', maxHeight: 400, overflowY: 'auto' }}>{ticketModal.body}</pre>
          </div>
          <div slot="footer" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem', flexWrap: 'wrap' }}>
            <Button design="Emphasized" disabled={busy} onClick={handleInvoiced}>Mark as Invoiced</Button>
            <Button onClick={() => navigator.clipboard.writeText(ticketModal.body)}>Copy to Clipboard</Button>
            <Button onClick={() => setTicketModal(null)}>Close</Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
