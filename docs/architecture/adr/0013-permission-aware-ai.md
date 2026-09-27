---
title: "ADR-0013 — IA sensible aux permissions de chaque utilisateur"
status: "Accepté"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0013 — IA sensible aux permissions de chaque utilisateur

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté** |
| Date | 27 septembre 2026 |
| Portée | Orchestrator, recherche documentaire, analyses, citations, caches et historique |
| ADR liés | ADR-0005, ADR-0008, ADR-0010, ADR-0011, ADR-0012, ADR-0018, ADR-0019, ADR-0020, ADR-0021 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Le produit doit empêcher que l'assistant IA devienne un canal de fuite. Deux collaborateurs d'une même entreprise peuvent poser la même question mais avoir des droits différents sur les données RH, commerciales et financières. Donner au LLM toutes les ressources puis lui demander de masquer les passages interdits ne crée pas de frontière de sécurité fiable. L'architecture doit imposer le contrôle **avant** l'accès aux données et couvrir les sorties indirectes.

## 2. Décision

**Aucune information non autorisée ne doit entrer dans le contexte du modèle.** Pour chaque requête, l'AI Orchestrator obtient un contexte d'identité, organisation, plugin et opérations vérifiable. Il ne sélectionne que les outils autorisés et adresse à chaque plugin une demande bornée. Le plugin revalide les droits au moment de l'accès et combine permissions globales du Core avec ACL de ses ressources.

**Knowledge :** le filtre d'accès et d'organisation est appliqué pendant la récupération SQL/vectorielle. Les chunks héritent d'une politique déterministe du document ou d'une politique plus restrictive ; s'ils mélangent plusieurs niveaux de confidentialité, l'ingestion doit les séparer ou les refuser. Les extraits utilisés dans le prompt ne dépassent jamais le scope autorisé.

**Analytics :** valider dataset, opérations permises et restrictions lignes/colonnes avant d'interroger ou de transmettre les données au worker. Ne pas permettre à un code ou SQL généré d'accéder directement à un volume partagé ou à une connexion superutilisateur. Les résultats dérivés (agrégations, graphiques, exports) restent sensibles ; considérer les attaques par petites cohortes et tentatives de reconstruction.

**Conversations et sorties :** citations vérifiées et contrôlées avant affichage ; références de sources non autorisées masquées ; historiques et réponses déjà enregistrées soumis à une nouvelle autorisation lors de la lecture ; caches segmentés par scope et version de politique, avec invalidation à la révocation. En cas d'incertitude d'autorisation ou de panne du Core, refuser l'accès aux données plutôt que générer depuis un contexte plus large.

La prompt injection d'un document importé n'a aucune autorité pour élargir les droits ni appeler un outil interdit. L'outil LLM peut reformuler uniquement des données autorisées ; un post-filtre de sortie est une défense supplémentaire et **jamais le contrôle principal**.

## 3. Alternatives examinées

- **Tout récupérer puis filtrer la réponse générée :** risque de divulgation directe et inférentielle, rejeté.
- **Un index vectoriel entièrement séparé par utilisateur :** difficile à maintenir lors des changements d'ACL et coûts élevés ; possible exceptionnellement pour un environnement dédié.
- **Autorisations vérifiées seulement dans l'Orchestrator :** les appels directs ou jobs au plugin contourneraient la sécurité ; rejeté.

## 4. Conséquences et compromis

Le produit respecte la confidentialité de manière structurelle, mais les vérifications coûtent de la latence et imposent des requêtes ACL-aware et des caches prudents. Une réponse partielle ou un refus est acceptable si les données nécessaires ne sont pas accessibles. Les scores de recherche et les messages d'erreur ne doivent pas révéler l'existence de documents cachés.

## 5. Sécurité et isolation

C'est une décision transversale et obligatoire. Inclure dans le modèle de menace : divulgation inter-tenant, élévation de rôle, inversion de cache, changement d'ACL pendant un job, anciennes conversations, métadonnées/citations, prompt injection, fuite dans les logs/observabilité et reconstruction statistique de données confidentielles. Prévoir tests adversariaux automatisés avec ressources autorisées et interdites.

## 6. État et mise en œuvre

**Non implémenté par les routes actuelles.** Construire d'abord Identity/Authorization du Core, puis un Knowledge Plugin filtrant réellement les chunks et le premier parcours sécurisé Gateway → Orchestrator → Knowledge. Différer les fonctions hybrides jusqu'à preuve que tous leurs outils appliquent les mêmes règles. Définir une politique explicite de rétention et de retrait des réponses déjà générées.

## 7. Critères de validation

- Deux employés posent la même question ; chacun reçoit uniquement le contenu de son périmètre.
- Une tentative de citation, d'export, d'historique et d'appel direct ne divulgue pas une ressource refusée.
- La révocation en cours de job bloque la publication du résultat.
- Un document malveillant ne peut forcer l'utilisation d'un plugin ou d'une ACL interdits.
- Les tests d'accès négatifs traversent Gateway, Core, Orchestrator, plugins et worker, pas seulement les composants mockés.

## 8. Traçabilité

- ADR liés : ADR-0005, ADR-0008, ADR-0010, ADR-0011, ADR-0012, ADR-0018, ADR-0019, ADR-0020, ADR-0021.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
