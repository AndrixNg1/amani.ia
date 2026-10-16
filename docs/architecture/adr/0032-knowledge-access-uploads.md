---
title: "ADR-0032 — Knowledge : ACL conservatrices et uploads versionnés"
status: "Accepté — implémentation soumise à validation manuelle"
date: "2026-10-15"
lang: fr-FR
---

# ADR-0032 — Knowledge : ACL conservatrices et uploads versionnés

## Décision et justification

Conserver Drizzle/node-postgres, migrations SQL versionnées et empreintes comme Core.
Knowledge possède le schéma knowledge sous amani_knowledge. Les FK composites incluent
organization_id et empêchent les associations base/source/document/version inter-tenant.

Les ACL initiales ciblent uniquement des memberships Core actives. Teams et rôles ne
sont pas acceptés tant qu’un contrat fiable de résolution n’existe pas. Les actions
read, ingest, manage sont indépendantes. Le créateur reçoit les trois sur sa base.
Un document inherit utilise les droits de la base. Un document restricted exige
la conjonction du droit sur la base ET du même droit explicite sur le document.
Aucune union permissive, aucun bypass owner/admin implicite. Passer en restricted
attribue les trois actions au membership gestionnaire ; les autres doivent être
accordées explicitement. Archiver bloque les opérations et descendants immédiatement.

Core reste autorité de membership, permission et installation/entitlement. Un petit
endpoint interne fournit décision et membership courant ; la lecture Core existante
par user impose members.read et ne convient pas à un lecteur documentaire ordinaire.
Il ne reçoit ni ACL ni identifiant de document. Permission Core : lecture =
knowledge.documents.read, ingestion = plugins.use, gestion = plugins.manage ; chacune
nomme knowledge pour vérifier son installation et abonnement. Les grants ciblant un
membership sont validés par Core sous plugins.manage. ACL locales en complément.

L’authentification reste désactivée par défaut. L’adaptateur de développement reprend
la délégation HMAC bornée existante avec clés séparées Gateway→Core, appelant→Knowledge
et Knowledge→Core. Le dernier appelant ne peut utiliser que le nouvel endpoint interne.
Aucun mécanisme de production n’est inventé ; les adaptateurs locaux sont interdits
hors développement/test et loopback. Pas de route Gateway→Knowledge dans cet incrément.

## Upload et cohérence

Choix : POST S3 présigné à durée courte, clé opaque, MIME exact et taille exacte dans
la policy. Pas de proxy de gros upload NestJS. Le bucket doit être privé ET versionné.
À la finalisation, HEAD fige un VersionId non null ; GET de CETTE version calcule le
SHA-256 et vérifie taille/MIME. La version validée reste adressée par VersionId même
si une URL d’upload réutilisée écrit un nouveau head. Refuser un bucket non versionné.
Le contrôle de MIME est une déclaration vérifiée contre les métadonnées, pas un scan
ni une extraction : aucun contenu n’est prêt à la recherche avant le futur worker.

L’intention crée document/version et conserve une clé d’idempotence tenant/acteur.
Une reprise identique retrouve l’intention ; un payload différent sous la même clé
est un conflit. Finalize répété conserve version et unique ingestion_request. Un objet
sans finalisation reste privé et récupérable par reprise ; l’annulation/expiration
interdit la finalisation. Pas de prétendue transaction ACID SQL+S3. Les objets abandonnés
et versions supplémentaires attendent un nettoyage opérateur après expiration des URLs.
L’archivage est logique ; aucun effacement physique automatique de documents métier.

L’ingestion est enregistrée transactionnellement, versionnée, unique par version de
document. Aucun publisher Redis, consommateur, extraction, chunk, embedding ou retrieval.
Le worker devra réautoriser avant accès et publication. Audit Knowledge local limité
aux mutations de ressources ; Core conserve l’audit global de plateforme.

## Coûts, limites et validation

La vérification SHA-256 lit le binaire côté serveur à finalisation avec taille/durée
bornées ; ce n’est ni un proxy d’upload ni un parseur documentaire. Versioning exige
une politique de nettoyage et de rétention. Les décisions Core et transactions Knowledge
ne forment pas une transaction distribuée : pas de cache, contrôle frais par opération,
verrou local de base pour sérialiser ACL et mutations, revalidation après stockage lent.
Une révocation ne révoque pas une URL déjà émise ; TTL court, aucune URL de lecture ici.
Tests de concurrence, version pinning, erreurs S3, révocation, ACL et refus Core requis.
Tous les tests et contrôles d’exécution restent **NOT RUN BY REQUEST**.

Voir ADR-0031, ADR-0011, ADR-0012, ADR-0014 et ADR-0024.
