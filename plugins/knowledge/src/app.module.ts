import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database';
import { StorageModule } from './storage/object-storage';
import { IdentityVerifier, TrustedIdentityGuard } from './common/context';
import { identityVerifier } from './common/development-identity';
import { CorePolicyClient } from './authorization/core-client';
import { ResourcePolicy } from './authorization/resource-policy';
import { AccessService } from './authorization/access.service';
import { KnowledgeBasesService } from './knowledge-bases/knowledge-bases.service';
import { SourcesService } from './sources/sources.service';
import { DocumentsService } from './documents/documents.service';
import { UploadsService } from './uploads/uploads.service';
import { KnowledgeBasesController } from './knowledge-bases/knowledge-bases.controller';
import { SourcesController } from './sources/sources.controller';
import { DocumentsController } from './documents/documents.controller';
import { UploadsController } from './uploads/uploads.controller';
import { AccessController } from './authorization/access.controller';
import { HealthController } from './health/health.controller';
import { DocumentProcessingQueue } from './processing/document-processing.queue';
import { DocumentProcessingService } from './processing/document-processing.service';
import { DocumentProcessingController } from './processing/document-processing.controller';
import { RetrievalService } from './retrieval/retrieval.service';
import { RetrievalController } from './retrieval/retrieval.controller';
import { RetrievalEmbeddingProvider } from './retrieval/retrieval.embedding';

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [
    HealthController,
    KnowledgeBasesController,
    SourcesController,
    DocumentsController,
    UploadsController,
    AccessController,
    DocumentProcessingController,
    RetrievalController,
  ],
  providers: [
    CorePolicyClient,
    ResourcePolicy,
    AccessService,
    KnowledgeBasesService,
    SourcesService,
    DocumentsService,
    UploadsService,
    DocumentProcessingQueue,
    DocumentProcessingService,
    RetrievalEmbeddingProvider,
    RetrievalService,
    { provide: IdentityVerifier, useFactory: () => identityVerifier() },
    { provide: APP_GUARD, useClass: TrustedIdentityGuard },
  ],
})
export class AppModule {}
