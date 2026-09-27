---
title: "ADR-0022 — Connectors Plugin : intégrations externes et synchronisation"
status: "Proposé"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0022 — Connectors Plugin : intégrations externes et synchronisation

| Métadonnée | Valeur |
|---|---|
| Statut | **Proposé** |
| Date | 27 septembre 2026 |
| Portée | plugins/connectors, connexions par entreprise, synchronisation, webhooks et secrets |
| ADR liés | ADR-0006, ADR-0010, ADR-0012, ADR-0014, ADR-0015, ADR-0024 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Certaines entreprises voudront connecter des dépôts documentaires, CRM, outils internes ou services de fichiers. Les connecteurs étendent la portée des données et augmentent le risque de divulgation si les scopes du fournisseur sont utilisés à tort comme permissions Amani IA. L'API Connectors existe aujourd'hui comme fondation ; aucune intégration réelle n'est encore construite.

## 2. Décision

**Connectors détient la configuration et l'état des connexions externes par organisation.** Un connecteur possède type/version, credentials référencés dans un coffre, scopes approuvés, mapping de ressources, checkpoints de synchronisation, statut, propriétaire et politique de rétention. Les connexions sont activées uniquement si le plugin et l'entitlement sont disponibles, par un administrateur autorisé du tenant.

La synchronisation passe par des tâches asynchrones limitées et idempotentes, avec backoff et quotas du fournisseur. Les données importées sont remises à l'API propriétaire de leur type (Knowledge pour documents, Analytics pour datasets) avec tenant, provenance, droits de source et règles de suppression explicites ; Connectors ne devient pas une base documentaire parallèle. Les différences d'ACL entre systèmes doivent être résolues par une politique documentée : ne jamais transformer une ACL inconnue en lecture globale.

**Webhooks entrants :** signatures, replay protection, limitation de débit, déduplication et segmentation par tenant. Les connecteurs tiers pouvant déclencher une sortie réseau exigent validation stricte des hôtes, défenses SSRF et allowlists adaptées. Le choix des fournisseurs et APIs concrètes reste hors du périmètre de la V1 initiale.

## 3. Alternatives examinées

- **Chaque plugin implémente ses propres credentials et webhooks externes :** duplication et gouvernance incohérente.
- **Transférer tout le compte entreprise à un LLM pour appeler des APIs :** accès excessif et comportement difficile à auditer.
- **Installer automatiquement toutes les intégrations :** inutile sans consentement explicite du propriétaire.

## 4. Conséquences et compromis

Base réutilisable pour l'écosystème d'intégrations et provenance consolidée. Les API tierces, expirations OAuth, changements de droits, suppressions source et limites de quotas impliquent une maintenance régulière. La synchronisation est éventuellement cohérente, jamais instantanée par défaut.

## 5. Sécurité et isolation

Secrets chiffrés hors PostgreSQL en clair ; scopes externes minimaux ; séparation de tenants ; protection SSRF et webhooks ; conformité aux autorisations de la source et d'Amani IA. Désactiver un connecteur doit arrêter la synchro et appliquer une politique documentée aux copies importées.

## 6. État et mise en œuvre

**Squelette uniquement.** Construire d'abord manifestes, modèle de connexion, coffre de secrets et contrats d'import ; choisir un premier fournisseur seulement après évaluation de son API et de ses autorisations. Aucune promesse d'intégration Google Drive ou autre ne doit apparaître comme implémentée.

## 7. Critères de validation

- Les credentials A ne sont jamais accessibles par l'utilisateur ou le worker B.
- Un webhook falsifié ou rejoué est rejeté.
- Les documents importés conservent une ACL conservatrice et leur provenance.
- Une désactivation arrête les tâches futures et ne laisse pas de secrets dans les logs.
- Les requêtes externes ne permettent pas d'accéder aux réseaux internes non autorisés.

## 8. Traçabilité

- ADR liés : ADR-0006, ADR-0010, ADR-0012, ADR-0014, ADR-0015, ADR-0024.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
