import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHealth() {
    return {
      service: 'Sexxy Market API',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
