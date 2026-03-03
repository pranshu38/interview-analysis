# app.py
# Gemini API Fallback Version — safe rotation between multiple API keys

# --- Standard Library Imports ---
import os
import json
import random
import re
import uuid
import time
from typing import List, Dict, Any
from flask import Flask, render_template, request, jsonify, session

# --- Third-Party Imports ---
import google.generativeai as genai
import fitz  # PyMuPDF for PDF parsing
import speech_recognition as sr


# -----------------------
# --- Gemini Key Rotation (Environment Based) ---
# -----------------------

def get_available_keys():
    keys = []
    index = 1

    while True:
        key = os.getenv(f"GEMINI_KEY_{index}")
        if not key:
            break
        keys.append(key)
        index += 1

    if not keys:
        raise Exception("No Gemini API keys configured in environment.")

    return keys

# -----------------------
# --- Central AI Helper with Fallback ---
# -----------------------
def generate_with_fallback(prompt: str, model_name="models/gemini-1.5-flash"):
    keys = get_available_keys()
    last_exception = None

    for key in keys:
        try:
            genai.configure(api_key=key)
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)

            if not response or not response.text:
                continue

            text = response.text.strip()

            # Quota detection
            if "quota" in text.lower() or "429" in text:
                print(f"Quota hit for key {key[:6]}***")
                continue

            print(f"Success using key {key[:6]}***")
            return text

        except Exception as e:
            print(f"Key {key[:6]}*** failed: {e}")
            last_exception = e
            continue

    raise Exception(f"All Gemini API keys failed. Last error: {last_exception}")

# -----------------------
# --- Flask App Setup ---
# -----------------------
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "fallback_secret")

# -----------------------
# --- In-Memory Interview Storage ---
# -----------------------
interview_storage: Dict[str, List[Dict[str, Any]]] = {}

# -----------------------
# --- Load Questions JSON ---
# -----------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TECH_QUESTIONS_PATH = os.path.join(BASE_DIR, "static", "json", "technical_questions.json")
GENERAL_QUESTIONS_PATH = os.path.join(BASE_DIR, "static", "json", "general_questions.json")

try:
    with open(TECH_QUESTIONS_PATH, "r", encoding="utf-8") as f:
        TECH_QUESTIONS = json.load(f)
    print(">>> technical_questions.json loaded successfully.")
except FileNotFoundError:
    TECH_QUESTIONS = {}
    print(">>> technical_questions.json not found.")

try:
    with open(GENERAL_QUESTIONS_PATH, "r", encoding="utf-8") as f:
        GENERAL_QUESTIONS = json.load(f)
    print(">>> general_questions.json loaded successfully.")
except FileNotFoundError:
    GENERAL_QUESTIONS = []
    print(">>> general_questions.json not found.")

# -----------------------
# --- Helper Functions ---
# -----------------------
def _get_session_id() -> str:
    return session.get("session_id", None)

def _create_qa_entry(q_text: str, source: str) -> Dict[str, Any]:
    return {
        "question": q_text,
        "text": q_text,
        "source": source,
        "answer": "",
        "score": None,
        "feedback": "N/A",
        "ai_model_answer": None
    }

# -----------------------
# --- Page Routes ---
# -----------------------
@app.route('/')
def start():
    return render_template('start.html')  # Landing Page

@app.route('/home')
def home():
    return render_template('home.html') 

@app.route("/interview")
def interview():
    return render_template("interview.html")

@app.route("/review")
def review():
    session_id = _get_session_id()
    qa_log = interview_storage.get(session_id, [])
    return render_template("review.html", qa_log=qa_log)

# -----------------------
# --- Solution Page (AI Recommended Answers) ---
# -----------------------
@app.route("/solution")
def solution():
    """
    Serves the solution.html page where AI recommended answers are displayed.
    """
    return render_template("solution.html")


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/insights")
def insights():
    return render_template("insights.html")

@app.route("/report")
def report():
    return render_template("report.html")

@app.route("/resume")
def resume():
    return render_template("resume.html")

