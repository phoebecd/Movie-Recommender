import json
import os
from typing import Optional

import joblib
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

MODEL_PATH = "kmeans_model.pkl"
VECTORS_PATH = "movie_vectors.npy"
MOVIE_IDS_PATH = "movie_ids.npy"
TFIDF_PATH = "tfidf_vectorizer.pkl"
METADATA_PATH = "movie_metadata.json"

model = None
movie_vectors = None
movie_ids = None
vectorizer = None
movie_meta: Optional[dict] = None


def load_models():
    global model, movie_vectors, movie_ids, vectorizer, movie_meta
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
    if os.path.exists(VECTORS_PATH):
        movie_vectors = np.load(VECTORS_PATH)
    if os.path.exists(MOVIE_IDS_PATH):
        movie_ids = np.load(MOVIE_IDS_PATH, allow_pickle=True)
    if os.path.exists(TFIDF_PATH):
        vectorizer = joblib.load(TFIDF_PATH)
    if os.path.exists(METADATA_PATH):
        with open(METADATA_PATH) as f:
            movie_meta = json.load(f)


load_models()


def _mmr_select(
    candidates: list,
    candidate_vecs: np.ndarray,
    lam: float,
    n: int,
    metadata: Optional[list] = None,
) -> list:
    """
    Max Marginal Relevance with optional era/language soft penalties.

    lam=1.0 → pure similarity, lam=0.0 → pure diversity.
    metadata: list of dicts with 'decade' and 'language', parallel to candidates.
    """
    MAX_PER_DECADE = 4
    MAX_ENGLISH = 10  # out of n=20; leaves room for non-English films

    if not candidates:
        return []

    selected_pos: list[int] = []
    remaining = list(range(len(candidates)))
    decade_counts: dict[int, int] = {}
    lang_counts: dict[str, int] = {}

    while len(selected_pos) < n and remaining:
        if not selected_pos:
            best = max(remaining, key=lambda i: candidates[i]["rawScore"])
        else:
            sel_vecs = candidate_vecs[selected_pos]

            def mmr_score(i: int) -> float:
                sim_user = candidates[i]["rawScore"]
                sim_sel = float(
                    np.max(cosine_similarity(candidate_vecs[i : i + 1], sel_vecs))
                )
                score = lam * sim_user - (1.0 - lam) * sim_sel
                if metadata:
                    decade = metadata[i].get("decade")
                    lang = metadata[i].get("language")
                    if decade and decade_counts.get(decade, 0) >= MAX_PER_DECADE:
                        score -= 0.15
                    if lang == "en" and lang_counts.get("en", 0) >= MAX_ENGLISH:
                        score -= 0.10
                return score

            best = max(remaining, key=mmr_score)

        if metadata:
            decade = metadata[best].get("decade")
            lang = metadata[best].get("language")
            if decade:
                decade_counts[decade] = decade_counts.get(decade, 0) + 1
            if lang:
                lang_counts[lang] = lang_counts.get(lang, 0) + 1

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

    # Score every movie: 80% cosine similarity + 20% cluster proximity
    all_sims = cosine_similarity(user_vec_arr, movie_vectors)[0]

    centre_sims = cosine_similarity(user_vec_arr, model.cluster_centers_)[0]
    c_min, c_max = centre_sims.min(), centre_sims.max()
    if c_max > c_min:
        centre_sims_norm = (centre_sims - c_min) / (c_max - c_min)
    else:
        centre_sims_norm = np.ones_like(centre_sims)
    cluster_bonus = centre_sims_norm[model.labels_]
    weighted = 0.80 * all_sims + 0.20 * cluster_bonus

    mood = contextual_inputs.get("mood", ["something"])
    mood_label = mood[0] if mood else "something"

    # Build candidates, keeping vector index and metadata aligned
    exclude_set = set(exclude_movie_ids)
    paired = []  # (candidate_dict, vector_index, metadata_dict)
    for i, score in enumerate(weighted):
        m_id = str(movie_ids[i])
        if m_id in exclude_set:
            continue
        meta = movie_meta.get(m_id, {}) if movie_meta else {}
        paired.append((
            {
                "movieId": m_id,
                "rawScore": float(score),
                "confidenceScore": float(score),
                "whyThisText": f"Aligns with your taste for {mood_label} films.",
            },
            i,
            {"decade": meta.get("decade"), "language": meta.get("language")},
        ))

    if not paired:
        return {"recommendations": []}

    # Sort by score and build aligned pool (fixes previous vector-index mismatch)
    paired.sort(key=lambda x: x[0]["rawScore"], reverse=True)
    pool_size = min(300, len(paired))
    pool = [p[0] for p in paired[:pool_size]]
    pool_indices = [p[1] for p in paired[:pool_size]]
    pool_meta = [p[2] for p in paired[:pool_size]]
    pool_vecs = movie_vectors[pool_indices]

    # λ=0.55: 55% relevance, 45% diversity — more varied than the old 0.70
    diverse = _mmr_select(pool, pool_vecs, lam=0.55, n=limit, metadata=pool_meta)

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
