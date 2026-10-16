---
title: "ADR-0033 — Exécution asynchrone du traitement documentaire"
status: "Accepté — implémentation soumise à validation manuelle"
date: "2026-10-16"
lang: fr-FR
---

# ADR-0033 — Exécution asynchrone du traitement documentaire

## Contexte

La finalisation d’un upload Knowledge rend un original immuable disponible, mais
l’extraction, le découpage et les embeddings ne doivent pas bloquer une requête HTTP.
Redis est déjà le composant local prévu pour les tâches Node, tandis que le worker
documentaire n’avait pas encore de runtime ni de transport concret.

## Décision

Le worker TypeScript `@amani/document-processing` consomme la version 1 du contrat
`KnowledgeDocumentIngestionRequestedV1` depuis BullMQ. La queue est nommée
`document-processing` et son préfixe dépend de l’environnement, ce qui produit une
identité telle que `amani:development:knowledge:document-processing`.

BullMQ est un mécanisme de transport local au workflow documentaire Node. Le contrat
métier versionné reste indépendant de BullMQ. Le futur Python Data Engine ne lit pas
les structures BullMQ et devra recevoir son propre protocole interopérable explicite.

Knowledge conserve la propriété des demandes, états, chunks, embeddings et résultats.
Le worker ne reçoit ni identifiant PostgreSQL ni credential MinIO. Pour chaque livraison,
il appelle Knowledge avec l’identité de service vérifiée, qui réévalue l’état courant,
l’accès du demandeur, l’organisation et la ressource. Knowledge lui remet alors une URL
de téléchargement courte, liée à la version S3 figée. Les batches et la finalisation
repassent par les opérations internes Knowledge.

La livraison est **au moins une fois**. Le `jobId` est l’identifiant durable de la
demande d’ingestion ; les transitions sont compare-and-set et les chunks utilisent une
contrainte `(organization_id, document_version_id, chunk_index)`. Une redélivrance du
même job ne crée pas une seconde version logique ni des chunks supplémentaires. Trois
tentatives avec backoff exponentiel sont configurées ; l’échec terminal est enregistré
avec un code sûr dans Knowledge. Un outbox Knowledge persiste l’intention de publication
avant l’envoi BullMQ ; une reprise opérateur peut republier une intention non livrée.

## Conséquences

Le chemin est asynchrone et récupérable sans prétention d’exactly-once. L’API Knowledge
reste la frontière métier et l’accès aux objets est réautorisé au moment utile. Redis
devient requis pour traiter un job, mais pas pour connaître son état durable.

Le mécanisme HMAC de service est un adaptateur de développement loopback déjà employé
par Amani. Une authentification de service de production reste à sélectionner ; le
worker refuse la configuration de développement hors développement/test.

## Non-objectifs

Cette décision n’ajoute ni retrieval utilisateur, ni ranking vectoriel, ni RAG, ni OCR,
ni connecteur externe, ni protocole du moteur Python.

## Traçabilité

Complète ADR-0006, ADR-0007, ADR-0010, ADR-0013, ADR-0024 et ADR-0032.
