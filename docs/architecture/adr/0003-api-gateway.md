---
title: "ADR-0003 — API Gateway : périmètre, routage et protections"
status: "Accepté"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0003 — API Gateway : périmètre, routage et protections

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté** |
| Date | 27 septembre 2026 |
| Portée | apps/gateway et accès des trois frontends aux API |
| ADR liés | ADR-0002, ADR-0004, ADR-0005, ADR-0011, ADR-0012, ADR-0025 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Le Website, le SaaS Admin et le portail Enterprise nécessitent un point d'entrée cohérent. Exposer chaque Plugin API directement au navigateur compliquerait le routage, la gestion des origines et les contrôles transversaux. À l'inverse, déplacer la logique métier dans une Gateway rendrait la plateforme fortement couplée. Le squelette NestJS `apps/gateway` existe, mais ses clients réels ne sont pas encore implémentés.

## 2. Décision

**La Gateway NestJS est la frontière HTTP publique par défaut.** Elle termine les requêtes entrantes, applique validation élémentaire, limites de taille et de débit, CORS, identifiant de corrélation, contrôle des jetons et routage vers Core, Orchestrator ou Plugin APIs explicitement autorisés.

Les familles de routes publiques, admin SaaS et enterprise seront distinctes. Les opérations du portail Admin restent soumises à une autorisation de plateforme dans le service propriétaire, indépendamment du frontend utilisé. La Gateway transmet le contexte d'identité et d'organisation **vérifié**, jamais des en-têtes arbitraires provenant du client. Les secrets d'appel internes ne sont pas transmis au navigateur.

La Gateway n'est pas propriétaire des organisations, messages, documents ou abonnements. Une fois la requête admise, **le service destinataire réévalue ses permissions métier et ses droits sur les ressources**. Les appels internes Core ↔ Orchestrator ↔ plugins ne repassent pas par la Gateway, sauf besoin explicitement documenté.

Pour un streaming de réponse IA, la Gateway devra supporter une connexion longue avec annulation, délais, contrôle de taille et transmission du contexte sécurisé ; le choix SSE/WebSocket sera décidé selon le contrat réel.

## 3. Alternatives examinées

- **Appels navigateur directs à toutes les APIs :** surface d'exposition et configuration CORS accrues ; écarté.
- **Gateway contenant toute l'autorisation métier :** risque de contournement par les appels internes ; écarté.
- **Service mesh dès la V1 :** pourrait aider à une échelle ultérieure, mais n'est pas requis pour faire fonctionner les premières API.

## 4. Conséquences et compromis

Une entrée publique claire et un endroit unique pour les protections transversales ; en contrepartie, la Gateway devient un composant de disponibilité critique. Prévoir health/readiness distincts, timeouts, propagation des erreurs et aucune journalisation des prompts ou données confidentielles par défaut. Les services internes ne doivent pas dépendre de la Gateway pour leur communication mutuelle.

## 5. Sécurité et isolation

Rejeter toute identité, tenant ou rôle non vérifiables ; filtrer les headers entrants ; politique de taille des uploads ; auth serveur côté Next.js lorsque nécessaire ; interdire d'exposer les API internes sur Internet sans nécessité. Les règles de Gateway ne remplacent pas l'authz locale des plugins. Ne pas faire transiter des identifiants de base ou clés LLM vers les frontends.

## 6. État et mise en œuvre

**Existant :** service NestJS et `/health`, port local 4000. **À faire :** choix concret de vérification des jetons (ADR-0011), routage contractuel, limites, observabilité, gestion des erreurs, propagation du contexte et tests. Ne pas déclarer un `/health` liveness comme un contrôle d'authentification réussi.

## 7. Critères de validation

- Requêtes sans identité sur routes privées rejetées ; origine non autorisée rejetée selon le cas.
- Le routage préserve l'identité prouvée et le correlation ID.
- Un appel direct au plugin avec un faux header utilisateur échoue.
- Un refus émis par le plugin n'est ni transformé en succès ni mis en cache publiquement.
- Les limites de débit et de corps sont exercées par tests automatisés.

## 8. Traçabilité

- ADR liés : ADR-0002, ADR-0004, ADR-0005, ADR-0011, ADR-0012, ADR-0025.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
