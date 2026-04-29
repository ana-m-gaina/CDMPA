import sys
from pathlib import Path
import pytest

APP_DIR = Path(__file__).parent.parent / "app"
for p in [str(APP_DIR), str(APP_DIR.parent)]:
    if p not in sys.path:
        sys.path.insert(0, p)


@pytest.mark.asyncio
async def test_lookup_pricing(mock_cap_client):
    from agents.pricing_agent import lookup_pricing
    result = await lookup_pricing.ainvoke({"service_code": "SC-42"})
    assert "5000" in result
    assert "EUR" in result


@pytest.mark.asyncio
async def test_search_pricing(mock_cap_client):
    from agents.pricing_agent import search_pricing
    result = await search_pricing.ainvoke({"search_term": "SC"})
    assert "SC-42" in result
