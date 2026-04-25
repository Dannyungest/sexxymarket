import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BackgroundJobsService {
  private readonly logger = new Logger(BackgroundJobsService.name);

  enqueue(name: string, task: () => Promise<void>) {
    void task().catch((error: unknown) => {
      this.logger.error(
        `Background task failed: ${name}`,
        error instanceof Error ? error.stack : String(error),
      );
    });
  }
}
