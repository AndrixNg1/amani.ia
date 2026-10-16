---
title: "ADR-0034 — Représentation traitée des documents Knowledge"
status: "Accepté — implémentation soumise à validation manuelle"
date: "2026-10-16"
lang: fr-FR
---

# ADR-0034 — Représentation traitée des documents Knowledge

## Décision

Knowledge traite uniquement PDF textuels, DOCX, TXT UTF-8 et Markdown, selon le MIME
validé lors de l’upload. Les octets restent des données inertes : aucun macro, script,
URL, image ou contenu embarqué n’est exécuté ou récupéré. Les PDF sans texte échouent
avec `NO_EXTRACTABLE_TEXT`; l’OCR n’est pas fourni.

L’extraction produit du texte et une provenance de section lorsque disponible. La
normalisation version 1 convertit les fins de ligne, écarte les contrôles non sûrs,
normalise les espaces à l’intérieur des lignes et préserve les paragraphes/entêtes. Le
chunker version 1 est déterministe, orienté paragraphes, avec découpe sûre des grands
paragraphes et overlap configurable. Les mêmes original, versions de pipeline et
configuration produisent le même ordre, les mêmes indices et les mêmes checksums.

Les embeddings passent par `EmbeddingProvider`. L’adaptateur OpenAI-compatible est
configurable (URL, clé, modèle, timeout et batch), et un fournisseur déterministe est
réservé au développement/test explicite. Il ne mesure pas de pertinence sémantique.
Chaque chunk conserve provider, modèle, dimension et version de configuration.

Les vecteurs sont stockés par Knowledge dans pgvector sous forme `extensions.vector`
non dimensionnée au niveau SQL, accompagnée de leur dimension. Cela évite de figer un
modèle fournisseur dans le schéma. Aucun index ANN n’est créé avant le profil de modèle
et les mesures de retrieval de la phase 7 ; un document est `ready` seulement après
persistance complète et contrôlée de ses chunks/embeddings.

## Limites et sécurité

Les tailles d’original/extraction, pages détectables, paragraphes, chunks, batches,
concurrence et délais sont toutes configurées et bornées. Les erreurs exposées sont des
codes sûrs, jamais des corps de documents, URL signées, clés, vecteurs ou erreurs brutes
de fournisseur. Un antivirus n’est pas fourni et reste un renforcement de production.

## Non-objectifs

La phase ne fournit aucune recherche, similarité, réponse IA, citation utilisateur ou
orchestration RAG. Ces opérations relèvent de la phase 7.

## Traçabilité

Complète ADR-0008, ADR-0014, ADR-0019, ADR-0024 et ADR-0033.
