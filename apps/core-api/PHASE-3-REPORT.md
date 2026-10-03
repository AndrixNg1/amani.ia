# Phase 3 — Core Platform API

Validation finale : 2 octobre 2026. Fondation Core implémentée et vérifiée localement.
Les routes métier sont volontairement fermées par défaut jusqu'à l'intégration de
l'authentification utilisateur/service. Aucun développement Gateway n'a été ajouté.

## A. Audit

Lecture des ADR 0001 à 0030, des documents d'architecture et d'autorisation, du
catalogue des diagrammes et des images 02/04/06/07/09/15/16. Inspection du starter
Core, des quatre packages partagés, de PostgreSQL et de la configuration npm/env.
Le Core ne contenait que le starter et la liveness ; aucun ORM n'était sélectionné.
Les décisions acceptées gouvernent les illustrations et les anciens états documentaires.

## B. Choix de persistance

Drizzle ORM 0.45.3 + node-postgres 8.23.0 : modèles internes typés, SQL paramétré,
transactions, contraintes PostgreSQL et migrations SQL explicites. Un seul ORM.
Aucune synchronisation automatique, création de schéma d'infrastructure ou lecture
des données d'un autre service. Le choix et les sources officielles figurent dans
[README.md](README.md#architecture-audit-and-choice). Un ADR de suivi du choix Core
reste à proposer, puisque les ADR 0008/0030 laissaient cette décision ouverte.

## C. Fichiers créés

Tous sous `apps/core-api/` :

```text
PHASE-3-REPORT.md
migrations/0001_core_platform.sql
scripts/setup-local-env.cjs
src/audit/audit.service.ts
src/authorization/authorization.service.ts
src/authorization/policy.controller.ts
src/common/config.spec.ts
src/common/config.ts
src/common/context.ts
src/common/dto.ts
src/common/http.ts
src/database/cli.ts
src/database/database.ts
src/database/migrate.ts
src/database/schema.ts
src/database/seed.ts
src/entitlements/entitlements.service.ts
src/health/health.controller.ts
src/memberships/memberships.controller.ts
src/memberships/memberships.service.ts
src/organizations/organizations.controller.ts
src/organizations/organizations.service.ts
src/permissions/permissions.service.ts
src/plans/catalog.controller.ts
src/plans/plans.service.ts
src/plugins/lifecycle.spec.ts
src/plugins/lifecycle.ts
src/plugins/plugins.controller.ts
src/plugins/plugins.service.ts
src/roles/roles.controller.ts
src/roles/roles.service.ts
src/teams/teams.controller.ts
src/teams/teams.service.ts
src/users/users.controller.ts
src/users/users.service.ts
test/core.integration-spec.ts
test/jest-integration.json
```

## D. Fichiers modifiés

Dans Core : `.env.example`, `README.md`, `package.json`, `src/app.controller.ts`,
`src/app.module.ts`, `src/main.ts`, `test/app.e2e-spec.ts`.
Hors Core : **seulement `package-lock.json`**, actualisé par le `npm install` exécuté
par le propriétaire. Le `.env` local ignoré par Git a reçu les clés manquantes,
sans écraser les valeurs existantes, avec permissions 600 et sans affichage des secrets.
Aucun fichier d'infrastructure, package partagé ou autre application n'a été modifié.

## E. Structure finale

`common`, `database`, `users`, `organizations`, `memberships`, `teams`, `roles`,
`permissions`, `plugins`, `plans`, `entitlements`, `authorization`, `audit`, `health`.
Nest compose les modules et contrôleurs dans `AppModule`, avec garde globale.
Les dépendances descendent vers Database/Authorization puis Audit, sans cycle Nest.
Voir l'arborescence complète du [README](README.md#module-structure).

## F. Tables créées

18 tables métier dans `core_platform` : `users`, `organizations`, `memberships`,
`teams`, `team_memberships`, `roles`, `permissions`, `role_permissions`,
`membership_roles`, `platform_roles`, `user_platform_roles`, `plugins`,
`plugin_versions`, `organization_plugin_installations`, `plans`, `plan_entitlements`,
`organization_subscriptions`, `audit_events`.
`schema_migrations` ajoute le suivi des migrations, soit **19 tables au total**.

## G. Migrations

`migrations/0001_core_platform.sql`, exécutée par `src/database/migrate.ts` et la CLI.
Compte fixe `amani_core_platform`, transaction, verrou consultatif, checksum SHA-256,
rejeu identique sans duplication, refus si une migration appliquée a changé.
Migration appliquée à la base locale puis rejouée avec succès. Aucun rollback
destructeur automatique ; les futures évolutions exigent de nouvelles migrations.

## H. Relations et contraintes

UUID, email normalisé unique, slug unique, appartenance unique organisation/utilisateur,
plusieurs rôles par membre, clés composites organisation/objet, contraintes de statut,
clés de permission et plugin uniques, installation unique organisation/plugin,
version obligatoirement rattachée au bon plugin, index des parcours principaux.
Toutes les clés étrangères métier restent dans `core_platform`.

## I. Autorisation

Refus par défaut ; utilisateur, organisation et appartenance actifs ; union des
permissions des rôles dans le tenant. Contrôle frais des entitlements/installations
pour les permissions de plugins. Aucune confiance dans les en-têtes d'identité.
Les décisions internes explicitent allowed/reason/user/organization/permission.
Les contrôleurs utilisent un vérificateur d'identité qui **refuse tout par défaut**.
L'authentification cryptographique sera ajoutée ultérieurement.

Les rôles système sont protégés. Le propriétaire peut déléguer les permissions du
catalogue tenant ; les autres gestionnaires ne peuvent déléguer que leurs propres
droits effectifs. Modification des droits système, attribution/retrait du rôle owner
et désactivation du propriétaire sont refusés. Transfert de propriété à concevoir.
Les rôles plateforme ne donnent aucune appartenance ni lecture tenant implicite.

## J. Isolation des organisations

Comparaison du contexte de l'acteur avec l'organisation demandée, requêtes par tenant
et ID, clés étrangères composites et verrouillage de l'organisation avant les mutations
et leur revalidation. Tests négatifs via services, HTTP et SQL direct. Pas de RLS ni
d'ACL de documents/datasets dans Core ; ces dernières restent aux Plugin APIs.

## K. Plugins

Registre et versions séparés des installations par organisation. États ADR :
requested, provisioning, active, suspended, disabled, deprovisioning, failed.
Available est un état de catalogue. Requête d'installation idempotente ; désactivation
sans suppression des données. Progression vers activation réservée au service de
contrôle plateforme, sans prétendre exécuter le provisionnement réel des Plugin APIs.
Le seed fournit les cinq plugins officiels et des versions de développement explicites.

## L. Plans et entitlements

Plans, capacités activables et abonnement courant par organisation. L'accès exige
un plan actif, un abonnement active/trial dans sa période de validité et la capacité
activée. Aucun paiement, facturation, quota effectif ou intégration Stripe.
Le plan `development-all` est synthétique ; aucun client n'y est automatiquement abonné.

## M. Audit

Écriture atomique avec les mutations sensibles : acteur, organisation éventuelle,
action, cible, résultat, corrélation, date et métadonnées autorisées explicitement.
Pas de mot de passe, token, corps de requête ou contenu plugin. Pas d'API de modification
ou suppression de l'audit. Immutabilité face au propriétaire SQL, rétention et audit
des échecs restent à préparer pour la production.

## N. Tests

**37 tests au total :** 6 unitaires, 9 HTTP, 22 d'intégration PostgreSQL.
Ils couvrent création/rollback d'organisation, propriétaire, unicité, multi-appartenance,
rôles personnalisés, attributions/révocations, membres inactifs, utilisateurs/tenants
suspendus, séparation plateforme, ID étrangers, contraintes composites, équipes,
états/versions/installations plugins, entitlements, expiration, plans désactivés,
audit, DTO, réponses expurgées et portée des identités vérifiées de test.
Les tests HTTP sans vérificateur artificiel confirment le refus des identités forgées.

## O. Validations réellement exécutées

| Contrôle | Résultat |
| --- | --- |
| Build des quatre packages partagés | PASS |
| `lint:check` Core, sans avertissement | PASS |
| `typecheck` Core | PASS |
| Tests unitaires : 6 | PASS |
| Tests HTTP : 9 | PASS |
| Tests PostgreSQL : 22, schéma initialement vide puis déjà migré | PASS |
| Migration et seed dans transaction de test, annulation complète | PASS |
| Vérification après annulation initiale : zéro table Core | PASS |
| CLI migration persistante puis rejeu | PASS |
| CLI seed de développement puis rejeu | PASS |
| Build Nest avec construction préalable des packages partagés | PASS |
| Démarrage de `dist/main.js` sur port loopback temporaire | PASS |
| Liveness 200, readiness PostgreSQL réelle 200, identité HTTP forgée 403 | PASS |
| `check:structure` racine | PASS — contrôle statique uniquement |
| `git diff --check` et syntaxe du script de configuration | PASS |

Après migration/seed : 19 tables, 5 plugins, 16 permissions, 1 plan synthétique,
**0 utilisateur et 0 organisation**. L'application démarrée pour vérification a été
arrêtée proprement. Les conteneurs démarrés par le propriétaire restent disponibles.

## P. Validations non exécutées

NOT RUN : authentification cryptographique réelle, intégration Gateway/Plugin APIs,
charge/concurrence sur plusieurs connexions, injection de panne réseau au commit,
TLS de production, restauration et durcissement des comptes de production.
Ces composants/parcours sont hors phase ou non implémentés.

NOT RUN : suites globales de toutes les autres applications. Le contrôle de structure
signale que plusieurs workspaces n'ont pas de script `test` ; aucun PASS global n'est
annoncé. Aucune validation Core ne reste bloquée par les dépendances ou PostgreSQL.

## Q. Dépendances

Déclarées puis installées par le propriétaire via `npm install` racine :
`drizzle-orm@0.45.3`, `pg@8.23.0`, `class-validator@0.15.1`,
`class-transformer@0.5.1`, `@types/pg@8.23.1`, et les quatre workspaces
`@amani/types`, `@amani/contracts`, `@amani/config`, `@amani/shared` en 0.1.0.
Aucune installation n'a été exécutée par l'agent. Aucun autre ajout à installer
n'est actuellement en attente.

## R. Commandes manuelles

**Sur ce poste, configuration, migration, seed et vérifications ont déjà été exécutés.**
Pour lancer le Core maintenant :

```bash
cd /home/andrix-ng/Bureau/amani.ia
npm run dev:core
```

Dans un second terminal :

```bash
curl --fail http://127.0.0.1:4001/health
curl --fail http://127.0.0.1:4001/health/ready
```

Pour reproduire toute l'étape sur un checkout préparé avec les images d'infrastructure
locales existantes, exécuter chaque commande dans l'ordre et arrêter en cas d'erreur :

```bash
cd /home/andrix-ng/Bureau/amani.ia
npm install
npm run env:local --workspace=@amani/core-api
npm run infra:up -- --no-build --pull never
npm run build --workspace=@amani/core-api
npm run db:migrate --workspace=@amani/core-api
npm run db:seed --workspace=@amani/core-api
npm run lint:check --workspace=@amani/core-api
npm run typecheck --workspace=@amani/core-api
npm run test --workspace=@amani/core-api -- --runInBand
npm run test:e2e --workspace=@amani/core-api -- --runInBand
CORE_DB_TESTS=true npm run test:integration --workspace=@amani/core-api
npm run start:prod --workspace=@amani/core-api
```

Le seed est optionnel et limité au développement/test. Aucun `git add`, `git commit`
ou `git push` n'a été exécuté. Ne pas ajouter les fichiers `.env` au commit.

## S. ADR

Aucun conflit avec une décision acceptée. ADR complémentaire recommandé pour le
choix Drizzle/migrations de Core. Les identités, rôles et paramètres suggérés dans
certains PNG ne remplacent pas les invariants des ADR. Aucun changement d'infrastructure.

## T. Suite avant le trafic Gateway réel

Intégrer le fournisseur d'identité, le vérificateur cryptographique et la délégation
bornée ; concevoir l'initialisation légitime des premiers comptes ; contractualiser
les endpoints et leur version ; ajouter les tests interservices. Les API métier
resteront 403 jusqu'à cette intégration. Les ACL de ressources restent aux plugins.
Pagination complète, production, télémétrie, invitations, transfert owner et workflows
de provisionnement/billing sont explicitement documentés comme travaux ultérieurs.

## U. Commit proposé

```text
feat(core-api): add tenant domain, authorization and plugin governance
```
