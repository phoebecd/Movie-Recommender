import numpy as np
import joblib
from sklearn.metrics.pairwise import cosine_similarity
import os

MODEL_PATH = "kmeans_model.pkl"
VECTORS_PATH = "movie_vectors.npy"
MOVIE_IDS_PATH = "movie_ids.npy"
TFIDF_PATH = "tfidf_vectorizer.pkl"

model = None
movie_vectors = None
movie_ids = None
vectorizer = None


def load_models():
    global model, movie_vectors, movie_ids, vectorizer
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
    if os.path.exists(VECTORS_PATH):
        movie_vectors = np.load(VECTORS_PATH)
    if os.path.exists(MOVIE_IDS_PATH):
        movie_ids = np.load(MOVIE_IDS_PATH, allow_pickle=True)
    if os.path.exists(TFIDF_PATH):
        vectorizer = joblib.load(TFIDF_PATH)


load_models()


def _mmr_select(candidates: list, candidate_vecs: np.ndarray, lam: float, n: int) -> list:
    """
    Max Marginal Relevance: picks `n` items that balance similarity to the user
    (via pre-computed `rawScore`) against diversity from already-selected items.

    lam=1.0 → pure similarity (no diversity), lam=0.0 → pure diversity.
    """
    if not candidates:
        return []

    selected_pos: list[int] = []
    remaining = list(range(len(candidates)))

    while len(selected_pos) < n and remaining:
        if not selected_pos:
            best = max(remaining, key=lambda i: candidates[i]["rawScore"])
        else:
            sel_vecs = candidate_vecs[selected_pos]  # (k, dim)

            def mmr_score(i: int) -> float:
                sim_user = candidates[i]["rawScore"]
                # Similarity to the nearest already-selected item
                sim_sel = float(
                    np.max(cosine_similarity(candidate_vecs[i : i + 1], sel_vecs))
                )
                return lam * sim_user - (1.0 - lam) * sim_sel

            best = max(remaining, key=mmr_score)

        selected_pos.append(best)
        remaining.remove(best)

    return [candidates[i] for i in selected_pos]


def get_recommendations(user_vector, contextual_inputs, exclude_movie_ids, limit):
    if model is None:
        load_models()
    if model is None or movie_vectors is None:
        return {"recommendations": []}

    user_vec_arr = np.array(user_vector).reshape(1, -1)

    # Cold start: no vector yet
    if user_vec_arr.shape[1] == 0 or np.all(user_vec_arr == 0):
        indices = np.random.choice(len(movie_ids), min(limit * 3, len(movie_ids)), replace=False)
        results = []
        for i in indices:
            m_id = str(movie_ids[i])
            if m_id not in exclude_movie_ids:
                results.append({
                    "movieId": m_id,
                    "confidenceScore": 0.5,
                    "whyThisText": "Popular pick to start your journey!",
                })
            if len(results) >= limit:
                break
        return {"recommendations": results}

    # ── Score every movie in the dataset ──────────────────────────────────────
    all_sims = cosine_similarity(user_vec_arr, movie_vectors)[0]  # (N,)

    # Cluster-proximity bonus: movies in the user's nearest clusters score higher.
    # This keeps the output focused but still lets any movie participate.
    centre_sims = cosine_similarity(user_vec_arr, model.cluster_centers_)[0]
    # Normalise centre similarities to [0, 1]
    c_min, c_max = centre_sims.min(), centre_sims.max()
    if c_max > c_min:
        centre_sims_norm = (centre_sims - c_min) / (c_max - c_min)
    else:
        centre_sims_norm = np.ones_like(centre_sims)
    cluster_bonus = centre_sims_norm[model.labels_]  # per-movie bonus

    # Weighted score: 80% cosine similarity + 20% cluster proximity
    weighted = 0.80 * all_sims + 0.20 * cluster_bonus

    mood = contextual_inputs.get("mood", ["something"])
    mood_label = mood[0] if mood else "something"

    # Build candidate list (exclude already-seen movies)
    exclude_set = set(exclude_movie_ids)
    candidates = []
    candidate_indices = []
    for i, score in enumerate(weighted):
        m_id = str(movie_ids[i])
        if m_id in exclude_set:
            continue
        candidates.append({
            "movieId": m_id,
            "rawScore": float(score),
            "confidenceScore": float(score),
            "whyThisText": f"Aligns with your taste for {mood_label} films.",
        })
        candidate_indices.append(i)

    if not candidates:
        return {"recommendations": []}

    # Sort and take top-150 as the MMR pool (fast; full sort over 2000 is fine too)
    candidates.sort(key=lambda x: x["rawScore"], reverse=True)
    pool_size = min(150, len(candidates))
    pool = candidates[:pool_size]
    pool_vecs = movie_vectors[candidate_indices[:pool_size]]

    # ── MMR diversity selection ────────────────────────────────────────────────
    # λ=0.70: 70% relevance, 30% diversity penalty — keeps output varied without
    # sacrificing too much quality. Increase λ for more similarity, decrease for
    # more surprise.
    diverse = _mmr_select(pool, pool_vecs, lam=0.70, n=limit)

    return {"recommendations": [
        {
            "movieId": r["movieId"],
            "confidenceScore": r["confidenceScore"],
            "whyThisText": r["whyThisText"],
        }
        for r in diverse
    ]}


def get_blended_recommendations(user_vectors, contextual_inputs, exclude_movie_ids):
    if not user_vectors:
        return {"recommendations": []}
    blended_vector = np.mean(user_vectors, axis=0).tolist()
    return get_recommendations(blended_vector, contextual_inputs, exclude_movie_ids, 20)
