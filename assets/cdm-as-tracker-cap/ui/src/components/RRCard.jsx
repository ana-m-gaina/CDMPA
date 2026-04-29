import { useState } from 'react';
import { Card, CardHeader, Table, TableRow, TableCell, TableHeaderRow, TableHeaderCell, Input, Select, Option, Button } from '@ui5/webcomponents-react';
import { useOData } from '../hooks/useOData';
import { getRREntries } from '../api';

export default function RRCard({ onChatToggle }) {
  const { data, loading, refresh } = useOData(getRREntries);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [chargeFilter, setChargeFilter] = useState('All');

  const categories = ['All', ...new Set(data.map(r => r.category).filter(Boolean))];
  const filtered = data.filter(r => {
    const matchSearch = !search || r.serviceCode?.toLowerCase().includes(search.toLowerCase()) || r.serviceName?.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'All' || r.category === catFilter;
    const matchCharge = chargeFilter === 'All' || (chargeFilter === 'Yes' ? r.chargeable : !r.chargeable);
    return matchSearch && matchCat && matchCharge;
  });

  return (
    <Card>
      <CardHeader titleText="R&R Reference" subtitleText={`${filtered.length} entries`}
        action={<div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button icon="refresh" design="Transparent" onClick={refresh} />
          <Button icon="discussion" design="Transparent" onClick={onChatToggle} />
        </div>}
      />
      <div style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Input placeholder="Search code or name..." value={search} onInput={e => setSearch(e.target.value)} style={{ minWidth: 180 }} />
        <Select onChange={e => setCatFilter(e.detail.selectedOption.value)} style={{ minWidth: 160 }}>
          {categories.map(c => <Option key={c} value={c}>{c}</Option>)}
        </Select>
        <Select onChange={e => setChargeFilter(e.detail.selectedOption.value)} style={{ minWidth: 120 }}>
          <Option value="All">All</Option><Option value="Yes">Chargeable</Option><Option value="No">Not Chargeable</Option>
        </Select>
      </div>
      {loading ? <p style={{ padding: '1rem' }}>Loading...</p> : (
        <Table>
          <TableHeaderRow slot="headerRow">
            <TableHeaderCell>Code</TableHeaderCell><TableHeaderCell>Service Name</TableHeaderCell>
            <TableHeaderCell>Category</TableHeaderCell><TableHeaderCell>Chargeable</TableHeaderCell><TableHeaderCell>Notes</TableHeaderCell>
          </TableHeaderRow>
          {filtered.map(r => (
            <TableRow key={r.ID}>
              <TableCell><strong>{r.serviceCode}</strong></TableCell>
              <TableCell>{r.serviceName}</TableCell>
              <TableCell>{r.category}</TableCell>
              <TableCell><span className={`status-badge ${r.chargeable ? 'status-Approved' : 'status-Invoiced'}`}>{r.chargeable ? 'Yes' : 'No'}</span></TableCell>
              <TableCell>{r.notes}</TableCell>
            </TableRow>
          ))}
        </Table>
      )}
    </Card>
  );
}
