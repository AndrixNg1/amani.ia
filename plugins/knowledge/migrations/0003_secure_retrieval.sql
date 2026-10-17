-- Run only as amani_knowledge. Retrieval remains exact because embeddings have variable dimensions.
-- Authorization and lifecycle predicates narrow candidates before pgvector cosine ordering.
CREATE INDEX resource_grants_retrieval_read_idx
  ON knowledge.resource_grants (organization_id, membership_id, action, resource_type, resource_id);
CREATE INDEX document_chunks_retrieval_profile_idx
  ON knowledge.document_chunks (
    organization_id, knowledge_base_id, document_id, document_version_id,
    embedding_provider, embedding_model, embedding_dimension, embedding_config_version
  );
