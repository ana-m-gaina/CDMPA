"""
Async HTTP client for the CDM AS Tracker CAP OData backend.
All methods raise RuntimeError on non-2xx responses.
"""
import os
from typing import Optional

import httpx

CAP_SERVICE_URL = os.environ.get("CAP_SERVICE_URL", "http://localhost:4004/odata/v4/CDMService")
CAP_ADMIN_SERVICE_URL = os.environ.get("CAP_ADMIN_SERVICE_URL", "http://localhost:4004/odata/v4/AdminService")


def _auth_header() -> dict:
    """Return dummy auth header; in production, BTP principal propagation is used."""
    user = os.environ.get("CAP_USER", "alex")
    password = os.environ.get("CAP_PASSWORD", user)
    import base64
    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    return {"Authorization": f"Basic {token}", "Content-Type": "application/json", "Accept": "application/json"}


def _check(resp: httpx.Response) -> dict:
    if not resp.is_success:
        raise RuntimeError(f"CAP request failed: {resp.status_code} {resp.text[:300]}")
    if resp.status_code == 204:
        return {}
    data = resp.json()
    return data


def _list(data: dict) -> list:
    return data.get("value", []) if isinstance(data, dict) else data


# ─── R&R ────────────────────────────────────────────────────────────────────

async def get_rr_entries(search: Optional[str] = None,
                         category: Optional[str] = None,
                         chargeable: Optional[bool] = None) -> list:
    filters = ["active eq true"]
    if category:
        filters.append(f"category eq '{category}'")
    if chargeable is not None:
        filters.append(f"chargeable eq {str(chargeable).lower()}")
    url = f"{CAP_SERVICE_URL}/RRTable?$filter={' and '.join(filters)}&$orderby=serviceCode"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=_auth_header())
        data = _check(resp)
    results = _list(data)
    if search:
        s = search.lower()
        results = [r for r in results if s in r.get("serviceCode", "").lower() or s in r.get("serviceName", "").lower()]
    return results


async def get_rr_entry_by_code(service_code: str) -> Optional[dict]:
    url = f"{CAP_SERVICE_URL}/RRTable?$filter=serviceCode eq '{service_code}' and active eq true"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=_auth_header())
        data = _check(resp)
    entries = _list(data)
    return entries[0] if entries else None


# ─── Pricing ─────────────────────────────────────────────────────────────────

async def get_pricing_entry(service_code: str) -> Optional[dict]:
    url = f"{CAP_SERVICE_URL}/PricingTable?$filter=serviceCode eq '{service_code}' and active eq true"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=_auth_header())
        data = _check(resp)
    entries = _list(data)
    return entries[0] if entries else None


async def get_all_pricing(search: Optional[str] = None) -> list:
    url = f"{CAP_SERVICE_URL}/PricingTable?$filter=active eq true&$orderby=serviceCode"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=_auth_header())
        data = _check(resp)
    results = _list(data)
    if search:
        s = search.lower()
        results = [r for r in results if s in r.get("serviceCode", "").lower() or s in r.get("serviceName", "").lower()]
    return results


async def update_pricing_entry(entry_id: str, data: dict) -> dict:
    url = f"{CAP_ADMIN_SERVICE_URL}/PricingTable({entry_id})"
    async with httpx.AsyncClient() as client:
        resp = await client.patch(url, headers=_auth_header(), json=data)
        return _check(resp)


# ─── AS Requests ─────────────────────────────────────────────────────────────

async def get_as_request(request_id: str) -> dict:
    url = f"{CAP_SERVICE_URL}/ASRequest({request_id})?$expand=activityLog"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=_auth_header())
        return _check(resp)


async def get_open_requests(cdm_email: Optional[str] = None) -> list:
    filters = ["status ne 'Invoiced'"]
    if cdm_email:
        filters.append(f"assignedCDM eq '{cdm_email}'")
    url = f"{CAP_SERVICE_URL}/ASRequest?$filter={' and '.join(filters)}&$orderby=createdAt desc"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=_auth_header())
        data = _check(resp)
    return _list(data)


async def create_as_request(data: dict) -> dict:
    url = f"{CAP_SERVICE_URL}/ASRequest"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=_auth_header(), json=data)
        return _check(resp)


async def advance_status(request_id: str, new_status: str, comment: str = "") -> dict:
    url = f"{CAP_SERVICE_URL}/ASRequest({request_id})/CDMService.advanceStatus"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=_auth_header(), json={"newStatus": new_status, "comment": comment})
        return _check(resp)


async def record_approval(request_id: str, approval_text: str, po_number: str = "") -> dict:
    url = f"{CAP_SERVICE_URL}/ASRequest({request_id})/CDMService.recordApproval"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=_auth_header(), json={"approvalText": approval_text, "poNumber": po_number})
        return _check(resp)


async def generate_jira_ticket(request_id: str) -> str:
    url = f"{CAP_SERVICE_URL}/ASRequest({request_id})/CDMService.generateJiraTicket"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=_auth_header(), json={})
        data = _check(resp)
    return data.get("value", str(data))


async def confirm_invoiced(request_id: str) -> dict:
    url = f"{CAP_SERVICE_URL}/ASRequest({request_id})/CDMService.advanceStatus"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=_auth_header(), json={"newStatus": "Invoiced", "comment": "JIRA ticket submitted"})
        return _check(resp)
