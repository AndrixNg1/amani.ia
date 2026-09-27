---
title: "ADR-0016 — Abonnements, offres et droits d’activation des plugins"
status: "Proposé"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0016 — Abonnements, offres et droits d’activation des plugins

| Métadonnée | Valeur |
|---|---|
| Statut | **Proposé** |
| Date | 27 septembre 2026 |
| Portée | Plans SaaS, limites d’usage, entitlements et changement d’offre |
| ADR liés | ADR-0004, ADR-0012, ADR-0015, ADR-0017, ADR-0026 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Le parcours d'inscription prévoit le choix d'un plan puis des plugins. La plateforme doit différencier accès commercial et permissions utilisateur. Le prix, les devises, le prestataire de paiement et le modèle de facturation ne sont pas encore arrêtés ; l'architecture ne doit ni inventer un fournisseur ni bloquer la conception des plugins.

## 2. Décision

**Séparer `Plan`, `Subscription`, `Entitlement` et `OrganizationPluginInstallation`.** Le plan définit les capacités commerciales potentielles et quotas ; la souscription indique l'état contractuel d'une organisation ; l'entitlement représente un droit effectivement accordé ; l'installation est l'activation technique par le tenant. L'activation d'un plugin exige l'entitlement, mais le droit commercial ne donne jamais accès aux données sans rôle/ACL.

**Proposition V1 :** conserver une abstraction de facturation pilotée par le Core, avec états `trial/active/past_due/suspended/cancelled` à affiner avant paiement réel. Les modules plugins consultent les entitlements via API/cache à durée contrôlée. Définir des quotas explicites (stockage, utilisateurs, documents, analyses, appels IA) avec une unité, période et comportement en cas de dépassement ; ne pas mélanger limites techniques de débit et restrictions contractuelles.

Les changements d'offre suivent un workflow traçable, avec mise à jour des installations et période de grâce configurée. La suppression d'un entitlement **suspend l'accès**, pas automatiquement les documents ni le contenu des conversations. Tout webhook de facturation éventuel doit être vérifié, idempotent et rejouable.

## 3. Alternatives examinées

- **Abonnement booléen sur l'organisation :** insuffisant pour représenter plusieurs plans et plugins.
- **Contrôle de quotas dans le frontend :** contournable par appels directs.
- **Intégration immédiate à un prestataire de paiement :** prématurée avant fixation des offres et des obligations commerciales.

## 4. Conséquences et compromis

Catalogue de plans et droits évolutifs ; le domaine Core reste indépendant du futur prestataire de paiement. En contrepartie, un moteur de compteurs fiable et des événements de changement d'offre sont nécessaires pour éviter des incohérences entre API.

## 5. Sécurité et isolation

Vérifier autorisation de l'administrateur avant achat/configuration et protection contre replay/double paiement des webhooks. Les quotas sont contrôlés côté backend sous le tenant prouvé. Les exports ou anciennes conversations ne deviennent pas accessibles en raison d'un simple changement de plan.

## 6. État et mise en œuvre

**Aucune facturation opérationnelle n'est demandée maintenant.** Définir entités et interfaces, quelques plans synthétiques pour tests, schémas d'usage et states ; réserver le connecteur de paiement. Ne pas stocker d'informations de carte ni afficher de prix non décidés.

## 7. Critères de validation

- Une organisation ne peut installer un plugin hors de son entitlement.
- Changer de plan met à jour les droits sans effacer de données silencieusement.
- Deux appels concurrents n'outrepassent pas les limites si le quota doit être strict.
- Un événement de paiement dupliqué n'est pas appliqué deux fois.

## 8. Traçabilité

- ADR liés : ADR-0004, ADR-0012, ADR-0015, ADR-0017, ADR-0026.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
