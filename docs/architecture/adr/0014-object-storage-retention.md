---
title: "ADR-0014 — Stockage objet, accès aux fichiers et conservation des données"
status: "Proposé"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0014 — Stockage objet, accès aux fichiers et conservation des données

| Métadonnée | Valeur |
|---|---|
| Statut | **Proposé** |
| Date | 27 septembre 2026 |
| Portée | MinIO/S3, pièces importées, exports, rétention et suppression |
| ADR liés | ADR-0008, ADR-0009, ADR-0010, ADR-0012, ADR-0013, ADR-0019, ADR-0024 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

PDF, DOCX, tableurs et exports ne doivent pas être enregistrés comme gros blobs dans des tables PostgreSQL. La plateforme prévoit MinIO local et S3-compatible en production. Un objet peut exposer des données confidentielles même si le document correspondant ne figure plus dans les résultats RAG. Une architecture d'ACL ne peut donc pas se limiter aux métadonnées SQL.

## 2. Décision

**Conserver les originaux et artefacts volumineux en stockage objet privé**, géré localement avec MinIO et en production avec un fournisseur S3-compatible à choisir. Chaque plugin demeure propriétaire des métadonnées SQL de ses objets, notamment organisation, propriétaire, classification, état de scan/extraction, version, checksum, politique de rétention et ACL. Les buckets/prefixes par service et tenant facilitent la gestion, mais **le nom du chemin ne suffit pas comme contrôle d'accès**.

Les téléchargements passent par un endpoint backend qui vérifie permission actuelle, organisation active et statut de la ressource avant de produire une URL présignée courte durée ou de streamer le fichier. Contrôler MIME et taille, limites d'upload, décompression et malwares selon le contexte ; ne jamais exposer de bucket public pour des documents privés.

Définir des états de fichier `uploaded → quarantined → scanned → available/failed → deleted`, adaptés aux technologies effectivement installées. Une suppression logique interdit immédiatement l'accès ; la purge physique, la suppression des embeddings/chunks, la révocation d'URL et l'expiration des sauvegardes suivent une politique explicitement choisie. Les règles légales de rétention restent à valider selon les marchés ciblés.

## 3. Alternatives examinées

- **Blobs dans PostgreSQL :** transactions simples mais charges, sauvegardes et distribution de gros fichiers défavorables.
- **Bucket public + URL connue :** incompatible avec les ACL d'entreprise.
- **URL signée longue durée sans nouveau contrôle :** une révocation ne serait pas effective avant expiration ; rejetée pour contenus sensibles.

## 4. Conséquences et compromis

Stockage extensible, séparation des responsabilités et restauration plus flexible. Il faut gérer cohérence metadata/objet, nettoyage des uploads interrompus, expirations et audit des téléchargements. Les URL déjà émises restent potentiellement valides jusqu'à leur expiration : garder une durée courte et prévoir un proxy pour les documents les plus sensibles.

## 5. Sécurité et isolation

Chiffrement au repos et en transit, clés distinctes par environnement, IAM de buckets au moindre privilège, scan de fichiers et contrôle d'accès préalable à chaque lecture. Les workers reçoivent des références contrôlées plutôt que des clés permanentes. Tester la révocation et l'absence de liens cross-tenant.

## 6. État et mise en œuvre

**Existant :** MinIO est préparé dans Compose ; pas de client métier. **À faire :** choisir SDK, conventions de clés, politiques IAM, scan, métadonnées, lifecycle de purge et stratégie backup. Les secrets de stockage restent hors dépôt et hors variables exposées à Next.js.

## 7. Critères de validation

- Une URL de A ne permet pas de récupérer un objet de B.
- Un rôle supprimé empêche toute nouvelle URL, y compris depuis une ancienne conversation.
- Un upload invalide/volumineux n'est pas ingéré.
- Le test de suppression confirme la disparition des métadonnées dérivées selon la politique.
- Les restores détectent les références SQL orphelines et objets non référencés.

## 8. Traçabilité

- ADR liés : ADR-0008, ADR-0009, ADR-0010, ADR-0012, ADR-0013, ADR-0019, ADR-0024.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