# -----------------------
# --- Start Interview Session ---
# -----------------------
@app.route("/start_session", methods=["POST"])
def start_session():
    start_time = time.time()
    print(">>> Starting new interview session...")

    if "resume" not in request.files:
        return jsonify({"error": "No resume file found"}), 400

    resume_file = request.files["resume"]
    job_field = request.form.get("job_field", "general").strip()

    # Extract text from PDF
    resume_text = ""
    try:
        with fitz.open(stream=resume_file.read(), filetype="pdf") as doc:
            for page in doc:
                resume_text += page.get_text()
        print(">>> Resume extracted successfully.")
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return jsonify({"error": "Could not read resume PDF."}), 500

    # Pick random general questions
    general_questions = []
    try:
        if isinstance(GENERAL_QUESTIONS, list):
            general_questions = random.sample(GENERAL_QUESTIONS, min(5, len(GENERAL_QUESTIONS)))
        elif isinstance(GENERAL_QUESTIONS, dict) and "general" in GENERAL_QUESTIONS:
            general_questions = random.sample(GENERAL_QUESTIONS["general"], min(5, len(GENERAL_QUESTIONS["general"])))
    except Exception as e:
        print(f"Error selecting general questions: {e}")
    general_questions = [{"question": q or "No question text", "source": "general"} for q in general_questions]

    # Pick random technical questions
    technical_questions = []
    if isinstance(TECH_QUESTIONS, dict) and TECH_QUESTIONS:
        normalized_job_field = job_field.strip().lower().replace("-", " ").replace("_", " ")
        json_keys_map = {k.strip().lower(): k for k in TECH_QUESTIONS.keys()}
        matched_key = json_keys_map.get(normalized_job_field)
        if matched_key:
            selected_tech = random.sample(TECH_QUESTIONS[matched_key], min(5, len(TECH_QUESTIONS[matched_key])))
        else:
            fallback_key = next(iter(TECH_QUESTIONS.keys()))
            selected_tech = random.sample(TECH_QUESTIONS[fallback_key], min(5, len(TECH_QUESTIONS[fallback_key])))
        technical_questions = [{"question": q or "No question text", "source": "technical"} for q in selected_tech]

    # Generate resume-based questions using AI with fallback
    resume_questions = []
    try:
        resume_prompt = f"""
        You are a professional hiring manager for a '{job_field}' position.
        Based on the content of the following resume, generate exactly 5 insightful interview questions.
        Focus on the candidate's skills and projects. Return each question on a new line.

        RESUME:
        ---{resume_text}---
        """
        resume_response_text = generate_with_fallback(resume_prompt)
        extracted = [q.strip() for q in resume_response_text.split("\n") if q.strip()]
        resume_questions = [{"question": q or "No question text", "source": "resume"} for q in extracted]
        print(">>> Resume-based questions generated.")
    except Exception as e:
        print(f"Error generating resume questions: {e}")

    # Combine all questions
    all_questions = general_questions + technical_questions + resume_questions
    if len(all_questions) < 12:
        all_questions += [{"question": "Tell me more about your projects.", "source": "general"}] * (12 - len(all_questions))
    random.shuffle(all_questions)

    # Create session and store server-side QA
    session_id = str(uuid.uuid4())
    session["session_id"] = session_id
    qa_list = [_create_qa_entry(q.get("question"), q.get("source")) for q in all_questions]
    interview_storage[session_id] = qa_list
    print(f">>> Session {session_id} created with {len(all_questions)} questions.")
    print(f">>> start_session total time: {time.time() - start_time:.2f}s")

    return jsonify({"message": "Personalized interview session started successfully."})

## -----------------------
# --- Generate / Fetch AI Recommended Answers ---
# -----------------------
@app.route("/get_model_answers", methods=["GET"])
def get_solution_answers():
    """
    Returns all AI recommended answers for the current session.
    Format:
    {
        "model_answers": [
            {"question": "...", "model_answer": "..."},
            ...
        ]
    }
    """
    session_id = _get_session_id()
    qa_log = interview_storage.get(session_id, [])

    if not qa_log:
        return jsonify({"model_answers": []})

    # Generate AI recommended answers if missing
    for entry in qa_log:
        if not entry.get("ai_model_answer"):
            try:
                prompt = f"""
                You are an expert interviewer and subject-matter expert.
                Provide a concise, accurate, and professional answer for the following interview question:
                "{entry['question']}"
                Return only the answer text.
                """
                entry["ai_model_answer"] = generate_with_fallback(prompt)
            except Exception as e:
                entry["ai_model_answer"] = f"(AI generation failed: {e})"

    # Update session storage
    interview_storage[session_id] = qa_log

    # Return JSON for solution.js
    return jsonify({
        "model_answers": [
            {"question": q["question"], "model_answer": q["ai_model_answer"]}
            for q in qa_log
        ]
    })

