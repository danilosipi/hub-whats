import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MetaWhatsappWebhookController } from './controllers/meta-whatsapp-webhook.controller';
import { MetaWhatsappWebhookService } from './services/meta-whatsapp-webhook.service';
import { WhatsappOutboundClientService } from './services/whatsapp-outbound-client.service';

@Module({
  imports: [HttpModule],
  controllers: [MetaWhatsappWebhookController],
  providers: [MetaWhatsappWebhookService, WhatsappOutboundClientService],
})
export class WhatsappModule {}
