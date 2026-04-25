import { Injectable, Logger } from '@nestjs/common';
import { AccountResolver } from './account-resolver.service';
import { EvolutionPayloadNormalizer } from './evolution-payload-normalizer.service';
import { ProcessorForwarder } from './processor-forwarder.service';

@Injectable()
export class EvolutionWhatsappWebhookService {
  private readonly logger = new Logger(EvolutionWhatsappWebhookService.name);
  private readonly seenMessages = new Map<string, number>();
  private readonly dedupeWindowMs = this.resolveDedupeWindowMs();

  constructor(
    private readonly evolutionPayloadNormalizer: EvolutionPayloadNormalizer,
    private readonly accountResolver: AccountResolver,
    private readonly processorForwarder: ProcessorForwarder,
  ) {}

  async processIncoming(body: any): Promise<void> {
    const parsed = this.evolutionPayloadNormalizer.normalize(body);
    if (parsed.kind === 'ignored') {
      this.logger.log(
        JSON.stringify({
          event: 'whatsapp.evolution.webhook.ignored',
          reason: parsed.reason,
          correlation_id: parsed.correlationId,
        }),
      );
      return;
    }

    if (this.isDuplicate(parsed.dedupeKey, parsed.correlationId)) {
      return;
    }

    this.logger.log(
      JSON.stringify({
        event: `whatsapp.evolution.${parsed.kind}.normalized`,
        correlation_id: parsed.correlationId,
        messageId: parsed.data.messageId ?? null,
        from: parsed.kind === 'message' ? parsed.data.from ?? null : null,
        instance: parsed.data.rawInstance ?? null,
      }),
    );

    const accountId = this.accountResolver.resolve({
      instanceName: parsed.data.rawInstance ?? null,
      phoneNumberId: parsed.data.phoneNumberId ?? null,
      displayPhoneNumber: parsed.data.displayPhoneNumber ?? null,
      correlationId: parsed.correlationId,
    });

    if (!accountId) {
      this.logger.warn(
        JSON.stringify({
          event: 'whatsapp.evolution.account.not_found',
          correlation_id: parsed.correlationId,
          instance: parsed.data.rawInstance ?? null,
          phoneNumberId: parsed.data.phoneNumberId ?? null,
          displayPhoneNumber: parsed.data.displayPhoneNumber ?? null,
        }),
      );
      return;
    }

    await this.processorForwarder.forward({
      kind: parsed.kind,
      account_id: accountId,
      correlation_id: parsed.correlationId,
      data: parsed.data,
    });
  }

  private isDuplicate(
    dedupeKey: string | null,
    correlationId: string,
  ): boolean {
    if (!dedupeKey) {
      return false;
    }
    const now = Date.now();
    this.pruneSeenMessages(now);
    if (this.seenMessages.has(dedupeKey)) {
      this.logger.warn(
        JSON.stringify({
          event: 'whatsapp.evolution.duplicate.ignored',
          correlation_id: correlationId,
          messageId: dedupeKey,
        }),
      );
      return true;
    }
    this.seenMessages.set(dedupeKey, now);
    return false;
  }

  private pruneSeenMessages(now: number): void {
    for (const [messageId, seenAt] of this.seenMessages.entries()) {
      if (now - seenAt > this.dedupeWindowMs) {
        this.seenMessages.delete(messageId);
      }
    }
  }

  private resolveDedupeWindowMs(): number {
    const raw = process.env.EVOLUTION_DEDUPE_WINDOW_MS;
    const parsed = Number.parseInt(raw ?? '', 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return 5 * 60 * 1000;
  }
}
