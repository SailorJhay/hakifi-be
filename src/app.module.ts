import { Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InsurancesModule } from './insurances/insurances.module';
import { PrismaModule, loggingMiddleware } from 'nestjs-prisma';
import config from './configs/config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TokensModule } from './tokens/tokens.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PairsModule } from './pairs/pairs.module';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { Config } from './configs/config.interface';
import { GeneralModule } from './general/general.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { PriceModule } from './price/price.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: (configService: ConfigService<Config>) => ({
        store: redisStore,
        url: configService.get<string>('redisUrl'),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    PrismaModule.forRoot({
      isGlobal: true,
      prismaServiceOptions: {
        middlewares: [
          // configure your prisma middleware
          loggingMiddleware({
            logger: new Logger('PrismaMiddleware'),
            logLevel: 'log',
          }),
        ],
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 10000,
        limit: 100,
      },
    ]),
    AuthModule,
    InsurancesModule,
    UsersModule,
    TokensModule,
    PairsModule,
    GeneralModule,
    HealthModule,
    PriceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
