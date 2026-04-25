import { Module } from '@nestjs/common';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [MerchantController],
  providers: [MerchantService, RolesGuard],
  exports: [MerchantService],
})
export class MerchantModule {}
