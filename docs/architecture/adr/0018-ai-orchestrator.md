---
title: "ADR-0018 — AI Orchestrator et coordination des Plugin APIs"
status: "Accepté"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0018 — AI Orchestrator et coordination des Plugin APIs

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté** |
| Date | 27 septembre 2026 |
| Portée | apps/ai-orchestrator : classification, sélection d’outils et réponse IA |
| ADR liés | ADR-0002, ADR-0005, ADR-0011, ADR-0012, ADR-0013, ADR-0015, ADR-0019, ADR-0020, ADR-0021 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Une demande utilisateur peut nécessiter la recherche de documents, l'analyse d'un fichier Excel ou les deux. Amani IA a déjà un squelette NestJS indépendant `apps/ai-orchestrator` sur le port 4002. L'Orchestrator doit sélectionner des capacités sans devenir propriétaire des documents ou contourner les décisions de permissions. Les modèles, fournisseurs et transports concrets ne sont pas encore intégrés.

## 2. Décision

**L'AI Orchestrator est un service NestJS distinct** chargé de planifier une demande, identifier les plugins autorisés, invoquer leurs outils via contrats versionnés et produire une réponse avec références validées. Il n'accède jamais directement aux tables de Knowledge, Analytics ou Conversations. Le Core fournit la politique commune de tenant/permission ; chaque plugin valide aussi l'opération demandée et les ACL locales.

Pipeline logique : (1) identité et organisation vérifiées ; (2) vérification des entitlements et droits ; (3) classification `general/knowledge/analytics/hybrid` ; (4) sélection des outils autorisés et budgets d'exécution ; (5) appels backend-to-backend aux plugins ; (6) construction d'un contexte **uniquement à partir des résultats autorisés** ; (7) génération de la réponse ; (8) validation de provenance/citations, métadonnées de sécurité et stockage de l'historique par Conversations si l'utilisateur y est autorisé.

**Providers abstraits** pour modèles de génération, embeddings et éventuel reranking ; sélectionner le fournisseur et les régions de traitement selon les accords de traitement de données réels. Les documents récupérés sont des **données non fiables** : leurs instructions ne peuvent changer ni rôle, ni outils, ni destinations réseau. Limiter temps, tokens, appels et coût ; prévoir annulation et erreurs partielles sans dégrader l'autorisation. Les analyses lourdes sont asynchrones via Analytics/worker, pas réalisées en code libre dans l'Orchestrator.

Une réponse de type général sans accès documentaire doit être explicitement distinguée d'une réponse fondée sur les données de l'entreprise. Ne pas inventer de citations lorsque le plugin n'en fournit pas.

## 3. Alternatives examinées

- **LLM unique qui choisit et exécute n'importe quel outil :** surface de risque et absence de contrôle déterministe.
- **Logique d'orchestration répétée dans chaque frontend ou plugin :** incohérences et fuite de credentials.
- **Orchestrator inclus dans Core :** possible au début, mais le service séparé existe déjà et la responsabilité IA inter-plugins est suffisamment distincte.

## 4. Conséquences et compromis

Un parcours IA unifié et une capacité hybride réutilisable ; coûts de coordination, observabilité, politiques de retry et gestion de fournisseurs. Les réponses peuvent être partielles lorsqu'un plugin n'est pas disponible, mais ne doivent pas masquer un refus d'autorisation ou utiliser des données hors scope.

## 5. Sécurité et isolation

Chaque outil est allowlisté par plugin, tenant, action et ressource. Le modèle ne reçoit ni secrets de service ni règles internes sensibles inutilement. Protéger contre prompt injection, extraction par citations, réutilisation de réponse de cache, log des prompts, appel d'outil non autorisé et transformation d'un résultat sensible en export public.

## 6. État et mise en œuvre

**Existant :** squelette et `/health`, pas d'orchestration métier effective. **Premier incrément :** question Knowledge unique avec filtres réels, interface provider mockable, citations et tests multi-utilisateurs. Ajouter Analytics puis hybride seulement après validation des frontières. Les URLs internes et credentials restent server-side.

## 7. Critères de validation

- Le service n'appelle jamais un plugin désactivé ou interdit par les droits de l'utilisateur.
- Les outils refusés ne sont pas réessayés avec un contexte privilégié.
- Deux employés sur la même question reçoivent uniquement leurs informations permises.
- Les citations réfèrent à des ressources actuellement accessibles.
- Une panne du provider ou d'un plugin ne provoque pas de fuite ni d'enregistrement de prompt brut.

## 8. Traçabilité

- ADR liés : ADR-0002, ADR-0005, ADR-0011, ADR-0012, ADR-0013, ADR-0015, ADR-0019, ADR-0020, ADR-0021.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
