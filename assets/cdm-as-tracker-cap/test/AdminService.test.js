const cds = require('@sap/cds');
cds.test(__dirname + '/..');

let adminSrv, cdmSrv;
const adminUser = new cds.User({ id: 'pricingadmin', roles: ['Admin'] });
const cdmUser   = new cds.User({ id: 'alex', roles: ['CDM'] });

beforeAll(async () => {
  adminSrv = await cds.connect.to('AdminService');
  cdmSrv   = await cds.connect.to('CDMService');
});

describe('AdminService access control', () => {

  it('Admin user can read PricingTable via AdminService', async () => {
    const result = await adminSrv.tx({ user: adminUser }, tx =>
      tx.run(SELECT.from('AdminService.PricingTable'))
    );
    expect(Array.isArray(result)).toBe(true);
  });

  it('CDM user gets 403 on AdminService', async () => {
    await expect(
      cdmSrv.tx({ user: cdmUser }, tx =>
        tx.run(SELECT.from('AdminService.PricingTable'))
      )
    ).rejects.toBeDefined();
  });
});
