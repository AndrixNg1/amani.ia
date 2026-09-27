---
title: "ADR-0028 — Observabilité, résilience, journalisation et secrets"
status: "Proposé"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0028 — Observabilité, résilience, journalisation et secrets

| Métadonnée | Valeur |
|---|---|
| Statut | **Proposé** |
| Date | 27 septembre 2026 |
| Portée | Traces interservices, métriques, logs, quotas, erreurs et opérations sûres |
| ADR liés | ADR-0003, ADR-0005, ADR-0006, ADR-0010, ADR-0011, ADR-0024, ADR-0026, ADR-0029 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Une plateforme backend-to-backend peut échouer partiellement : Core indisponible, queue bloquée, fournisseur LLM lent ou indexation interrompue. Le support doit diagnostiquer les flux sans exposer les prompts et fichiers confidentiels. Les dossiers `infrastructure/observability` et les routes `/health` existent, mais une route liveness ne prouve ni readiness ni sécurité opérationnelle.

## 2. Décision

**Observabilité structurée commune, ownership par service.** Tous les appels externes et internes propagent un `correlationId` et, lorsque l'outillage est choisi, un contexte de tracing compatible OpenTelemetry. Émettre des métriques de disponibilité, latence, taux d'erreur, délais d'attente, profondeur des queues, jobs échoués, coût et consommation IA agrégés avec segmentation qui ne fuit pas de données tenant.

**Séparer liveness, readiness et santé des dépendances.** `/health` actuel reste uniquement un signal que le processus répond. La readiness future vérifiera les dépendances réellement nécessaires au trafic métier concerné. Définir SLO et alertes après première exploitation, plutôt que publier des seuils arbitraires. Pour les appels internes : timeouts, retries bornés avec jitter, circuit breakers si utile, annulations et limites de concurrence par tenant.

**Secrets :** configuration par environnement, stockage dans un gestionnaire de secrets en production à sélectionner, rotation, permissions minimum et aucun secret dans GitHub, les bundles Next ou les logs. Les erreurs et traces doivent exclure contenu client, jetons, URL présignées et exports. Distinguer audit métier immuable (ADR-0026) et logs opérationnels rétention courte.

Les plans de reprise documentent sauvegardes PostgreSQL/objets, dead-letter jobs et procédures de restauration testées. Les incidents d'autorisation provoquent un refus sûr plutôt qu'un bypass de service indisponible.

## 3. Alternatives examinées

- **Logs texte isolés sans correlation ID :** diagnostic des flux hybrides difficile.
- **Capturer prompts et datasets complets dans chaque trace :** exposition sensible disproportionnée.
- **Tolérance aux pannes par autorisation permissive :** explicitement rejetée.

## 4. Conséquences et compromis

Diagnostic, capacité de reprise et prévision de charge améliorés ; coûts de stockage télémétrique et maintenance des dashboards. L'instrumentation elle-même doit être testée pour éviter fuite de données ou amplification de coûts sur prompts volumineux.

## 5. Sécurité et isolation

Pseudonymiser les identifiants exposés, cloisonner droits de lecture des logs, chiffrer transport et stockage, empêcher l'inclusion de credentials dans les traces, auditer accès aux outils d'observabilité. Prévoir alarmes sur événements de refus anormaux, abus de quotas et désactivation de contrôles.

## 6. État et mise en œuvre

**À faire :** sélectionner collecteur/backends, bibliothèque de logs partagée et conventions d'instrumentation ; commencer par Gateway, Core, Orchestrator et Knowledge, puis étendre. Préparer runbooks et tests de panne sans imposer un fournisseur cloud absent des décisions actuelles.

## 7. Critères de validation

- Une requête traverse plusieurs API avec un identifiant traçable sans donnée confidentielle.
- Une indisponibilité Core bloque les accès qui exigent une décision fraîche.
- Les quotas, timeouts et annulations limitent les cascades d'échec.
- Une restauration et une rotation des secrets sont exercées en environnement de test.
- Le scan de logs ne retrouve ni clé API, ni token, ni contenu client volontairement injecté dans un test.

## 8. Traçabilité

- ADR liés : ADR-0003, ADR-0005, ADR-0006, ADR-0010, ADR-0011, ADR-0024, ADR-0026, ADR-0029.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
