---
title: "ADR-0017 — Création des entreprises et provisionnement initial"
status: "Proposé"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0017 — Création des entreprises et provisionnement initial

| Métadonnée | Valeur |
|---|---|
| Statut | **Proposé** |
| Date | 27 septembre 2026 |
| Portée | Inscription utilisateur, création tenant, plugins, invitations et erreurs partielles |
| ADR liés | ADR-0004, ADR-0006, ADR-0011, ADR-0012, ADR-0015, ADR-0016, ADR-0027 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

À la création d'une entreprise, le premier compte choisit son plan et les plugins à activer avant d'inviter les collaborateurs. Il faut garantir qu'une étape partiellement réussie ne laisse pas une organisation active avec des plugins mal provisionnés ni un propriétaire absent. Le Website et l'Enterprise Portal existent comme squelettes mais n'offrent pas encore d'onboarding métier.

## 2. Décision

**Le Core orchestre un workflow d'onboarding traçable.** Étapes proposées : authentifier/inscrire le créateur ; réserver l'organisation et son slug ; créer une adhésion **owner** unique initiale ; sélectionner plan et entitlements ; demander les installations de plugins souhaitées ; provisionner chaque tenant logique ; afficher les états ; inviter les employés ; permettre aux administrateurs habilités d'attribuer les rôles et ACL.

Conserver l'état `draft/provisioning/active/failed/suspended` de l'organisation selon sa disponibilité réelle. Les installations sont des jobs idempotents, chacun ayant un état indépendant ; une panne Analytics ne doit pas autoriser des opérations Analytics mais peut permettre l'utilisation de Knowledge si sa configuration est valide. Les tâches compensatoires doivent être explicites, non des suppressions automatiques de données déjà importées.

**Invitations :** identité de l'invité vérifiée à l'acceptation, jeton à usage limité et expiration, tenant et rôle proposés explicites ; accepter une invitation ne suffit pas à attribuer des ressources confidentielles. L'Owner initial doit disposer d'un chemin sûr de récupération/transfert de propriété, sans création arbitraire de nouveaux propriétaires par un administrateur ordinaire.

L'interface sépare la sélection commerciale des permissions des personnes. Les frontends consomment le statut réel du Core plutôt que d'inférer l'activation depuis un clic client.

## 3. Alternatives examinées

- **Onboarding entièrement synchrone :** échec global si un plugin tarde ou est momentanément indisponible.
- **Créer automatiquement tous les plugins et les désactiver visuellement :** consommation inutile et ambiguïté de facturation.
- **Inscription automatique de tous les employés comme administrateurs :** risque évident d'escalade.

## 4. Conséquences et compromis

Parcours compréhensible, états récupérables et possibilité d'ajouter des plugins après création. Exige un suivi de saga, idempotence, statut d'installation et UX adaptée aux échecs partiels. Une entreprise « créée » ne signifie pas que chaque plugin est prêt.

## 5. Sécurité et isolation

Appliquer les permissions owner sur une identité prouvée, valider unicité et réservation de slug, limiter invitations et opérations d'activation, empêcher le détournement de liens d'invitation. Auditer création, changements de propriété et attribution des rôles sensibles.

## 6. État et mise en œuvre

**Non implémenté.** Commencer par Core organisation/membership et Plugin Registry, puis un wizard Enterprise ou Website selon le parcours UX choisi. Les interfaces de billing restent simulées tant que l'ADR-0016 est proposé. Ne pas connecter de vrai fournisseur de paiement par défaut.

## 7. Critères de validation

- Le créateur est bien owner dans la seule organisation créée.
- Un échec de provisionnement est réessayable sans installations doublées.
- Un utilisateur A ne peut accepter une invitation destinée à B sans vérification du bénéficiaire.
- Les employés invités n'ont que les rôles et ressources explicitement attribués.
- Une interruption entre étapes laisse un état explicite et récupérable.

## 8. Traçabilité

- ADR liés : ADR-0004, ADR-0006, ADR-0011, ADR-0012, ADR-0015, ADR-0016, ADR-0027.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
