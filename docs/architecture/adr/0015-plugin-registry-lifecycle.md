---
title: "ADR-0015 — Plugin Registry, installation et cycle de vie des plugins"
status: "Accepté"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0015 — Plugin Registry, installation et cycle de vie des plugins

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté** |
| Date | 27 septembre 2026 |
| Portée | Catalogue Core, installations tenant, manifestes et provisionnement |
| ADR liés | ADR-0002, ADR-0004, ADR-0006, ADR-0012, ADR-0016, ADR-0017, ADR-0018 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Amani IA commercialise un ensemble de capacités facultatives. L'entreprise sélectionne ses plugins lors de l'inscription ou plus tard ; le propriétaire peut ensuite déléguer leur utilisation. Sans distinction entre plugin disponible, compris dans l'abonnement, installé, activé et utilisable par un collaborateur, les contrôles d'accès deviennent ambigus. Les cinq applications NestJS existent déjà ; aucun registre métier d'installations n'est opérationnel.

## 2. Décision

**Le Core est propriétaire du registre de plugins.** Chaque entrée possède `pluginKey` stable, nom, description, version de manifeste, compatibilité API, état de publication, permissions disponibles et dépendances déclarées. Le manifeste est de la métadonnée validée ; il ne confère pas automatiquement des droits au code du plugin.

**Différencier cinq niveaux :** (1) plugin déployé et disponible sur la plateforme ; (2) entitlement autorisé par l'offre de l'organisation ; (3) installation enregistrée pour cette organisation ; (4) état d'activation/provisionnement ; (5) permission effective du collaborateur sur ce plugin et ses ressources. Un plugin déployé **n'entraîne pas une instance par organisation**. Une installation crée un tenant logique dans les données possédées par le plugin.

**Cycle de vie proposé :** `available → requested → provisioning → active → suspended/disabled → deprovisioning`, avec état `failed` réessayable et horodatage. L'installation, la suspension et le nettoyage sont des commandes idempotentes. Une désactivation retire l'accès et les outils de l'Orchestrator immédiatement après prise d'effet, sans effacement silencieux. Définir une politique séparée de conservation/purge et notifier les administrateurs.

La plateforme ne charge pas de code arbitraire fourni par les entreprises comme « plugin » lors de la V1 : les services sont développés et déployés par l'équipe Amani IA. Une extension tierce devra disposer d'un modèle de signature, sandbox et validation propre à une décision ultérieure.

## 3. Alternatives examinées

- **Flags de fonctionnalités codés en dur dans chaque frontend :** rapides mais non auditables et susceptibles de diverger du Core.
- **Conteneur par plugin et par entreprise :** isolation physique possible mais très coûteuse à opérer en SaaS standard.
- **Plugin exécutable tiers dynamique dès la V1 :** surface de sécurité trop large et gouvernance absente.

## 4. Conséquences et compromis

Le catalogue et les installations deviennent traçables et facturables, et les frontends peuvent refléter la configuration réelle. En revanche, les transitions de cycle de vie demandent orchestration, compensation en cas d'échec et compatibilité des versions entre Core et plugins.

## 5. Sécurité et isolation

Seul un administrateur de l'organisation autorisé peut demander activation et configuration, selon entitlements. Une installation ne confère aucun accès aux ressources à un simple utilisateur. Les commandes de cycle de vie sont authentifiées entre Core et plugin et auditées. Le plugin refuse les requêtes tant que l'installation n'est pas active.

## 6. État et mise en œuvre

**À implémenter :** tables `plugin_catalog`, `plugin_versions`, `organization_plugin_installations`, registre des permissions, endpoints de consultation et commandes provision/disable, événements versionnés et SDK. Les manifestes des cinq plugins peuvent d'abord être maintenus statiquement dans Core et évoluer vers un registre dynamique seulement si justifié.

## 7. Critères de validation

- Une installation répétée n'engendre ni doublon ni état incohérent.
- Deux entreprises ont des configurations distinctes sur le même service déployé.
- Une suspension retire immédiatement le plugin du plan de l'Orchestrator.
- Un utilisateur sans permission ne peut pas utiliser un plugin pourtant activé.
- Un échec de provisionnement est visible et peut être rejoué sans fuite de données.

## 8. Traçabilité

- ADR liés : ADR-0002, ADR-0004, ADR-0006, ADR-0012, ADR-0016, ADR-0017, ADR-0018.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
