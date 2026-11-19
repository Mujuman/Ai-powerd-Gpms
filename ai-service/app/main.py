import hmac
import os
from functools import lru_cache
from math import fsum

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, model_validator

app = FastAPI(title="AI-GPMS Internal AI Service", version="0.1.0")


class SimilarityItem(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=10000)


class SimilarityPair(BaseModel):
    left_id: str = Field(alias="leftId", min_length=1, max_length=80)
    right_id: str = Field(alias="rightId", min_length=1, max_length=80)


class SimilarityRequest(BaseModel):
    items: list[SimilarityItem] = Field(min_length=2, max_length=500)
    pairs: list[SimilarityPair] = Field(min_length=1, max_length=25000)

    @model_validator(mode="after")
    def validate_pairs(self):
        ids = {item.id for item in self.items}
        if len(ids) != len(self.items):
            raise ValueError("Similarity item IDs must be unique")
        if any(pair.left_id not in ids or pair.right_id not in ids for pair in self.pairs):
            raise ValueError("Every similarity pair must reference an item")
        return self


@lru_cache(maxsize=1)
def load_embedding_model():
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as error:
        raise HTTPException(
            status_code=503,
            detail="Install the AI service requirements to enable project similarity analysis",
        ) from error

    model_name = os.getenv("AI_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    try:
        return model_name, SentenceTransformer(model_name)
    except (OSError, RuntimeError) as error:
        raise HTTPException(
            status_code=503,
            detail=f"The configured sentence-embedding model is unavailable: {model_name}",
        ) from error


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-service"}


@app.post("/api/v1/similarity")
def similarity(
    request: SimilarityRequest,
    service_token: str | None = Header(default=None, alias="X-AI-Service-Token"),
) -> dict:
    expected_token = os.getenv("AI_SERVICE_TOKEN")
    if not expected_token:
        raise HTTPException(status_code=503, detail="AI service authentication is not configured")
    if not service_token or not hmac.compare_digest(service_token, expected_token):
        raise HTTPException(status_code=401, detail="Invalid internal service token")

    model_name, model = load_embedding_model()
    embeddings = model.encode(
        [item.text for item in request.items],
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    index = {item.id: position for position, item in enumerate(request.items)}
    scores = []
    for pair in request.pairs:
        left = embeddings[index[pair.left_id]]
        right = embeddings[index[pair.right_id]]
        score = max(-1.0, min(1.0, fsum(float(a) * float(b) for a, b in zip(left, right))))
        scores.append({
            "leftId": pair.left_id,
            "rightId": pair.right_id,
            "score": score,
        })
    return {"modelName": model_name, "scores": scores}
