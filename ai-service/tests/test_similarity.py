import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

from app.main import SimilarityRequest, similarity


def create_request(pairs=None):
    return SimilarityRequest.model_validate({
        "items": [
            {"id": "project-a", "text": "campus water monitoring"},
            {"id": "project-b", "text": "water use monitoring on campus"},
        ],
        "pairs": pairs or [{"leftId": "project-a", "rightId": "project-b"}],
    })


class FakeModel:
    def encode(self, texts, **kwargs):
        return [[1.0, 0.0], [0.8, 0.6]]


class SimilarityServiceTests(unittest.TestCase):
    def test_requires_a_configured_and_matching_token(self):
        request = create_request()
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("AI_SERVICE_TOKEN", None)
            with self.assertRaises(HTTPException) as missing_token:
                similarity(request, "anything")
        self.assertEqual(missing_token.exception.status_code, 503)

        with patch.dict(os.environ, {"AI_SERVICE_TOKEN": "expected"}):
            with self.assertRaises(HTTPException) as invalid_token:
                similarity(request, "wrong")
        self.assertEqual(invalid_token.exception.status_code, 401)

    def test_returns_cosine_similarity_from_normalized_embeddings(self):
        request = create_request()
        with (
            patch.dict(os.environ, {"AI_SERVICE_TOKEN": "expected"}),
            patch("app.main.load_embedding_model", return_value=("test-model", FakeModel())),
        ):
            result = similarity(request, "expected")

        self.assertEqual(result["modelName"], "test-model")
        self.assertEqual(result["scores"], [{
            "leftId": "project-a",
            "rightId": "project-b",
            "score": 0.8,
        }])

    def test_rejects_duplicate_or_reversed_comparison_pairs(self):
        with self.assertRaises(ValidationError):
            create_request([
                {"leftId": "project-a", "rightId": "project-b"},
                {"leftId": "project-b", "rightId": "project-a"},
            ])


if __name__ == "__main__":
    unittest.main()