# -----------------------
# --- Fetch Questions ---
# -----------------------
@app.route("/get_questions", methods=["GET"])
def get_questions():
    session_id = _get_session_id()
    qa_log = interview_storage.get(session_id, [])
    return jsonify({"questions": qa_log})

# -----------------------
# --- Save Answer ---
# -----------------------
@app.route("/save_answer", methods=["POST"])
def save_answer():
    try:
        data = request.get_json()
        index = int(data.get("index", -1))
        answer = data.get("answer", "").strip()
        session_id = _get_session_id()
        qa_log = interview_storage.get(session_id, [])
        if 0 <= index < len(qa_log):
            qa_log[index]["answer"] = answer
            interview_storage[session_id] = qa_log
            return jsonify({"status": "success"})
        return jsonify({"status": "error", "message": "index out of range"}), 400
    except Exception as e:
        print(f"Error in save_answer: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# -----------------------
# --- Evaluate Single Answer ---
# -----------------------
@app.route("/evaluate_answer", methods=["POST"])
def evaluate_answer():
    try:
        data = request.get_json()
        index = int(data.get("index", -1))
        answer = data.get("answer", "").strip()
        question = data.get("question", "").strip()
        session_id = _get_session_id()
        qa_log = interview_storage.get(session_id, [])

        if index < 0 or index >= len(qa_log):
            return jsonify({"error": "Invalid question index"}), 400

        try:
            prompt = f"""
            You are an expert interviewer and evaluator.
            Question: "{question}"
            Candidate Answer: "{answer}"
            Evaluate the candidate answer for relevance, correctness, and informativeness.
            Provide a numeric score between 0 and 100 and a short feedback sentence.
            Return ONLY valid JSON, e.g.:
            {{ "score": 72, "feedback": "Some strengths; missing details about X." }}
            """
            gemini_text = generate_with_fallback(prompt)
            match = re.search(r"\{.*\}", gemini_text, re.DOTALL)
            if match:
                gemini_data = json.loads(match.group())
                score = float(gemini_data.get("score", 0))
                feedback = gemini_data.get("feedback", "N/A")
            else:
                score_match = re.search(r"\b(\d{1,3})\b", gemini_text)
                score = float(score_match.group(1)) if score_match else 0
                feedback = gemini_text
        except Exception as e:
            score = 0
            feedback = f"Evaluation failed: {e}"

        qa_log[index]["score"] = round(score, 2)
        qa_log[index]["feedback"] = feedback
        qa_log[index]["answer"] = answer
        interview_storage[session_id] = qa_log

        return jsonify({"score": round(score, 2), "feedback": feedback})
    except Exception as e:
        print(f"Error in evaluate_answer: {e}")
        return jsonify({"error": str(e)}), 500

# -----------------------
# --- Submit All Answers ---
# -----------------------
@app.route("/analyze", methods=["POST"])
def analyze_interview():
    try:
        data = request.get_json()
        all_answers = data.get("answers", [])
        session_id = _get_session_id()
        qa_log = interview_storage.get(session_id, [])

        for ans in all_answers:
            idx = ans.get("index")
            if isinstance(idx, int) and 0 <= idx < len(qa_log):
                qa_log[idx]["answer"] = ans.get("answer", "")

        interview_storage[session_id] = qa_log
        return jsonify({"message": "All answers submitted successfully.", "redirect": "/review"})
    except Exception as e:
        print(f"Error in analyze_interview: {e}")
        return jsonify({"error": str(e)}), 500

# -----------------------
# --- Run Flask App ---
# -----------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)