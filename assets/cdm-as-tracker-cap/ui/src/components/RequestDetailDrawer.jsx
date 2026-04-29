import { useState } from 'react';
import { Dialog, Button, Label, Input, TextArea } from '@ui5/webcomponents-react';
import { advanceStatus, recordApproval } from '../api';

export default function RequestDetailDrawer({ request, onClose, onRefresh }) {
  const [priceForm, setPriceForm] = useState({ price: '', currency: 'EUR', comment: '' });
  const [approvalForm, setApprovalForm] = useState({ approvalText: '', poNumber: '' });
  const [busy, setBusy] = useState(false);

  async function doAdvance(newStatus, comment = '') {
    setBusy(true);
    try { await advanceStatus(request.ID, newStatus, comment); onRefresh(); onClose(); }
    catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  async function doRecordApproval() {
    setBusy(true);
    try { await recordApproval(request.ID, approvalForm.approvalText, approvalForm.poNumber); onRefresh(); onClose(); }
    catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }

  if (!request) return null;
  const logs = [...(request.activityLog || [])].sort((a, b) => new Date(a.performedAt) - new Date(b.performedAt));

  return (
    <Dialog open headerText={request.requestTitle} style={{ '--_ui5_dialog_max_width': '640px' }} onClose={onClose}>
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div><Label>Customer</Label><p>{request.customerName} ({request.customerAccountId})</p></div>
          <div><Label>Service Code</Label><p>{request.serviceCode}</p></div>
          <div><Label>Status</Label><p><span className={`status-badge status-${request.status}`}>{request.status}</span></p></div>
          <div><Label>Assigned CDM</Label><p>{request.assignedCDM}</p></div>
          <div><Label>Price</Label><p>{request.currency} {request.price || '—'}</p></div>
          <div><Label>PO Number</Label><p>{request.poNumber || '—'}</p></div>
          {request.sap4MeTicketId && <div><Label>SAP4Me</Label><p>{request.sap4MeTicketId}</p></div>}
          {request.amsTicketId && <div><Label>AMS</Label><p>{request.amsTicketId}</p></div>}
        </div>
        {request.description && <div><Label>Description</Label><p>{request.description}</p></div>}
        {request.approvalText && <div><Label>Approval</Label><p>{request.approvalText}</p></div>}

        {request.status === 'New' && (
          <div style={{ border: '1px solid #e5e5e5', padding: '1rem', borderRadius: 8 }}>
            <Label>Communicate Price</Label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <Input placeholder="Price" value={priceForm.price} onInput={e => setPriceForm(f => ({ ...f, price: e.target.value }))} style={{ width: 120 }} />
              <Input placeholder="EUR" value={priceForm.currency} onInput={e => setPriceForm(f => ({ ...f, currency: e.target.value }))} style={{ width: 80 }} />
              <Input placeholder="Comment" value={priceForm.comment} onInput={e => setPriceForm(f => ({ ...f, comment: e.target.value }))} style={{ flex: 1 }} />
              <Button design="Emphasized" disabled={busy} onClick={() => doAdvance('PriceCommunicated', priceForm.comment)}>Send</Button>
            </div>
          </div>
        )}
        {request.status === 'PriceCommunicated' && (
          <div style={{ border: '1px solid #e5e5e5', padding: '1rem', borderRadius: 8 }}>
            <Label>Record Customer Approval</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <TextArea placeholder="Paste customer approval text..." value={approvalForm.approvalText} onInput={e => setApprovalForm(f => ({ ...f, approvalText: e.target.value }))} rows={3} />
              <Input placeholder="PO Number (optional)" value={approvalForm.poNumber} onInput={e => setApprovalForm(f => ({ ...f, poNumber: e.target.value }))} />
              <Button design="Emphasized" disabled={busy || !approvalForm.approvalText} onClick={doRecordApproval}>Record Approval</Button>
            </div>
          </div>
        )}
        {request.status === 'Approved' && <Button design="Emphasized" disabled={busy} onClick={() => doAdvance('InDelivery')}>Start Delivery</Button>}
        {request.status === 'InDelivery' && <Button design="Emphasized" disabled={busy} onClick={() => doAdvance('Delivered')}>Confirm Delivery</Button>}

        {logs.length > 0 && (
          <div>
            <Label>Activity Log</Label>
            <div className="timeline">
              {logs.map(l => (
                <div key={l.ID} className="timeline-item">
                  <strong>{l.action}</strong>
                  {l.oldStatus && <span> · {l.oldStatus} → {l.newStatus}</span>}
                  {l.description && <p>{l.description}</p>}
                  <div className="time">{l.performedBy} · {new Date(l.performedAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div slot="footer" style={{ padding: '0.5rem' }}><Button onClick={onClose}>Close</Button></div>
    </Dialog>
  );
}
