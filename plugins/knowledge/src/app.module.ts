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

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [
    HealthController,
    KnowledgeBasesController,
    SourcesController,
    DocumentsController,
    UploadsController,
    AccessController,
  ],
  providers: [
    CorePolicyClient,
    ResourcePolicy,
    AccessService,
    KnowledgeBasesService,
    SourcesService,
    DocumentsService,
    UploadsService,
    { provide: IdentityVerifier, useFactory: () => identityVerifier() },
    { provide: APP_GUARD, useClass: TrustedIdentityGuard },
  ],
})
export class AppModule {}
