---
title: "ADR-0001 — Monorepo npm et organisation du repository"
subtitle: "Amani IA — Architecture Decision Record"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0001 — Monorepo npm et organisation du repository

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté** — décision d'architecture ; validation technique progressive |
| Date | 27 septembre 2026 |
| Portée | Repository, applications Next.js/NestJS, plugins, packages, workers et CI |
| Remplace | Aucun ADR : documentation initiale de la nouvelle architecture |
| ADR liés | ADR-0002 (backend par plugins), ADR-0005 (appels interservices), ADR-0007 (contrats), ADR-0029 (déploiement et CI/CD) |

## 1. Contexte

Amani IA est une plateforme SaaS multi-tenant dans laquelle des entreprises activent des plugins d'IA, attribuent des rôles à leurs collaborateurs et limitent l'accès aux données jusque dans les réponses générées. Le système comprend plusieurs applications Next.js, des API NestJS indépendantes, des workers et une infrastructure de développement commune.

Le repository `amani.ia` possède déjà des fondations pour **11 applications TypeScript** : trois frontends Next.js (`website`, `enterprise`, `admin`), trois services de plateforme NestJS (`gateway`, `core-api`, `ai-orchestrator`) et cinq Plugin APIs NestJS (`knowledge`, `data-analytics`, `conversations`, `connectors`, `evaluation`). Les répertoires `packages/` et `workers/` sont réservés à des composants qui seront initialisés progressivement.

Nous devons pouvoir modifier les contrats entre services, développer les frontends et maintenir les plugins ensemble, sans imposer un déploiement commun de toutes les applications. L'existence d'un répertoire ou d'un projet initialisé ne signifie pas que ses fonctionnalités métier ou ses intégrations sont déjà opérationnelles.

## 2. Décision

### 2.1. Un repository Git unique

L'ensemble des sources de la plateforme est conservé dans **un monorepo Git**, nommé `amani.ia` sur GitHub. Les frontières logiques et de déploiement se trouvent au niveau des applications, et non au niveau des repositories.

Les principaux répertoires sont :

- `apps/` : Gateway, Core Platform, AI Orchestrator et trois frontends Next.js ;
- `plugins/` : une application NestJS par plugin ;
- `workers/` : traitements documentaires et Python Data Engine ;
- `packages/` : contrats, types, configuration, SDK, prompts et composants UI lorsqu'ils sont effectivement initialisés ;
- `infrastructure/` : Docker, PostgreSQL/pgvector, Redis, stockage et observabilité ;
- `docs/architecture/adr/` et `docs/architecture/diagrams/` : décisions et représentations de l'architecture ;
- `tests/` : tests de contrats, d'intégration et de bout en bout entre services.

### 2.2. npm workspaces comme gestionnaire TypeScript

Le fichier **`package.json` à la racine** définit les workspaces :

```json
{
  "private": true,
  "workspaces": ["apps/*", "plugins/*", "packages/*"]
}
```

Chaque application ou package TypeScript initialisé conserve son propre `package.json`, avec un nom stable sous le scope `@amani/*` et les scripts qui lui correspondent. Les répertoires sans `package.json` ne sont pas considérés comme des packages installables.

La référence de résolution des dépendances est **un seul `package-lock.json` à la racine**, généré et maintenu par npm. Les anciens lockfiles enfants ne doivent plus servir après la migration. `npm install` est exécuté à la racine ; `npm ci` est utilisé pour les installations reproductibles une fois le lockfile racine validé. La suppression éventuelle des anciens lockfiles et `node_modules` reste une opération manuelle contrôlée par le propriétaire du repository.

Aucun fichier `npm-workspace.yaml` ou `pnpm-workspace.yaml` ne doit être utilisé pour configurer npm.

### 2.3. Applications autonomes malgré le monorepo

Chaque API NestJS est un processus autonome avec son propre point d'entrée, sa configuration, ses tests et son artefact de déploiement. Chaque frontend Next.js est une application autonome. Une modification du monorepo n'oblige pas à reconstruire et redéployer tous les services si leurs dépendances et contrats ne changent pas.

Les Plugin APIs ne doivent **pas importer** les services internes, les dépôts de données ni les entités de persistance d'autres applications. La communication interservices passera par des contrats d'API et, lorsque nécessaire, des événements versionnés. Les choix précis de protocole seront documentés dans les ADR spécialisés.

### 2.4. Packages partagés limités aux véritables contrats communs

