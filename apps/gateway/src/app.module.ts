import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_GUARD } from '@nestjs/core';
import { gatewayConfig, GATEWAY_CONFIG } from './config/gateway.config';
import {
  AuthenticationProvider,
  authenticationProvider,
} from './auth/authentication';
import { AuthenticationGuard, AuthorizationGuard } from './auth/guards';
import {
  ServiceAuthentication,
  serviceAuthentication,
} from './core-client/service-authentication';
import { CoreClient } from './core-client/core-client';
import { RateLimiter } from './common/rate-limit';
import { SafeLogger } from './common/logging';
import { PlatformController } from './routing/platform.controller';

@Module({
  imports: [],
  controllers: [AppController, PlatformController],
  providers: [
    AppService,
    { provide: GATEWAY_CONFIG, useFactory: () => gatewayConfig() },
    {
      provide: AuthenticationProvider,
      useFactory: authenticationProvider,
      inject: [GATEWAY_CONFIG],
    },
    {
      provide: ServiceAuthentication,
      useFactory: serviceAuthentication,
      inject: [GATEWAY_CONFIG],
    },
    CoreClient,
    RateLimiter,
    SafeLogger,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
})
export class AppModule {}
