"""Unit tests for cap_client — mocked httpx."""
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

APP_DIR = Path(__file__).parent.parent / "app"
for p in [str(APP_DIR), str(APP_DIR.parent)]:
    if p not in sys.path:
        sys.path.insert(0, p)


def _resp(data, status=200):
    r = MagicMock()
    r.is_success = status < 400
    r.status_code = status
    r.json.return_value = data
    r.text = str(data)
    return r


def _client(get=None, post=None, patch_fn=None):
    mc = MagicMock()
    mc.__aenter__ = AsyncMock(return_value=mc)
    mc.__aexit__ = AsyncMock(return_value=False)
    if get: mc.get = AsyncMock(return_value=get)
    if post: mc.post = AsyncMock(return_value=post)
    if patch_fn: mc.patch = AsyncMock(return_value=patch_fn)
    return mc


@pytest.mark.asyncio
async def test_get_rr_entries():
    import cap_client
    with patch("httpx.AsyncClient", return_value=_client(get=_resp({"value": [{"serviceCode": "SC-42", "serviceName": "Conversion", "chargeable": True}]}))):
        result = await cap_client.get_rr_entries()
    assert result[0]["serviceCode"] == "SC-42"


@pytest.mark.asyncio
async def test_get_rr_entries_with_search():
    import cap_client
    with patch("httpx.AsyncClient", return_value=_client(get=_resp({"value": [{"serviceCode": "SC-42", "serviceName": "Conversion", "chargeable": True}, {"serviceCode": "MS-01", "serviceName": "Migration", "chargeable": True}]}))):
        result = await cap_client.get_rr_entries(search="SC")
    assert all("SC" in r["serviceCode"] for r in result)


@pytest.mark.asyncio
async def test_get_rr_entry_by_code_found():
    import cap_client
    with patch("httpx.AsyncClient", return_value=_client(get=_resp({"value": [{"serviceCode": "SC-42"}]}))):
        result = await cap_client.get_rr_entry_by_code("SC-42")
    assert result["serviceCode"] == "SC-42"


@pytest.mark.asyncio
async def test_get_rr_entry_by_code_not_found():
    import cap_client
    with patch("httpx.AsyncClient", return_value=_client(get=_resp({"value": []}))):
        result = await cap_client.get_rr_entry_by_code("NOTFOUND")
    assert result is None


@pytest.mark.asyncio
async def test_get_pricing_entry():
    import cap_client
    with patch("httpx.AsyncClient", return_value=_client(get=_resp({"value": [{"serviceCode": "SC-42", "price": 5000.0, "currency": "EUR"}]}))):
        result = await cap_client.get_pricing_entry("SC-42")
    assert result["price"] == 5000.0


@pytest.mark.asyncio
async def test_get_all_pricing():
    import cap_client
    with patch("httpx.AsyncClient", return_value=_client(get=_resp({"value": [{"serviceCode": "SC-42", "price": 5000.0, "currency": "EUR", "serviceName": "Conversion"}]}))):
        result = await cap_client.get_all_pricing(search="SC")
    assert len(result) == 1


@pytest.mark.asyncio
async def test_get_open_requests():
    import cap_client
    with patch("httpx.AsyncClient", return_value=_client(get=_resp({"value": [{"ID": "req-001", "status": "New"}]}))):
        result = await cap_client.get_open_requests(cdm_email="alex")
    assert len(result) == 1


@pytest.mark.asyncio
async def test_create_as_request():
    import cap_client
    resp = _resp({"ID": "req-new", "status": "New"}, 201)
    resp.is_success = True
    with patch("httpx.AsyncClient", return_value=_client(post=resp)):
        result = await cap_client.create_as_request({"requestTitle": "Test", "customerName": "Corp", "assignedCDM": "alex"})
    assert result["ID"] == "req-new"


@pytest.mark.asyncio
async def test_advance_status():
    import cap_client
    with patch("httpx.AsyncClient", return_value=_client(post=_resp({"ID": "req-001", "status": "PriceCommunicated"}))):
        result = await cap_client.advance_status("req-001", "PriceCommunicated", "sent")
    assert result["status"] == "PriceCommunicated"


@pytest.mark.asyncio
async def test_record_approval():
    import cap_client
    with patch("httpx.AsyncClient", return_value=_client(post=_resp({"ID": "req-001", "status": "Approved"}))):
        result = await cap_client.record_approval("req-001", "Approved via email", "PO-123")
    assert result["status"] == "Approved"


@pytest.mark.asyncio
async def test_generate_jira_ticket():
    import cap_client
    with patch("httpx.AsyncClient", return_value=_client(post=_resp({"value": "JIRA Body"}))):
        result = await cap_client.generate_jira_ticket("req-001")
    assert "JIRA Body" in result


@pytest.mark.asyncio
async def test_confirm_invoiced():
    import cap_client
    with patch("httpx.AsyncClient", return_value=_client(post=_resp({"ID": "req-001", "status": "Invoiced"}))):
        result = await cap_client.confirm_invoiced("req-001")
    assert result["status"] == "Invoiced"


@pytest.mark.asyncio
async def test_check_raises_on_error():
    import cap_client
    with patch("httpx.AsyncClient", return_value=_client(get=_resp({"error": "Not found"}, 404))):
        with pytest.raises(RuntimeError, match="CAP request failed"):
            await cap_client.get_pricing_entry("BADCODE")
