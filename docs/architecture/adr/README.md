# Architecture Decision Records — Amani IA

> **Édition initiale : 27 septembre 2026.** Cette collection documente les décisions d’architecture d’Amani IA. Les 11 applications TypeScript ont été initialisées ; cela ne signifie pas que les fonctions métier, les communications backend-to-backend, l’authentification, les workers et les contrôles d’accès sont déjà opérationnels.

## Principes de lecture

- **Accepté** : le principe architectural a été décidé ; lire « État et mise en œuvre » pour savoir ce qui est réellement construit.
- **Proposé** : conception de référence à revoir et approuver avant implémentation ; un outil, un protocole ou un prestataire peut rester ouvert.
- **ADR-0030** est une synthèse des décisions, pas une autorisation de remplacer les ADR spécialisés ni une preuve de déploiement.
- Les diagrammes sont conçus **après** validation des ADR ; les images dans `../diagrams/` doivent illustrer les décisions sans inverser la source d’autorité.

## Catalogue des 30 ADR

### A. Fondations architecturales

| Numéro | Décision | Statut |
|---|---|---|
| 0001 | [ADR-0001 — Monorepo npm et organisation du repository](./0001-npm-monorepo.md) | Accepté |
| 0002 | [ADR-0002 — Architecture backend par API et plugins indépendants](./0002-plugin-backend.md) | Accepté |
| 0003 | [ADR-0003 — API Gateway : périmètre, routage et protections](./0003-api-gateway.md) | Accepté |
| 0004 | [ADR-0004 — Core Platform API et frontières des domaines centraux](./0004-core-platform.md) | Accepté |
| 0005 | [ADR-0005 — Communication synchrone backend-to-backend](./0005-backend-sync-communication.md) | Proposé |
| 0006 | [ADR-0006 — Communication asynchrone, événements et files de tâches](./0006-async-events-jobs.md) | Proposé |
| 0007 | [ADR-0007 — Contrats OpenAPI, SDK et versionnement des API](./0007-api-contracts-versioning.md) | Proposé |

### B. Données, identité et sécurité

| Numéro | Décision | Statut |
|---|---|---|
| 0008 | [ADR-0008 — PostgreSQL comme base principale et pgvector pour le RAG](./0008-postgresql-pgvector.md) | Accepté |
| 0009 | [ADR-0009 — Propriété des données, schémas et migrations par service](./0009-data-ownership-migrations.md) | Accepté |
| 0010 | [ADR-0010 — Architecture multi-tenant et isolation des entreprises](./0010-multi-tenant-isolation.md) | Accepté |
| 0011 | [ADR-0011 — Authentification des utilisateurs et des services](./0011-user-service-authentication.md) | Proposé |
| 0012 | [ADR-0012 — Rôles personnalisés, permissions et contrôle des ressources](./0012-roles-permissions-resources.md) | Accepté |
| 0013 | [ADR-0013 — IA sensible aux permissions de chaque utilisateur](./0013-permission-aware-ai.md) | Accepté |
| 0014 | [ADR-0014 — Stockage objet, accès aux fichiers et conservation des données](./0014-object-storage-retention.md) | Proposé |

### C. Plateforme de plugins et IA

| Numéro | Décision | Statut |
|---|---|---|
| 0015 | [ADR-0015 — Plugin Registry, installation et cycle de vie des plugins](./0015-plugin-registry-lifecycle.md) | Accepté |
| 0016 | [ADR-0016 — Abonnements, offres et droits d’activation des plugins](./0016-subscriptions-entitlements.md) | Proposé |
| 0017 | [ADR-0017 — Création des entreprises et provisionnement initial](./0017-organization-onboarding.md) | Proposé |
| 0018 | [ADR-0018 — AI Orchestrator et coordination des Plugin APIs](./0018-ai-orchestrator.md) | Accepté |
| 0019 | [ADR-0019 — Knowledge Plugin : ingestion, indexation et RAG autorisé](./0019-knowledge-rag.md) | Accepté |
| 0020 | [ADR-0020 — Data Analytics Plugin : datasets et analyses sécurisées](./0020-data-analytics.md) | Accepté |
| 0021 | [ADR-0021 — Conversations Plugin : messages et historique sécurisé](./0021-conversations.md) | Proposé |
| 0022 | [ADR-0022 — Connectors Plugin : intégrations externes et synchronisation](./0022-connectors.md) | Proposé |
| 0023 | [ADR-0023 — Evaluation Plugin : contrôle de qualité et jeux de tests IA](./0023-evaluation.md) | Proposé |
| 0024 | [ADR-0024 — Workers documentaires, Python Data Engine et isolation des jobs](./0024-background-workers.md) | Accepté |

