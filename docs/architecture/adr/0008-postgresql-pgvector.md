---
title: "ADR-0008 — PostgreSQL comme base principale et pgvector pour le RAG"
status: "Accepté"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0008 — PostgreSQL comme base principale et pgvector pour le RAG

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté** |
| Date | 27 septembre 2026 |
| Portée | Persistance relationnelle, embeddings et socle de stockage local |
| ADR liés | ADR-0002, ADR-0009, ADR-0010, ADR-0013, ADR-0019 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Amani IA doit conserver des relations explicites entre entreprises, adhésions, rôles, installations de plugins, documents, datasets et historiques de conversation. La nouvelle architecture remplace le choix antérieur MongoDB par PostgreSQL. Knowledge a aussi besoin d'indexer et de retrouver des embeddings avec un filtre d'accès. Le `docker-compose.yml` local prépare PostgreSQL et un script d'extension pgvector ; les applications ne possèdent pas encore de clients de persistance opérationnels.

## 2. Décision

**PostgreSQL est le moteur de persistance transactionnelle principal** pour Core et les Plugin APIs ayant des données structurées. Le Knowledge Plugin utilise l'extension **pgvector** pour stocker embeddings et métadonnées de recherche, avec les identifiants de tenant et ressources nécessaires à l'autorisation. Les documents et datasets binaires restent en stockage objet (ADR-0014).

Le partage d'une **instance** PostgreSQL en développement est autorisé, mais chaque service possède sa base ou son schéma, un utilisateur SQL dédié, ses migrations et ses sauvegardes/logiques de restauration compatibles avec son ownership (ADR-0009). L'ORM ou query builder n'est pas encore figé : le choisir après un prototype PostgreSQL/pgvector, afin d'éviter d'imposer un outil qui ne prendrait pas en charge les requêtes vectorielles nécessaires. Si du SQL natif est utilisé, il doit être paramétré et testé.

Pour la recherche vectorielle, choisir le type d'embedding, la dimension, la métrique et les index après mesures représentatives. **Le filtrage d'organisation et de ressources autorisées s'applique dans la requête de récupération**, non uniquement après l'obtention des vecteurs. Mesurer rappel et latence sous des filtres d'ACL réalistes, notamment pour des collections hétérogènes.

## 3. Alternatives examinées

- **MongoDB et moteur vectoriel intégré :** cohérent dans l'ancienne conception, mais n'est plus le choix validé du projet.
- **Base relationnelle plus service vectoriel externe :** séparation potentiellement utile à grande échelle, mais cohérence, coûts et synchronisation supplémentaires pour la V1.
- **Embeddings dans des fichiers ou mémoire du processus :** insuffisants pour reprise, filtrage et exploitation multi-tenant.

## 4. Conséquences et compromis

Une base SQL consolidée simplifie contraintes relationnelles et transactions locales ; pgvector évite au départ une autre infrastructure de recherche. Il faudra toutefois dimensionner séparément les workloads transactionnels et vectoriels si la volumétrie augmente. Une seule instance de développement ne garantit pas de bonne isolation sans rôles SQL et contrôles applicatifs.

## 5. Sécurité et isolation

Identifiants SQL distincts et privilèges minimum ; aucune connexion directe du navigateur ; requêtes paramétrées ; filtres de tenant obligatoires et tests de non-divulgation. Les données extraites, embeddings et métadonnées peuvent contenir des informations sensibles et doivent suivre les mêmes règles d'accès et de rétention que les originaux.

## 6. État et mise en œuvre

**Existant :** Compose PostgreSQL/pgvector préparé, sans connexions applicatives effectives connues. **À faire :** migrations par service, comptes SQL, modèle des chunks, stratégie d'index, sauvegarde/restauration et benchmarks avec ACL. Ne pas annoncer MongoDB supprimé des données réelles sans plan de migration si des données devaient apparaître.

## 7. Critères de validation

- Chaque service ne peut créer/modifier que ses objets SQL.
- Les requêtes de recherche ne retournent aucun chunk d'un autre tenant ni hors ACL.
- Un index vectoriel avec données synthétiques atteint les seuils de rappel/latence définis.
- Les migrations s'exécutent depuis un état vierge et se rejouent selon leur stratégie.
- Une restauration de test récupère données structurées et métadonnées d'objets cohérentes.

## 8. Traçabilité

- ADR liés : ADR-0002, ADR-0009, ADR-0010, ADR-0013, ADR-0019.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
