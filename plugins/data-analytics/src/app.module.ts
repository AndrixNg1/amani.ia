import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database';
import { StorageModule } from './storage/object-storage';
import { IdentityVerifier, TrustedIdentityGuard } from './common/context';
import { identityVerifier } from './common/development-identity';
import { CorePolicyClient } from './authorization/core-client';
import { ResourcePolicy } from './authorization/resource-policy';
import { AccessService } from './authorization/access.service';
import { AccessController } from './authorization/access.controller';
import { SourcesService } from './sources/sources.service';
import { SourcesController } from './sources/sources.controller';
import { DatasetsService } from './datasets/datasets.service';
import { DatasetsController } from './datasets/datasets.controller';
import { UploadsService } from './uploads/uploads.service';
import { UploadsController } from './uploads/uploads.controller';
import { VersionsService } from './versions/versions.service';
import { VersionsController } from './versions/versions.controller';
import { SchemaMetadataService } from './schema-metadata/schema-metadata.service';
import { SchemaMetadataController } from './schema-metadata/schema-metadata.controller';
import { AnalysisService } from './analysis/analysis.service';
import { AnalysisController } from './analysis/analysis.controller';

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [
    AppController,
    SourcesController,
    DatasetsController,
    UploadsController,
    VersionsController,
    SchemaMetadataController,
    AccessController,
    AnalysisController,
  ],
  providers: [
    AppService,
    CorePolicyClient,
    ResourcePolicy,
    AccessService,
    SourcesService,
    DatasetsService,
    UploadsService,
    VersionsService,
    SchemaMetadataService,
    AnalysisService,
    { provide: IdentityVerifier, useFactory: () => identityVerifier() },
    { provide: APP_GUARD, useClass: TrustedIdentityGuard },
  ],
})
export class AppModule {}
