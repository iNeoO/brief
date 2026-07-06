# Brief — Flow

## But

Chaque jour, à heure fixe, l'app récupère les derniers articles de diverses sources, les fait passer à un LLM pour sélection + résumé, transforme ce résumé en audio, et l'envoie aux utilisateurs abonnés.

## Pipeline

1. **Fetch (par provider, planifié)**
   - À heure fixe, chaque provider récupère ses `fetchLimit` derniers articles.
   - Stockage dans `articles` (dédupliqué par `providerId + url`), mise à jour de `providers.lastFetchedAt`.
   - Indépendant du pipeline `jobs` — pas de ligne `jobs` créée pour un simple fetch.

2. **Création du job (par catégorie)**
   - Dès que **tous les providers d'une catégorie** ont terminé leur fetch du jour, un `job` est créé pour cette catégorie/ce jour (`targetDate`).
   - `status = PENDING`, `state = GETTING_ARTICLES` (récupération des articles déjà en base pour cette catégorie, pas un fetch externe).

3. **Sélection + résumé (`CREATING_REPORT`)**
   - La liste d'articles de la catégorie est envoyée à un LLM.
   - Le LLM sélectionne les articles les plus pertinents et génère un texte de résumé.
   - Résumé stocké dans `jobs.summary`, articles retenus tracés dans `job_articles` (avec `rank` pour préserver l'ordre).

4. **Génération audio (`CREATING_AUDIO`)**
   - Le résumé est envoyé à un service externe de synthèse vocale.
   - Peut produire **plusieurs fichiers audio, un par langue**.

5. **Envoi (`SENDING_MESSAGE`)**
   - Le(s) fichier(s) audio sont envoyés via messagerie à tous les utilisateurs abonnés à cette catégorie/ce service.

## Modèle de données (actuel)

- `providers` — config des sources (URL, `fetchLimit`, `lastFetchedAt`, `isEnabled`)
- `categories` — thèmes de résumé (tech, actu globale...), `isEnabled` pour suspendre la génération de jobs sans supprimer l'historique
- `category_providers` — rattachement provider ↔ catégorie, avec un `weight` par provider dans la catégorie (non historisé : si le poids change, on ne peut plus reconstituer *a posteriori* la pondération utilisée pour un job passé)
- `articles` — articles bruts récupérés, dédupliqués par `(providerId, url)`
- `jobs` — un run de pipeline par catégorie/jour : `status` (pending/running/finished/failed), `state` (étape en cours), `retry`, `error`, `summary`. `summary` est réécrit sur chaque retry (pas d'historique des versions précédentes du résumé — seul l'historique des transitions est dans `job_events`)
- `job_articles` — table de jointure : quels articles ont été retenus pour le résumé d'un job donné, avec leur `rank`
- `job_events` — journal d'audit append-only de chaque tentative/transition (`attempt`, `fromState`, `toState`, `status`, `error`)
- `files` — métadonnées des fichiers uploadés (bucket/objectKey S3), un par `(jobId, kind, language)` — régénéré (upsert) sur retry, pas versionné. Actuellement seul `kind = audio_file` existe, `language ∈ {fr, en}`

**Contraintes d'intégrité notables** : `jobs.finishedAt` doit être renseigné ssi `status ∈ (finished, failed)` ; `status = failed` impose `error` renseigné (checks DB). Index partiel `jobs_pending_queue_idx` sur les jobs `pending` pour le polling de la queue. Index `(providerId, publishedAt)` sur `articles` pour les requêtes "articles d'une catégorie sur une fenêtre de temps" (via join `category_providers`).

## Points ouverts / pas encore modélisés

- **Abonnés** : aucune notion `users`/`subscribers` ni de table d'abonnement (qui est abonné à quelle catégorie, dans quelle langue) n'existe encore — c'est l'étape "distribution" du pipeline, pas encore modélisée.
- **Concurrence** : si plusieurs workers pollent `jobs` pour prendre le prochain `PENDING`, utiliser `SELECT ... FOR UPDATE SKIP LOCKED` (l'index partiel `jobs_pending_queue_idx` est fait pour ce scan).
- **Reproductibilité** : `job_articles` ne trace que les articles *sélectionnés* par le LLM, pas l'ensemble des candidats considérés. L'ensemble des candidats reste reconstructible via `articles` filtré par provider + fenêtre de temps, tant que le rattachement provider ↔ catégorie (et son `weight`) n'a pas changé depuis.
- **`file_kind`** : l'enum n'a qu'une seule valeur (`audio_file`) — à surveiller si un nouveau type de fichier apparaît (transcript, notification...).
