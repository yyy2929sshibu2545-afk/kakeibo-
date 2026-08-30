import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Routes
  app.post("/api/parse-receipt", async (req, res) => {
    try {
      const { imageBase64, mimeType, memo } = req.body;
      if (!imageBase64 && !memo) {
        return res.status(400).json({ error: "Image or text is required." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = `あなたは同棲カップル（よしや・りん）の家計簿専用AIアシスタントです。レシート画像またはテキストチャットから品目を抽出し、仕分けを行ってください。

【固定比率】
共通出費の負担割合: よしや 58% / りん 42%

【分類ルール】
1. category（大分類）:
   - 食料品・飲料・外食 ➔ "food"（食費）
   - 日用品・消耗品・雑貨 ➔ "daily"（生活雑貨）
   - 飲み会・友人との交際 ➔ "social"（交際費）
   - 2人のデート・旅行・外食 ➔ "date"（デート費）

2. owner（対象者）:
   - ユーザーのチャット/メモで指定がない品目はすべて "common"（共通）
   - 「〇〇はよしや」➔ "yoshiya"
   - 「〇〇はりん」➔ "rin"

3. price（金額）:
   - 税込金額を数値で抽出。値引きがある場合は適用後の金額。

4. date（購入日付）と store（購入店舗）:
   - レシートの印字から日付（YYYY-MM-DD形式）と店舗名を抽出してください。
   - 不明な場合は date: "", store: "不明" としてください。

【出力要件】
ユーザーから「解析して」「確定」等のリクエストがあった場合、必ず以下のJSON配列のみを出力してください（Markdown記号や前置きは含めない）：
[
  { "date": "2026-08-30", "store": "スーパーABC", "name": "品名", "price": 300, "category": "food", "owner": "common" },
  { "date": "2026-08-30", "store": "スーパーABC", "name": "品名2", "price": 1200, "category": "daily", "owner": "yoshiya" }
]

※ユーザーとの対話・修正ラリー中の場合は、丁寧な日本語で修正確認メッセージを返してください。`;

      let promptText = "";
      if (imageBase64 && memo) {
        promptText = `【ユーザーからのメッセージ・メモ】\n${memo}\n\n上記と添付のレシート画像をあわせて確認・解析してください。`;
      } else if (imageBase64) {
        promptText = `レシート画像を解析して確定してください。`;
      } else if (memo) {
        promptText = memo;
      }

      const contents = [];
      if (imageBase64 && mimeType) {
        contents.push({
          inlineData: {
            data: imageBase64,
            mimeType: mimeType,
          },
        });
      }
      contents.push(promptText);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contents,
        config: {
          systemInstruction,
          temperature: 0.1, // Keep it deterministic for data extraction
          responseMimeType: "application/json",
        },
      });

      let responseText = response.text?.trim() || "";
      
      // Attempt to parse as JSON if it looks like an array
      let parsed = null;
      let isJson = false;
      
      // Clean up markdown block if the model accidentally includes it
      if (responseText.startsWith("\`\`\`json")) {
        responseText = responseText.replace(/^\`\`\`json\n?/, "").replace(/\n?\`\`\`$/, "").trim();
      } else if (responseText.startsWith("\`\`\`")) {
        responseText = responseText.replace(/^\`\`\`\n?/, "").replace(/\n?\`\`\`$/, "").trim();
      }

      if (responseText.startsWith("[") && responseText.endsWith("]")) {
        try {
          parsed = JSON.parse(responseText);
          isJson = true;
        } catch (e) {
          // not valid json
        }
      }

      res.json({
        type: isJson ? "json" : "text",
        content: isJson ? parsed : responseText
      });

    } catch (error: any) {
      console.error("Error calling Gemini API:", error);
      res.status(500).json({ error: error.message || "An error occurred while processing the request." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
