import { useState } from 'react';
import { Card, CardHeader, Table, TableRow, TableCell, TableHeaderRow, TableHeaderCell, Input, Button, Dialog, Label } from '@ui5/webcomponents-react';
import { useOData } from '../hooks/useOData';
import { getPricing, updatePricing } from '../api';

export default function PricingCard({ isAdmin, onChatToggle }) {
  const { data, loading, refresh } = useOData(getPricing);
  const [search, setSearch] = useState('');
  const [editRow, setEditRow] = useState(null);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);

  const filtered = data.filter(r => !search || r.serviceCode?.toLowerCase().includes(search.toLowerCase()) || r.serviceName?.toLowerCase().includes(search.toLowerCase()));

  async function handleSave() {
    setSaving(true);
    try { await updatePricing(editRow.ID, editData); setEditRow(null); refresh(); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Card>
      <CardHeader titleText="Pricing" subtitleText={`${filtered.length} entries`}
        action={<div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button icon="refresh" design="Transparent" onClick={refresh} />
          <Button icon="discussion" design="Transparent" onClick={onChatToggle} />
        </div>}
      />
      <div style={{ padding: '0.5rem' }}><Input placeholder="Search..." value={search} onInput={e => setSearch(e.target.value)} style={{ minWidth: 200 }} /></div>
      {loading ? <p style={{ padding: '1rem' }}>Loading...</p> : (
        <Table>
          <TableHeaderRow slot="headerRow">
            <TableHeaderCell>Code</TableHeaderCell><TableHeaderCell>Service Name</TableHeaderCell>
            <TableHeaderCell>Price</TableHeaderCell><TableHeaderCell>Effective From</TableHeaderCell>
            <TableHeaderCell>Last Updated By</TableHeaderCell>{isAdmin && <TableHeaderCell></TableHeaderCell>}
          </TableHeaderRow>
          {filtered.map(r => (
            <TableRow key={r.ID}>
              <TableCell><strong>{r.serviceCode}</strong></TableCell>
              <TableCell>{r.serviceName}</TableCell>
              <TableCell><strong>{r.currency} {Number(r.price).toLocaleString('en-DE', { minimumFractionDigits: 2 })}</strong></TableCell>
              <TableCell>{r.effectiveFrom}</TableCell>
              <TableCell>{r.lastUpdatedBy}</TableCell>
              {isAdmin && <TableCell><Button design="Transparent" onClick={() => { setEditRow(r); setEditData({ price: r.price, currency: r.currency, effectiveFrom: r.effectiveFrom }); }}>Edit</Button></TableCell>}
            </TableRow>
          ))}
        </Table>
      )}
      {editRow && (
        <Dialog open headerText={`Edit ${editRow.serviceCode}`} onClose={() => setEditRow(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', minWidth: 300 }}>
            <div><Label>Price</Label><Input value={editData.price} onInput={e => setEditData(d => ({ ...d, price: e.target.value }))} /></div>
            <div><Label>Currency</Label><Input value={editData.currency} onInput={e => setEditData(d => ({ ...d, currency: e.target.value }))} /></div>
            <div><Label>Effective From</Label><Input type="Date" value={editData.effectiveFrom} onInput={e => setEditData(d => ({ ...d, effectiveFrom: e.target.value }))} /></div>
          </div>
          <div slot="footer" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem' }}>
            <Button design="Emphasized" onClick={handleSave} disabled={saving}>Save</Button>
            <Button onClick={() => setEditRow(null)}>Cancel</Button>
          </div>
        </Dialog>
      )}
    </Card>
  );
}
