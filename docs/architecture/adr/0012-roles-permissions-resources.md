---
title: "ADR-0012 — Rôles personnalisés, permissions et contrôle des ressources"
status: "Accepté"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0012 — Rôles personnalisés, permissions et contrôle des ressources

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté** |
| Date | 27 septembre 2026 |
| Portée | RBAC d’organisation, ACL, administration SaaS et calcul des droits effectifs |
| ADR liés | ADR-0004, ADR-0010, ADR-0011, ADR-0013, ADR-0015, ADR-0027 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Chaque entreprise doit pouvoir attribuer les accès de ses collaborateurs. Le fait d'avoir acheté ou activé Knowledge ne donne pas un droit de lecture global à tous les employés. Un utilisateur peut participer à plusieurs organisations ; les administrateurs Amani IA ne doivent pas être confondus avec les administrateurs d'un tenant. L'authentification ne suffit pas pour répondre à « qui peut faire quoi sur quelle ressource ? ».

## 2. Décision

**Adopter RBAC propre à chaque organisation + permissions granulaires et ACL de ressources.** Le Core gère les adhésions, rôles personnalisés, attributions de rôles et permissions abstraites, par exemple `knowledge.documents.read` ou `analytics.datasets.analyze`. Un propriétaire initial est créé lors de l'onboarding. Les administrateurs d'organisation peuvent attribuer des rôles et permissions **uniquement dans leur périmètre délégué**. Éviter que la personnalisation permette une escalade au-delà du propriétaire ou des contraintes du plan.

L'autorisation effective pour une action sensible requiert la **conjonction** de conditions : identité valide ; adhésion active dans le tenant ; abonnement/entitlement compatible ; plugin installé et activé ; rôle permettant l'opération ; autorisation sur le workspace ou la ressource ; contraintes de sensibilité, de statut et de durée. Le Core vérifie les attributs globaux, le plugin vérifie la décision et ses ACL locales. Une permission générale `knowledge.use` ne donne pas `knowledge.document.read` sur tous les documents.

Les équipes peuvent accélérer les attributions, mais la sémantique d'héritage/exception doit être explicite : refuser par défaut ; un refus explicite prévaut là où le modèle choisit de supporter des `deny`. Les propriétaires n'ont pas un droit illimité sur les données d'autres entreprises. Les droits liés au support Amani IA nécessitent un workflow séparé, limité dans le temps et audité.

Une modification de rôle, d'adhésion ou d'ACL invalide les caches et empêche les nouvelles récupérations, téléchargements et lectures d'historique non autorisés. Les traitements longs doivent réévaluer les droits avant de publier leurs résultats.

## 3. Alternatives examinées

- **Rôles globaux uniques :** incapables de représenter un utilisateur RH dans l'entreprise A et simple lecteur dans B.
- **ACL manuelles uniquement :** expressives mais pénibles à administrer sans rôles.
- **Confiance dans les menus frontend :** contournable par les appels directs, exports, caches et requêtes IA.

## 4. Conséquences et compromis

Flexibilité adaptée aux entreprises et protection des ressources sensibles. En contrepartie, la combinaison RBAC/ACL augmente la complexité et nécessite un simulateur/test des permissions ainsi qu'une documentation claire pour les administrateurs. Les refus doivent être compréhensibles sans révéler l'existence de documents secrets.

## 5. Sécurité et isolation

Toutes les décisions de lecture et d'écriture s'appliquent côté backend avant accès SQL/vectoriel ou génération d'URL signée. Isoler rôles plateforme et entreprise ; journaliser attribution/révocation, sans stocker dans les logs le contenu des documents. Des tests de régression doivent couvrir escalade horizontale et verticale.

## 6. État et mise en œuvre

**Architecture décidée, fonctionnalité non développée.** Modéliser `OrganizationMembership`, `Role`, `RoleAssignment`, `Permission`, `Team`, `ResourceGrant` et les états des plugins. Concevoir un point d'évaluation du Core et un `resource guard` dans chaque plugin. Construire l'UI d'attribution seulement après validation des API et tests de refus.

## 7. Critères de validation

- Un administrateur A n'assigne aucun rôle dans B.
- Deux utilisateurs de A disposant du même plugin mais d'ACL distinctes ne lisent pas le même ensemble de documents.
- Un rôle supprimé invalide nouveaux appels et accès aux résultats précédents.
- Les chemins de téléchargement, recherche et chat ne contournent pas l'ACL.
- Les décisions `allow/deny` sont testées sur une matrice de profils multi-tenant.

## 8. Traçabilité

- ADR liés : ADR-0004, ADR-0010, ADR-0011, ADR-0013, ADR-0015, ADR-0027.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
