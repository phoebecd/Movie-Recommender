import os
import pandas as pd
import numpy as np
import json
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
import firebase_admin
from firebase_admin import credentials, firestore
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

# Use emulators if USE_EMULATORS is set
if os.getenv("USE_EMULATORS") == "true":
    os.environ["FIRESTORE_EMULATOR_HOST"] = "localhost:8080"
    os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = "localhost:9099"

# Initialize Firebase
cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "moviematch-3f5f8-firebase-adminsdk-fbsvc-614af38e39.json")
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    except:
        # Fallback if cert missing but emulator requested
        firebase_admin.initialize_app()
db = firestore.client()

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
MODELS_DIR = "." # Save in ml root for simplicity

async def get_tmdb_metadata(tmdb_id):
    """Fetch poster, backdrop and watch providers from TMDB"""
    async with httpx.AsyncClient() as client:
        try:
            # 1. Get images
            res = await client.get(f"https://api.themoviedb.org/3/movie/{tmdb_id}?api_key={TMDB_API_KEY}")
            data = res.json()
            poster_url = f"https://image.tmdb.org/t/p/w500{data.get('poster_path')}" if data.get('poster_path') else ""
            backdrop_url = f"https://image.tmdb.org/t/p/w1280{data.get('backdrop_path')}" if data.get('backdrop_path') else ""
            
            # 2. Get providers
            res_p = await client.get(f"https://api.themoviedb.org/3/movie/{tmdb_id}/watch/providers?api_key={TMDB_API_KEY}")
            data_p = res_p.json()
            us_providers = data_p.get('results', {}).get('US', {}).get('flatrate', [])
            platforms = [p['provider_name'] for p in us_providers]

            return poster_url, backdrop_url, platforms
        except Exception as e:
            print(f"TMDB Error for {tmdb_id}: {e}")
            return "", "", []

def parse_genres(genre_str):
    try:
        data = json.loads(genre_str.replace("'", '"'))
        return [g['name'] for g in data]
    except:
        return []

async def seed():
    print("--- MovieMatch Seeder (Lightweight Mode) ---")
    
    csv_path = "data/tmdb_5000_movies_enriched.csv"
    if not os.path.exists(csv_path):
        csv_path = "data/tmdb_5000_movies.csv"
    
    if not os.path.exists(csv_path):
        print(f"Error: Dataset {csv_path} not found.")
        return
        
    df = pd.read_csv(csv_path)
    df = df.head(2000)

    print(f"Generating TF-IDF vectors for {len(df)} movies...")
    # Pre-process text for TF-IDF
    corpus = []
    for idx, row in df.iterrows():
        title = str(row['title'])
        overview = str(row['overview']) if not pd.isna(row['overview']) else ""
        genres = " ".join(parse_genres(row['genres']))
        corpus.append(f"{title} {genres} {overview}")

    vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
    movie_vectors_sparse = vectorizer.fit_transform(corpus)
    movie_vectors = movie_vectors_sparse.toarray()

    print("Uploading to Firestore and saving local models...")
    movie_ids = []

    for idx, row in df.iterrows():
        tmdb_id = int(row['id'])
        title = str(row['title'])
        overview = str(row['overview']) if not pd.isna(row['overview']) else ""
        genres = parse_genres(row['genres'])
        vector = movie_vectors[idx].tolist()
        
        # Metadata
        poster, backdrop, platforms = await get_tmdb_metadata(tmdb_id)
        
        movie_doc = {
            "title": title,
            "year": int(row['release_date'].split('-')[0]) if not pd.isna(row['release_date']) else 0,
            "runtime": int(row['runtime']) if not pd.isna(row['runtime']) else 0,
            "genres": genres,
            "platforms": platforms,
            "language": str(row['original_language']),
            "description": overview,
            "one_sentence_summary": row.get('one_sentence_summary', ""),
            "tmdb_id": tmdb_id,
            "posterUrl": poster,
            "backdropUrl": backdrop,
            "globalRating": float(row['vote_average']),
            "vote_count": int(row['vote_count']),
            "featureVector": vector
        }
        
        db.collection('movies').document(str(tmdb_id)).set(movie_doc)
        movie_ids.append(str(tmdb_id))
        
        if idx % 50 == 0:
            print(f"Processed {idx} movies...")

    # KMeans Clustering on the same vectors — more movies needs more clusters
    print("Training taste clusters...")
    kmeans = KMeans(n_clusters=30, random_state=42, n_init='auto')
    kmeans.fit(movie_vectors)
    
    # Save artifacts
    joblib.dump(vectorizer, "tfidf_vectorizer.pkl")
    joblib.dump(kmeans, "kmeans_model.pkl")
    np.save("movie_vectors.npy", movie_vectors)
    np.save("movie_ids.npy", np.array(movie_ids))

    print("\n✅ Success!")
    print("1. Firestore seeded (Top 500 movies)")
    print("2. TF-IDF vectorizer saved (tfidf_vectorizer.pkl)")
    print("3. KMeans model saved (kmeans_model.pkl)")
    print("4. Vectors & IDs saved")

if __name__ == "__main__":
    asyncio.run(seed())
