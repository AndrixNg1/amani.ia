---
title: "ADR-0025 — Trois applications Next.js indépendantes"
status: "Accepté"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0025 — Trois applications Next.js indépendantes

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté** |
| Date | 27 septembre 2026 |
| Portée | apps/website, apps/admin, apps/enterprise et packages/ui |
| ADR liés | ADR-0001, ADR-0003, ADR-0011, ADR-0012, ADR-0015, ADR-0026, ADR-0027 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Amani IA dessert trois publics distincts : visiteurs du site, administrateurs/modérateurs de la plateforme SaaS et collaborateurs des entreprises clientes. Regrouper tous ces profils dans une seule application rendrait plus difficile la distinction des interfaces et des surfaces de sécurité. Les trois applications Next.js App Router existent déjà comme squelettes, avec des ports locaux documentés : Website 3000, Enterprise 3001 et Admin 3002.

## 2. Décision

**Conserver trois applications Next.js dans `apps/`** : `website` pour marketing, description des plugins et onboarding public ; `admin` pour l'administration de la plateforme et la modération ; `enterprise` pour les espaces d'entreprise, activation des plugins, rôles, documents, datasets et conversations. Chaque application garde sa configuration, ses tests, son déploiement et ses routes indépendants.

**Un portail Enterprise pour plusieurs rôles, pas un frontend par rôle.** L'UI ajuste la navigation, les actions et les listes selon les permissions effectives fournies par Core et plugins. La disparition d'un bouton ne remplace jamais un refus backend. L'admin SaaS utilise une autorisation plateforme indépendante ; son accès ne donne pas automatiquement lecture du contenu confidentiel des entreprises.

**Bibliothèques communes limitées :** design system et composants accessibles dans `packages/ui` une fois initialisé ; SDK API versionnés dans `packages/sdk` ; types de transport dans `packages/types/contracts`. Éviter de partager du code serveur contenant secrets, accès SQL ou politiques internes avec les bundles client.

**Accès réseau :** les demandes passent par Gateway ; la possibilité de Backend for Frontend/route handlers Next.js pour gestion sécurisée des sessions est permise, sans devenir une voie de contournement des contrôles du Gateway et des Plugin APIs. Un token de service ne doit pas apparaître dans les variables `NEXT_PUBLIC_*`.

## 3. Alternatives examinées

- **Une unique application Next.js pour tous les publics :** duplication moindre mais frontière SaaS/tenant plus ambiguë.
- **Un frontend pour chaque plugin :** fragmentation de l'UX et multiplie les flux de session ; non retenu pour la V1.
- **Tout faire en rendu client avec accès direct aux plugins :** exposition de surface et gestion des secrets défavorables.

## 4. Conséquences et compromis

Séparation des parcours et déploiements indépendants ; coût de maintenance de trois applications et nécessité de maintenir un design system/contrats cohérents. Un utilisateur invité à plusieurs organisations doit sélectionner un contexte explicite avant les opérations sensibles.

## 5. Sécurité et isolation

Protection backend systématique, sessions sécurisées, mécanisme CSRF approprié, anti-XSS, limites d'uploads, séparation Admin/Enterprise dans les routes et API. Le rendu serveur ne justifie pas d'utiliser des droits de service à la place des droits de l'utilisateur lorsqu'il lit des données privées.

## 6. État et mise en œuvre

**Existant :** trois Next.js scaffolds, ports dev 3000/3001/3002, pages starter. **À faire :** session réelle, routes publiques/admin/tenant, SDK et UI partagée, chargement sécurisé des permissions, tests de navigation, erreurs 403 et E2E des parcours. Aucune interface métier n'est présumée terminée.

## 7. Critères de validation

- L'Admin SaaS ne peut utiliser des APIs Enterprise sans l'autorisation métier requise.
- Un employé ne voit pas un plugin désactivé et une URL directe est également refusée côté backend.
- Les clients Next ne contiennent aucun secret de service dans les bundles publics.
- Les trois applications buildent et se démarrent indépendamment.
- Les changements de rôle se répercutent sur les permissions et vues sans confiance dans une session obsolète.

## 8. Traçabilité

- ADR liés : ADR-0001, ADR-0003, ADR-0011, ADR-0012, ADR-0015, ADR-0026, ADR-0027.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
