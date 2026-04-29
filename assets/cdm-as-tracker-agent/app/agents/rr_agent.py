"""
R&R Specialist Subagent — expert on CDM Additional Services Roles & Responsibilities.
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
    "You are an expert on CDM Additional Services Roles and Responsibilities. "
    "Answer questions about service code chargeability and categories using only R&R table data. "
    "Never hallucinate. State clearly when a code is not found."
)


@tool
async def lookup_rr_entry(
    service_code: Optional[str] = None,
    search_term: Optional[str] = None,
    category: Optional[str] = None,
    chargeable_only: bool = False,
) -> str:
    """Look up R&R entries. Provide service_code for exact lookup or search_term/category for filtered list."""
    if service_code:
        entry = await cap_client.get_rr_entry_by_code(service_code)
        if not entry:
            return f"No R&R entry found for service code '{service_code}'."
        chargeable = "Yes" if entry.get("chargeable") else "No"
        return (
            f"Service Code: {entry['serviceCode']}\n"
            f"Service Name: {entry['serviceName']}\n"
            f"Category: {entry.get('category', 'N/A')}\n"
            f"Chargeable: {chargeable}\n"
            f"Notes: {entry.get('notes', '')}"
        )
    ch = True if chargeable_only else None
    entries = await cap_client.get_rr_entries(search=search_term, category=category, chargeable=ch)
    if not entries:
        return "No matching R&R entries found."
    lines = [f"Found {len(entries)} entries:"]
    for e in entries:
        chargeable = "Yes" if e.get("chargeable") else "No"
        lines.append(f"  {e['serviceCode']} — {e['serviceName']} [{e.get('category', '')}] Chargeable={chargeable}")
    return "\n".join(lines)


@tool
async def check_chargeability(service_code: str) -> str:
    """Check whether a specific service code is chargeable."""
    entry = await cap_client.get_rr_entry_by_code(service_code)
    if not entry:
        return f"Service code '{service_code}' not found in R&R table."
    chargeable = "Yes" if entry.get("chargeable") else "No"
    return (
        f"Service code {entry['serviceCode']}: Chargeable={chargeable}, "
        f"Category={entry.get('category', 'N/A')}, "
        f"Notes={entry.get('notes', 'N/A')}"
    )


_RR_TOOLS = [lookup_rr_entry, check_chargeability]


def _build_rr_graph():
    from langchain_litellm import ChatLiteLLM
    from app.agent import get_model_name, get_temperature
    llm = ChatLiteLLM(model=get_model_name(), temperature=get_temperature())
    llm_with_tools = llm.bind_tools(_RR_TOOLS)
    tool_node = ToolNode(_RR_TOOLS)

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


async def run(query: str) -> str:
    graph = _build_rr_graph()
    messages = [SystemMessage(content=_SYSTEM_PROMPT), HumanMessage(content=query)]
    result = await graph.ainvoke({"messages": messages})
    return result["messages"][-1].content
