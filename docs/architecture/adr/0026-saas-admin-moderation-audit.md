---
title: "ADR-0026 — Administration SaaS, modération et journal d’audit"
status: "Proposé"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0026 — Administration SaaS, modération et journal d’audit

| Métadonnée | Valeur |
|---|---|
| Statut | **Proposé** |
| Date | 27 septembre 2026 |
| Portée | Administration plateforme, support limité, modération, audit et gouvernance |
| ADR liés | ADR-0004, ADR-0010, ADR-0011, ADR-0012, ADR-0015, ADR-0025, ADR-0028 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

L'équipe Amani IA doit gérer le catalogue de plugins, les organisations, incidents, plans et demandes de support. Elle ne doit toutefois pas obtenir un pouvoir de lecture illimité sur tous les documents clients. Le projet `apps/admin` est un squelette de frontend distinct ; les rôles et API de modération sont à concevoir.

## 2. Décision

**Séparer l'administration de plateforme de celle d'une organisation.** Définir dans Core des rôles spécifiques tels que opérateur plateforme, gestionnaire des plugins, support et modérateur, chacun avec des permissions limitées. Les administrateurs SaaS peuvent gérer états d'organisation, plans et catalogues sans être automatiquement membres des tenants qu'ils administrent.

**Modération :** formaliser des types de signalements et actions restreintes (désactivation d'un plugin vulnérable, suspension d'une intégration ou d'un compte suspect), avec motifs, approbations nécessaires et traces d'audit. Les opérations de support sur données clientes doivent être exceptionnelles : justification, durée courte, périmètre explicite, autorisation suivant la politique contractuelle et enregistrement consultable.

**Audit :** événements de mutation sensibles `actor, organization, action, target, outcome, timestamp, correlationId` avec politique d'intégrité, rétention et consultation à définir. Les journaux d'audit ne recopient pas les documents ni les prompts clients ; les accès support peuvent nécessiter un niveau d'enregistrement renforcé. Distinguer audit métier et logs techniques de l'ADR-0028.

Toutes les opérations Admin sont soumises à MFA/step-up auth pour les privilèges critiques si le fournisseur IAM le permet, avec revue de séparation des fonctions et mécanisme contrôlé de comptes d'urgence.

## 3. Alternatives examinées

- **Réutiliser le rôle owner d'une entreprise pour le support SaaS :** mélange de responsabilités et privilèges excessifs.
- **Support ayant accès permanent à toutes les bases :** confidentialité incompatible avec la proposition de valeur.
- **Auditer seulement les logs applicatifs textuels :** difficiles à préserver, exploiter et interpréter pour les actions métier.

## 4. Conséquences et compromis

Opérations traçables et support plus sûr, avec davantage de workflows d'approbation et de contrôle des privilèges. Certains incidents peuvent demander une intervention hors outil qui doit alors suivre une procédure d'urgence documentée.

## 5. Sécurité et isolation

Least privilege, MFA pour admins, séparation de fonctions, pas de lecture transverse implicite, accès support éphémère et audité. Sécuriser les journaux contre modification/suppression non autorisée et empêcher l'audit de devenir lui-même une copie des données clients.

## 6. État et mise en œuvre

**Non implémenté.** Définir matrice des rôles plateforme, endpoints Core, politique de signalement/support et stockage d'audit ; relier ensuite le frontend Admin. Les procédures légales, de conservation et de modération seront validées en fonction du marché et des contrats avant production.

## 7. Critères de validation

- Un modérateur n'accède pas aux données RH d'une entreprise par défaut.
- Une action critique non autorisée échoue même via appel direct à Core.
- Une intervention support a un scope, un motif, une échéance et une trace.
- Les changements de rôles et suspensions sont retrouvables dans l'audit.
- Les logs exposés à l'opérateur ne contiennent pas de tokens ou de données sensibles non nécessaires.

## 8. Traçabilité

- ADR liés : ADR-0004, ADR-0010, ADR-0011, ADR-0012, ADR-0015, ADR-0025, ADR-0028.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
