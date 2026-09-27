---
title: "ADR-0009 — Propriété des données, schémas et migrations par service"
status: "Accepté"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0009 — Propriété des données, schémas et migrations par service

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté** |
| Date | 27 septembre 2026 |
| Portée | Frontières SQL, identifiants interservices, migrations, cohérence et sauvegardes |
| ADR liés | ADR-0002, ADR-0004, ADR-0006, ADR-0008, ADR-0010, ADR-0014 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Des services NestJS séparés mais partageant librement les mêmes tables constituent un monolithe distribué. Amani IA veut pouvoir déployer Knowledge, Analytics et Core indépendamment, tout en conservant des relations fonctionnelles telles que `organizationId` et `userId`. Dans les squelettes actuels, aucune base applicative par service ni migration métier n'est opérationnelle.

## 2. Décision

**Chaque service est propriétaire de ses tables, schémas d'évolution et procédures de restauration.** En local, utiliser une instance PostgreSQL avec des bases ou schémas isolés et des comptes de service distincts. En production, les mêmes frontières doivent subsister, même si l'hébergement exact diffère. Les services ne créent ni clés étrangères SQL ni requêtes `JOIN` directes vers les tables d'un autre propriétaire.

L'identité de l'organisation et de l'utilisateur est représentée dans les autres services par des **identifiants de référence** ; leur validité métier est établie par les API du Core. Les plugins peuvent maintenir des vues dérivées strictement limitées à leur domaine via événements versionnés, avec invalidation et réconciliation. Une mutation à cheval sur plusieurs services utilise saga, états explicites et opérations idempotentes ; aucune transaction SQL distribuée implicite n'est présumée.

Les migrations sont rangées et exécutées avec le service propriétaire. Planifier les changements en **expand → migrate → contract** pour préserver la compatibilité des versions déployées pendant la transition. Les backups couvrent base et stockage objet de façon cohérente pour les fichiers référencés.

## 3. Alternatives examinées

- **Une seule base et des repositories importables partout :** facilite certains joins mais rend tout déploiement dépendant de tous les schémas.
- **Une instance physique PostgreSQL par service dès le premier jour :** peut renforcer l'isolation, mais augmente les coûts opérationnels avant d'apporter une valeur vérifiable.
- **Copie complète du référentiel utilisateur dans chaque plugin :** entraîne dérive et difficultés de révocation.

## 4. Conséquences et compromis

Autonomie réelle des évolutions SQL, droits de base plus simples à auditer et pannes mieux contenues. Le coût est le recours à des références applicatives, API internes, cohérence éventuelle et stratégies de récupération interservices. La suppression d'une entreprise exige un workflow de purge coordonné avec preuves d'achèvement.

## 5. Sécurité et isolation

Aucun plugin n'obtient un compte superutilisateur commun ou les credentials du Core. Définir une politique de sauvegarde chiffrée et une procédure d'effacement incluant objets, index vectoriels, caches, workers, exports et copies de secours selon les obligations retenues. Les vues dérivées ne conservent pas de permissions illimitées après révocation.

## 6. État et mise en œuvre

**État :** décision acceptée, persistence métier non implémentée. Définir conventions de schémas/DB, migrations, DSN par service, scripts de développement et tests de privilèges. Choisir un outil de migration/ORM cohérent après essais, sans partage d'entités ORM entre API.

## 7. Critères de validation

- Les comptes `knowledge` et `analytics` ne peuvent pas lire les tables `core`.
- Un changement de schéma Core compatible ne nécessite pas redéployer tous les plugins.
- L'effacement organisation traverse les services et signale tout échec partiel.
- Les tests de restauration couvrent l'accord entre métadonnées SQL et objets présents.

## 8. Traçabilité

- ADR liés : ADR-0002, ADR-0004, ADR-0006, ADR-0008, ADR-0010, ADR-0014.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
