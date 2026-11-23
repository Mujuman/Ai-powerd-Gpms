import hmac
import os
import re
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
        comparisons = {
            tuple(sorted((pair.left_id, pair.right_id)))
            for pair in self.pairs
        }
        if len(comparisons) != len(self.pairs):
            raise ValueError("Similarity pairs must be unique")
        return self


class TitleRecommendationRequest(BaseModel):
    interest: str = Field(min_length=2, max_length=2000)
    area: str = Field(min_length=2, max_length=2000)
    tools: str = Field(min_length=2, max_length=2000)
    problem: str = Field(default="", max_length=2000)
    target_users: str = Field(default="", alias="targetUsers", max_length=2000)
    desired_outcome: str = Field(default="", alias="desiredOutcome", max_length=2000)


@lru_cache(maxsize=1)
def load_embedding_model():
    try:
        from sentence_transformers import SentenceTransformer
    except (ImportError, OSError) as error:
        raise HTTPException(
            status_code=503,
            detail="Sentence-embedding dependencies could not be loaded; install the AI service requirements in a compatible Python environment",
        ) from error

    model_name = os.getenv("AI_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    try:
        return model_name, SentenceTransformer(model_name)
    except (OSError, RuntimeError) as error:
        raise HTTPException(
            status_code=503,
            detail=f"The configured sentence-embedding model is unavailable: {model_name}",
        ) from error


@lru_cache(maxsize=1)
def load_title_generation_model():
    try:
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    except (ImportError, OSError) as error:
        raise HTTPException(
            status_code=503,
            detail="Transformers dependencies could not be loaded; install the AI service requirements in a compatible Python environment",
        ) from error

    model_name = os.getenv("AI_TITLE_GENERATION_MODEL", "google/flan-t5-base")
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        model.eval()
        return model_name, tokenizer, model
    except (OSError, RuntimeError) as error:
        raise HTTPException(
            status_code=503,
            detail=f"The configured title-generation model is unavailable: {model_name}",
        ) from error


def parse_generated_titles(text: str) -> list[str]:
    candidates = re.findall(
        r"(?:^|\s)(?:\d+[.)]|[-*])\s+(.+?)(?=(?:\s+\d+[.)]\s+)|$)",
        text.strip(),
        flags=re.DOTALL,
    )
    if not candidates:
        candidates = re.split(r"[\r\n]+", text)
    titles = []
    seen = set()
    for candidate in candidates:
        title = re.sub(r"^\s*(?:\d+[.)]\s*|[-*]\s*|title\s*:\s*)", "", candidate, flags=re.IGNORECASE)
        title = title.strip().strip("\"'").strip()
        normalized = title.casefold()
        if 8 <= len(title) <= 240 and normalized not in seen:
            seen.add(normalized)
            titles.append(title)
        if len(titles) == 5:
            break
    return titles


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


@app.post("/api/v1/title-recommendations")
def title_recommendations(
    request: TitleRecommendationRequest,
    service_token: str | None = Header(default=None, alias="X-AI-Service-Token"),
) -> dict:
    expected_token = os.getenv("AI_SERVICE_TOKEN")
    if not expected_token:
        raise HTTPException(status_code=503, detail="AI service authentication is not configured")
    if not service_token or not hmac.compare_digest(service_token, expected_token):
        raise HTTPException(status_code=401, detail="Invalid internal service token")

    model_name, tokenizer, model = load_title_generation_model()
    prompt = (
        "Generate five distinct, academically suitable undergraduate graduation project titles. "
        "Use the student's interests, application area, and available tools. "
        "Use the optional problem, users, and outcome details when provided. "
        "Make each title specific, feasible, and clearly related to the application area. "
        "Do not copy an existing project title. Return only a numbered list with one title per line.\n"
        f"Student interests: {request.interest}\n"
        f"Application area: {request.area}\n"
        f"Available tools and technologies: {request.tools}\n"
        f"Specific problem to solve: {request.problem or 'Not specified'}\n"
        f"Target users or beneficiaries: {request.target_users or 'Not specified'}\n"
        f"Expected outcome or key features: {request.desired_outcome or 'Not specified'}\n"
        "Titles:"
    )
    try:
        model_inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
        generated = model.generate(
            **model_inputs,
            max_new_tokens=160,
            num_beams=4,
            no_repeat_ngram_size=3,
            early_stopping=True,
        )
        text = tokenizer.decode(generated[0], skip_special_tokens=True)
    except (OSError, RuntimeError, ValueError) as error:
        raise HTTPException(status_code=503, detail="The local title-generation model could not generate suggestions") from error

    suggestions = parse_generated_titles(text)
    if not suggestions:
        raise HTTPException(status_code=502, detail="The local title-generation model returned no valid project titles")
    return {"modelName": model_name, "suggestions": suggestions}
