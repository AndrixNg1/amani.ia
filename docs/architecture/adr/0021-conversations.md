---
title: "ADR-0021 — Conversations Plugin : messages et historique sécurisé"
status: "Proposé"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0021 — Conversations Plugin : messages et historique sécurisé

| Métadonnée | Valeur |
|---|---|
| Statut | **Proposé** |
| Date | 27 septembre 2026 |
| Portée | plugins/conversations, stockage de sessions et accès aux anciennes réponses |
| ADR liés | ADR-0009, ADR-0010, ADR-0012, ADR-0013, ADR-0014, ADR-0018 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Les utilisateurs ont besoin d'un historique de leurs interactions, éventuellement avec recherche Knowledge et analyses de datasets. Un message peut contenir une donnée privée, une citation ou un artefact dérivé : sa sécurité ne s'épuise pas au moment où il est généré. L'application NestJS Conversations existe comme squelette mais ne stocke pas encore de conversations métier.

## 2. Décision

**Conversations est propriétaire des conversations, messages, références et états de partage.** Chaque conversation possède tenant, créateur, liste de participants autorisés, classification et dates de rétention. Les messages sont ordonnés, identifiés et reliés aux artefacts détenus par leurs plugins d'origine, sans copier systématiquement des documents entiers dans l'historique.

La lecture, recherche dans l'historique, partage, export et reprise d'un contexte exigent une **autorisation fraîche** tenant + conversation + ressource. Une citation sauvegardée ne constitue pas une permission durable sur sa source. Si un droit est révoqué, le service masque les références et passages qui ne sont plus accessibles ; il faut définir si une ancienne réponse entière doit être caviardée, invalidée ou régénérée selon sa provenance.

**L'Orchestrator orchestre et produit ; Conversations conserve sous contrat.** Le plugin peut enregistrer le résultat après validation du contexte et la présence des droits `conversations.write`. Les messages de service et les réponses en streaming ont des états `pending/complete/failed` pour éviter l'exposition de réponses partielles non vérifiées. Partage collaboratif prévu seulement avec un modèle ACL explicite, pas une URL publique devinable.

## 3. Alternatives examinées

- **Historique stocké par chaque frontend :** divergence des sessions et contrôle serveur insuffisant.
- **Historique stocké exclusivement dans l'Orchestrator :** mélange exécution et domaine conversationnel.
- **Enregistrer toutes les sources récupérées en texte intégral :** réplication excessive de données et révocation difficile.

## 4. Conséquences et compromis

Historique cohérent, pagination et audit de partage ; obligation de gérer provenance, suppression, rétention et confidentialité lors de changements de rôles. Les références interplugins nécessitent des contrats de résolution qui recontrôlent les droits.

## 5. Sécurité et isolation

Par défaut, conversations privées à leurs participants habilités dans le tenant. Jamais de consultation cross-tenant ou de partage public implicite. Réautoriser citations, sources, exports et anciennes réponses ; isoler clés Redis et historiques de sessions. Éviter d'enregistrer prompts privés dans la télémétrie non nécessaire.

## 6. État et mise en œuvre

**Non implémenté.** Définir schéma SQL propriétaire, statuts messages, relation à Orchestrator, provenance et modèle ACL. Ajouter tests de révocation et suppression avant le partage d'historique. Prévoir synthèses de contexte limitées par droits plutôt que réinjecter tous les anciens messages sans contrôle.

## 7. Critères de validation

- Le lecteur non participant ne consulte pas la conversation même s'il devine l'ID.
- Après révocation Knowledge, une citation historique ne fournit plus un téléchargement interdit.
- Une conversation créée dans A reste invisible dans B.
- Export et lien de partage revérifient ACL et rétention.
- Un flux interrompu ne publie pas une réponse non validée comme définitive.

## 8. Traçabilité

- ADR liés : ADR-0009, ADR-0010, ADR-0012, ADR-0013, ADR-0014, ADR-0018.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
