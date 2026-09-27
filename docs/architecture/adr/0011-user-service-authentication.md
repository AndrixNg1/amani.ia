---
title: "ADR-0011 — Authentification des utilisateurs et des services"
status: "Proposé"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0011 — Authentification des utilisateurs et des services

| Métadonnée | Valeur |
|---|---|
| Statut | **Proposé** |
| Date | 27 septembre 2026 |
| Portée | Identité utilisateur, sessions, délégation interservices et secrets techniques |
| ADR liés | ADR-0003, ADR-0004, ADR-0005, ADR-0010, ADR-0012, ADR-0025 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

La plateforme distingue visiteurs publics, utilisateurs d'entreprise, propriétaires et personnel Amani IA. Un utilisateur peut avoir plusieurs adhésions, alors qu'un service NestJS doit prouver sa propre identité lorsqu'il agit pour le compte d'un utilisateur. Il faut éviter de traiter une connexion réseau interne ou un header fourni par un client comme une preuve d'autorisation. Aucun fournisseur IAM ni flux final n'est encore arrêté.

## 2. Décision

**Proposition :** retenir un protocole standard d'authentification utilisateur **OIDC/OAuth 2.0**, avec un fournisseur d'identité à décider après étude des besoins (gestion des entreprises, invitations, MFA, récupération et coûts). L'identité authentifiée possède un `userId` stable ; les adhésions, rôles, permissions et entitlements restent sous l'autorité métier Core. L'organisation active est sélectionnée explicitement et son adhésion est vérifiée côté serveur.

**Interservices :** authentifier séparément chaque client de service par un jeton signé de courte durée et audience restreinte, ou une identité mTLS selon le plan de déploiement. Une délégation utilisateur n'est valable que si le service vérifie l'appelant, la signature, la durée, l'audience et l'organisation. Ne pas autoriser une API interne à inventer des `userId` à partir de headers bruts.

**Sessions frontend :** éviter les secrets durables dans `localStorage`. Favoriser des cookies sécurisés côté serveur ou un flux équivalent audité. Les rôles et claims dans un token peuvent devenir périmés : les permissions critiques et l'accès aux ressources exigent vérification actuelle ou invalidation fortement bornée. Prévoir rotation des clés, MFA pour rôles sensibles, révocation, limites de sessions et journaux d'authentification.

La politique de support exceptionnel ou de comptes machines doit être explicitement documentée et auditable, sans accès transversal implicite aux données d'entreprise.

## 3. Alternatives examinées

- **Sessions/JWT propriétaires développés intégralement dans le Core :** contrôle complet, mais forte surface de risque de sécurité et maintenance d'IAM.
- **Confiance dans l'API Gateway seule :** facilite l'entrée mais ne protège pas les appels directs interservices.
- **Jetons longue durée avec rôles figés :** révocation trop lente pour les ressources confidentielles.

## 4. Conséquences et compromis

Séparation de la preuve d'identité et de la décision métier, interopérabilité potentielle avec SSO entreprise. En contrepartie, intégrer un IdP et un cycle de gestion des clés exige de la configuration, et la délégation sûre doit être testée avant toute route métier.

## 5. Sécurité et isolation

Refus sur signature, audience ou expiration incorrecte ; aucune clé privée dans un frontend ; cookies `HttpOnly`/`Secure`/`SameSite` adaptés et protections CSRF sur mutations concernées ; rate limiting et MFA pour les opérations d'administration ; secrets dans coffre ou variables sécurisées. Les ACL de documents restent spécifiques aux plugins.

## 6. État et mise en œuvre

**Non implémenté.** Décider fournisseur OIDC, mode de session, identité des services et format de délégation dans une étape de conception technique documentée. Préparer tests négatifs et processus de rotation avant exposition publique. Le `/health` existant doit rester distinct de l'authentification métier.

## 7. Critères de validation

- Connexion, déconnexion, MFA admin et révocation vérifiés.
- Usurpation d'un service, fausse organisation et replay de délégation rejetés.
- Un rôle retiré n'autorise pas une opération critique grâce à un ancien token.
- Les navigateurs ne reçoivent ni secrets d'application ni jetons de service.
- Audit des connexions sensibles sans enregistrer les credentials.

## 8. Traçabilité

- ADR liés : ADR-0003, ADR-0004, ADR-0005, ADR-0010, ADR-0012, ADR-0025.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
