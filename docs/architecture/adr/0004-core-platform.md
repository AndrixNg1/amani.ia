---
title: "ADR-0004 — Core Platform API et frontières des domaines centraux"
status: "Accepté"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0004 — Core Platform API et frontières des domaines centraux

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté** |
| Date | 27 septembre 2026 |
| Portée | apps/core-api : organisations, IAM, rôles, permissions, registry et entitlements |
| ADR liés | ADR-0002, ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0015, ADR-0016 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Le Core Platform détient les vérités métier communes à toutes les capacités Amani IA. Sans autorité claire, chaque plugin pourrait maintenir sa propre liste d'employés, plans et droits ; la révocation deviendrait incohérente. Le service NestJS existe mais ne possède pas encore ces modules métiers opérationnels.

## 2. Décision

**Core Platform API est propriétaire des identités métier et de la gouvernance SaaS** : utilisateurs, organisations, adhésions utilisateur-organisation, équipes, rôles et attributions, permissions, plans, entitlements, catalogue des plugins, installations, gouvernance plateforme et audit des actions centrales.

Conserver une structure interne en modules NestJS à frontières explicites, par exemple `identity`, `organizations`, `memberships`, `authorization`, `plugin-registry`, `subscriptions`, `platform-admin` et `audit`. Les contrats externes exposent des commandes et des lectures cohérentes ; un plugin ne peut pas importer le module NestJS `authorization` directement.

Le Core maintient la **politique commune** (droit d'utiliser un plugin, appartenance, permission de rôle). Le plugin combine cette décision avec **sa politique de ressource**, par exemple une ACL de document ou de dataset qu'il possède. Le Core n'héberge ni chunks Knowledge, ni datasets, ni conversation détaillée.

Une installation de plugin est une relation `organization ↔ plugin-version/configuration` assortie d'un état et d'entitlements ; son provisionnement doit être idempotent. Une désactivation n'efface pas automatiquement les données du plugin.

Les décisions sensibles peuvent émettre des événements versionnés : utilisateur retiré, rôle modifié, plugin suspendu. Ces événements accélèrent les invalidations mais ne remplacent pas une vérification fiable des droits courants.

## 3. Alternatives examinées

- **Répliquer utilisateurs et permissions dans chaque plugin :** autonomie locale séduisante, mais dérive et révocations incohérentes.
- **Faire du Core le propriétaire de toutes les tables :** contredit l'autonomie des Plugin APIs et élargit considérablement son rôle.
- **Service IAM externe comme unique modèle métier :** possible pour l'authentification, mais adhésions, plans et permissions du domaine Amani restent sous la responsabilité du Core.

## 4. Conséquences et compromis

Le Core est une dépendance de gouvernance partagée, donc sa disponibilité et ses API doivent être robustes. Les plugins doivent distinguer décisions fraîches, caches à durée limitée et refus conservateurs lorsque les droits ne peuvent pas être établis. Les migrations Core ne doivent pas exiger des lectures directes depuis les bases plugins.

## 5. Sécurité et isolation

Les rôles d'Admin SaaS sont séparés des rôles propriétaires/administrateurs d'organisation. Une permission globale de plateforme ne donne pas automatiquement lecture des documents privés. Toutes les commandes de changement de rôle, d'installation ou de facturation produisent une trace d'audit et vérifient les autorisations d'administration.

## 6. État et mise en œuvre

**Existant :** squelette `@amani/core-api` sur 4001 et route liveness. **À réaliser :** schémas PostgreSQL propres, migrations, endpoints IAM et organisations, policy API, événements d'invalidation et tests transversaux. Le fournisseur d'identité et le protocole de jeton seront documentés à l'ADR-0011.

## 7. Critères de validation

- Un même utilisateur appartient à deux organisations avec des rôles différents.
- Un administrateur de l'organisation A ne peut pas administrer B.
- Un plugin ne peut pas installer un entitlement absent ni ignorer un état `suspended`.
- La suppression d'une adhésion invalide les nouvelles autorisations et les traitements en attente.
- Les contrats API ne révèlent aucune table interne ni secret d'un autre service.

## 8. Traçabilité

- ADR liés : ADR-0002, ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0015, ADR-0016.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
