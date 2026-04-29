"""
Pricing Specialist Subagent — expert on CDM Additional Services pricing.
"""
import logging
from typing import Optional

from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_litellm import ChatLiteLLM
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

import cap_client

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are an expert on CDM Additional Services pricing. "
    "Provide accurate price lookups. Never guess prices. "
    "The update tool is available only to admin users."
)


@tool
async def lookup_pricing(service_code: str) -> str:
    """Look up the price for a specific service code."""
    entry = await cap_client.get_pricing_entry(service_code)
    if not entry:
        return f"No pricing found for {service_code}."
    return (
        f"Service Code: {entry['serviceCode']}\n"
        f"Service Name: {entry.get('serviceName', 'N/A')}\n"
        f"Price: {entry.get('currency', 'EUR')} {entry['price']}\n"
        f"Effective From: {entry.get('effectiveFrom', 'N/A')}\n"
        f"Last Updated By: {entry.get('lastUpdatedBy', 'N/A')}"
    )


@tool
async def search_pricing(search_term: str) -> str:
    """Search pricing entries by service code or name."""
    entries = await cap_client.get_all_pricing(search=search_term)
    if not entries:
        return "No pricing records found."
    lines = [f"Found {len(entries)} pricing entries:"]
    for e in entries:
        lines.append(f"  {e['serviceCode']} — {e.get('serviceName', '')} | {e.get('currency', 'EUR')} {e['price']}")
    return "\n".join(lines)


@tool
async def update_pricing_entry(
    entry_id: str,
    price: float,
    currency: str = "EUR",
    effective_from: Optional[str] = None,
    admin_context: bool = False,
) -> str:
    """Update a pricing entry. Only available to admin users (admin_context must be True)."""
    if not admin_context:
        return "Unauthorized: admin access required."
    data = {"price": price, "currency": currency}
    if effective_from:
        data["effectiveFrom"] = effective_from
    await cap_client.update_pricing_entry(entry_id, data)
    return f"Pricing entry {entry_id} updated: {currency} {price}"


_PRICING_TOOLS = [lookup_pricing, search_pricing, update_pricing_entry]


def _build_pricing_graph():
    from langchain_litellm import ChatLiteLLM
    from app.agent import get_model_name, get_temperature
    llm = ChatLiteLLM(model=get_model_name(), temperature=get_temperature())
    llm_with_tools = llm.bind_tools(_PRICING_TOOLS)
    tool_node = ToolNode(_PRICING_TOOLS)

    async def call_model(state: MessagesState):
        response = await llm_with_tools.ainvoke(state["messages"])
        return {"messages": [response]}

    def should_continue(state: MessagesState):
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return "__end__"

    builder = StateGraph(MessagesState)
    builder.add_node("model", call_model)
    builder.add_node("tools", tool_node)
    builder.add_edge(START, "model")
    builder.add_conditional_edges("model", should_continue, {"tools": "tools", "__end__": END})
    builder.add_edge("tools", "model")
    return builder.compile()


async def run(query: str, admin_context: bool = False) -> str:
    graph = _build_pricing_graph()
    messages = [SystemMessage(content=_SYSTEM_PROMPT), HumanMessage(content=query)]
    result = await graph.ainvoke({"messages": messages})
    return result["messages"][-1].content
