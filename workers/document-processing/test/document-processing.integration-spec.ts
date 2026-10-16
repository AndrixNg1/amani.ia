/**
 * Integration coverage intentionally remains disabled until the owner starts Redis,
 * PostgreSQL, MinIO, Core and Knowledge. It will exercise duplicate BullMQ delivery,
 * stale/revoked jobs, cross-tenant publication, terminal provider failure and no public
 * READY state before all chunk batches are committed.
 */
describe('document processing integration boundary', () => {
  it.todo('processes a synthetic TXT version once across duplicate queue delivery');
  it.todo('rejects a cross-tenant version claim and publication');
  it.todo('records a terminal safe failure after bounded retry exhaustion');
  it.todo('keeps a partial persistence result out of READY state');
});
