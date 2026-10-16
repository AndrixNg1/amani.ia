import { createHash } from 'node:crypto';
import {
  Injectable,
  Module,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  GetObjectCommand,
  GetBucketVersioningCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { knowledgeConfig } from '../common/config';

export interface UploadTarget {
  url: string;
  fields: Record<string, string>;
  expiresAt: string;
}
export interface ObjectMetadata {
  contentType: string;
  contentLength: number;
  versionId: string;
}
@Injectable()
export class ObjectStorage {
  private readonly config = knowledgeConfig().storage;
  private readonly client = new S3Client({
    endpoint: this.config.endpoint,
    region: this.config.region,
    forcePathStyle: this.config.forcePathStyle,
    credentials: {
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
    },
  });
  async assertReady(): Promise<void> {
    try {
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.config.bucket }),
      );
      const versioning = await this.client.send(
        new GetBucketVersioningCommand({ Bucket: this.config.bucket }),
      );
      if (versioning.Status !== 'Enabled')
        throw new Error('Bucket versioning is required');
    } catch {
      throw new ServiceUnavailableException();
    }
  }
  async createUploadUrl(
    key: string,
    contentType: string,
    size: number,
  ): Promise<UploadTarget> {
    try {
      const result = await createPresignedPost(this.client, {
        Bucket: this.config.bucket,
        Key: key,
        Fields: { 'Content-Type': contentType },
        Conditions: [
          ['eq', '$key', key],
          ['eq', '$Content-Type', contentType],
          ['content-length-range', size, size],
        ],
        Expires: this.config.uploadUrlSeconds,
      });
      return {
        url: result.url,
        fields: result.fields,
        expiresAt: new Date(
          Date.now() + this.config.uploadUrlSeconds * 1000,
        ).toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
  async head(key: string): Promise<ObjectMetadata> {
    try {
      const object = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      const contentLength = object.ContentLength;
      if (
        !object.ContentType ||
        !Number.isSafeInteger(contentLength) ||
        contentLength === undefined ||
        contentLength < 1 ||
        !object.VersionId
      )
        throw new Error('Incomplete object metadata');
      return {
        contentType: object.ContentType,
        contentLength,
        versionId: object.VersionId,
      };
    } catch {
      throw new ServiceUnavailableException();
    }
  }
  async checksum(key: string, versionId: string): Promise<string> {
    try {
      const object = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          VersionId: versionId,
        }),
      );
      if (!object.Body) throw new Error('Object body missing');
      const hash = createHash('sha256');
      for await (const chunk of object.Body as AsyncIterable<Uint8Array>)
        hash.update(chunk);
      return hash.digest('hex');
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
@Module({ providers: [ObjectStorage], exports: [ObjectStorage] })
export class StorageModule {}
