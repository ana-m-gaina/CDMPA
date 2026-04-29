"""Test fixtures with deterministic cap_client mocks."""
import sys
from pathlib import Path
from unittest.mock import AsyncMock
import pytest

APP_DIR = Path(__file__).parent.parent / "app"
AGENT_DIR = Path(__file__).parent.parent
for p in [str(APP_DIR), str(AGENT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

SC42_RR = {"ID": "r002", "serviceCode": "SC-42", "serviceName": "System Conversion Support", "category": "SystemConversion", "chargeable": True, "notes": "Standard scope", "active": True}
SC42_PRICING = {"ID": "p002", "serviceCode": "SC-42", "serviceName": "System Conversion Support", "price": 5000.00, "currency": "EUR", "effectiveFrom": "2024-01-01", "lastUpdatedBy": "pricingadmin", "active": True}
OPEN_REQUESTS = [
    {"ID": "req-001", "requestTitle": "System Conversion for ACME", "customerName": "ACME Corp", "customerAccountId": "ACC-001", "serviceCode": "SC-42", "serviceType": "SystemConversion", "status": "New", "assignedCDM": "alex", "createdAt": "2025-01-01T10:00:00Z"},
    {"ID": "req-002", "requestTitle": "Migration support for Beta", "customerName": "Beta Inc", "customerAccountId": "ACC-002", "serviceCode": "MS-01", "serviceType": "MigrationSupport", "status": "PriceCommunicated", "assignedCDM": "alex", "createdAt": "2025-01-05T10:00:00Z"},
]
CREATED_REQUEST = {"ID": "req-001", "status": "New", "requestTitle": "Test Request"}
JIRA_BODY = "JIRA Ticket Body:\nCustomer: ACME Corp\nService: SC-42\nPrice: EUR 5000"


@pytest.fixture
def mock_cap_client(monkeypatch):
    import cap_client as cc
    monkeypatch.setattr(cc, "get_rr_entry_by_code", AsyncMock(return_value=SC42_RR))
    monkeypatch.setattr(cc, "get_rr_entries", AsyncMock(return_value=[SC42_RR]))
    monkeypatch.setattr(cc, "get_pricing_entry", AsyncMock(return_value=SC42_PRICING))
    monkeypatch.setattr(cc, "get_all_pricing", AsyncMock(return_value=[SC42_PRICING]))
    monkeypatch.setattr(cc, "get_open_requests", AsyncMock(return_value=OPEN_REQUESTS))
    monkeypatch.setattr(cc, "get_as_request", AsyncMock(return_value=OPEN_REQUESTS[0]))
    monkeypatch.setattr(cc, "create_as_request", AsyncMock(return_value=CREATED_REQUEST))
    monkeypatch.setattr(cc, "advance_status", AsyncMock(return_value={"ID": "req-001", "status": "PriceCommunicated"}))
    monkeypatch.setattr(cc, "record_approval", AsyncMock(return_value={"ID": "req-001", "status": "Approved"}))
    monkeypatch.setattr(cc, "generate_jira_ticket", AsyncMock(return_value=JIRA_BODY))
    monkeypatch.setattr(cc, "confirm_invoiced", AsyncMock(return_value={"ID": "req-001", "status": "Invoiced"}))
    return cc
