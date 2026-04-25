import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  providers: [AuditService, RolesGuard],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
