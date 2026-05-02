import os
from fastapi import FastAPI, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import List, Dict, Optional
import firebase_admin
from firebase_admin import credentials, auth
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="MovieMatch ML Service")

# Initialize Firebase Admin
cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "moviematch-3f5f8-firebase-adminsdk-fbsvc-614af38e39.json")
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

FASTAPI_SECRET = os.getenv("FASTAPI_SECRET", "your-shared-secret")

async def verify_secret(authorization: str = Header(None)):
    if authorization != f"Bearer {FASTAPI_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    return authorization

class RecommendRequest(BaseModel):
    userVector: List[float]
    contextualInputs: Dict
    excludeMovieIds: List[str]
    limit: int

class UserVectorRequest(BaseModel):
    profile: Dict
    favoriteMovieVectors: List[List[float]]
    lastWatchedVectors: List[List[float]]

class BlendRequest(BaseModel):
    userVectors: List[List[float]]
    contextualInputs: Dict
    excludeMovieIds: List[str]

@app.get("/")
async def root():
    return {"message": "MovieMatch ML Service is running"}

# These will be implemented in separate files but imported here
from recommender import get_recommendations, get_blended_recommendations
from vectorizer import compute_user_vector

@app.post("/recommend", dependencies=[Depends(verify_secret)])
async def recommend(req: RecommendRequest):
    return get_recommendations(req.userVector, req.contextualInputs, req.excludeMovieIds, req.limit)

@app.post("/user-vector", dependencies=[Depends(verify_secret)])
async def user_vector(req: UserVectorRequest):
    return compute_user_vector(req.profile, req.favoriteMovieVectors, req.lastWatchedVectors)

@app.post("/blend", dependencies=[Depends(verify_secret)])
async def blend(req: BlendRequest):
    return get_blended_recommendations(req.userVectors, req.contextualInputs, req.excludeMovieIds)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
