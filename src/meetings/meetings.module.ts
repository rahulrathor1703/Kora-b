import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { CalendarConnectionsModule } from '../calendar-connections/calendar-connections.module';
import { ProspectsModule } from '../prospects/prospects.module';
import { RbacModule } from '../rbac/rbac.module';
import { MeetingEntity } from './entities/meeting.entity';
import { MeetingCalendarSyncService } from './meeting-calendar-sync.service';
import { MeetingMapper } from './mappers/meeting.mapper';
import { MeetingsController } from './meetings.controller';
import { MeetingsRepository } from './meetings.repository';
import { MeetingsService } from './meetings.service';
import { GoogleCalendarAdapter } from './providers/google-calendar.adapter';
import { OutlookCalendarAdapter } from './providers/outlook-calendar.adapter';
import { ZoomMeetingAdapter } from './providers/zoom-meeting.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([MeetingEntity]),
    CalendarConnectionsModule,
    ProspectsModule,
    RbacModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
  ],
  controllers: [MeetingsController],
  providers: [
    MeetingsRepository,
    MeetingsService,
    MeetingMapper,
    MeetingCalendarSyncService,
    GoogleCalendarAdapter,
    OutlookCalendarAdapter,
    ZoomMeetingAdapter,
  ],
  exports: [MeetingsService],
})
export class MeetingsModule {}
