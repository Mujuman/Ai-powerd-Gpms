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
    project_idea: str = Field(alias="projectIdea", min_length=2, max_length=1000)
    problem_statement: str = Field(alias="problemStatement", min_length=2, max_length=3000)
    general_objective: str = Field(alias="generalObjective", min_length=2, max_length=1000)
    specific_objectives: str = Field(alias="specificObjectives", min_length=2, max_length=3000)
    project_description: str = Field(alias="projectDescription", min_length=2, max_length=5000)
    technologies: str = Field(min_length=2, max_length=1000)
    domain: str = Field(min_length=2, max_length=1000)


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


def complete_title_suggestions(
    request: TitleRecommendationRequest,
    generated_titles: list[str],
) -> list[str]:
    def compact(value: str, max_length: int) -> str:
        value = re.sub(r"\s+", " ", value).strip(" \t\r\n.,;:")
        if len(value) > max_length:
            value = value[:max_length].rsplit(" ", 1)[0].strip(" \t\r\n.,;:")
        return value

    def meaningful_terms(value: str) -> set[str]:
        generic_terms = {
            "application", "based", "development", "management", "platform",
            "project", "solution", "system", "tool",
        }
        return {
            term for term in re.findall(r"[a-z0-9]+", value.casefold())
            if len(term) >= 4 and term not in generic_terms
        }

    idea = compact(request.project_idea, 90)
    if not idea:
        idea = compact(request.general_objective, 90) or "Student Project"
    concept = re.sub(r"^(?:a|an|the)\s+", "", idea, flags=re.IGNORECASE).strip()
    if not concept:
        concept = idea
    domain = compact(request.domain, 45) or "the stated domain"
    technologies = compact(request.technologies, 45) or "the proposed technologies"
    idea_terms = meaningful_terms(
        " ".join((request.project_idea, request.general_objective, request.specific_objectives))
    )

    suggestions = []
    seen = set()

    def add(title: str) -> None:
        title = compact(title, 240)
        normalized = title.casefold()
        if 8 <= len(title) <= 240 and normalized not in seen:
            seen.add(normalized)
            suggestions.append(title)

    for title in generated_titles:
        title_terms = meaningful_terms(title)
        if not idea_terms or idea_terms.intersection(title_terms):
            add(title)

    for title in (
        idea,
        f"Design and Development of {concept}",
        f"Development and Implementation of {concept}",
        f"{concept} for {domain}",
        f"Development of {concept} Using {technologies}",
        f"A {domain} Approach to {concept}",
        f"Implementation of {concept} for {domain}",
    ):
        add(title)
        if len(suggestions) == 5:
            break

    return suggestions[:5]


def build_title_recommendation_prompt(request: TitleRecommendationRequest) -> str:
    objectives = []
    for line in request.specific_objectives.splitlines():
        objective = re.sub(r"^\s*(?:\d+[.)]|[-*])\s*", "", line).strip()
        if objective:
            objectives.append(objective)
    specific_objectives = "; ".join(objectives)

    return (
        "You are an academic graduation project title recommendation assistant. "
        "Analyze all the following student project information:\n"
        f"Project Idea: {request.project_idea}\n"
        f"Problem Statement: {request.problem_statement}\n"
        f"General Objective: {request.general_objective}\n"
        f"Specific Objectives: {specific_objectives}\n"
        f"Project Description: {request.project_description}\n"
        f"Proposed Technologies: {request.technologies}\n"
        f"Project Domain: {request.domain}\n"
        "Generate five clear, specific, professional graduation project titles.\n"
        "Requirements:\n"
        "1. Reflect the actual project idea.\n"
        "2. Avoid unnecessarily complicated words.\n"
        "3. Do not introduce features not mentioned by the student.\n"
        "4. Do not change the original project scope.\n"
        "5. Return only five suggested titles, one title per line."
    )


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
    prompt = build_title_recommendation_prompt(request)
    try:
        model_inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)
        generated = model.generate(
            **model_inputs,
            max_new_tokens=96,
            num_beams=2,
            no_repeat_ngram_size=3,
            early_stopping=True,
        )
        text = tokenizer.decode(generated[0], skip_special_tokens=True)
    except (OSError, RuntimeError, ValueError) as error:
        raise HTTPException(status_code=503, detail="The local title-generation model could not generate suggestions") from error

    suggestions = complete_title_suggestions(request, parse_generated_titles(text))
    if len(suggestions) != 5:
        raise HTTPException(status_code=502, detail="Could not create five distinct project titles from the submitted project brief")
    return {"modelName": model_name, "suggestions": suggestions}
