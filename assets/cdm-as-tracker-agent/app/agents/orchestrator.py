"""
Main Orchestrator Agent — routes CDM queries to specialist subagents.
"""
import logging
from typing import Optional

from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_litellm import ChatLiteLLM
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from agents import rr_agent, pricing_agent, request_management_agent, o2i_agent

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are the CDM AS Tracker personal assistant. "
    "Route every query to the correct specialist subagent. "
    "Never answer data questions yourself — always delegate. "
    "The CDM sees one unified conversation. "
    "If a query is ambiguous, ask one clarifying question before routing."
)

# ─── Routing hints by card context ───────────────────────────────────────────
_CARD_CONTEXT_HINTS = {
    "rr-reference":    "Use query_rr_agent for this query.",
    "pricing":         "Use query_pricing_agent for this query.",
    "active-requests": "Use query_request_management_agent for this query.",
    "jira-o2i":        "Use query_o2i_agent for this query.",
}


@tool
async def query_rr_agent(query: str) -> str:
    """Query the R&R specialist subagent for service code chargeability and R&R reference data."""
    return await rr_agent.run(query)


@tool
async def query_pricing_agent(query: str) -> str:
    """Query the pricing specialist subagent for service pricing information."""
    return await pricing_agent.run(query)


@tool
async def query_request_management_agent(query: str, cdm_email: str = "") -> str:
    """Query the request management specialist subagent for AS request lifecycle operations."""
    return await request_management_agent.run(query, cdm_email=cdm_email or None)


@tool
async def query_o2i_agent(query: str, cdm_email: str = "") -> str:
    """Query the O2I specialist subagent for JIRA ticket generation and invoicing."""
    return await o2i_agent.run(query, cdm_email=cdm_email or None)


_ORCHESTRATOR_TOOLS = [
    query_rr_agent,
    query_pricing_agent,
    query_request_management_agent,
    query_o2i_agent,
]


def _build_orchestrator_graph(card_context: Optional[str] = None):
    from app.agent import get_model_name, get_temperature
    llm = ChatLiteLLM(model=get_model_name(), temperature=get_temperature())
    llm_with_tools = llm.bind_tools(_ORCHESTRATOR_TOOLS)
    tool_node = ToolNode(_ORCHESTRATOR_TOOLS)

    # Add routing hint to system prompt when card context is known
    system_prompt = _SYSTEM_PROMPT
    if card_context and card_context in _CARD_CONTEXT_HINTS:
        system_prompt += f" {_CARD_CONTEXT_HINTS[card_context]}"

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
    return builder.compile(), system_prompt


async def run(message: str, card_context: Optional[str] = None, cdm_email: Optional[str] = None) -> str:
    graph, system_prompt = _build_orchestrator_graph(card_context)
    context_note = f" CDM: {cdm_email}." if cdm_email else ""
    messages = [SystemMessage(content=system_prompt + context_note), HumanMessage(content=message)]
    result = await graph.ainvoke({"messages": messages})
    return result["messages"][-1].content
