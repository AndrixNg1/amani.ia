---
title: "ADR-0027 — Portail entreprise et interfaces fondées sur les permissions"
status: "Proposé"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0027 — Portail entreprise et interfaces fondées sur les permissions

| Métadonnée | Valeur |
|---|---|
| Statut | **Proposé** |
| Date | 27 septembre 2026 |
| Portée | apps/enterprise, gestion des collaborateurs, plugins et parcours utilisateur |
| ADR liés | ADR-0003, ADR-0004, ADR-0010, ADR-0012, ADR-0013, ADR-0015, ADR-0017, ADR-0025 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Le portail Enterprise réunit des collaborateurs ayant des rôles très différents : propriétaire, admin, responsable RH, analyste ou lecteur. Les clients souhaitent sélectionner des plugins à l'onboarding puis distribuer précisément les droits. Une interface identique pour tous ou des menus cachés uniquement côté React ne suffisent pas à représenter ni faire respecter ces droits. `apps/enterprise` existe comme squelette Next.js.

## 2. Décision

**Un seul portail Enterprise, rendu selon le contexte effectif du tenant et de l'utilisateur.** Prévoir sélection d'organisation active, onboarding/provisionnement, catalogue des plugins disponibles, page des installations, invitations, équipes, rôles personnalisés, écrans d'attribution des permissions et espaces d'utilisation Knowledge/Analytics/Conversations. Les opérations ne s'affichent que si l'autorisation a été vérifiée par une API ; les requêtes côté backend vérifient de nouveau systématiquement les mêmes droits.

Les droits de visibilité et d'action sont distincts : voir un plugin dans le catalogue n'autorise pas l'installation ; utiliser Knowledge n'autorise pas la lecture de tous les documents ; inviter un membre n'autorise pas à lui attribuer un rôle supérieur au sien. Chaque route tenant utilise l'organisation active et refuse les liens vers des ressources d'un autre tenant, indépendamment du navigateur.

Le portail affiche clairement les états `provisioning`, `active`, `disabled` et `failed` des plugins. Pour une réponse IA partielle en raison d'un périmètre d'accès limité, donner un message neutre (« données accessibles insuffisantes ») sans suggérer le nom ou le contenu de ressources interdites. Les citations et exports s'ouvrent via des opérations qui réautorisent l'accès.

## 3. Alternatives examinées

- **Un portail par rôle :** duplication du code et incohérence lors des changements de rôle.
- **Rôles codés en dur dans le frontend :** ne couvre pas les rôles personnalisés par entreprise.
- **Afficher toutes les ressources puis masquer par CSS :** fuite immédiate via HTML et réseau.

## 4. Conséquences et compromis

Expérience unifiée et administration des entreprises sans accès SaaS global ; nécessite un modèle de permissions stable et des composants UI d'état/erreur cohérents. Les droits peuvent changer durant une session et exigent rafraîchissement et refus serveur robustes.

## 5. Sécurité et isolation

Contrôler SSR/CSR, Server Actions, route handlers, uploads et exports ; ne jamais faire confiance à l'organizationId de l'URL seul. Éviter tout préchargement non autorisé et purge de caches côté client à la déconnexion/changement de tenant. Les messages de refus ne révèlent pas les noms de ressources cachées.

## 6. État et mise en œuvre

**Non implémenté au-delà du starter.** Commencer par login/tenant switch, liste des plugins, puis gestion des rôles et premier espace Knowledge après les API Core/Knowledge. Les pages de facturation réelle dépendent de l'ADR-0016 ; ne pas construire un paiement fictif présenté comme fonctionnel.

## 7. Critères de validation

- Un employé ne peut attribuer un rôle ou activer un plugin sans permission correspondante.
- Changer d'entreprise rafraîchit le contexte et efface les données mises en cache du précédent tenant.
- Anciennes conversations et exports respectent les droits révoqués.
- Les états partiels d'installation sont représentés correctement.
- Les tests E2E réalisent les mêmes actions via UI et API directe avec les mêmes résultats d'autorisation.

## 8. Traçabilité

- ADR liés : ADR-0003, ADR-0004, ADR-0010, ADR-0012, ADR-0013, ADR-0015, ADR-0017, ADR-0025.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
