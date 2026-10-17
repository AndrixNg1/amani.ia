import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IdentityVerifier, TrustedIdentityGuard } from './common/context';
import { identityVerifier } from './common/development-identity';
import { CorePolicyClient } from './clients/core-policy.client';
import { KnowledgeRetrievalClient } from './clients/knowledge-retrieval.client';
import {
  ConfiguredGenerationProvider,
  GenerationProvider,
} from './generation/generation.provider';
import { KnowledgeRagController } from './rag/rag.controller';
import { KnowledgeRagPromptBuilder } from './rag/prompt-builder';
import { KnowledgeRagService } from './rag/rag.service';

@Module({
  imports: [],
  controllers: [AppController, KnowledgeRagController],
  providers: [
    AppService,
    CorePolicyClient,
    KnowledgeRetrievalClient,
    KnowledgeRagPromptBuilder,
    KnowledgeRagService,
    { provide: GenerationProvider, useClass: ConfiguredGenerationProvider },
    { provide: IdentityVerifier, useFactory: () => identityVerifier() },
    { provide: APP_GUARD, useClass: TrustedIdentityGuard },
  ],
})
export class AppModule {}
