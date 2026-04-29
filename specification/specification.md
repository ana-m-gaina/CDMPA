# Specification

> **Guidelines**: Read [guidelines.md](./guidelines.md) before executing ANY tasks below.

Check off items as completed.

## Solution Setup

- [ ] Create asset directories: `mkdir -p assets/cdm-as-tracker-cap/ assets/cdm-as-tracker-agent/`
- [ ] Invoke `setup-solution` skill to create `solution.yaml` and `asset.yaml` files for every asset
- [ ] Validate all `asset.yaml` and `solution.yaml` files exist and are well-formed

## Asset Implementation

- [ ] Execute `specification/cdm-as-tracker-cap/specification.md` (all items)
- [ ] Execute `specification/cdm-as-tracker-agent/specification.md` (all items)

## Cross-Implementation Compatibility Check

- [ ] **CAP ↔ Agent URL alignment**: Confirm `CAP_SERVICE_URL` default in `cap_client.py` matches the CAP OData path (`/odata/v4/CDMService`) and `CAP_ADMIN_SERVICE_URL` matches `/odata/v4/AdminService`
- [ ] **OData action names match**: Confirm action names in `cap_client.py` HTTP calls match bound action names in `srv/cdm-service.cds` — `CDMService.generateJiraTicket`, `CDMService.advanceStatus`, `CDMService.recordApproval`, `CDMService.saveCardLayout`
- [ ] **Entity field names match**: Confirm all field names referenced in `cap_client.py` (e.g. `assignedCDM`, `serviceCode`, `approvalText`, `poNumber`, `jiraTicketBody`) exactly match the CDS entity definitions in `db/schema.cds`
- [ ] **Status string values match**: Confirm status strings used by the agent (`New`, `PriceCommunicated`, `Approved`, `InDelivery`, `Delivered`, `Invoiced`) exactly match those enforced in the CAP status state machine handler in `srv/cdm-service.js`
- [ ] **Card context IDs match**: Confirm `cardId` values used in the frontend (`rr-reference`, `pricing`, `active-requests`, `jira-o2i`) exactly match those in the agent's orchestrator routing logic and in `CardLayout` seed data
- [ ] **Auth role names consistent**: Confirm role names `CDM`, `Manager`, `Admin` are identical between CAP `@requires` annotations and any role-check logic in the agent
- [ ] **Chat proxy wired**: Confirm CAP proxies `POST /api/chat` to the agent's `AGENT_URL`; confirm agent's `/api/chat` route accepts `{message, card_context, cdm_email}` and returns a string response
- [ ] Fix any mismatches before marking this section complete
