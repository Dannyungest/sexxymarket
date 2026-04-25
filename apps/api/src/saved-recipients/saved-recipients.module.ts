import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SavedRecipientsController } from './saved-recipients.controller';
import { SavedRecipientsService } from './saved-recipients.service';

@Module({
  imports: [PrismaModule],
  controllers: [SavedRecipientsController],
  providers: [SavedRecipientsService],
  exports: [SavedRecipientsService],
})
export class SavedRecipientsModule {}
