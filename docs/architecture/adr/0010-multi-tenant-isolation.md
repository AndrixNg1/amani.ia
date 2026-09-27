---
title: "ADR-0010 — Architecture multi-tenant et isolation des entreprises"
status: "Accepté"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0010 — Architecture multi-tenant et isolation des entreprises

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté** |
| Date | 27 septembre 2026 |
| Portée | Contexte tenant, ACL, persistence, fichiers, caches, jobs et observabilité |
| ADR liés | ADR-0004, ADR-0008, ADR-0009, ADR-0011, ADR-0012, ADR-0013, ADR-0014 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Une seule infrastructure Amani IA servira plusieurs entreprises. Un collaborateur peut appartenir à plusieurs organisations avec des droits différents. Le risque majeur est la divulgation interentreprises au travers des API, des embeddings, des analyses, des conversations ou des résultats de jobs. Les projets actuels ne disposent pas encore de mécanismes de tenant isolation métier ; le modèle doit être défini avant toute donnée réelle.

## 2. Décision

**L'organisation est la frontière de confidentialité par défaut.** Chaque requête métier possède un tenant actif déterminé par le contexte d'identité vérifié et l'adhésion courante, non par la simple valeur d'un paramètre de route ou header. Les ressources possédées par les plugins incluent `organizationId` et leur ACL. Les utilisateurs multi-organisations sélectionnent un tenant actif et ne combinent pas implicitement ses données avec celles d'un autre.

**L'isolation s'applique à toutes les couches :** routes, requêtes SQL et vectorielles, stockage objet et URL signées, clés/cache Redis, queue/job payloads, historiques de conversation, résultats d'analyse, embeddings, exports, logs et métriques. Les identifiants opaques ne sont pas des autorisations. Les processus workers réévaluent le contexte au moment de l'accès, pas seulement à la création du job.

**Stratégie initiale :** services partagés et isolation logique vérifiée, données SQL propriétaires par service et filtrage obligatoire `organizationId`. PostgreSQL Row-Level Security peut ajouter une défense en profondeur après validation des connexions et du contexte transactionnel ; ce n'est pas un substitut au contrôle applicatif ni une garantie universelle pour toutes les requêtes vectorielles.

Tout partage interentreprises futur exige un mécanisme explicitement modélisé et audité, non un assouplissement des filtres. Les administrateurs de la plateforme ne disposent pas automatiquement d'un droit de lecture des documents clients.

## 3. Alternatives examinées

- **Conteneurs et bases dédiés par tenant :** isolation plus forte, mais administration et coûts élevés ; possible pour une offre spécifique future.
- **Tenant déduit uniquement de l'URL :** facilement falsifiable.
- **Filtrage au seul frontend ou au seul Orchestrator :** laisse ouvertes les API directes, jobs et exports ; rejeté.

## 4. Conséquences et compromis

Une plateforme SaaS à coût maîtrisé, avec des règles uniformes et testables. L'isolation logique impose cependant une discipline de programmation, de revue SQL, de tests négatifs et d'audit réguliers. Le coût d'une fuite est élevé : privilégier le refus plutôt que des résultats non scellés par un contexte tenant fiable.

## 5. Sécurité et isolation

Refus par défaut ; service auth ; ACL de ressource en plus de la permission de rôle ; prévention des effets de cache et de confusion des organisations. Séparer les journaux opérationnels des contenus clients et utiliser des identifiants pseudonymisés si nécessaire. Prévoir un mécanisme de révocation et de purge tenant complet.

## 6. État et mise en œuvre

**Actuellement non implémenté** dans les routes starter. Construire un `AuthorizationContext` interne signé/vérifié, guard côté chaque plugin, repositories tenant-scoped, conventions `objectKey`, clés Redis namespacées et suite d'essais inter-tenant avec au moins deux organisations et un utilisateur multi-tenant.

## 7. Critères de validation

- Tenter de lire, rechercher, exporter ou citer les ressources d'un autre tenant renvoie une erreur sans fuite de métadonnées.
- Le changement d'organisation active ne réutilise pas l'ancien cache d'autorisations.
- Un worker lancé pour A ne peut produire un artefact visible dans B.
- Un administrateur SaaS sans autorisation de support explicite ne peut lire les données privées.
- Les tests couvrent chemins HTTP directs, AI Orchestrator, SQL/vectors et URL de fichiers.

## 8. Traçabilité

- ADR liés : ADR-0004, ADR-0008, ADR-0009, ADR-0011, ADR-0012, ADR-0013, ADR-0014.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
