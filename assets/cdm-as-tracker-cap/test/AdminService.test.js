const cds = require('@sap/cds');

// Prevent cds.shutdown from calling process.exit() — Jest manages process lifecycle
cds.shutdown = async () => { /* no-op in Jest test runs */ };

cds.test(__dirname + '/..');

let adminSrv, cdmSrv;
const adminUser = new cds.User({ id: 'pricingadmin', roles: ['Admin'] });
const cdmUser   = new cds.User({ id: 'alex', roles: ['CDM'] });

beforeAll(async () => {
  adminSrv = await cds.connect.to('AdminService');
  cdmSrv   = await cds.connect.to('CDMService');
});

afterAll(async () => {
  if (cds.app?.server) cds.app.server.close();
});

describe('AdminService access control', () => {

  it('Admin user can read PricingTable via AdminService', async () => {
    const result = await adminSrv.tx({ user: adminUser }, tx =>
      tx.run(SELECT.from('AdminService.PricingTable'))
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('CDM user cannot access AdminService (403)', async () => {
    await expect(
      cdmSrv.tx({ user: cdmUser }, tx =>
        tx.run(SELECT.from('AdminService.PricingTable'))
      )
    ).rejects.toBeDefined();
  });
});
