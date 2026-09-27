---
title: "ADR-0007 — Contrats OpenAPI, SDK et versionnement des API"
status: "Proposé"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0007 — Contrats OpenAPI, SDK et versionnement des API

| Métadonnée | Valeur |
|---|---|
| Statut | **Proposé** |
| Date | 27 septembre 2026 |
| Portée | packages/contracts, packages/sdk, schémas partagés et tests de compatibilité |
| ADR liés | ADR-0001, ADR-0002, ADR-0005, ADR-0006, ADR-0029 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Le monorepo rassemble tous les composants mais cela ne rend pas les API internes compatibles automatiquement. Les frontends, Gateway, Orchestrator et plugins ont besoin d'accords clairs sur les champs, erreurs, scopes et versions, indépendamment du langage utilisé par le consommateur (TypeScript ou Python). Les dossiers `packages/contracts` et `packages/sdk` existent mais restent non initialisés.

## 2. Décision

**Maintenir un contrat public explicite pour chaque service** : spécification OpenAPI, schémas de requête/réponse, erreurs normalisées, codes d'autorisation, pagination, version de contrat et exemples synthétiques. Le contrat est conservé dans `packages/contracts` ou dans le service propriétaire avec publication automatisée vers le package ; une seule source fait autorité pour chaque route.

Les clients du Gateway, des frontends serveur et de l'Orchestrator utilisent un SDK maintenu ou généré ; ils ne dépendent pas d'entités ORM ou de DTO internes importés directement. Pour les événements, définir des schémas dédiés avec type, version, messageId, organizationId lorsque pertinent, occurredAt et règles de compatibilité.

**Politique proposée :** changements rétrocompatibles mineurs ; changement incompatible par nouvelle version d'API ou période de coexistence documentée. Champs ajoutés facultatifs par défaut ; suppression ou changement de sémantique demande un plan de migration consommateur. Les headers sécurisés et modèles d'erreur figurent dans le contrat sans révéler les mécanismes secrets.

Les tests de contrats s'exécutent en CI sur les routes exposées et les clients critiques ; publier un changelog dès qu'une interface consommée évolue.

## 3. Alternatives examinées

- **Imports TS directs entre applications :** tentants en monorepo, mais couplent les services et excluent Python.
- **Schémas implicites déduits du code client :** divergence silencieuse et rupture tardive.
- **GraphQL global dès le départ :** ne résout pas à lui seul les contrats entre services et impose une couche supplémentaire non nécessaire à la V1.

## 4. Conséquences et compromis

Contrats lisibles, revues de sécurité et changements indépendants facilités. En contrepartie, génération, synchronisation et vérification des versions demandent de l'outillage. Un SDK ne doit pas contourner l'API propriétaire en allant lire la base directement.

## 5. Sécurité et isolation

Documenter les scopes par opération, codes `401/403/404` sans divulguer l'existence de ressources privées, propagation de la délégation utilisateur et règles de redaction. Les exemples n'utilisent que des identifiants et contenus factices.

## 6. État et mise en œuvre

**Existant :** dossiers placeholders. **À faire :** choisir l'outil OpenAPI dans chaque application NestJS, établir les premiers contrats `Core authorization` et `Knowledge search`, générer les clients, ajouter lint de schémas et contract tests. La stabilité de version est exigée avant un déploiement indépendant effectif.

## 7. Critères de validation

- Les modifications incompatibles d'un contrat détectées en CI provoquent un échec.
- Le SDK TypeScript et un client Python de test utilisent les mêmes schémas validés.
- Les opérations privées annoncent leurs exigences d'authentification.
- Une ancienne version encore annoncée supportée reste fonctionnelle durant sa fenêtre de migration.

## 8. Traçabilité

- ADR liés : ADR-0001, ADR-0002, ADR-0005, ADR-0006, ADR-0029.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