### D. Frontends et administration

| Numéro | Décision | Statut |
|---|---|---|
| 0025 | [ADR-0025 — Trois applications Next.js indépendantes](./0025-nextjs-frontends.md) | Accepté |
| 0026 | [ADR-0026 — Administration SaaS, modération et journal d’audit](./0026-saas-admin-moderation-audit.md) | Proposé |
| 0027 | [ADR-0027 — Portail entreprise et interfaces fondées sur les permissions](./0027-enterprise-portal.md) | Proposé |

### E. Exploitation et qualité

| Numéro | Décision | Statut |
|---|---|---|
| 0028 | [ADR-0028 — Observabilité, résilience, journalisation et secrets](./0028-observability-resilience-secrets.md) | Proposé |
| 0029 | [ADR-0029 — Déploiement indépendant, CI/CD et stratégie de tests](./0029-deployment-cicd-testing.md) | Proposé |

### F. Synthèse globale

| Numéro | Décision | Statut |
|---|---|---|
| 0030 | [ADR-0030 — Architecture globale consolidée d’Amani IA](./0030-global-architecture.md) | Accepté — principes globaux ; détails proposés selon ADR |

## Ordre de conception et de validation

1. **Frontières techniques** — ADR-0001 à 0007 : repository, services, Gateway, Core, appels synchrones/asynchrones, contrats.
2. **Données et permissions** — ADR-0008 à 0014 : PostgreSQL, propriété, multi-tenant, identité, ACL, IA sensible aux permissions, fichiers.
3. **Fonctionnalités et parcours** — ADR-0015 à 0024 : registry, entitlements, onboarding, orchestrateur, cinq plugins, workers.
4. **Expérience et exploitation** — ADR-0025 à 0029 : frontends, gouvernance, portail, observabilité, CI/CD.
5. **Consolidation** — ADR-0030 : vérifier la cohérence de l’ensemble puis produire les diagrammes définitifs.

## Décisions ouvertes et points à ne pas inventer

- Prestataire et protocole concret d’authentification OIDC / identité interservices : ADR-0011.
- Backend événementiel durable, protocole Python/NestJS, garanties de livraison : ADR-0006 et 0024.
- ORM/query builder, paramètres pgvector et stratégie de sauvegarde : ADR-0008 et 0009.
- Prestataire de paiement, détails des offres, taxes et règles légales de conservation : ADR-0014 et 0016.
- Fournisseurs LLM/embeddings, politiques de transfert des données et quotas : ADR-0018 à 0020.
- Prestataire cloud, secrets manager, système d’observabilité et orchestrateur de déploiement : ADR-0028 et 0029.

## Référence d’implémentation actuelle

| Zone | Squelettes ou configuration présents | Port local |
|---|---|---:|
| Frontends | `apps/website`, `apps/enterprise`, `apps/admin` | 3000, 3001, 3002 |
| Core | `apps/gateway`, `apps/core-api`, `apps/ai-orchestrator` | 4000, 4001, 4002 |
| Plugin APIs | Knowledge, Data Analytics, Conversations, Connectors, Evaluation | 4101–4105 |
| Infrastructure locale | PostgreSQL/pgvector, Redis, MinIO via Docker Compose | 5432, 6379, 9000/9001 |
| Workers | Document Processing, Python Data Engine | À initialiser |
| Packages partagés | Dossiers `contracts`, `sdk`, `types`, `ui` et autres | À initialiser |

Les routes NestJS `/health` existantes vérifient uniquement la présence du processus ; elles ne valident pas l’isolation multi-tenant ou l’accès aux données. Vérifier les versions, scripts et état Git effectifs sur le repository avant tout déploiement.

## Convention pour les révisions

Un ADR accepté n’est **pas** supprimé lorsqu’une décision change. Le marquer « Remplacé par ADR-XXXX », expliquer le changement et rédiger un nouvel ADR avec ses conséquences. Mettre à jour les liens dans cet index, puis les diagrammes correspondants. Ne pas transformer un ADR proposé en accepté sans revue explicite de ses décisions ouvertes.

## Diagrammes existants et suite

Le diagramme global déjà créé se trouve dans `../diagrams/01-global-architecture.png`. Les diagrammes spécialisés seront conçus après validation de cette collection. Conserver les sources Mermaid (`.mmd`) avec chaque PNG afin de les maintenir à jour.
