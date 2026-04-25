import { Injectable } from '@nestjs/common';
import type {
  MetaIncomingMessageData,
  MetaIncomingStatusData,
} from '../types/meta-whatsapp-incoming.types';

export type EvolutionNormalized =
  | {
      kind: 'message';
      correlationId: string;
      dedupeKey: string | null;
      data: MetaIncomingMessageData & { rawInstance: string | null };
    }
  | {
      kind: 'status';
      correlationId: string;
      dedupeKey: string | null;
      data: MetaIncomingStatusData & { rawInstance: string | null };
    }
  | {
      kind: 'ignored';
      correlationId: string;
      reason: string;
    };

@Injectable()
export class EvolutionPayloadNormalizer {
  normalize(body: any): EvolutionNormalized {
    const correlationId = this.pickCorrelationId(body);
    const data = body?.data ?? {};
    const key = data?.key ?? {};
    const message = data?.message ?? {};
    const event = String(body?.event ?? '').toLowerCase();

    const instanceName = this.pickInstanceName(body);
    const remoteJid =
      typeof key?.remoteJid === 'string' ? key.remoteJid.trim() : '';
    const participant =
      typeof key?.participant === 'string' ? key.participant.trim() : '';
    const fromMe = key?.fromMe === true;

    const messageId = this.pickString(key?.id) ?? this.pickString(body?.event_id);
    const timestamp = data?.messageTimestamp
      ? String(data.messageTimestamp)
      : this.pickString(body?.date_time);
    const senderPhone = this.extractDigitsFromJid(participant || remoteJid);
    const displayPhoneNumber = this.extractDigits(instanceName);
    const phoneNumberId = this.extractDigits(body?.instance?.instanceId ?? instanceName);
    const textBody =
      this.pickString(message?.conversation) ??
      this.pickString(message?.extendedTextMessage?.text) ??
      this.pickString(message?.imageMessage?.caption) ??
      this.pickString(message?.videoMessage?.caption);

    const isGroupMessage = remoteJid.endsWith('@g.us');
    if (isGroupMessage) {
      return { kind: 'ignored', correlationId, reason: 'group_message' };
    }

    const isMessageEvent =
      event === 'messages.upsert' && remoteJid.length > 0 && !fromMe;
    if (isMessageEvent) {
      return {
        kind: 'message',
        correlationId,
        dedupeKey: messageId,
        data: {
          messagingProduct: 'whatsapp',
          displayPhoneNumber,
          phoneNumberId,
          rawInstance: instanceName,
          customerWaId: senderPhone,
          customerName: this.pickString(data?.pushName),
          messageId,
          from: senderPhone,
          timestamp,
          type: this.detectMessageType(message),
          textBody,
        },
      };
    }

    const status = this.detectStatus(event, body);
    if (status) {
      return {
        kind: 'status',
        correlationId,
        dedupeKey: messageId,
        data: {
          phoneNumberId,
          displayPhoneNumber,
          rawInstance: instanceName,
          messageId,
          status,
          timestamp,
          recipientId: senderPhone,
        },
      };
    }

    return { kind: 'ignored', correlationId, reason: `unmapped_event:${event || 'unknown'}` };
  }

  private pickCorrelationId(body: any): string {
    return (
      this.pickString(body?.correlation_id) ??
      this.pickString(body?.event_id) ??
      this.pickString(body?.data?.key?.id) ??
      this.safeRandomId()
    );
  }

  private safeRandomId(): string {
    const random = Math.random().toString(36).slice(2, 12);
    return `evo-${Date.now()}-${random}`;
  }

  private pickInstanceName(body: any): string | null {
    const instance = body?.instance;
    if (typeof instance === 'string' && instance.trim().length > 0) {
      return instance.trim();
    }
    if (
      typeof instance?.instanceName === 'string' &&
      instance.instanceName.trim().length > 0
    ) {
      return instance.instanceName.trim();
    }
    return null;
  }

  private detectMessageType(message: any): string | null {
    if (message?.conversation || message?.extendedTextMessage) {
      return 'text';
    }
    const keys = Object.keys(message ?? {}).filter(Boolean);
    if (keys.length === 0) {
      return null;
    }
    return keys[0].replace(/Message$/, '').toLowerCase();
  }

  private detectStatus(event: string, body: any): string | null {
    if (event.includes('delivery') || event.includes('delivered')) {
      return 'delivered';
    }
    if (event.includes('read')) {
      return 'read';
    }
    if (event.includes('sent')) {
      return 'sent';
    }
    if (event === 'messages.update') {
      const status = this.pickString(body?.data?.update?.status);
      return status ?? null;
    }
    return null;
  }

  private extractDigits(value: unknown): string | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }
    const digits = value.replace(/\D/g, '');
    return digits.length > 0 ? digits : null;
  }

  private extractDigitsFromJid(value: unknown): string | null {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }
    const jid = value.split('@')[0];
    const digits = jid.replace(/\D/g, '');
    return digits.length > 0 ? digits : null;
  }

  private pickString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
