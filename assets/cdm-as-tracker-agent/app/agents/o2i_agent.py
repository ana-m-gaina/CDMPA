"""
O2I Specialist Subagent — expert on CDM JIRA Order-to-Invoice process.
"""
import logging
from typing import Optional

from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_litellm import ChatLiteLLM
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode
from opentelemetry import trace

import cap_client

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)

_SYSTEM_PROMPT = (
    "You are an expert on the CDM JIRA Order-to-Invoice process. "
    "Generate JIRA ticket bodies and present them for CDM review. "
    "Never mark a request as Invoiced without explicit CDM confirmation."
)


@tool
async def get_invoiceable_requests(cdm_email: Optional[str] = None) -> str:
    """Get all AS requests ready for invoicing (status = Delivered)."""
    try:
        all_requests = await cap_client.get_open_requests(cdm_email=cdm_email)
        delivered = [r for r in all_requests if r.get("status") == "Delivered"]
        if not delivered:
            return "No requests ready for invoicing."
        lines = [f"Found {len(delivered)} requests ready for invoicing:"]
        for r in delivered:
            lines.append(
                f"  [{r['ID']}] {r.get('requestTitle', 'N/A')} | {r.get('customerName', '')} | "
                f"{r.get('serviceCode', '')} | Delivered: {r.get('deliveryDate', 'N/A')}"
            )
        return "\n".join(lines)
    except Exception as e:
        return f"Failed to fetch invoiceable requests: {e}"


@tool
async def generate_jira_ticket(request_id: str) -> str:
    """Generate a JIRA O2I ticket body for a delivered AS request. Returns the body for CDM review."""
    try:
        body = await cap_client.generate_jira_ticket(request_id)
        return (
            f"JIRA Ticket Body:\n{body}\n\n"
            "Please review and confirm submission to mark as Invoiced."
        )
    except Exception as e:
        return f"Failed to generate JIRA ticket: {e}"


@tool
async def confirm_jira_submission(request_id: str) -> str:
    """Mark an AS request as Invoiced after CDM confirms the JIRA ticket has been submitted."""
    with tracer.start_as_current_span("milestone_M5"):
        try:
            await cap_client.confirm_invoiced(request_id)
            logger.info(f"[M5.achieved]: JIRA O2I ticket generated — requestId={request_id}")
            return f"Request {request_id} marked as Invoiced."
        except Exception as e:
            return f"Failed to mark as Invoiced: {e}"


_O2I_TOOLS = [get_invoiceable_requests, generate_jira_ticket, confirm_jira_submission]


def _build_o2i_graph():
    from langchain_litellm import ChatLiteLLM
    from app.agent import get_model_name, get_temperature
    llm = ChatLiteLLM(model=get_model_name(), temperature=get_temperature())
    llm_with_tools = llm.bind_tools(_O2I_TOOLS)
    tool_node = ToolNode(_O2I_TOOLS)

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


async def run(query: str, cdm_email: Optional[str] = None) -> str:
    graph = _build_o2i_graph()
    context = f" CDM email: {cdm_email}." if cdm_email else ""
    messages = [SystemMessage(content=_SYSTEM_PROMPT + context), HumanMessage(content=query)]
    result = await graph.ainvoke({"messages": messages})
    return result["messages"][-1].content
