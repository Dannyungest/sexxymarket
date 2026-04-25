import { Global, Module } from '@nestjs/common';
import { BackgroundJobsService } from './background-jobs.service';
import { NotificationsService } from './notifications.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [NotificationsService, StorageService, BackgroundJobsService],
  exports: [NotificationsService, StorageService, BackgroundJobsService],
})
export class IntegrationsModule {}
