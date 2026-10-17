import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { orchestratorConfig } from '../common/config';
import type { KnowledgeRagPrompt } from '../rag/prompt-builder';

export interface GenerationRequest {
  readonly prompt: KnowledgeRagPrompt;
  readonly evidenceIds: readonly string[];
}

export interface GenerationResponse {
  readonly answer: string;
  readonly evidenceIds: readonly string[];
  readonly provider: string;
  readonly model: string;
  readonly finishReason: string | null;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

export abstract class GenerationProvider {
  abstract generate(request: GenerationRequest): Promise<GenerationResponse>;
}

function structuredOutput(value: unknown): {
  answer: string;
  evidenceIds: readonly string[];
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadGatewayException();
  }
  const output = value as Record<string, unknown>;
  if (
    typeof output.answer !== 'string' ||
    !output.answer.trim() ||
    output.answer.length > 12000 ||
    !Array.isArray(output.evidenceIds) ||
    !output.evidenceIds.every(
      (id) => typeof id === 'string' && /^E[1-9][0-9]*$/.test(id),
    )
  ) {
    throw new BadGatewayException();
  }
  return { answer: output.answer.trim(), evidenceIds: output.evidenceIds };
}

/** Deterministic development/test provider. Production configuration rejects it. */
export class DeterministicGenerationProvider extends GenerationProvider {
  private readonly config = orchestratorConfig();

  generate(request: GenerationRequest): Promise<GenerationResponse> {
    const evidenceId = request.evidenceIds[0];
    if (!evidenceId) throw new BadGatewayException();
    return Promise.resolve({
      answer: 'Amani found authorized evidence relevant to your question.',
      evidenceIds: [evidenceId],
      provider: 'deterministic-test',
      model: this.config.generation.model,
      finishReason: 'stop',
    });
  }
}

export class OpenAiCompatibleGenerationProvider extends GenerationProvider {
  private readonly config = orchestratorConfig();

  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    const generation = this.config.generation;
    if (generation.provider !== 'openai-compatible') {
      throw new ServiceUnavailableException();
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), generation.timeoutMs);
    try {
      const response = await fetch(
        new URL('chat/completions', `${generation.baseUrl}/`).toString(),
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${generation.apiKey}`,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            model: generation.model,
            messages: [
              { role: 'system', content: request.prompt.systemInstruction },
              { role: 'user', content: request.prompt.userMessage },
            ],
            temperature: generation.temperatureBps / 10000,
            max_tokens: generation.maxOutputTokens,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
          redirect: 'manual',
        },
      );
      if (!response.ok) throw new ServiceUnavailableException();
      const payload: unknown = await response.json();
      const root = payload as {
        choices?: readonly {
          message?: { content?: unknown };
          finish_reason?: unknown;
        }[];
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
      };
      const choice = root.choices?.[0];
      if (typeof choice?.message?.content !== 'string') {
        throw new BadGatewayException();
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(choice.message.content);
      } catch {
        throw new BadGatewayException();
      }
      const output = structuredOutput(parsed);
      return {
        ...output,
        provider: 'openai-compatible',
        model: generation.model,
        finishReason:
          typeof choice.finish_reason === 'string'
            ? choice.finish_reason
            : null,
        ...(typeof root.usage?.prompt_tokens === 'number'
          ? { inputTokens: root.usage.prompt_tokens }
          : {}),
        ...(typeof root.usage?.completion_tokens === 'number'
          ? { outputTokens: root.usage.completion_tokens }
          : {}),
      };
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GatewayTimeoutException();
      }
      throw new ServiceUnavailableException();
    } finally {
      clearTimeout(timer);
    }
  }
}

@Injectable()
export class ConfiguredGenerationProvider extends GenerationProvider {
  private readonly delegate: GenerationProvider;

  constructor() {
    super();
    this.delegate =
      orchestratorConfig().generation.provider === 'deterministic-test'
        ? new DeterministicGenerationProvider()
        : new OpenAiCompatibleGenerationProvider();
  }

  generate(request: GenerationRequest): Promise<GenerationResponse> {
    return this.delegate.generate(request);
  }
}
