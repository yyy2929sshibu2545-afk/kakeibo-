import os
import base64
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import requests
import google.generativeai as genai

app = FastAPI()

# CORS設定（どこからでもアクセス許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
FIREBASE_URL = os.environ.get("FIREBASE_URL")

# 旧SDK（安定版）の初期化
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

class ReceiptParseRequest(BaseModel):
    image_base64: Optional[str] = None
    memo: Optional[str] = None

@app.get("/api/data")
def get_data():
    if not FIREBASE_URL:
        raise HTTPException(status_code=500, detail="FIREBASE_URL is not set")
    try:
        response = requests.get(FIREBASE_URL)
        if response.status_code == 200:
            return response.json() or {}
        return {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/data")
def save_data(payload: dict):
    if not FIREBASE_URL:
        raise HTTPException(status_code=500, detail="FIREBASE_URL is not set")
    try:
        response = requests.put(FIREBASE_URL, json=payload)
        if response.status_code in [200, 201]:
            return {"status": "success"}
        raise HTTPException(status_code=response.status_code, detail="Failed to save to Firebase")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/parse-receipt")
def parse_receipt(payload: ReceiptParseRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured")
    
    contents = []
    
    if payload.image_base64:
        image_bytes = base64.b64decode(payload.image_base64)
        contents.append({
            "mime_type": "image/jpeg",
            "data": image_bytes
        })
    
    prompt = """
あなたは優秀な家計簿アシスタントです。提供されたレシート画像および、ユーザーからの指示・メモを解析し、以下のJSON形式の配列のみを出力してください。他の余計な文章（マークダウンの ```json や解説など）は一切含めず、純粋なJSON配列の文字列だけを返してください。

[
  {
    "date": "YYYY-MM-DD",
    "store": "店舗名",
    "name": "商品名または品目名",
    "price": 金額(数値),
    "category": "食費" または "daily"(生活雑貨) または "social"(交際費) または "date"(デート費),
    "owner": "common"(共通) または "yoshiya"(よしや) または "rin"(りん)
  }
]
ユーザーからの指示やメモがある場合はそれを最優先に反映してください。
"""
    if payload.memo:
        prompt += f"\n\n【ユーザーからの指示・メモ】\n{payload.memo}"
    
    contents.append(prompt)

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(contents)
        return {"text": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
