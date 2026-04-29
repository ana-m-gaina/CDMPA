using { cuid, managed } from '@sap/cds/common';

namespace cdm.tracker;

entity RRTable : cuid, managed {
  serviceCode  : String(20)  not null;
  serviceName  : String(200) not null;
  category     : String(100);
  chargeable   : Boolean default true;
  notes        : String(500);
  active       : Boolean default true;
}

entity PricingTable : cuid, managed {
  serviceCode    : String(20)    not null;
  serviceName    : String(200);
  price          : Decimal(10,2) not null;
  currency       : String(3)     default 'EUR';
  effectiveFrom  : Date;
  active         : Boolean default true;
  lastUpdatedBy  : String(100);
}

entity ASRequest : cuid, managed {
  requestTitle           : String(200)   not null;
  customerName           : String(200)   not null;
  customerAccountId      : String(50);
  serviceCode            : String(20);
  serviceType            : String(100);
  description            : String(2000);
  status                 : String(50)    default 'New';
  assignedCDM            : String(100)   not null;
  price                  : Decimal(10,2);
  currency               : String(3)     default 'EUR';
  approvalText           : String(2000);
  poNumber               : String(100);
  approvalDate           : DateTime;
  deliveryDate           : DateTime;
  invoiceDate            : DateTime;
  jiraTicketRef          : String(100);
  jiraTicketBody         : String(5000);
  sap4MeTicketId         : String(100);
  spcTicketId            : String(100);
  btpTicketId            : String(100);
  amsTicketId            : String(100);
  serviceNowTicketId     : String(100);
  salesOrderNumber       : String(100);
  providerContractNumber : String(100);
  activityLog            : Composition of many ActivityLog on activityLog.request = $self;
}

entity ActivityLog : cuid {
  request     : Association to ASRequest;
  action      : String(200) not null;
  description : String(1000);
  performedBy : String(100);
  performedAt : DateTime    not null;
  oldStatus   : String(50);
  newStatus   : String(50);
}

entity CardLayout : cuid {
  userEmail : String(200) not null;
  cardId    : String(50)  not null;
  visible   : Boolean     default true;
  sortOrder : Integer     default 0;
}

entity JiraTicketTemplate : cuid {
  serviceType  : String(100)  not null;
  templateBody : String(5000) not null;
  active       : Boolean      default true;
}
