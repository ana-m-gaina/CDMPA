import sys
from pathlib import Path
import pytest

APP_DIR = Path(__file__).parent.parent / "app"
for p in [str(APP_DIR), str(APP_DIR.parent)]:
    if p not in sys.path:
        sys.path.insert(0, p)


@pytest.mark.asyncio
async def test_lookup_rr_entry_by_code(mock_cap_client):
    from agents.rr_agent import lookup_rr_entry
    result = await lookup_rr_entry.ainvoke({"service_code": "SC-42"})
    assert "SC-42" in result
    assert "Chargeable" in result


@pytest.mark.asyncio
async def test_check_chargeability(mock_cap_client):
    from agents.rr_agent import check_chargeability
    result = await check_chargeability.ainvoke({"service_code": "SC-42"})
    assert "SC-42" in result
    assert "Chargeable=Yes" in result
