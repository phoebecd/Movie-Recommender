import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
import nltk
from nltk.corpus import stopwords
import re

# Simple keyword-based summarizer
def generate_simple_summary(row):
    title = row['title']
    overview = row['overview']
    if pd.isna(overview) or overview == "":
        return f"A film about {title}."
    
    # Simple logic: Take the first sentence and trim it
    first_sentence = overview.split('.')[0]
    return f"{first_sentence.strip()}."

def main():
    print("Loading dataset...")
    df = pd.read_csv("data/tmdb_5000_movies.csv")
    
    print("Generating summaries...")
    df['one_sentence_summary'] = df.apply(generate_simple_summary, axis=1)
    
    print("Saving enriched dataset...")
    df.to_csv("data/tmdb_5000_movies_enriched.csv", index=False)
    print("Done!")

if __name__ == "__main__":
    main()
