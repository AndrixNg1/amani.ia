import { UnprocessableEntityException } from '@nestjs/common';
import { validateAnalysisParameters } from './analysis.service';
describe('validateAnalysisParameters', () => {
  it('accepts only a bounded aggregate operation', () => {
    expect(
      validateAnalysisParameters('aggregate', {
        tableId: '00000000-0000-4000-8000-000000000001',
        columnId: '00000000-0000-4000-8000-000000000002',
        aggregation: 'sum',
      }),
    ).toEqual({
      tableId: '00000000-0000-4000-8000-000000000001',
      columnId: '00000000-0000-4000-8000-000000000002',
      aggregation: 'sum',
    });
  });
  it('rejects arbitrary SQL and executable-code fields', () => {
    expect(() =>
      validateAnalysisParameters('profile', { sql: 'SELECT * FROM payroll' }),
    ).toThrow(UnprocessableEntityException);
    expect(() =>
      validateAnalysisParameters('filter', {
        tableId: '00000000-0000-4000-8000-000000000001',
        columnId: '00000000-0000-4000-8000-000000000002',
        operator: 'eq',
        value: 'x',
        code: 'import os',
      }),
    ).toThrow(UnprocessableEntityException);
  });
});
