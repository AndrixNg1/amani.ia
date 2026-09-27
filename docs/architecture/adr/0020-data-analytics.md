---
title: "ADR-0020 — Data Analytics Plugin : datasets et analyses sécurisées"
status: "Accepté"
date: "2026-09-27"
lang: fr-FR
---

# ADR-0020 — Data Analytics Plugin : datasets et analyses sécurisées

| Métadonnée | Valeur |
|---|---|
| Statut | **Accepté** |
| Date | 27 septembre 2026 |
| Portée | plugins/data-analytics, workers/data-engine, import CSV/XLSX et résultats analytiques |
| ADR liés | ADR-0006, ADR-0008, ADR-0010, ADR-0012, ADR-0013, ADR-0014, ADR-0018, ADR-0024 |

> **Lecture du statut :** une décision d'architecture peut être acceptée sans être encore implémentée. Les sections « État et mise en œuvre » décrivent ce qui est réellement disponible.

## 1. Contexte

Les fichiers CSV/XLSX suivent une chaîne déterministe de données distincte du RAG documentaire. Une question utilisateur peut demander un profilage, un filtrage, un calcul statistique ou une visualisation, éventuellement à combiner avec les résultats Knowledge. L'API NestJS Data Analytics est déjà initialisée ; le worker Python reste à construire. L'exécution arbitraire de code fourni par le LLM n'est pas acceptable sur des données clients.

## 2. Décision

**Data Analytics est propriétaire des métadonnées de datasets, schémas détectés, permissions de données et demandes d'analyse.** L'import valide droits, type et taille, stocke l'original en MinIO et crée un profil de colonnes, types, valeurs manquantes et limitations. Le plugin propose au départ des opérations analytiques **allowlistées et déterministes**, exprimées par contrats structurés : sélection de colonnes, filtres validés, agrégations, statistiques et graphiques.

Le **Python Data Engine** réalise le calcul lourd dans un processus isolé et limité (ressources, durée, accès réseau, filesystem temporaire, jeux de données autorisés). Outils pressentis : Pandas/Polars et éventuellement DuckDB selon la charge ; ne pas lier l'ADR à toutes les bibliothèques simultanément. Le transport NestJS ↔ Python doit être explicitement choisi (FastAPI authentifié et jobs Redis orchestrés par le plugin pour démarrer, ou protocole de queue compatible documenté).

**Autorisations multi-niveaux :** permission de plugin, dataset, opérations, restrictions de lignes/colonnes et classification. Les projections et filtres sont appliqués **avant** de transmettre le dataset au moteur ; si une isolation stricte exige des vues limitées, générer ces vues sous contrôle backend plutôt que confier tout le classeur au worker. Éviter qu'un résultat agrégé révèle indirectement de petits groupes protégés. Stocker résultats, graphiques et exports avec ACL et expiration ; réautoriser avant téléchargement.

L'Orchestrator peut traduire une intention en plan d'analyse validé, mais ni le texte utilisateur ni le LLM ne contrôlent librement les chemins, connexions SQL ou modules Python. La V1 ne prend pas en charge des requêtes SQL arbitraires sur l'instance PostgreSQL SaaS.

## 3. Alternatives examinées

- **Tout convertir en texte pour le RAG :** perd la précision des calculs tabulaires et la sémantique des colonnes.
- **Code Python arbitraire généré par LLM :** risque d'exfiltration et de commande système ; non retenu sans sandbox forte future.
- **Traiter tout dans NestJS :** duplique l'écosystème analytique et bloque potentiellement le serveur HTTP.

## 4. Conséquences et compromis

Calculs reproductibles, analyse explicable et séparation du moteur d'exécution. En contrepartie, schémas hétérogènes, permissions de lignes/colonnes, traitements longs et conformité statistique sont complexes. Commencer par une liste restreinte d'opérations et enrichir sur preuves d'usage.

## 5. Sécurité et isolation

Comptes SQL et credentials fortement limités ; dataset tenant-scoped, colonnes sensibles exclues du contexte IA lorsque non permises, isolation du runtime, quotas, absence d'accès réseau par défaut, résultats réautorisés et purge des fichiers temporaires. Vérifier les transformations et agrégations contre la réidentification.

## 6. État et mise en œuvre

**À faire :** contrats dataset et plan d'analyse, stockage, API de jobs, worker Python avec `uv`/FastAPI, tests de sandbox et matrices de permissions. Les dépendances Python restent indépendantes des npm workspaces. Le choix final du protocole de queue doit satisfaire ADR-0006.

## 7. Critères de validation

- Un employé non autorisé ne peut accéder à une colonne sensible par agrégat, graphique ou export.
- Un job annulé ou dont le droit a expiré ne publie pas de résultat.
- Le moteur refuse chemins arbitraires, exfiltration réseau et SQL interservices.
- Les mêmes données et plans synthétiques produisent des calculs déterministes.
- Le temps et la mémoire des analyses dépassant les quotas sont interrompus proprement.

## 8. Traçabilité

- ADR liés : ADR-0006, ADR-0008, ADR-0010, ADR-0012, ADR-0013, ADR-0014, ADR-0018, ADR-0024.
- Les diagrammes correspondants seront créés après validation des ADR. Un schéma cible ne constitue pas une preuve d'implémentation.
