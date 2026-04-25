import { Injectable, Logger } from '@nestjs/common';
import { WhatsappIntegrationRepository } from '../repositories/whatsapp-integration.repository';

export type AccountResolutionInput = {
  instanceName: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  correlationId: string;
};

@Injectable()
export class AccountResolver {
  private readonly logger = new Logger(AccountResolver.name);

  constructor(
    private readonly whatsappIntegrationRepository: WhatsappIntegrationRepository,
  ) {}

  resolve(input: AccountResolutionInput): string | null {
    const byInstance = this.whatsappIntegrationRepository.resolveEvolutionAccountId(
      input.instanceName,
    );
    if (byInstance) {
      this.logger.log(
        JSON.stringify({
          event: 'whatsapp.evolution.account.resolved',
          resolver: 'instance',
          correlation_id: input.correlationId,
          instance: input.instanceName,
          account_id: byInstance,
        }),
      );
      return byInstance;
    }

    const byPhone = this.whatsappIntegrationRepository.resolveAccountId(
      input.phoneNumberId,
      input.displayPhoneNumber,
    );
    if (byPhone) {
      this.logger.log(
        JSON.stringify({
          event: 'whatsapp.evolution.account.resolved',
          resolver: 'phone',
          correlation_id: input.correlationId,
          phoneNumberId: input.phoneNumberId,
          account_id: byPhone,
        }),
      );
      return byPhone;
    }

    const byEvolutionDefault = process.env.EVOLUTION_DEFAULT_ACCOUNT_ID?.trim();
    if (byEvolutionDefault) {
      this.logger.warn(
        JSON.stringify({
          event: 'whatsapp.evolution.account.fallback',
          resolver: 'evolution_default_account_id',
          correlation_id: input.correlationId,
        }),
      );
      return byEvolutionDefault;
    }

    const byLegacy = process.env.PROCESSOR_ACCOUNT_ID?.trim();
    if (byLegacy) {
      this.logger.warn(
        JSON.stringify({
          event: 'whatsapp.evolution.account.fallback',
          resolver: 'processor_account_id',
          correlation_id: input.correlationId,
        }),
      );
      return byLegacy;
    }

    return null;
  }
}
