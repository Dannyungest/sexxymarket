import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [NotificationsService, StorageService],
  exports: [NotificationsService, StorageService],
})
export class IntegrationsModule {}
