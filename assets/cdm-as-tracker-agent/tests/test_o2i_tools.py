import sys
from pathlib import Path
import pytest

APP_DIR = Path(__file__).parent.parent / "app"
for p in [str(APP_DIR), str(APP_DIR.parent)]:
    if p not in sys.path:
        sys.path.insert(0, p)


@pytest.mark.asyncio
async def test_get_invoiceable_requests(mock_cap_client):
    from agents.o2i_agent import get_invoiceable_requests
    import cap_client as cc
    cc.get_open_requests.return_value = [
        {"ID": "req-003", "requestTitle": "Delivered Request", "customerName": "Corp A", "serviceCode": "SC-42", "status": "Delivered", "deliveryDate": "2025-03-01"}
    ]
    result = await get_invoiceable_requests.ainvoke({})
    assert "req-003" in result or "Delivered" in result


@pytest.mark.asyncio
async def test_generate_jira_ticket(mock_cap_client):
    from agents.o2i_agent import generate_jira_ticket
    result = await generate_jira_ticket.ainvoke({"request_id": "req-001"})
    assert "JIRA Ticket Body" in result
    assert "review" in result.lower()


@pytest.mark.asyncio
async def test_confirm_jira_submission(mock_cap_client):
    from agents.o2i_agent import confirm_jira_submission
    import cap_client as cc
    result = await confirm_jira_submission.ainvoke({"request_id": "req-001"})
    cc.confirm_invoiced.assert_called_once_with("req-001")
    assert "Invoiced" in result
