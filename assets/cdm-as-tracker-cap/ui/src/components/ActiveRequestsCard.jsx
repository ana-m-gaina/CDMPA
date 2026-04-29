import { useState } from 'react';
import { Card, CardHeader, Table, TableRow, TableCell, TableHeaderRow, TableHeaderCell, Button } from '@ui5/webcomponents-react';
import { useOData } from '../hooks/useOData';
import { getActiveRequests, createRequest, getRREntries } from '../api';
import RequestDetailDrawer from './RequestDetailDrawer';

function daysSince(d) { return d ? Math.floor((Date.now() - new Date(d)) / 86400000) + 'd' : '—'; }

export default function ActiveRequestsCard({ isManager, currentUser, onChatToggle }) {
  const { data, loading, refresh } = useOData(getActiveRequests);
  const { data: rrData } = useOData(getRREntries);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  function f(field) { return e => setForm(p => ({ ...p, [field]: e.target.value })); }

  async function handleCreate() {
    setSaving(true);
    try { await createRequest({ ...form, assignedCDM: currentUser, status: 'New' }); setShowNew(false); setForm({}); refresh(); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  return (
    <>
      <Card>
        <CardHeader titleText="Active Requests" subtitleText={`${data.length} open`}
          action={<div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button icon="add" onClick={() => setShowNew(true)}>New</Button>
            <Button icon="refresh" design="Transparent" onClick={refresh} />
            <Button icon="discussion" design="Transparent" onClick={onChatToggle} />
          </div>}
        />
        {loading ? <p style={{ padding: '1rem' }}>Loading...</p> : (
          <Table>
            <TableHeaderRow slot="headerRow">
              <TableHeaderCell>Title</TableHeaderCell><TableHeaderCell>Customer</TableHeaderCell>
              <TableHeaderCell>Code</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Age</TableHeaderCell>{isManager && <TableHeaderCell>CDM</TableHeaderCell>}
            </TableHeaderRow>
            {data.map(r => (
              <TableRow key={r.ID} style={{ cursor: 'pointer' }} onClick={() => setSelected(r)}>
                <TableCell><Button design="Transparent">{r.requestTitle}</Button></TableCell>
                <TableCell>{r.customerName}</TableCell><TableCell>{r.serviceCode}</TableCell>
                <TableCell><span className={`status-badge status-${r.status}`}>{r.status}</span></TableCell>
                <TableCell>{daysSince(r.createdAt)}</TableCell>
                {isManager && <TableCell>{r.assignedCDM}</TableCell>}
              </TableRow>
            ))}
          </Table>
        )}
      </Card>
      {selected && <RequestDetailDrawer request={selected} onClose={() => setSelected(null)} onRefresh={() => { refresh(); setSelected(null); }} />}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', width: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1rem' }}>New AS Request</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[['requestTitle','Title *'],['customerName','Customer Name *'],['customerAccountId','Account ID'],['serviceType','Service Type'],['sap4MeTicketId','SAP4Me Ticket'],['spcTicketId','SPC Ticket'],['btpTicketId','BTP Ticket'],['amsTicketId','AMS Ticket'],['serviceNowTicketId','ServiceNow Ticket'],['salesOrderNumber','Sales Order #'],['providerContractNumber','Provider Contract #']].map(([k, label]) => (
                <div key={k}>
                  <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>{label}</label>
                  <input style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }} value={form[k] || ''} onChange={f(k)} />
                </div>
              ))}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>Service Code</label>
                <select style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }} value={form.serviceCode || ''} onChange={f('serviceCode')}>
                  <option value="">— Select —</option>
                  {rrData.filter(r => r.chargeable).map(r => <option key={r.serviceCode} value={r.serviceCode}>{r.serviceCode} — {r.serviceName}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>Description</label>
                <textarea style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: 4 }} rows={3} value={form.description || ''} onChange={f('description')} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button style={{ padding: '8px 16px', background: '#0070f2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }} disabled={saving || !form.requestTitle || !form.customerName} onClick={handleCreate}>Create</button>
              <button style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }} onClick={() => { setShowNew(false); setForm({}); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
