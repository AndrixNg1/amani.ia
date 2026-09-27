---
title: "ADR-0019 — Knowledge Plugin : ingestion, indexation et RAG autorisé"
status: "Accepté"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0019 — Knowledge Plugin : ingestion, indexation et RAG autorisé

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté** |
| Date | 27 septembre 2026 |
| Portée | plugins/knowledge, worker documentaire, embeddings et recherche ACL-aware |
| ADR liés | ADR-0006, ADR-0008, ADR-0010, ADR-0012, ADR-0013, ADR-0014, ADR-0018, ADR-0024 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Amani IA transforme PDF, DOCX, TXT et Markdown en connaissances interrogeables, mais chaque utilisateur doit rester limité aux documents dont il possède le droit de lecture. L'API NestJS Knowledge et le dossier du worker existent comme fondations ; aucune chaîne ingestion/embeddings/vector search protégée n'est encore en fonctionnement.

## 2. Décision

**Knowledge est propriétaire des documents, connaissances dérivées et ACL locales.** L'API reçoit les imports, valide les droits et met les fichiers privés dans MinIO/S3 ; elle enregistre statut, version, propriétaire, organisation, workspace, classification et métadonnées SQL. Un job documentaire déclenche extraction, normalisation, segmentation en chunks, génération d'embeddings via provider abstrait puis stockage PostgreSQL/pgvector. Les opérations coûteuses sont déléguées au worker documentaire.

**Ne pas indexer aveuglément les données sensibles.** Au minimum, associer à chaque chunk l'identifiant du document, version, tenant, workspace et politique de lecture. Si une source contient des parties aux ACL différentes, chunker par frontière d'accès ou refuser l'indexation jusqu'à classification. Les réindexations, mises à jour d'ACL, changements de modèle d'embedding et suppression exigent une stratégie de version et une invalidation déterministe.

**Recherche :** le plugin authentifie le service demandeur, le contexte utilisateur délégué et le tenant ; il évalue `knowledge.search` et les ACL avant d'exécuter une recherche vectorielle/lexicale filtrée. La requête SQL/vectorielle doit tenir compte du périmètre **pendant** la récupération ; vérifier les limites des index approximatifs et ajuster la stratégie pour éviter qu'un filtre post-traitement ne révèle des candidats interdits. Retourner des extraits minimisés, score et références source sûres ; l'Orchestrator ne peut pas élargir ce scope.

Le provider d'embeddings reçoit uniquement les contenus autorisés pour ce traitement dans le cadre contractuel choisi. Le texte importé est non fiable : aucune instruction dans un document ne modifie le système d'autorisation.

## 3. Alternatives examinées

- **Index complet commun sans filtres d'accès :** refusé ; un post-filtre ne prouve pas l'absence de fuite.
- **Un index par utilisateur :** complexité extrême sous changements de rôles ; possibilité future pour besoins exceptionnels.
- **Vector DB externe dès la V1 :** ajout opérationnel non nécessaire avant benchmarks pgvector.
- **Traitement synchrone de tous les PDF :** timeouts et difficulté de reprise.

## 4. Conséquences et compromis

Un plugin Knowledge autonome et une traçabilité des sources. Les embeddings, reindexations, permissions fines et volumes de fichiers rendent le pipeline exigeant ; des tests de précision et performance doivent accompagner les tests de sécurité. Répondre « information non disponible dans votre périmètre » est préférable à l'utilisation d'une source interdite.

## 5. Sécurité et isolation

MIME/virus/size checks, fichiers chiffrés et accès présignés courts, métadonnées et chunks tenant-scoped, refus par défaut, citations réautorisées, suppression des dérivés, limites de contexte externe et prompt injection. Aucun original stocké directement dans PostgreSQL.

## 6. État et mise en œuvre

**Étape 1 :** modèle documentaire, upload sécurisé, file d'ingestion, extraction test PDF/TXT, provider d'embeddings simulable, schéma pgvector et retrieval filtré ; ajouter DOCX/Markdown, monitoring et réindexation ensuite. Documenter les dimensions d'embeddings et index après benchmark, pas comme valeur universelle.

## 7. Critères de validation

- Un document RH importé n'apparaît ni en recherche ni en citation pour l'employé non autorisé.
- Un changement d'ACL invalide recherche, cache et accès aux anciennes références.
- Deux versions d'un document n'engendrent pas des fragments obsolètes accessibles.
- L'extraction échouée ou malveillante ne publie pas d'embeddings partiels.
- Un test évalue rappel et latence sur données factices tenant-scoped.

## 8. Traçabilité

- ADR liés : ADR-0006, ADR-0008, ADR-0010, ADR-0012, ADR-0013, ADR-0014, ADR-0018, ADR-0024.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
