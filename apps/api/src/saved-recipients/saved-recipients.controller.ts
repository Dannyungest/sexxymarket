import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SavedRecipientsService } from './saved-recipients.service';
import { CreateSavedRecipientDto } from './dto/create-saved-recipient.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';

@Controller('saved-recipients')
@UseGuards(JwtAuthGuard)
export class SavedRecipientsController {
  constructor(private readonly savedRecipients: SavedRecipientsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.savedRecipients.listForUser(user.sub);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateSavedRecipientDto) {
    return this.savedRecipients.createForUser(user.sub, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.savedRecipients.removeForUser(user.sub, id);
  }
}
