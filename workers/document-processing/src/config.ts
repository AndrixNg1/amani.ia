import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { ConfigurationError, createEnv } from "@amani/config";
import type { EnvironmentSource } from "@amani/config";

export function loadLocalEnvironment() {
  if (!existsSync(".env")) return;
  for (const [key, value] of Object.entries(
    parseEnv(readFileSync(".env", "utf8")),
  )) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function workerConfig(source: EnvironmentSource = process.env) {
  const env = createEnv(source);
  const environment = env.environment("APP_ENV", { default: "development" });
  const provider = env.required("DOCUMENT_PROCESSING_EMBEDDING_PROVIDER");
  if (!["openai-compatible", "deterministic-test"].includes(provider))
    throw new ConfigurationError(
      "DOCUMENT_PROCESSING_EMBEDDING_PROVIDER",
      "invalid_string",
    );
  if (
    provider === "deterministic-test" &&
    !["development", "test"].includes(environment)
  )
    throw new ConfigurationError(
      "DOCUMENT_PROCESSING_EMBEDDING_PROVIDER",
      "invalid_environment",
    );
  const secret = env.required("DOCUMENT_PROCESSING_DEVELOPMENT_SECRET");
  if (!/^[a-f0-9]{64}$/.test(secret))
    throw new ConfigurationError(
      "DOCUMENT_PROCESSING_DEVELOPMENT_SECRET",
      "invalid_string",
    );
  const chunkSize = env.integer("DOCUMENT_PROCESSING_CHUNK_SIZE", {
    default: 1200,
    min: 128,
    max: 10000,
  });
  const chunkOverlap = env.integer("DOCUMENT_PROCESSING_CHUNK_OVERLAP", {
    default: 160,
    min: 0,
    max: 5000,
  });
  if (chunkOverlap >= chunkSize)
    throw new ConfigurationError(
      "DOCUMENT_PROCESSING_CHUNK_OVERLAP",
      "out_of_range",
    );
  const openAi = provider === "openai-compatible";
  return {
    environment,
    redis: {
      host: env.required("DOCUMENT_PROCESSING_REDIS_HOST"),
      port: env.integer("DOCUMENT_PROCESSING_REDIS_PORT", {
        default: 6379,
        min: 1,
        max: 65535,
      }),
      password: env.required("DOCUMENT_PROCESSING_REDIS_PASSWORD"),
      prefix: env.required("DOCUMENT_PROCESSING_QUEUE_PREFIX"),
      name: env.required("DOCUMENT_PROCESSING_QUEUE_NAME"),
    },
    knowledge: {
      url: env.url("KNOWLEDGE_INTERNAL_URL"),
      timeoutMs: env.integer("KNOWLEDGE_INTERNAL_TIMEOUT_MS", {
        default: 10000,
        min: 100,
        max: 30000,
      }),
      developmentSecret: secret,
    },
    worker: {
      concurrency: env.integer("DOCUMENT_PROCESSING_CONCURRENCY", {
        default: 1,
        min: 1,
        max: 8,
      }),
      timeoutMs: env.integer("DOCUMENT_PROCESSING_TIMEOUT_MS", {
        default: 120000,
        min: 1000,
        max: 900000,
      }),
    },
    limits: {
      maxOriginalBytes: env.integer("DOCUMENT_PROCESSING_MAX_ORIGINAL_BYTES", {
        default: 52_428_800,
        min: 1,
        max: 1_073_741_824,
      }),
      maxExtractedCharacters: env.integer(
        "DOCUMENT_PROCESSING_MAX_EXTRACTED_CHARACTERS",
        { default: 2_000_000, min: 1, max: 20_000_000 },
      ),
      maxPages: env.integer("DOCUMENT_PROCESSING_MAX_PAGES", {
        default: 500,
        min: 1,
        max: 10000,
      }),
      maxParagraphCharacters: env.integer(
        "DOCUMENT_PROCESSING_MAX_PARAGRAPH_CHARACTERS",
        { default: 20_000, min: 128, max: 100_000 },
      ),
      chunkSize,
      chunkOverlap,
      maxChunks: env.integer("DOCUMENT_PROCESSING_MAX_CHUNKS", {
        default: 2000,
        min: 1,
        max: 10000,
      }),
      embeddingBatchSize: env.integer(
        "DOCUMENT_PROCESSING_EMBEDDING_BATCH_SIZE",
        { default: 16, min: 1, max: 100 },
      ),
    },
    embedding: {
      provider: provider as "openai-compatible" | "deterministic-test",
      model: env.required("DOCUMENT_PROCESSING_EMBEDDING_MODEL"),
      dimension: env.integer("DOCUMENT_PROCESSING_EMBEDDING_DIMENSION", {
        min: 1,
        max: 4096,
      }),
      configVersion: env.integer(
        "DOCUMENT_PROCESSING_EMBEDDING_CONFIG_VERSION",
        {
          default: 1,
          min: 1,
          max: 1000,
        },
      ),
      timeoutMs: env.integer("DOCUMENT_PROCESSING_EMBEDDING_TIMEOUT_MS", {
        default: 10000,
        min: 100,
        max: 60000,
      }),
      ...(openAi
        ? {
            baseUrl: env.url("DOCUMENT_PROCESSING_EMBEDDING_BASE_URL"),
            apiKey: env.required("DOCUMENT_PROCESSING_EMBEDDING_API_KEY"),
          }
        : {}),
    },
  } as const;
}
