const BASE = '/CDMService';
const ADMIN = '/AdminService';

async function odataFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers || {}) },
    credentials: 'include',
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err?.error?.message || res.statusText);
  }
  if (res.status === 204) return null;
  const json = await res.json();
  return json.value !== undefined ? json.value : json;
}

export const getRREntries = () => odataFetch(`${BASE}/RRTable?$filter=active eq true&$orderby=serviceCode`);
export const getPricing   = () => odataFetch(`${BASE}/PricingTable?$filter=active eq true&$orderby=serviceCode`);
export const updatePricing = (id, data) => odataFetch(`${ADMIN}/PricingTable(${id})`, { method: 'PATCH', body: JSON.stringify(data) });
export const getActiveRequests = () => odataFetch(`${BASE}/ASRequest?$filter=status ne 'Invoiced'&$expand=activityLog&$orderby=createdAt desc`);
export const getDeliveredRequests = () => odataFetch(`${BASE}/ASRequest?$filter=status eq 'Delivered'&$orderby=createdAt desc`);
export const createRequest = (data) => odataFetch(`${BASE}/ASRequest`, { method: 'POST', body: JSON.stringify(data) });
export const advanceStatus = (id, newStatus, comment = '') =>
  odataFetch(`${BASE}/ASRequest(${id})/CDMService.advanceStatus`, { method: 'POST', body: JSON.stringify({ newStatus, comment }) });
export const recordApproval = (id, approvalText, poNumber = '') =>
  odataFetch(`${BASE}/ASRequest(${id})/CDMService.recordApproval`, { method: 'POST', body: JSON.stringify({ approvalText, poNumber }) });
export const generateJiraTicket = (id) =>
  odataFetch(`${BASE}/ASRequest(${id})/CDMService.generateJiraTicket`, { method: 'POST', body: JSON.stringify({}) });
export const getCardLayouts = () => odataFetch(`${BASE}/CardLayout`);
export const saveCardLayout = (layouts) =>
  odataFetch(`${BASE}/saveCardLayout`, { method: 'POST', body: JSON.stringify({ layouts }) });
export const sendChat = (message, card_context = null, cdm_email = null) =>
  fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ message, card_context, cdm_email }) }).then(r => r.text());
