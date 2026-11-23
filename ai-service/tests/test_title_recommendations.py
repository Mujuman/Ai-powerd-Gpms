import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

from app.main import (
    TitleRecommendationRequest,
    parse_generated_titles,
    title_recommendations,
)


class FakeTokenizer:
    def __call__(self, prompt, **kwargs):
        if "Student interests: machine learning" not in prompt:
            raise AssertionError("Student interests were not included in the generation prompt")
        if kwargs != {"return_tensors": "pt", "truncation": True, "max_length": 512}:
            raise AssertionError("Unexpected tokenizer options")
        return {"input_ids": [1]}

    def decode(self, generated, **kwargs):
        if generated != [1] or kwargs != {"skip_special_tokens": True}:
            raise AssertionError("Unexpected generated output")
        return "1. Crop Disease Detection with Machine Learning\n2. Smart Irrigation Planning Platform"


class FakeGenerationModel:
    def eval(self):
        return self

    def generate(self, **kwargs):
        if kwargs != {
            "input_ids": [1],
            "max_new_tokens": 160,
            "num_beams": 4,
            "no_repeat_ngram_size": 3,
            "early_stopping": True,
        }:
            raise AssertionError("Unexpected generation options")
        return [[1]]


class TitleRecommendationTests(unittest.TestCase):
    def test_requires_a_configured_and_matching_token(self):
        request = TitleRecommendationRequest(
            interest="machine learning",
            area="agriculture",
            tools="Python and scikit-learn",
        )
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("AI_SERVICE_TOKEN", None)
            with self.assertRaises(HTTPException) as missing_token:
                title_recommendations(request, "anything")
        self.assertEqual(missing_token.exception.status_code, 503)

        with patch.dict(os.environ, {"AI_SERVICE_TOKEN": "expected"}):
            with self.assertRaises(HTTPException) as invalid_token:
                title_recommendations(request, "wrong")
        self.assertEqual(invalid_token.exception.status_code, 401)

    def test_generates_titles_from_student_preferences_with_local_model(self):
        request = TitleRecommendationRequest(
            interest="machine learning",
            area="agriculture",
            tools="Python and scikit-learn",
        )
        with (
            patch.dict(os.environ, {"AI_SERVICE_TOKEN": "expected"}),
            patch(
                "app.main.load_title_generation_model",
                return_value=("google/flan-t5-base", FakeTokenizer(), FakeGenerationModel()),
            ),
        ):
            result = title_recommendations(request, "expected")

        self.assertEqual(result["modelName"], "google/flan-t5-base")
        self.assertEqual(result["suggestions"], [
            "Crop Disease Detection with Machine Learning",
            "Smart Irrigation Planning Platform",
        ])

    def test_parser_removes_duplicate_and_invalid_titles(self):
        self.assertEqual(parse_generated_titles(
            "1. Crop Disease Detection\n"
            "2. crop disease detection\n"
            "3. Tiny\n"
            "4. Smart Irrigation Planning"
        ), ["Crop Disease Detection", "Smart Irrigation Planning"])

    def test_rejects_too_short_preferences(self):
        with self.assertRaises(ValidationError):
            TitleRecommendationRequest(interest="x", area="agriculture", tools="Python")


if __name__ == "__main__":
    unittest.main()
