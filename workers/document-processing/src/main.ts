import { Worker } from "bullmq";
import type { KnowledgeDocumentIngestionRequestedV1 } from "@amani/contracts";
import { loadLocalEnvironment, workerConfig } from "./config.js";
import { DocumentProcessor } from "./processor.js";

function bootstrap() {
  loadLocalEnvironment();
  const config = workerConfig();
  const processor = new DocumentProcessor(config);
  const worker = new Worker<KnowledgeDocumentIngestionRequestedV1>(
    config.redis.name,
    async (job) =>
      processor.process(
        {
          ...job.data,
          job: { ...job.data.job, attempt: job.attemptsMade + 1 },
        },
        job.attemptsMade + 1,
        typeof job.opts.attempts === "number" ? job.opts.attempts : 1,
      ),
    {
      prefix: config.redis.prefix,
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      concurrency: config.worker.concurrency,
      lockDuration: config.worker.timeoutMs,
    },
  );
  worker.on("completed", (job) => {
    console.info("document_processing_completed", {
      jobId: job.id,
      organizationId: job.data.organizationId,
      documentVersionId: job.data.documentVersionId,
      attempt: job.attemptsMade + 1,
    });
  });
  worker.on("failed", (job, error) => {
    console.warn("document_processing_failed", {
      jobId: job?.id,
      organizationId: job?.data.organizationId,
      documentVersionId: job?.data.documentVersionId,
      attempt: job?.attemptsMade,
      code: error instanceof Error ? error.name : "PROCESSING_FAILURE",
    });
  });
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await worker.pause();
    await worker.close();
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

try {
  bootstrap();
} catch {
  console.error(
    "Document processing worker startup failed. Check configuration.",
  );
  process.exitCode = 1;
}
