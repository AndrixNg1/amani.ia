---
title: "ADR-0031 — Sources d’entreprise et propriété des domaines"
status: "Accepté — implémentation soumise à validation manuelle"
date: "2026-10-15"
lang: fr-FR
---

# ADR-0031 — Sources d’entreprise et propriété des domaines

## Contexte

Knowledge pouvait être interprété comme un dépôt de fichiers importés. Les entreprises
conservent aussi leurs originaux dans Notion, Drive, SharePoint, Confluence ou S3, et
leurs données structurées dans PostgreSQL, MySQL, SQL Server, tableurs et entrepôts.
Ces exemples ne constituent pas des intégrations disponibles.

## Décision

Une source documentaire alimente Knowledge ; une source structurée alimente Data
Analytics. Connectors possède connectivité, secrets et synchronisation. Chaque domaine
possède ses sources et ressources : aucune table universelle partagée entre services.
Les packages partagent seulement SourceFamily, SourceKind et SourceReference.
L’upload manuel reste une source documentaire de première classe. KnowledgeSource
conserve une référence externe opaque, jamais un jeton OAuth, mot de passe ou URL
contenant des credentials. Les lignes SQL ne sont pas converties en texte pour RAG.

La chaîne documentaire est source → documents → versions → traitement documentaire
→ recherche autorisée. La chaîne structurée est source → datasets → calcul autorisé
→ résultat structuré. L’Orchestrator compose ensuite les seuls résultats autorisés.
Cette livraison implémente les sources manuelles et le socle documentaire ; connecteurs,
Analytics, workers, recherche et orchestration ne sont pas implémentés ici.

## Alternatives

Un catalogue SQL universel couplerait migrations et domaines. Répliquer les secrets
dans Knowledge élargirait les privilèges. Vectoriser toutes les tables détruirait la
sémantique des calculs et ne répondrait pas aux permissions de lignes/colonnes.

## Conséquences

Les systèmes d’entreprise peuvent rester sources de vérité, l’upload reste simple,
le RAG reste documentaire et les calculs restent précis. Connectors devient réutilisable
sans posséder les documents ni datasets. Les coûts sont des contrats plus explicites,
la synchronisation, le mapping des droits, la propagation des révocations, les versions
de sources et la coordination entre services.

## Sécurité

Toute source appartient à une organisation. Accéder à la source ou au connecteur
n’accorde pas l’accès à toutes ses ressources. Deux membres du même tenant peuvent
avoir des droits différents. Les identifiants Core restent opaques, sans FK interschéma.
Les secrets de source ne traversent pas les contrats Knowledge. Un mapping de droits
inconnu doit refuser, jamais publier à tous les membres.

## Validation

Tests à écrire/exécuter : contraintes composites de tenant, source manuelle bornée,
refus d’une source d’un autre tenant, absence de secrets dans contrats et logs.
Validation de cette livraison : **NOT RUN BY REQUEST**.

## Traçabilité

Complète ADR-0009, 0013, 0014, 0019, 0020, 0022 et 0024 sans réécrire leur historique.
Voir [ADR-0032](0032-knowledge-access-uploads.md) pour les décisions d’implémentation.
