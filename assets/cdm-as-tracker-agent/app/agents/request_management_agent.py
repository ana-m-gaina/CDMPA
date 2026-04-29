"""
Request Management Specialist Subagent — expert on CDM AS request lifecycle.
"""
import logging
from datetime import datetime
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
    "You are an expert on the CDM Additional Services request lifecycle "
    "(New→PriceCommunicated→Approved→InDelivery→Delivered→Invoiced). "
    "Always present extracted data for CDM confirmation before creating or updating records. "
    "Never write without confirmation. Never hallucinate request data."
)


@tool
async def get_as_request(request_id: str) -> str:
    """Get details of a specific AS request by ID."""
    try:
        req = await cap_client.get_as_request(request_id)
        if not req:
            return "Request not found."
        return (
            f"ID: {req['ID']}\n"
            f"Title: {req.get('requestTitle', 'N/A')}\n"
            f"Customer: {req.get('customerName', 'N/A')} ({req.get('customerAccountId', '')})\n"
            f"Service Code: {req.get('serviceCode', 'N/A')}\n"
            f"Status: {req.get('status', 'N/A')}\n"
            f"Assigned CDM: {req.get('assignedCDM', 'N/A')}\n"
            f"Price: {req.get('currency', 'EUR')} {req.get('price', 'N/A')}\n"
            f"PO Number: {req.get('poNumber', 'N/A')}"
        )
    except Exception as e:
        return f"Request not found: {e}"


@tool
async def get_open_requests(cdm_email: Optional[str] = None) -> str:
    """Get all open AS requests. Optionally filter by CDM email."""
    requests = await cap_client.get_open_requests(cdm_email=cdm_email)
    if not requests:
        return "No open requests found."
    lines = [f"Found {len(requests)} open requests:"]
    for r in requests:
        created = r.get("createdAt", "")
        age_days = ""
        if created:
            try:
                delta = datetime.utcnow() - datetime.fromisoformat(created.replace("Z", "+00:00").replace("+00:00", ""))
                age_days = f" ({delta.days}d old)"
            except Exception:
                pass
        lines.append(
            f"  [{r['ID']}] {r.get('requestTitle', 'N/A')} | {r.get('customerName', '')} | "
            f"{r.get('serviceCode', '')} | {r.get('status', '')}{age_days} | CDM: {r.get('assignedCDM', '')}"
        )
    return "\n".join(lines)


@tool
async def create_as_request(
    customer_name: str,
    service_code: str,
    description: str,
    cdm_email: str,
    customer_account_id: str = "",
    service_type: str = "",
    sap4me_ticket_id: str = "",
    spc_ticket_id: str = "",
    btp_ticket_id: str = "",
    ams_ticket_id: str = "",
    servicenow_ticket_id: str = "",
    sales_order_number: str = "",
    provider_contract_number: str = "",
    request_title: str = "",
    confirmed: bool = False,
) -> str:
    """
    Create a new AS request. Set confirmed=False first to show a summary for CDM review.
    Set confirmed=True only after CDM explicitly confirms.
    """
    title = request_title or f"{service_code} – {customer_name}"
    summary = (
        f"New AS Request Summary:\n"
        f"  Title: {title}\n"
        f"  Customer: {customer_name} ({customer_account_id})\n"
        f"  Service Code: {service_code}\n"
        f"  Service Type: {service_type}\n"
        f"  Description: {description}\n"
        f"  Assigned CDM: {cdm_email}\n"
        f"  SAP4Me: {sap4me_ticket_id}\n"
        f"  SPC: {spc_ticket_id}\n"
        f"  AMS: {ams_ticket_id}\n"
        f"  Sales Order: {sales_order_number}\n"
        f"  Provider Contract: {provider_contract_number}"
    )

    if not confirmed:
        return f"{summary}\n\n[PENDING_CONFIRMATION] Please confirm to create this request."

    with tracer.start_as_current_span("milestone_M1"):
        try:
            data = {
                "requestTitle": title,
                "customerName": customer_name,
                "customerAccountId": customer_account_id,
                "serviceCode": service_code,
                "serviceType": service_type,
                "description": description,
                "assignedCDM": cdm_email,
                "sap4MeTicketId": sap4me_ticket_id,
                "spcTicketId": spc_ticket_id,
                "btpTicketId": btp_ticket_id,
                "amsTicketId": ams_ticket_id,
                "serviceNowTicketId": servicenow_ticket_id,
                "salesOrderNumber": sales_order_number,
                "providerContractNumber": provider_contract_number,
            }
            result = await cap_client.create_as_request(data)
            req_id = result.get("ID", "unknown")
            logger.info(f"[M1.achieved]: AS request logged — requestId={req_id}, customer={customer_name}, serviceCode={service_code}")
            return f"AS request created successfully. Request ID: {req_id}"
        except Exception as e:
            reason = str(e)
            logger.warning(f"[M1.missed]: AS request intake did not complete — reason={reason}")
            return f"Failed to create request: {reason}"


@tool
async def advance_request_status(request_id: str, new_status: str, comment: str = "") -> str:
    """Advance the status of an AS request to the next lifecycle stage."""
    with tracer.start_as_current_span("milestone_M2" if new_status == "PriceCommunicated" else
                                       "milestone_M4" if new_status == "Delivered" else
                                       "milestone_status"):
        try:
            result = await cap_client.advance_status(request_id, new_status, comment)
            updated_status = result.get("status", new_status)
            if new_status == "PriceCommunicated":
                logger.info(f"[M2.achieved]: Price communicated — requestId={request_id}")
            elif new_status == "Delivered":
                logger.info(f"[M4.achieved]: Delivery confirmed — requestId={request_id}")
            return f"Request {request_id} status updated to: {updated_status}"
        except Exception as e:
            return f"Failed to advance status: {e}"


@tool
async def record_approval(request_id: str, approval_text: str, po_number: str = "") -> str:
    """Record customer approval for an AS request (must be in PriceCommunicated status)."""
    with tracer.start_as_current_span("milestone_M3"):
        try:
            result = await cap_client.record_approval(request_id, approval_text, po_number)
            updated_status = result.get("status", "Approved")
            logger.info(f"[M3.achieved]: Customer approval recorded — requestId={request_id}, hasPO={bool(po_number)}")
            return f"Approval recorded. Request {request_id} is now: {updated_status}"
        except Exception as e:
            return f"Failed to record approval: {e}"


_REQUEST_TOOLS = [get_as_request, get_open_requests, create_as_request, advance_request_status, record_approval]


def _build_request_graph():
    from langchain_litellm import ChatLiteLLM
    from app.agent import get_model_name, get_temperature
    llm = ChatLiteLLM(model=get_model_name(), temperature=get_temperature())
    llm_with_tools = llm.bind_tools(_REQUEST_TOOLS)
    tool_node = ToolNode(_REQUEST_TOOLS)

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
    graph = _build_request_graph()
    context = f" CDM email: {cdm_email}." if cdm_email else ""
    messages = [SystemMessage(content=_SYSTEM_PROMPT + context), HumanMessage(content=query)]
    result = await graph.ainvoke({"messages": messages})
    return result["messages"][-1].content
