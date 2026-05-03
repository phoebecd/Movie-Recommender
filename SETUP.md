# MovieMatch Setup Guide 🎬

Follow these steps to set up the MovieMatch full-stack development environment locally.

## 1. Prerequisites
Ensure you have the following installed:
- **Node.js** (v18+)
- **Python** (3.10+)
- **Firebase CLI**: `npm install -g firebase-tools`

---

## 2. Environment Configuration

### Frontend
Create `frontend/.env`:
```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_TMDB_API_KEY=your_v3_api_key
```

### Root / ML
Place the moviematch-3f5f8 json in the root of the ML folder.

---

## 3. Installation & Initialization

### Frontend
```bash
cd frontend
npm install
```

### Cloud Functions
```bash
cd functions
npm install
npm run build
```

### ML Microservice
```bash
cd ml
# Recommended to use a virtualenv
pip install -r requirements.txt
```

---

## 4. Initial Data Seeding
Before using the app, you must populate the local Firestore emulator with movie data and train the lightweight ML model.

**In Terminal 1, run Firebase Emulators**

Starting the local Auth, Firestore, and Functions environment.
```bash
firebase emulators:start --project moviematch-3f5f8
```

**In Terminal 2 (with emulators running):**
```bash
cd ml
export USE_EMULATORS=true
export GCLOUD_PROJECT=moviematch-3f5f8
python seed_firestore.py
```
*Note: This will process the `tmdb_5000_movies.csv` and generate `.pkl` files for the recommender.*

---

## 5. Running the Application

You will need **three** terminal windows open:

### Terminal 1: Firebase Emulators (should already be running from previous step)
Starting the local Auth, Firestore, and Functions environment.
```bash
firebase emulators:start --project moviematch-3f5f8
```

### Terminal 2: ML Microservice
The FastAPI server handling vector computation and recommendations.
```bash
cd ml
export USE_EMULATORS=true
uvicorn main:app --reload --port 8000
```

### Terminal 3: Frontend
The Vite dev server for the React application.
```bash
cd frontend
npm run dev
```

---

## Deployment Warning
This setup uses the **local emulators** by default. To connect to production, set `USE_EMULATORS=false` in your `.env` files and deploy the functions via `firebase deploy`.
