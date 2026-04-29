import sys
from pathlib import Path
import pytest

APP_DIR = Path(__file__).parent.parent / "app"
for p in [str(APP_DIR), str(APP_DIR.parent)]:
    if p not in sys.path:
        sys.path.insert(0, p)


@pytest.mark.asyncio
async def test_get_as_request(mock_cap_client):
    from agents.request_management_agent import get_as_request
    result = await get_as_request.ainvoke({"request_id": "req-001"})
    assert "System Conversion for ACME" in result


@pytest.mark.asyncio
async def test_get_open_requests(mock_cap_client):
    from agents.request_management_agent import get_open_requests
    result = await get_open_requests.ainvoke({})
    assert "req-001" in result
    assert "req-002" in result


@pytest.mark.asyncio
async def test_create_as_request_pending(mock_cap_client):
    from agents.request_management_agent import create_as_request
    import cap_client as cc
    result = await create_as_request.ainvoke({"customer_name": "Test Corp", "service_code": "SC-42", "description": "Test", "cdm_email": "alex", "confirmed": False})
    assert "[PENDING_CONFIRMATION]" in result
    cc.create_as_request.assert_not_called()


@pytest.mark.asyncio
async def test_create_as_request_confirmed(mock_cap_client):
    from agents.request_management_agent import create_as_request
    import cap_client as cc
    result = await create_as_request.ainvoke({"customer_name": "Test Corp", "service_code": "SC-42", "description": "Test", "cdm_email": "alex", "confirmed": True})
    cc.create_as_request.assert_called_once()
    assert "req-001" in result


@pytest.mark.asyncio
async def test_advance_request_status(mock_cap_client):
    from agents.request_management_agent import advance_request_status
    import cap_client as cc
    result = await advance_request_status.ainvoke({"request_id": "req-001", "new_status": "PriceCommunicated", "comment": "Price sent"})
    cc.advance_status.assert_called_once_with("req-001", "PriceCommunicated", "Price sent")
    assert "PriceCommunicated" in result


@pytest.mark.asyncio
async def test_record_approval(mock_cap_client):
    from agents.request_management_agent import record_approval
    import cap_client as cc
    result = await record_approval.ainvoke({"request_id": "req-001", "approval_text": "Customer approved via email", "po_number": "PO-123"})
    cc.record_approval.assert_called_once()
    assert "Approved" in result
