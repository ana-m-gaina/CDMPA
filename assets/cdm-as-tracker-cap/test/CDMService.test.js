const cds = require('@sap/cds');

// Prevent cds.shutdown from calling process.exit() — Jest manages the process
const _realShutdown = cds.shutdown.bind(cds);
cds.shutdown = async () => { /* no-op in Jest test runs */ };

cds.test(__dirname + '/..');

let srv;
const cdmUser = new cds.User({ id: 'alex', roles: ['CDM'] });

beforeAll(async () => {
  srv = await cds.connect.to('CDMService');
});

afterAll(async () => {
  // close the HTTP server so Jest can exit cleanly
  if (cds.app?.server) cds.app.server.close();
});

async function seedRequest(overrides = {}) {
  const ID = cds.utils.uuid();
  await INSERT.into('cdm.tracker.ASRequest').entries({
    ID,
    requestTitle: 'Test Request',
    customerName: 'ACME Corp',
    assignedCDM:  'alex',
    status:       'New',
    ...overrides
  });
  return ID;
}

async function sendAs(user, event, params, data) {
  return srv.tx({ user }, tx =>
    tx.send({ event, entity: 'CDMService.ASRequest', params, data })
  );
}

describe('Status State Machine', () => {

  it('valid transition New→PriceCommunicated succeeds', async () => {
    const ID = await seedRequest({ status: 'New' });
    const result = await sendAs(cdmUser, 'advanceStatus', [{ ID }], { newStatus: 'PriceCommunicated', comment: 'Price sent' });
    expect(result.status).toBe('PriceCommunicated');
  });

  it('valid transition creates an ActivityLog entry', async () => {
    const ID = await seedRequest({ status: 'New' });
    await sendAs(cdmUser, 'advanceStatus', [{ ID }], { newStatus: 'PriceCommunicated', comment: 'Sent' });
    const logs = await SELECT.from('cdm.tracker.ActivityLog').where({ request_ID: ID, action: 'Status Advanced' });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].newStatus).toBe('PriceCommunicated');
    expect(logs[0].oldStatus).toBe('New');
  });

  it('invalid transition New→Invoiced returns 400', async () => {
    const ID = await seedRequest({ status: 'New' });
    await expect(
      sendAs(cdmUser, 'advanceStatus', [{ ID }], { newStatus: 'Invoiced' })
    ).rejects.toMatchObject({ code: 400 });
  });
});

describe('recordApproval', () => {

  it('returns 400 when status is not PriceCommunicated', async () => {
    const ID = await seedRequest({ status: 'New' });
    await expect(
      sendAs(cdmUser, 'recordApproval', [{ ID }], { approvalText: 'Approved' })
    ).rejects.toMatchObject({ code: 400 });
  });

  it('succeeds when status is PriceCommunicated and advances to Approved', async () => {
    const ID = await seedRequest({ status: 'PriceCommunicated' });
    const result = await sendAs(cdmUser, 'recordApproval', [{ ID }], { approvalText: 'Customer approved via email', poNumber: 'PO-456' });
    expect(result.status).toBe('Approved');
    expect(result.approvalText).toBe('Customer approved via email');
  });
});

describe('generateJiraTicket', () => {

  it('returns 400 when status is not Delivered', async () => {
    const ID = await seedRequest({ status: 'New' });
    await expect(
      sendAs(cdmUser, 'generateJiraTicket', [{ ID }], {})
    ).rejects.toMatchObject({ code: 400 });
  });

  it('returns a non-empty string containing customerName when Delivered', async () => {
    const ID = await seedRequest({
      status:       'Delivered',
      customerName: 'ACME Corp',
      serviceCode:  'SC-42',
      serviceType:  'SystemConversion',
      deliveryDate: new Date()
    });
    const result = await sendAs(cdmUser, 'generateJiraTicket', [{ ID }], {});
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('ACME Corp');
  });
});

describe('CDM scoping', () => {

  it('CDM user cannot see requests assigned to a different CDM', async () => {
    const ID = cds.utils.uuid();
    await INSERT.into('cdm.tracker.ASRequest').entries({
      ID,
      requestTitle: 'Other CDM Request',
      customerName: 'Other Customer',
      assignedCDM:  'morgan',
      status:       'New'
    });
    const results = await srv.tx({ user: cdmUser }, tx =>
      tx.run(SELECT.from('CDMService.ASRequest').where({ ID }))
    );
    expect(results.length).toBe(0);
  });
});
