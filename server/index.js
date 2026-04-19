const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("./data.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mood TEXT,
      preference TEXT,
      availableHours TEXT,
      result TEXT
    )
  `);
});

// 🔥 GERÇEK AI (DÜZENLENDİ)
async function getAIRecommendation(mood, currentTime, preference, availableHours, language) {
  try {
    const isTR = language === "tr";

    const prompt = isTR
      ? `
Şu kurallara kesin uy:

1. Cevabın başına süre koy:
   Format: [TIME:XX]
   Örnek: [TIME:30]

2. Süre dakika cinsinden olsun

3. Cevap KISA olsun (max 2-3 cümle)

4. SADECE Türkçe yaz

---

Şu bilgiler:
Saat: ${currentTime}
Ruh hali: ${mood}
Tercih: ${preference}
Müsait süre: ${availableHours} saat

Uygun öneri ver.
`
      : `
Follow STRICT rules:

1. Start with time:
   Format: [TIME:XX]
   Example: [TIME:30]

2. Time must be in minutes

3. Keep response SHORT (max 2-3 sentences)

4. ONLY English

---

Info:
Time: ${currentTime}
Mood: ${mood}
Preference: ${preference}
Available time: ${availableHours} hours

Give recommendation.
`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();

    if (!data.choices) {
      console.log("AI ERROR:", data);
      return "[TIME:10] AI hata verdi.";
    }

    return data.choices[0].message.content;

  } catch (error) {
    console.log(error);
    return "[TIME:10] AI error oluştu.";
  }
}

// 🚀 ROUTE
app.post("/recommend", async (req, res) => {
  const { mood, preference, availableHours, language } = req.body;

  const currentTime = new Date().toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const recommendation = await getAIRecommendation(
    mood,
    currentTime,
    preference,
    availableHours,
    language
  );

  db.run(
    `INSERT INTO recommendations (mood, preference, availableHours, result)
     VALUES (?, ?, ?, ?)`,
    [mood, preference, availableHours, recommendation],
    function (err) {
      if (err) return res.status(500).send(err);

      res.json({ recommendation });
    }
  );
});

// 📜 HISTORY
app.get("/history", (req, res) => {
  db.all("SELECT * FROM recommendations", [], (err, rows) => {
    if (err) return res.status(500).send(err);

    res.json(rows);
  });
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});