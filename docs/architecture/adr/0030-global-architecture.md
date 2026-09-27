---
title: "ADR-0030 — Architecture globale consolidée d’Amani IA"
status: "Accepté — principes globaux ; détails proposés selon ADR"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0030 — Architecture globale consolidée d’Amani IA

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté — principes globaux ; détails proposés selon ADR** |
| Date | 27 septembre 2026 |
| Portée | Référence transversale pour le monorepo, les services, données, sécurité et déploiement |
| ADR liés | ADR-0001 à ADR-0029 : lire les ADR spécialisés avant toute modification structurante |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Ce document consolide les choix d'Amani IA après les ADR spécialisés. Il ne prétend pas introduire un nouveau système ni remplacer les décisions détaillées. Il sert de point d'entrée unique pour comprendre la cohérence du monorepo npm, les applications frontend, la communication backend-to-backend, les plugins indépendants, les workers, PostgreSQL/pgvector et l'IA sensible aux permissions. Le repository possède les squelettes de 11 applications TypeScript et une configuration d'infrastructure locale ; la plupart des parcours métier ne sont pas encore implémentés.

## 2. Décision

### 2.1. Topologie et frontières

- **Monorepo :** repository Git `amani.ia`, npm workspaces `apps/*`, `plugins/*` et packages initialisés sous `packages/*`, lockfile npm racine ; workers Python gérés séparément par `uv` (ADR-0001).
- **Frontends Next.js :** Website :3000, Enterprise Portal :3001, SaaS Admin :3002 ; sessions et accès via Gateway sans secrets de service dans le navigateur (ADR-0025 à 0027).
- **Plateforme NestJS :** Gateway :4000 (frontière publique), Core Platform :4001 (organisations, memberships, rôles, entitlements, registry), AI Orchestrator :4002 (sélection d'outils et composition de réponses) — ADR-0002 à 0004, ADR-0018.
- **Plugin APIs NestJS :** Knowledge :4101, Data Analytics :4102, Conversations :4103, Connectors :4104, Evaluation :4105. Ces ports sont des conventions **locales**, pas des adresses publiques de production. Un service plugin est déployé par environnement et activé logiquement pour les organisations (ADR-0015 à 0023).
- **Workers :** document-processing et Python Data Engine ; processing long par jobs, interopérabilité NestJS/Python contractualisée (ADR-0006, ADR-0024).

### 2.2. Chemins de communication

Les frontends passent par Gateway. Les opérations tenant/identité vont au Core ; les demandes IA vont à l'Orchestrator ; les CRUD de plugins peuvent être routés vers leur propriétaire après validation des contrôles transversaux. **Les API internes communiquent directement entre elles** par contrats authentifiés, sans repasser obligatoirement par Gateway. L'Orchestrator interroge le Core pour déterminer les outils possibles, puis appelle Knowledge, Analytics ou Conversations sous le contexte utilisateur **vérifiable**. Les plugins revalident leur opération et leur ACL. Les jobs longs utilisent une queue et les workers autorisés. Les événements de mise à jour accélèrent invalidation/provisionnement mais ne créent pas un bypass des vérifications actuelles.

### 2.3. Persistance et isolation

PostgreSQL est la base transactionnelle principale, avec pgvector dans Knowledge. Chaque service possède ses tables/schémas et migrations, même si plusieurs bases partagent la même instance locale. Redis est réservé aux usages cache, jobs ou événements selon protocoles explicités ; MinIO local et S3-compatible futur conservent les fichiers et exports. Un service n'écrit jamais directement dans les tables d'un autre (ADR-0008, 0009, 0014).

### 2.4. Permission-aware AI comme invariant

L'organisation est la frontière de tenant ; ses admins attribuent rôles et ressources aux collaborateurs. Une permission de plugin ne vaut ni accès global aux documents ni autorisation des analyses de toute colonne. Core définit les règles communes, les Plugin APIs les appliquent à leurs ressources, les workers les revalident et l'Orchestrator ne construit son contexte qu'avec **des données déjà autorisées**. Les citations, anciennes conversations, caches, exports et URL de fichiers sont eux aussi soumis à des contrôles actuels. En cas d'échec du contrôle : refus plutôt que recherche élargie (ADR-0010 à 0013).

### 2.5. Déploiement et maturité

La V1 peut partager des infrastructures locales mais conserve des artefacts déployables indépendamment. La production, le fournisseur d'identité, la solution d'observabilité, l'ORM, le paiement et le broker événementiel durable exact restent des choix **proposés ou ouverts** selon les ADR correspondants. L'architecture cible ne doit jamais être confondue avec la disponibilité réelle des routes de santé des squelettes (ADR-0028 et 0029).

## 3. Alternatives examinées

La synthèse s'appuie sur les compromis documentés : monolithe ou multi-repositories écartés au profit du monorepo à API indépendantes ; MongoDB remplacé par PostgreSQL ; service vectoriel externe différé au profit de pgvector ; conteneur par tenant différé au profit d'une isolation logique vérifiée ; accès documentaires par seul LLM rejeté au profit de garde-fous déterministes avant récupération. Aucun de ces choix ne transforme à lui seul le système en solution sécurisée tant que les tests E2E ne le prouvent pas.

## 4. Conséquences et compromis

**Cohérence d'ensemble :** langage TypeScript partagé sans partage des tables, plugins disponibles à la carte sans déploiement par tenant, plateforme gouvernée centralement sans concentration des données des plugins, parcours IA unifié sans accès illimité. **Difficultés structurantes :** cohérence d'autorisations pendant les jobs, latences interservices, gestion des contrats, coût de la recherche filtrée, gestion d'échecs partiels, tests multi-tenant et observabilité sûre. Les ADR spécialisés restent la référence normative pour chaque responsabilité.

## 5. Sécurité et isolation

Invariants de la plateforme : preuve d'identité service + utilisateur ; tenant actif vérifié ; policy Core et ACL plugin ; filtrage avant retrieval et exécution ; accès restreint au provider LLM ; revérification lors de lecture d'historique ou export ; audit des mutations critiques ; secrets isolés ; tests d'attaque cross-tenant, d'escalade et de prompt injection. Aucune confiance implicite n'est accordée au réseau privé, au monorepo ou aux réponses du modèle.

## 6. État et mise en œuvre

**Ce qui existe comme fondation :** 3 frontends Next.js, 3 API plateforme et 5 Plugin APIs NestJS initialisés ; dossiers worker/packages ; configuration Compose de PostgreSQL/pgvector, Redis et MinIO ; endpoints de liveness des Nest services. **Ce qui reste :** authn/authz, modèles métier SQL, registry opérationnel, intégrations HTTP internes, jobs, pipelines Knowledge/Analytics, orchestration IA réelle, outils de supervision et suite de tests interservices. L'état précis des installations, builds et GitHub Actions doit être confirmé à partir du repository actuel, pas déduit de cet ADR.

**Ordre d'incrémentation :** 1) lockfile/npm/infra ; 2) Core IAM/organisations/permissions et Gateway ; 3) Knowledge ingestion filtrée et worker documentaire ; 4) Orchestrator pour un premier RAG autorisé ; 5) Enterprise/Admin ; 6) Analytics/Conversations ; 7) Connectors/Evaluation ; 8) résilience et déploiements indépendants. Mettre à jour cet ADR et les diagrammes après toute nouvelle décision structurante, sans réécrire l'historique des ADR antérieurs.

## 7. Critères de validation

- Un tenant et ses ressources sont isolés sur tous les chemins : HTTP direct, IA, SQL, vecteurs, fichiers, caches et jobs.
- Deux employés aux permissions différentes reçoivent des réponses différentes et des citations limitées à leurs droits.
- La désactivation d'un plugin retire ses outils sans affecter les tenants qui l'utilisent encore.
- Chaque service a un contrat API, des tests et une procédure de déploiement indépendante vérifiée.
- Toutes les décisions ouvertes sont tracées, les états d'implémentation sont honnêtes et les diagrammes seront générés depuis les ADR validés.

## 8. Traçabilité

- ADR liés : ADR-0001 à ADR-0029 : lire les ADR spécialisés avant toute modification structurante.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
