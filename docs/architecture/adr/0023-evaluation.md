---
title: "ADR-0023 — Evaluation Plugin : contrôle de qualité et jeux de tests IA"
status: "Proposé"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0023 — Evaluation Plugin : contrôle de qualité et jeux de tests IA

| Métadonnée | Valeur |
|---|---|
| Statut | **Proposé** |
| Date | 27 septembre 2026 |
| Portée | plugins/evaluation, campagnes d’évaluation, métriques et gouvernance des données |
| ADR liés | ADR-0007, ADR-0013, ADR-0018, ADR-0019, ADR-0020, ADR-0029 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

La qualité d'un assistant multi-plugin ne se résume pas à la pertinence textuelle : elle comprend précision des citations, comportement face à l'absence de sources, coût, latence et résistance à la divulgation de données. Sans évaluations reproductibles, changer de modèle, de chunking ou de fournisseur peut régresser silencieusement. L'API Evaluation est initialisée mais ses campagnes et datasets de test ne sont pas opérationnels.

## 2. Décision

**Evaluation est propriétaire des jeux de tests, configurations de campagnes, exécutions et rapports.** Une campagne précise version du scénario, modèle, configuration d'Orchestrator, jeu de ressources synthétiques ou autorisées, autorisations du profil de test et critères. Les résultats distinguent vérifications déterministes (permissions, absence de sources interdites, format de citation, temps/coût) et mesures probabilistes (pertinence, complétude, fidélité) avec seuils et méthode documentés.

L'API n'accède pas directement aux tables de Knowledge/Analytics. Elle exécute les demandes à travers les contrats de l'Orchestrator et des plugins, sous **des identités de test à scopes bornés**. Les campagnes d'évaluation ne doivent jamais contourner la sécurité sous prétexte d'être internes. Conserver corpus synthétiques publics pour CI ; données clientes réelles seulement après accord explicite, politique de rétention et anonymisation appropriée.

Les changements majeurs de prompt, de modèle, de stratégie de retrieval ou de contrôle de permissions doivent déclencher une campagne de non-régression ciblée. Les résultats sont des aides à la décision : ne pas présenter un score de qualité comme une garantie de confidentialité.

## 3. Alternatives examinées

- **Tests uniquement manuels :** utiles mais non reproductibles et difficiles à comparer.
- **Évaluation uniquement par un second LLM :** mesure subjective non fiable pour prouver l'absence d'une fuite.
- **Mettre Evaluation dans chaque plugin :** duplication des métriques transversales et faible couverture des parcours hybrides.

## 4. Conséquences et compromis

Décisions sur modèles et prompts mieux informées ; coûts de campagnes, variabilité des LLM et nécessité de séparer données de test et environnements réels. Établir des métriques simples avant toute industrialisation sophistiquée.

## 5. Sécurité et isolation

Jeux d'évaluation tenant-scoped, accès restreint aux rapports, pas de copie de données clients dans la CI publique ; faux profils conçus pour prouver l'absence de divulgation intertenant et après révocation. Journaliser version de configuration plutôt que contenus sensibles bruts si cela suffit.

## 6. État et mise en œuvre

**Prévu, non implémenté.** Initialiser API de campagne et résultats, un corpus de test synthétique multi-tenant et un premier pipeline de non-régression Knowledge/Orchestrator. Automatiser ensuite mesures de retrieval et Analytics ; aucune métrique IA n'est aujourd'hui vérifiée en production.

## 7. Critères de validation

- Un changement d'ACL ou de prompt ne permet pas au profil non autorisé d'obtenir des citations protégées.
- Chaque rapport indique configuration/version et limites statistiques de la campagne.
- Les scénarios déterministes de divulgation échouent explicitement en CI lorsqu'une fuite est introduite.
- Aucun corpus confidentiel ne figure dans les artefacts publics de CI.

## 8. Traçabilité

- ADR liés : ADR-0007, ADR-0013, ADR-0018, ADR-0019, ADR-0020, ADR-0029.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
