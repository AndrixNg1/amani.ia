import {
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { validateUploadMetadata } from './uploads.service';
describe('upload metadata validation', () => {
  const storage = { allowedMimeTypes: ['application/pdf'], maxUploadBytes: 10 };
  it('rejects an unsupported MIME type before presigning', () =>
    expect(() =>
      validateUploadMetadata({ mimeType: 'text/csv', sizeBytes: 1 }, storage),
    ).toThrow(UnsupportedMediaTypeException));
  it('rejects an oversized object before document intent creation', () =>
    expect(() =>
      validateUploadMetadata(
        { mimeType: 'application/pdf', sizeBytes: 11 },
        storage,
      ),
    ).toThrow(PayloadTooLargeException));
});
