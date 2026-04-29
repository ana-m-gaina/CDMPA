using { cdm.tracker as db } from '../db/schema';

@requires: ['CDM', 'Manager']
service CDMService @(path: '/CDMService') {

  entity ASRequest as projection on db.ASRequest {
    *,
    activityLog
  }
  actions {
    action generateJiraTicket() returns String;
    action advanceStatus(newStatus: String, comment: String) returns ASRequest;
    action recordApproval(approvalText: String, poNumber: String) returns ASRequest;
  };

  @readonly
  entity RRTable      as projection on db.RRTable;

  @readonly
  entity PricingTable as projection on db.PricingTable;

  entity CardLayout   as projection on db.CardLayout;

  @readonly
  entity ActivityLog  as projection on db.ActivityLog;

  action saveCardLayout(
    layouts: many {
      cardId    : String;
      visible   : Boolean;
      sortOrder : Integer;
    }
  ) returns Boolean;
}
