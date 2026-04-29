using { cdm.tracker as db } from '../db/schema';

@requires: ['Admin']
service AdminService @(path: '/AdminService') {

  entity PricingTable       as projection on db.PricingTable;
  entity RRTable            as projection on db.RRTable;
  entity JiraTicketTemplate as projection on db.JiraTicketTemplate;
}
