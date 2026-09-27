---
title: "ADR-0006 — Communication asynchrone, événements et files de tâches"
status: "Proposé"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0006 — Communication asynchrone, événements et files de tâches

| Métadonnée | Valeur |
|---|---|
| Statut | **Proposé** |
| Date | 27 septembre 2026 |
| Portée | Redis, traitement des jobs, événements de domaines et cohérence éventuelle |
| ADR liés | ADR-0005, ADR-0007, ADR-0010, ADR-0013, ADR-0020, ADR-0024 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

L'indexation d'un document, l'analyse d'un gros tableur ou la synchronisation d'une source externe dépassent la durée d'un appel HTTP classique. Les changements de rôles, la désactivation d'un plugin et la suppression de documents doivent aussi pouvoir invalider des vues dérivées. Redis existe dans la configuration Compose, mais aucune interopérabilité de queue ou worker n'est déjà construite.

## 2. Décision

**Séparer commandes longues et événements de domaine.** Les API reçoivent les requêtes et enregistrent l'état du job dans leur base propriétaire avant publication d'une tâche ; un `202 Accepted` peut renvoyer un `jobId` et une URL de suivi autorisée. Les événements de domaine sont versionnés et ne servent pas de source unique des permissions.

**Proposition initiale :** Redis et BullMQ pour les jobs TypeScript. Le plugin Data Analytics délègue au worker Python via un contrat FastAPI interne authentifié *ou* un protocole de queue indépendant explicitement choisi plus tard. Ne pas prétendre qu'un consommateur Python comprend nativement le format BullMQ. Si un broker d'événements durable devient nécessaire, choisir explicitement la technologie dans une révision d'ADR plutôt que confondre pub/sub Redis et livraison garantie.

Chaque tâche porte un identifiant stable, l'organisation et une référence de ressource, jamais une autorisation illimitée. Le consommateur revalide les droits nécessaires avant l'accès aux données et avant la mise à disposition du résultat ; les longues exécutions appliquent une politique de révocation. Prévoir retries bornés, backoff, dead-letter/quarantaine, métriques, idempotence, `createdAt`, expiration et annulation. Éviter la double écriture incohérente base/queue par un outbox transactionnel dès qu'un événement doit être publié de manière fiable.

## 3. Alternatives examinées

- **Tout en HTTP synchrone :** délais, échecs et concurrence défavorables aux opérations longues.
- **Redis pub/sub seul :** livraison non persistante, inadéquate pour des jobs devant survivre aux redémarrages.
- **Kafka/RabbitMQ dès la V1 :** utile dans certains contextes mais complexifie l'exploitation avant la démonstration des besoins.

## 4. Conséquences et compromis

La plateforme peut absorber les tâches longues et reprendre après incident, avec une cohérence éventuellement différée. Il faut en échange exposer des états de progression, gérer les duplications et prévoir le traitement des messages morts. Ne pas affirmer qu'une tâche « exactement une fois » est garantie ; concevoir pour au moins une livraison et des opérations idempotentes.

## 5. Sécurité et isolation

Les corps de tâches et les logs ne contiennent pas de secret brut ni de dataset complet. Les ACL et versions de permissions sont réévaluées avant tout résultat sensible ; les artefacts ne sont publiés qu'avec un accès réautorisé. Les caches sont séparés par organisation/utilisateur/permission lorsque requis.

## 6. État et mise en œuvre

**Existant :** Redis de développement, dossiers `workers/document-processing` et `workers/data-engine` encore à initialiser. **À faire :** schémas des jobs, transports, workers, stratégie de retry, outbox, suivi, annulation et tests de panne. Choisir officiellement les mécanismes et noter tout écart à cette proposition.

## 7. Critères de validation

- Un job en double ne crée pas deux indexations ou deux exports.
- Un job refusé ou révoqué ne produit aucun résultat consultable.
- Un redémarrage du worker ne perd pas définitivement un job accepté selon les garanties choisies.
- Les erreurs terminales sont consultables par l'opérateur sans contenu confidentiel.
- Les tests démontrent l'interopérabilité réelle du plugin NestJS et du worker Python.

## 8. Traçabilité

- ADR liés : ADR-0005, ADR-0007, ADR-0010, ADR-0013, ADR-0020, ADR-0024.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
