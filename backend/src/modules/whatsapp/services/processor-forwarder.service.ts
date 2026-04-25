import { Injectable, Logger } from '@nestjs/common';
import {
  WhatsappOutboundClientService,
  type WhatsappProcessorPayload,
} from './whatsapp-outbound-client.service';

@Injectable()
export class ProcessorForwarder {
  private readonly logger = new Logger(ProcessorForwarder.name);

  constructor(
    private readonly whatsappOutboundClientService: WhatsappOutboundClientService,
  ) {}

  async forward(
    payload: WhatsappProcessorPayload & { correlation_id: string },
  ): Promise<void> {
    this.logger.log(
      JSON.stringify({
        event: 'whatsapp.evolution.forward.start',
        kind: payload.kind,
        correlation_id: payload.correlation_id,
        account_id: payload.account_id,
      }),
    );

    await this.whatsappOutboundClientService.sendEvent(payload, 'evolution');

    this.logger.log(
      JSON.stringify({
        event: 'whatsapp.evolution.forward.done',
        kind: payload.kind,
        correlation_id: payload.correlation_id,
      }),
    );
  }
}
