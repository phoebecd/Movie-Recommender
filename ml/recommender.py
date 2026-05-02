import numpy as np
import joblib
from sklearn.metrics.pairwise import cosine_similarity
import os

# Load model and vectors on startup
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

# Initial load
load_models()

def get_recommendations(user_vector, contextual_inputs, exclude_movie_ids, limit):
    # Reload if not initialized (sanity check)
    if model is None: load_models()
    
    if model is None or movie_vectors is None:
        return {"recommendations": []}

    user_vec_arr = np.array(user_vector).reshape(1, -1)
    
    # Cold start check
    if user_vec_arr.shape[1] == 0 or np.all(user_vec_arr == 0):
        # Fallback to random if no vector
        indices = np.random.choice(len(movie_ids), min(limit, len(movie_ids)), replace=False)
        return {"recommendations": [{"movieId": str(movie_ids[i]), "confidenceScore": 0.5, "whyThisText": "Starting your journey!"} for i in indices]}

    # Find cluster
    cluster = model.predict(user_vec_arr)[0]
    
    # Get all movies in cluster
    cluster_indices = np.where(model.labels_ == cluster)[0]
    
    # Compute similarity within cluster
    similarities = cosine_similarity(user_vec_arr, movie_vectors[cluster_indices])[0]
    
    results = []
    for i, idx in enumerate(cluster_indices):
        m_id = str(movie_ids[idx])
        if m_id in exclude_movie_ids:
            continue
            
        score = similarities[i]
        
        # Template-based whyThisText
        mood = contextual_inputs.get('mood', ['something'])[0]
        results.append({
            "movieId": m_id,
            "confidenceScore": float(score),
            "whyThisText": f"Matches your taste for {mood} films."
        })
        
    results.sort(key=lambda x: x['confidenceScore'], reverse=True)
    return {"recommendations": results[:limit]}

def get_blended_recommendations(user_vectors, contextual_inputs, exclude_movie_ids):
    if not user_vectors:
        return {"recommendations": []}
    
    # Average vectors
    blended_vector = np.mean(user_vectors, axis=0).tolist()
    return get_recommendations(blended_vector, contextual_inputs, exclude_movie_ids, 20)
