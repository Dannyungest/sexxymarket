import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return health payload', () => {
      const health = appController.getHealth();
      expect(health.service).toBe('Sexxy Market API');
      expect(health.status).toBe('ok');
      expect(typeof health.timestamp).toBe('string');
    });
  });
});
