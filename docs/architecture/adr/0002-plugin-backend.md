---
title: "ADR-0002 — Architecture backend par API et plugins indépendants"
status: "Accepté"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0002 — Architecture backend par API et plugins indépendants

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté** |
| Date | 27 septembre 2026 |
| Portée | Découpage du backend, frontières de services et modèle d’activation multi-tenant |
| ADR liés | ADR-0001, ADR-0003, ADR-0004, ADR-0005, ADR-0009, ADR-0015 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Amani IA permet à une entreprise d'activer des capacités distinctes sans installer une plateforme complète par client. Le monorepo contient déjà trois applications NestJS de plateforme (`gateway`, `core-api`, `ai-orchestrator`) et cinq squelettes NestJS sous `plugins/`. Ces projets démarrent indépendamment ; leurs intégrations métier restent à construire. Il faut éviter de remplacer le monolithe historique par un ensemble de services qui partageraient leurs bases et leurs modules internes.

## 2. Décision

**Les frontières d'exécution suivent les responsabilités métier.** La Gateway reçoit les requêtes externes ; le Core Platform gère l'identité, les organisations, les abonnements, le registre et les installations ; l'AI Orchestrator coordonne les tâches IA. Les API Knowledge, Data Analytics, Conversations, Connectors et Evaluation sont cinq services métier distincts. Chaque API possède son processus, sa configuration, ses tests, ses contrats et son cycle de déploiement.

**Un plugin est une capacité logique installable par organisation, pas un conteneur par tenant.** Une même instance de service peut traiter plusieurs organisations ; chaque requête, job, cache et accès aux données applique l'isolation du tenant. L'installation est enregistrée dans le Core ; le plugin provisionne son espace logique sans exiger un nouveau déploiement pour chaque client.

**Un service ne connaît pas les détails internes d'un autre.** Il consomme des contrats HTTP versionnés ou des événements. Il n'importe ni modules métier NestJS ni repositories SQL d'une autre API. Les packages `@amani/*` regroupent les contrats et utilitaires réellement transversaux, jamais une couche métier commune imposée à tous.

**La Gateway n'est pas un bus interne.** Deux API autorisées peuvent communiquer directement via un réseau interne authentifié ; les dépendances autorisées sont explicites. Le Core administre les politiques mais ne devient pas un proxy pour tous les accès documentaires.

## 3. Alternatives examinées

- **Monolithe NestJS modulaire :** moins d'opérations réseau, mais déploiement et montée en charge liés entre plugins ; non retenu pour l'extensibilité décidée.
- **Un microservice par fonction technique :** granularité excessive, nombreuses transactions distribuées et coordination coûteuse ; non retenu.
- **Une instance de plugin par entreprise :** isolation physique envisageable pour certaines offres futures, mais coût disproportionné pour la V1 multi-tenant.

## 4. Conséquences et compromis

**Gains :** ownership clair, tests ciblés, évolution et déploiement indépendants, disponibilité d'un catalogue de fonctionnalités. **Coûts :** pannes partielles, latence réseau, contrats versionnés, migrations coordonnées, tracing distribué et nécessité de tests d'intégration. L'indépendance de déploiement sera démontrée et non simplement affirmée par l'arborescence.

## 5. Sécurité et isolation

Chaque plugin est une frontière d'autorisation ; son exposition interne ne suffit jamais à prouver la légitimité d'un appel. Il valide l'identité du service, le contexte utilisateur délégué, l'appartenance à l'organisation, le droit d'utiliser le plugin et les ACL des ressources. Aucun accès SQL interservices n'est autorisé. Voir ADR-0010, ADR-0011, ADR-0012 et ADR-0013.

## 6. État et mise en œuvre

**Existant :** les huit squelettes NestJS possèdent leurs points d'entrée et routes de santé ; les packages et workers sont pour partie réservés. **À faire :** définir manifestes de plugin, contrats, SDK, auth interservices, bases propriétaires, déploiements et tests de frontière. Ne pas ajouter de fausses intégrations aux health checks.

## 7. Critères de validation

- Chaque service démarre seul et expose `/health`.
- Un plugin peut évoluer sans importer le code privé ni les entités SQL d'un autre.
- L'activation pour l'organisation A ne confère aucun droit à l'organisation B.
- La désactivation logique d'un plugin n'arrête pas le service pour les autres organisations.
- Un test de contrat détecte une rupture d'API et un test E2E vérifie un appel interne authentifié.

## 8. Traçabilité

- ADR liés : ADR-0001, ADR-0003, ADR-0004, ADR-0005, ADR-0009, ADR-0015.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
