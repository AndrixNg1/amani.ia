---
title: "ADR-0029 — Déploiement indépendant, CI/CD et stratégie de tests"
status: "Proposé"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0029 — Déploiement indépendant, CI/CD et stratégie de tests

| Métadonnée | Valeur |
|---|---|
| Statut | **Proposé** |
| Date | 27 septembre 2026 |
| Portée | Docker, npm workspaces, GitHub Actions, environnements et qualité |
| ADR liés | ADR-0001, ADR-0002, ADR-0006, ADR-0007, ADR-0009, ADR-0024, ADR-0028 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Le repository npm regroupe 11 applications TypeScript : 3 Next.js, 3 services plateforme NestJS et 5 Plugin APIs NestJS. Le monorepo ne doit pas contraindre un déploiement simultané de tous les services, ni accepter un pipeline « vert » qui saute silencieusement les tests manquants. L'environnement actuel contient Compose PostgreSQL/pgvector, Redis et MinIO pour le développement, mais pas encore de déploiement de production décidé.

## 2. Décision

**La CI valide la cohérence du monorepo ; les livrables restent par service.** Le `package-lock.json` racine approuvé est l'unique source de résolution npm ; utiliser `npm ci` dans CI. Exécuter lint non mutatif, typecheck, build et tests réels des workspaces initialisés, ainsi que validation des contrats OpenAPI, tests de frontière et scans de dépendances/secrets. Tant qu'une application n'a pas de suite de tests, documenter explicitement le manque ; ne pas masquer son absence avec un script `exit 0`.

**Images indépendantes.** Chaque service déployable possède un Dockerfile minimal, un healthcheck approprié, variables documentées et artefacts versionnés. Les Docker builds Next/Nest du monorepo utilisent un contexte qui contient `package-lock.json` racine et les `packages/*` requis. Les déploiements sélectifs peuvent être déclenchés par graphe de dépendances et changements de contrats, avec tests d'intégration des consommateurs avant publication.

**Environnements :** local, environnement de validation et production, avec secrets séparés, migrations SQL par propriétaire, stratégie expand/contract, rollback ou roll-forward selon compatibilité, sauvegardes et journal de release. Choisir un orchestrateur/hosting production après tests réels de coûts et charge ; ne pas prescrire Kubernetes sans besoin démontré.

**Pyramide de tests :** unitaires par service ; contrats fournisseurs-consommateurs ; intégration PostgreSQL/Redis/MinIO et workers ; E2E d'onboarding, permissions inter-tenant, révocation, Knowledge et Analytics ; tests de charge et sécurité sur parcours sensibles. Éviter de prendre la route `/health` pour une preuve de fonctionnalités métier.

## 3. Alternatives examinées

- **Build et déploiement commun de tout à chaque changement :** simple à démarrer, mais contraire à l'indépendance visée à terme.
- **Un pipeline par repository :** non pertinent dans le monorepo retenu.
- **Déployer directement depuis `main` sans contrôles :** risque inutile pour un SaaS contenant des données sensibles.

## 4. Conséquences et compromis

Reproductibilité, livrables versionnés et validations adaptées ; les tests cross-service demandent une infrastructure CI plus lourde que les tests des squelettes. Les règles de protection `main` et checks requis doivent être activées uniquement après exécution réussie et identification des noms exacts des jobs.

## 5. Sécurité et isolation

Images minimales, scans CVE/dépendances, permissions GitHub Actions minimales, pas de secrets dans artefacts ou PR externes, approbations pour migrations sensibles, signatures/provenance d'images selon maturité. Les environnements ne partagent pas des credentials ou datasets clients non anonymisés.

## 6. État et mise en œuvre

**Existant :** scaffolds et commandes racine prévus ; l'état précis du lockfile et des workflows doit être vérifié sur le repository courant. **À faire :** CI npm, jobs Python uv, Dockerfiles monorepo-aware, tests intégration et procédure de release. Aucun hébergeur production ni résultat de pipeline n'est supposé décidé.

## 7. Critères de validation

- Un checkout vierge s'installe via `npm ci` après validation du lockfile.
- Une rupture de contrat ou un test multi-tenant en échec bloque une PR.
- Chaque image embarque son service et démarre avec config par environnement.
- Une mise à jour d'un plugin compatible ne force pas la migration des tables d'un autre.
- Les étapes de restauration, migration et rollback/roll-forward sont exercées avant production.

## 8. Traçabilité

- ADR liés : ADR-0001, ADR-0002, ADR-0006, ADR-0007, ADR-0009, ADR-0024, ADR-0028.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
