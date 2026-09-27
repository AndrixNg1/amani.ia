---
title: "ADR-0005 — Communication synchrone backend-to-backend"
status: "Proposé"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0005 — Communication synchrone backend-to-backend

| Métadonnée | Valeur |
|---|---|
| Statut | **Proposé** |
| Date | 27 septembre 2026 |
| Portée | Appels internes HTTPS, identité de service, délégation utilisateur et résilience |
| ADR liés | ADR-0003, ADR-0004, ADR-0006, ADR-0007, ADR-0011, ADR-0013 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Core, Orchestrator et plugins ont besoin d'échanger sans revenir systématiquement par la Gateway. Ces échanges doivent être explicites, sécurisés et testables ; un appel HTTP interne n'est pas fiable par défaut. Aucun client interservices opérationnel n'est encore présent dans les squelettes.

## 2. Décision

**Proposition pour la V1 : REST sur HTTP(S) avec OpenAPI versionné.** Les services utilisent des clients générés ou maintenus depuis `packages/contracts` et `packages/sdk`, avec timeouts explicites, annulation, taille maximale, codes d'erreur normalisés et `X-Correlation-Id` validé/généré à la frontière. Le HTTPS est requis entre domaines de confiance ; le mode exact de TLS local et de production dépendra de l'environnement choisi.

**Chaque appel transporte deux identités distinctes :** (1) l'identité authentifiée du service appelant et (2) le contexte utilisateur et organisation délégué, prouvé par un mécanisme signé à courte durée de vie ou par une introspection autorisée. Ne jamais considérer `X-User-Id`, `X-Org-Id` ou `X-Roles` comme dignes de confiance à eux seuls. Le service cible vérifie lui-même le droit métier et les ACL locales.

**Limiter les dépendances.** `AI Orchestrator → Core` pour droits et entitlements ; `AI Orchestrator → Knowledge/Analytics/Conversations` selon outils autorisés ; `Plugin API → Core` pour vérifier une permission lorsque nécessaire. Les lectures de ressources restent sous l'API propriétaire. Éviter les cycles d'appels synchrones, les cascades de N requêtes et les transactions couvrant plusieurs bases.

Pour les traitements longs, retourner un identifiant de job et passer à l'asynchrone (ADR-0006), au lieu d'allonger indéfiniment le timeout HTTP. Les retries sont bornés et réservés aux requêtes idempotentes ou munies d'une clé d'idempotence. Pas de retry aveugle pour une écriture irréversible.

## 3. Alternatives examinées

- **gRPC :** contrats typés performants, mais introduit un transport supplémentaire et des besoins spécifiques d'outillage ; réévaluation possible si volumes justifient.
- **Tout via la Gateway :** simplifie certaines règles réseau mais crée un goulot d'étranglement interne.
- **Confiance réseau / headers simples :** explicitement rejetée pour la confidentialité multi-tenant.

## 4. Conséquences et compromis

Débogage et interopérabilité faciles avec REST ; contrepartie : prise en charge des versions, pannes réseau, latences et propagation des erreurs. Les pannes d'une API doivent conduire à des erreurs explicites ou des réponses partielles **sans fuite de données**, jamais à l'assouplissement des permissions.

## 5. Sécurité et isolation

Auth service-à-service et délégation utilisateur sont obligatoires dès la première requête métier. Appliquer le moindre privilège aux jetons internes ; valider audience, expiration, signataire et organization context. Les URL privées ne constituent pas une protection suffisante. Ne pas enregistrer jetons, messages privés ou contenu des documents dans les traces.

## 6. État et mise en œuvre

**État :** décision proposée, contrats et clients absents. Définir le format de contexte signé avec ADR-0011, puis implémenter d'abord le parcours Gateway → Orchestrator → Core → Knowledge, en mesurant les erreurs et les délais. Le stockage d'un contexte d'autorisation dans le navigateur ou Redis ne peut pas le rendre perpétuellement valide.

## 7. Critères de validation

- Contract tests fournisseur/consommateur ; rejet des versions incompatibles.
- Test de faux en-têtes utilisateur, service usurpé, jeton expiré et audience erronée.
- Test de timeout et de non-répétition d'un POST non idempotent.
- Correlation ID visible de bout en bout, sans contenu sensible.
- Une panne Core ne permet pas une recherche non autorisée par repli.

## 8. Traçabilité

- ADR liés : ADR-0003, ADR-0004, ADR-0006, ADR-0007, ADR-0011, ADR-0013.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
