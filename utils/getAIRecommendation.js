export async function getAIRecommendation(userPrompt, products) {
  const API_KEY = process.env.GEMINI_API_KEY;
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

  try {
    // ✅ Reduce token usage (important for free tier)
    const simplifiedProducts = products.slice(0, 30).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
    }));

    const geminiPrompt = `
You are a STRICT product recommendation system.

Products:
${JSON.stringify(simplifiedProducts)}

User request:
"${userPrompt}"

Rules:
- Return ONLY highly relevant products
- IGNORE loosely related products
- If user searches "monitor", DO NOT include GPU, clothes, or unrelated items
- Prefer exact matches (name or category match)
- If unsure about a product, EXCLUDE it
- Do NOT guess
- Return at most 10 product IDs

Return ONLY a JSON array of product IDs.

Example:
["1", "2"]
`;

    const response = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: geminiPrompt }] }],
      }),
    });

    const data = await response.json();

    const aiResponseText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const cleanedText = aiResponseText
      .replace(/```json|```/g, "")
      .trim();

    if (!cleanedText) {
      return { success: false, message: "Empty AI response" };
    }

    let ids;

    try {
      const parsed = JSON.parse(cleanedText);

      // ✅ Ensure correct format
      if (!Array.isArray(parsed)) {
        return { success: false, message: "AI returned invalid format" };
      }

      ids = parsed;
    } catch (err) {
      console.log("RAW AI:", aiResponseText);
      return { success: false, message: "Invalid JSON from AI" };
    }

    // ✅ Safer matching using Set
    const idSet = new Set(ids.map(String));

    const matchedProducts = products.filter((p) =>
      idSet.has(String(p.id))
    );

    // 🔥 Fallback if AI returns empty
    if (matchedProducts.length === 0) {
      return { success: true, products };
    }

    return { success: true, products: matchedProducts };
  } catch (error) {
    console.error("AI ERROR:", error);
    return { success: false, message: "AI failed" };
  }
}