import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { CryptoModule } from '../common/crypto/crypto.module';
import { RbacModule } from '../rbac/rbac.module';
import { CalendarConnectionsOAuthService } from './calendar-connections-oauth.service';
import { CalendarConnectionsController } from './calendar-connections.controller';
import { CalendarConnectionsRepository } from './calendar-connections.repository';
import { CalendarConnectionsService } from './calendar-connections.service';
import { UserCalendarConnectionEntity } from './entities/user-calendar-connection.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserCalendarConnectionEntity]),
    CryptoModule,
    RbacModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
  ],
  controllers: [CalendarConnectionsController],
  providers: [
    CalendarConnectionsRepository,
    CalendarConnectionsService,
    CalendarConnectionsOAuthService,
  ],
  exports: [
    CalendarConnectionsOAuthService,
    CalendarConnectionsService,
    CalendarConnectionsRepository,
  ],
})
export class CalendarConnectionsModule {}
