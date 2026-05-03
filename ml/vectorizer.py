import numpy as np

def compute_user_vector(profile, favorite_movie_vectors, last_watched_vectors):
    """
    Computes a weighted average of movie vectors reflecting the user's taste.
    - favorite movies: 0.6 weight
    - last watched: 0.4 weight
    """
    fav_vecs = np.array(favorite_movie_vectors) if favorite_movie_vectors else np.array([])
    watch_vecs = np.array(last_watched_vectors) if last_watched_vectors else np.array([])
    
    if fav_vecs.size == 0 and watch_vecs.size == 0:
        # Initial cold start: zero vector based on feature size
        return {"vector": [], "clusterLabel": 0}

    vecs = []
    weights = []
    
    if fav_vecs.size > 0:
        vecs.append(np.mean(fav_vecs, axis=0))
        weights.append(0.6)
        
    if watch_vecs.size > 0:
        vecs.append(np.mean(watch_vecs, axis=0))
        weights.append(0.4)
        
    # Weighted average
    if not vecs:
        return {"vector": [0.0] * 384, "clusterLabel": 0}
        
    user_vector = np.average(vecs, axis=0, weights=weights)
    
    # Normalize
    norm = np.linalg.norm(user_vector)
    if norm > 0:
        user_vector = user_vector / norm
        
    return {
        "vector": user_vector.tolist(),
        "clusterLabel": 0 # This will be re-predicted by the main server logic
    }
