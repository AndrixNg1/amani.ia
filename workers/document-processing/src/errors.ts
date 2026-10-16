import type { KnowledgeProcessingFailureCode } from '@amani/contracts';

export class ProcessingError extends Error {
  constructor(readonly code: KnowledgeProcessingFailureCode) {
    super(code);
    this.name = 'ProcessingError';
  }
}

export function processingFailure(error: unknown): KnowledgeProcessingFailureCode {
  if (error instanceof ProcessingError) return error.code;
  if (error instanceof DOMException && error.name === 'AbortError')
    return 'PROCESSING_TIMEOUT';
  return 'EXTRACTION_FAILED';
}
