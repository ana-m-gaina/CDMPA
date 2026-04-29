const cds = require('@sap/cds');

const VALID_TRANSITIONS = {
  'New':               'PriceCommunicated',
  'PriceCommunicated': 'Approved',
  'Approved':          'InDelivery',
  'InDelivery':        'Delivered',
  'Delivered':         'Invoiced'
};

const STATUS_DATE_FIELD = {
  'Approved':  'approvalDate',
  'Delivered': 'deliveryDate',
  'Invoiced':  'invoiceDate'
};

module.exports = class CDMService extends cds.ApplicationService {

  async init() {

    const { ASRequest, ActivityLog, CardLayout } = this.entities;
    const JiraTicketTemplate = cds.db?.model?.definitions?.['cdm.tracker.JiraTicketTemplate']
      ?? cds.model?.definitions?.['cdm.tracker.JiraTicketTemplate'];

    // CDM scoping: CDMs only see their own requests
    this.before('READ', ASRequest, req => {
      if (!req.user.is('Manager')) {
        req.query.where({ assignedCDM: req.user.id });
      }
    });

    // Auto-create ActivityLog on new request
    this.after('CREATE', ASRequest, async (data, req) => {
      await INSERT.into(ActivityLog).entries({
        ID:          cds.utils.uuid(),
        request_ID:  data.ID,
        action:      'Request Created',
        newStatus:   'New',
        performedBy: req.user.id,
        performedAt: new Date()
      });
    });

    // advanceStatus action
    this.on('advanceStatus', ASRequest, async (req) => {
      const { newStatus, comment } = req.data;
      const { ID } = req.params[0];

      const request = await SELECT.one.from(ASRequest).where({ ID });
      if (!request) return req.reject(404, `Request ${ID} not found`);

      const expectedNext = VALID_TRANSITIONS[request.status];
      if (expectedNext !== newStatus) {
        return req.reject(400,
          `Invalid status transition from '${request.status}' to '${newStatus}'. ` +
          `Expected next status: '${expectedNext || 'none (terminal)'}'`
        );
      }

      const patch = { status: newStatus };
      const dateField = STATUS_DATE_FIELD[newStatus];
      if (dateField) patch[dateField] = new Date();

      await UPDATE(ASRequest).set(patch).where({ ID });

      await INSERT.into(ActivityLog).entries({
        ID:          cds.utils.uuid(),
        request_ID:  ID,
        action:      'Status Advanced',
        description: comment || '',
        performedBy: req.user.id,
        performedAt: new Date(),
        oldStatus:   request.status,
        newStatus
      });

      return SELECT.one.from(ASRequest).where({ ID });
    });

    // recordApproval action
    this.on('recordApproval', ASRequest, async (req) => {
      const { approvalText, poNumber } = req.data;
      const { ID } = req.params[0];

      const request = await SELECT.one.from(ASRequest).where({ ID });
      if (!request) return req.reject(404, `Request ${ID} not found`);

      if (request.status !== 'PriceCommunicated') {
        return req.reject(400,
          `Cannot record approval: request status is '${request.status}', expected 'PriceCommunicated'`
        );
      }

      const now = new Date();
      await UPDATE(ASRequest).set({
        approvalText,
        poNumber:    poNumber || null,
        status:      'Approved',
        approvalDate: now
      }).where({ ID });

      await INSERT.into(ActivityLog).entries({
        ID:          cds.utils.uuid(),
        request_ID:  ID,
        action:      'Approval Recorded',
        performedBy: req.user.id,
        performedAt: now,
        oldStatus:   'PriceCommunicated',
        newStatus:   'Approved'
      });

      return SELECT.one.from(ASRequest).where({ ID });
    });

    // generateJiraTicket action
    this.on('generateJiraTicket', ASRequest, async (req) => {
      const { ID } = req.params[0];

      const request = await SELECT.one.from(ASRequest).where({ ID });
      if (!request) return req.reject(404, `Request ${ID} not found`);

      if (request.status !== 'Delivered') {
        return req.reject(400,
          `Cannot generate JIRA ticket: request status is '${request.status}', expected 'Delivered'`
        );
      }

      let template = await SELECT.one.from(JiraTicketTemplate)
        .where({ serviceType: request.serviceType, active: true });
      if (!template) {
        template = await SELECT.one.from(JiraTicketTemplate)
          .where({ serviceType: 'default', active: true });
      }
      if (!template) return req.reject(500, 'No JIRA ticket template found');

      const fmt = (v) => v != null ? String(v) : '';
      const fmtDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';

      const body = template.templateBody
        .replace(/\{\{customerName\}\}/g,            fmt(request.customerName))
        .replace(/\{\{customerAccountId\}\}/g,       fmt(request.customerAccountId))
        .replace(/\{\{serviceCode\}\}/g,             fmt(request.serviceCode))
        .replace(/\{\{serviceType\}\}/g,             fmt(request.serviceType))
        .replace(/\{\{price\}\}/g,                   fmt(request.price))
        .replace(/\{\{currency\}\}/g,                fmt(request.currency))
        .replace(/\{\{poNumber\}\}/g,                fmt(request.poNumber))
        .replace(/\{\{approvalText\}\}/g,            fmt(request.approvalText))
        .replace(/\{\{approvalDate\}\}/g,            fmtDate(request.approvalDate))
        .replace(/\{\{deliveryDate\}\}/g,            fmtDate(request.deliveryDate))
        .replace(/\{\{sap4MeTicketId\}\}/g,          fmt(request.sap4MeTicketId))
        .replace(/\{\{spcTicketId\}\}/g,             fmt(request.spcTicketId))
        .replace(/\{\{amsTicketId\}\}/g,             fmt(request.amsTicketId))
        .replace(/\{\{salesOrderNumber\}\}/g,        fmt(request.salesOrderNumber))
        .replace(/\{\{providerContractNumber\}\}/g,  fmt(request.providerContractNumber));

      await UPDATE(ASRequest).set({ jiraTicketBody: body }).where({ ID });

      await INSERT.into(ActivityLog).entries({
        ID:          cds.utils.uuid(),
        request_ID:  ID,
        action:      'JIRA Ticket Generated',
        performedBy: req.user.id,
        performedAt: new Date()
      });

      return body;
    });

    // saveCardLayout action
    this.on('saveCardLayout', async (req) => {
      const { layouts } = req.data;
      const userEmail = req.user.id;

      for (const layout of layouts) {
        const existing = await SELECT.one.from(CardLayout)
          .where({ userEmail, cardId: layout.cardId });
        if (existing) {
          await UPDATE(CardLayout).set({
            visible:   layout.visible,
            sortOrder: layout.sortOrder
          }).where({ userEmail, cardId: layout.cardId });
        } else {
          await INSERT.into(CardLayout).entries({
            ID:        cds.utils.uuid(),
            userEmail,
            cardId:    layout.cardId,
            visible:   layout.visible,
            sortOrder: layout.sortOrder
          });
        }
      }
      return true;
    });

    await super.init();
  }
};
