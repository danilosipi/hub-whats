import { Body, Controller, Logger, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { EvolutionWhatsappWebhookService } from '../services/evolution-whatsapp-webhook.service';

@Controller('webhooks/whatsapp/evolution')
export class EvolutionWhatsappWebhookController {
  private readonly logger = new Logger(EvolutionWhatsappWebhookController.name);

  constructor(
    private readonly evolutionWhatsappWebhookService: EvolutionWhatsappWebhookService,
  ) {}

  @Post()
  async receive(@Body() body: any, @Res() res: Response): Promise<void> {
    this.logger.log(
      JSON.stringify({
        event: 'whatsapp.evolution.webhook.received',
      }),
    );

    await this.evolutionWhatsappWebhookService.processIncoming(body);
    res.status(200).json({ received: true });
  }
}
