import google.generativeai as genai

# configure with your Gemini API key
genai.configure(api_key=" AIzaSyDY63c35vh3rmBFeFGQcP761TKFRTEang4 ")

print("Available models in this SDK environment:\n")
for m in genai.list_models():
    print(f"- {m.name} | supports: {m.supported_generation_methods}")
