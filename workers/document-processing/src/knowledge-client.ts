import { createHash, createHmac, randomUUID } from "node:crypto";
import type {
  DevelopmentDelegation,
  KnowledgeDocumentIngestionRequestedV1,
  KnowledgeDocumentProcessingBatchV1,
  KnowledgeDocumentProcessingCompletionV1,
  KnowledgeDocumentProcessingFailureV1,
  KnowledgeDocumentProcessingInputV1,
  KnowledgeDocumentProcessingStartV1,
} from "@amani/contracts";
import type { OrganizationId, RequestId } from "@amani/types";
import { ProcessingError } from "./errors.js";

function input(value: unknown): value is KnowledgeDocumentProcessingInputV1 {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { type?: unknown }).type === "knowledge.document.processing.input"
  );
}

export class KnowledgeClient {
  constructor(
    private readonly config: {
      readonly url: string;
      readonly timeoutMs: number;
      readonly developmentSecret: string;
    },
  ) {}

  private async post<T>(
    path: string,
    job: KnowledgeDocumentIngestionRequestedV1,
    action: string,
    body: unknown,
  ): Promise<T> {
    const serialized = JSON.stringify(body);
    const requestId = randomUUID() as RequestId;
    const payload: DevelopmentDelegation = {
      version: 1,
      userId: job.job.requestedBy,
      organizationId: job.organizationId as OrganizationId,
      requestId,
      correlationId: job.job.correlationId,
      callingService: "@amani/document-processing",
      audience: "@amani/knowledge",
      scope: { action, resourceType: "document_version" },
      issuedAt: Date.now(),
      expiresAt: Date.now() + 30_000,
      nonce: randomUUID(),
      method: "POST",
      path,
      bodySha256: createHash("sha256").update(serialized).digest("hex"),
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac(
      "sha256",
      Buffer.from(this.config.developmentSecret, "hex"),
    )
      .update(encoded)
      .digest("hex");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(new URL(path, this.config.url), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": requestId,
          "x-correlation-id": job.job.correlationId,
          "x-amani-development-context": encoded,
          "x-amani-development-signature": signature,
        },
        body: serialized,
        signal: controller.signal,
      });
      if (response.status === 403)
        throw new ProcessingError("AUTHORIZATION_REVOKED");
      if (response.status === 404 || response.status === 409)
        throw new ProcessingError("DOCUMENT_VERSION_STALE");
      if (!response.ok) throw new ProcessingError("PERSISTENCE_FAILED");
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ProcessingError) throw error;
      throw new ProcessingError("PERSISTENCE_FAILED");
    } finally {
      clearTimeout(timer);
    }
  }

  async start(body: KnowledgeDocumentProcessingStartV1) {
    const response = await this.post<unknown>(
      "/internal/document-processing/start",
      body.job,
      "knowledge.processing.start",
      body,
    );
    if (!input(response)) throw new ProcessingError("PERSISTENCE_FAILED");
    return response;
  }
  async publish(
    job: KnowledgeDocumentIngestionRequestedV1,
    body: KnowledgeDocumentProcessingBatchV1,
  ) {
    return this.post(
      "/internal/document-processing/batches",
      job,
      "knowledge.processing.publish",
      body,
    );
  }
  async complete(
    job: KnowledgeDocumentIngestionRequestedV1,
    body: KnowledgeDocumentProcessingCompletionV1,
  ) {
    return this.post(
      "/internal/document-processing/complete",
      job,
      "knowledge.processing.complete",
      body,
    );
  }
  async fail(
    job: KnowledgeDocumentIngestionRequestedV1,
    body: KnowledgeDocumentProcessingFailureV1,
  ) {
    return this.post(
      "/internal/document-processing/fail",
      job,
      "knowledge.processing.fail",
      body,
    );
  }
}
