import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

from app.main import (
    TitleRecommendationRequest,
    build_title_recommendation_prompt,
    parse_generated_titles,
    title_recommendations,
)


class FakeTokenizer:
    def __call__(self, prompt, **kwargs):
        for expected in (
            "Project Idea: AI-based student attendance system",
            "Problem Statement: Manual attendance is slow and inaccurate",
            "General Objective: Develop an automated attendance system",
            "Specific Objectives: Automate attendance recording; Generate attendance reports",
            "Project Description: Teachers record attendance and review reports",
            "Proposed Technologies: Python, React, MySQL, OpenCV",
            "Project Domain: Artificial Intelligence and Education",
        ):
            if expected not in prompt:
                raise AssertionError(f"Project information was not included in the prompt: {expected}")
        if kwargs != {"return_tensors": "pt", "truncation": True, "max_length": 512}:
            raise AssertionError("Unexpected tokenizer options")
        return {"input_ids": [1]}

    def decode(self, generated, **kwargs):
        if generated != [1] or kwargs != {"skip_special_tokens": True}:
            raise AssertionError("Unexpected generated output")
        return (
            "1. Automated Student Attendance Management Platform\n"
            "2. Facial Recognition System for Classroom Attendance\n"
            "3. Machine Learning-Based Attendance Monitoring Tool\n"
            "4. Student Presence Tracking and Reporting Application\n"
            "5. Digital Attendance Verification for University Classes"
        )


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
            projectIdea="AI-based student attendance system",
            problemStatement="Manual attendance is slow and inaccurate",
            generalObjective="Develop an automated attendance system",
            specificObjectives="Automate attendance recording\nGenerate attendance reports",
            projectDescription="Teachers record attendance and review reports",
            technologies="Python, React, MySQL, OpenCV",
            domain="Artificial Intelligence and Education",
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
            projectIdea="AI-based student attendance system",
            problemStatement="Manual attendance is slow and inaccurate",
            generalObjective="Develop an automated attendance system",
            specificObjectives="Automate attendance recording\nGenerate attendance reports",
            projectDescription="Teachers record attendance and review reports",
            technologies="Python, React, MySQL, OpenCV",
            domain="Artificial Intelligence and Education",
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
            "Automated Student Attendance Management Platform",
            "Facial Recognition System for Classroom Attendance",
            "Machine Learning-Based Attendance Monitoring Tool",
            "Student Presence Tracking and Reporting Application",
            "Digital Attendance Verification for University Classes",
        ])

    def test_parser_removes_duplicate_and_invalid_titles(self):
        self.assertEqual(parse_generated_titles(
            "1. Crop Disease Detection\n"
            "2. crop disease detection\n"
            "3. Tiny\n"
            "4. Smart Irrigation Planning"
        ), ["Crop Disease Detection", "Smart Irrigation Planning"])
        self.assertEqual(parse_generated_titles(
            "1. Crop Disease Detection 2. Smart Irrigation Planning"
        ), ["Crop Disease Detection", "Smart Irrigation Planning"])

    def test_rejects_too_short_preferences(self):
        with self.assertRaises(ValidationError):
            TitleRecommendationRequest(projectIdea="x")

    def test_prompt_preprocesses_numbered_objectives(self):
        request = TitleRecommendationRequest(
            projectIdea="Attendance system",
            problemStatement="Manual attendance is inaccurate",
            generalObjective="Automate attendance management",
            specificObjectives="1. Record attendance\n- Generate reports",
            projectDescription="A system for teachers to manage attendance",
            technologies="Python and React",
            domain="Education",
        )
        prompt = build_title_recommendation_prompt(request)
        self.assertIn("Specific Objectives: Record attendance; Generate reports", prompt)


if __name__ == "__main__":
    unittest.main()