Les futurs packages peuvent contenir des schémas d'échange, des clients API générés, des composants UI, des types de transport, des outils transversaux et des configurations. Ils ne doivent ni centraliser toute la logique métier, ni partager des accès directs aux bases de données des services.

Le préfixe `@amani/*` est réservé aux packages internes de la plateforme ; ces packages restent privés tant qu'aucune publication n'est décidée.

### 2.5. Workers et dépendances non TypeScript

Le Python Data Engine conservera son propre environnement et son propre système de dépendances, notamment **uv** lorsqu'il sera initialisé. Il n'est pas géré artificiellement comme un package npm. Le worker documentaire recevra sa technologie d'exécution lors de sa conception détaillée ; son emplacement sous `workers/` ne présume pas encore de sa mise en œuvre.

### 2.6. Conventions de développement et de build

Les scripts racine pilotent les workspaces initialisés, tandis que les scripts propres à chaque service permettent de les démarrer ou de les tester séparément. Les noms et ports actuellement documentés sont :

- Next.js : `@amani/website` (3000), `@amani/enterprise` (3001), `@amani/admin` (3002) ;
- NestJS plateforme : `@amani/gateway` (4000), `@amani/core-api` (4001), `@amani/ai-orchestrator` (4002) ;
- NestJS plugins : `@amani/knowledge` (4101), `@amani/data-analytics` (4102), `@amani/conversations` (4103), `@amani/connectors` (4104), `@amani/evaluation` (4105).

Les builds Docker qui consomment des workspaces TypeScript utiliseront un contexte contenant le `package-lock.json` racine et les packages locaux nécessaires. Les pipelines CI devront vérifier les vrais scripts et ne pas masquer l'absence de tests par des scripts fictifs.

## 3. Alternatives étudiées

**Un repository par service.** Offre une séparation forte des équipes et des cycles de publication, mais multiplie dès la V1 la maintenance des contrats, les changements coordonnés, les workflows et les versions de packages internes.

**Un backend NestJS unique en monolithe modulaire.** Simplifie initialement le déploiement et les appels, mais ne répond pas au choix produit de Plugin APIs déployables et extensibles indépendamment. Le monorepo ne doit pas devenir un prétexte pour réintroduire cette dépendance forte.

**pnpm workspaces plutôt que npm.** Les deux solutions conviennent à un monorepo TypeScript. npm est retenu parce que les projets ont déjà été créés avec npm et que le propriétaire souhaite conserver cet outil ; un changement de gestionnaire ajouterait une migration sans avantage indispensable à ce stade.

## 4. Conséquences

**Bénéfices** : un historique Git cohérent, des modifications transversales plus simples, des contrats et composants UI partagés, une intégration continue commune et un démarrage local standardisé.

**Coûts et contraintes** : configuration CI plus exigeante, gestion rigoureuse du lockfile racine, risques de dépendances implicites et nécessité de préserver des frontières fortes entre applications. Les déploiements indépendants supposent des Dockerfiles, une sélection de builds et des tests de contrats adaptés.

## 5. Sécurité et isolation

La présence de tous les services dans le même monorepo n'implique **aucune confiance automatique** entre eux. Aucun frontend ne reçoit de secret interservices. Les identités de service, les rôles propres à chaque entreprise et les droits sur les documents/datasets seront validés côté backend. Le partage d'un package ne doit pas permettre à un service de contourner les API ou les politiques d'accès d'un autre.

Ces principes sont des **exigences d'architecture** : le présent ADR ne prétend pas que l'authentification, l'isolation multi-tenant ou l'IA sensible aux permissions sont déjà implémentées.

## 6. État d'implémentation et vérification

Les onze projets TypeScript et les répertoires d'organisation existent comme fondations. L'intégration métier, les clients backend-to-backend, les migrations PostgreSQL par service et les workers opérationnels sont des étapes ultérieures. Les validations npm, tests et builds doivent être consignés en fonction de ce qui a réellement été exécuté sur le repository courant.

Après la revue du lockfile et l'installation manuelle par le propriétaire, vérifier au minimum la résolution des workspaces, les scripts de lint/typecheck/build, les tests applicatifs existants et les endpoints de santé. Un test de santé ne démontre ni l'autorisation ni le fonctionnement d'une communication interservices.

## 7. Traçabilité

L’**ADR-0002 — Architecture backend par API et plugins indépendants** détaille le découpage des services, leur autonomie, leurs frontières métier et le modèle de déploiement partagé par les entreprises. Les diagrammes seront réalisés **après la rédaction des ADR**, puis liés aux décisions correspondantes.
