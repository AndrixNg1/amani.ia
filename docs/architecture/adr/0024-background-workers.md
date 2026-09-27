---
title: "ADR-0024 — Workers documentaires, Python Data Engine et isolation des jobs"
status: "Accepté"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0024 — Workers documentaires, Python Data Engine et isolation des jobs

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté** |
| Date | 27 septembre 2026 |
| Portée | workers/document-processing, workers/data-engine, interfaces et contraintes d’exécution |
| ADR liés | ADR-0006, ADR-0009, ADR-0010, ADR-0013, ADR-0014, ADR-0019, ADR-0020 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

L'ingestion documentaire et l'analyse tabulaire sont des opérations coûteuses, susceptibles d'échouer, de durer longtemps ou de manipuler du contenu non fiable. Les exécuter dans les API HTTP NestJS augmenterait le risque de saturation et compliquerait la reprise. Deux dossiers workers sont prévus ; le Data Engine Python et le worker documentaire ne sont pas encore complètement initialisés.

## 2. Décision

**Séparer le traitement métier de son API de commande.** Knowledge crée et suit les demandes d'ingestion ; son worker gère extraction, nettoyage, segmentation et embeddings. Data Analytics reçoit et autorise les demandes d'analyse ; le Python Data Engine exécute les plans validés dans un runtime borné. Les workers n'exposent pas d'endpoint public utilisateur.

**Python Data Engine :** Python 3.12 ou version finale validée par l'environnement, `uv` pour dépendances/lockfile, FastAPI si l'interface interne HTTP est retenue, Ruff/mypy/pytest. Les librairies Pandas, Polars ou DuckDB sont choisies selon les opérations démontrées ; leurs versions sont verrouillées. Le worker documentaire peut être TypeScript selon le profil d'extraction ; ne pas lui imposer Python sans décision.

Les jobs possèdent service propriétaire, `organizationId`, ressource, action autorisée, version de données, idempotencyKey, échéance et état. La publication/consommation utilise ADR-0006. Le worker obtient un accès **temporaire et minimal** aux seules données nécessaires, revalide le droit courant avant lecture sensible et avant publication du résultat, nettoie les fichiers temporaires, respecte limite mémoire/CPU/temps et ne sort pas arbitrairement sur Internet.

**Ne pas confondre BullMQ et Python.** Un processeur BullMQ TypeScript peut piloter le worker FastAPI au travers d'un appel interne authentifié. Un consommateur Python direct nécessiterait un protocole partagé explicitement choisi et testé ; ne pas lire naïvement les structures Redis internes de BullMQ.

## 3. Alternatives examinées

- **Traitement lourd dans le thread/processus API :** saturation et timeouts.
- **Exécution Python générée librement par LLM sur l'hôte :** risque majeur d'exfiltration et de corruption.
- **Workers partageant des credentials superuser :** contredit l'isolation par tenant et service.

## 4. Conséquences et compromis

Meilleure disponibilité des API et reprise des traitements ; coût opérationnel de queues, observabilité et contraintes runtime. Les états doivent refléter les échecs partiels et les suppressions de résultats, pas seulement « success/failed ». Prévoir limites et priorités pour empêcher qu'un tenant monopolise tous les workers.

## 5. Sécurité et isolation

Sandbox de calcul, identités de service limitées, ressources isolées par tenant et par tâche, accès objet court, pas de code non validé, logs minimisés, vérification de révocation et suppression d'artefacts éphémères. Les jobs ne transportent ni credentials persistants ni données sensibles sans nécessité.

## 6. État et mise en œuvre

**Dossiers réservés, services à réaliser.** Implémenter d'abord le chemin Knowledge → worker documentaire avec données synthétiques, puis Analytics NestJS → plan validé → worker Python. Tester le protocole réellement choisi, configurer métriques de queue, DLQ et critères de readiness séparés des `/health` HTTP.

## 7. Critères de validation

- Une API reste disponible pendant un traitement documentaire ou analytique lourd.
- Un worker ne peut pas lire une ressource d'un autre tenant ni exploiter des credentials transversaux.
- Les jobs idempotents résistent aux redémarrages et duplications selon les garanties retenues.
- Les restrictions de CPU/mémoire/temps et l'absence de réseau par défaut sont testées.
- Une révocation empêche lecture tardive ou publication du résultat.

## 8. Traçabilité

- ADR liés : ADR-0006, ADR-0009, ADR-0010, ADR-0013, ADR-0014, ADR-0019, ADR-0020.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
