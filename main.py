from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
import requests
import os

# --- 設定（Renderの環境変数から安全に読み込む） ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
FIREBASE_URL = os.environ.get("FIREBASE_URL")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. データの取得API ---
@app.get("/api/data")
def get_data():
    if not FIREBASE_URL:
        return {}
    response = requests.get(FIREBASE_URL)
    data = response.json()
    return data if data else {}

# --- 2. データの保存API ---
@app.post("/api/data")
def save_data(data: dict):
    if not FIREBASE_URL:
        raise HTTPException(status_code=500, detail="FIREBASE_URL is not set")
    requests.put(FIREBASE_URL, json=data)
    return {"status": "success"}

# --- 3. レシート解析API ---
class ReceiptRequest(BaseModel):
    image_base64: str

@app.post("/api/parse-receipt")
def parse_receipt(req: ReceiptRequest):
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = 'レシート画像を解析し、以下の形式のJSON配列のみを出力せよ。[{"name":"品名","price":1000,"category":"food|daily|social|date","owner":"common|yoshiya|rin"}]'
        response = model.generate_content([
            prompt,
            {"mime_type": "image/jpeg", "data": req.image_base64}
        ])
        return {"result": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))