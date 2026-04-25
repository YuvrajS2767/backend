export async function getAIRecommendation(userPrompt, products) {
  const API_KEY = process.env.GEMINI_API_KEY;
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

  try {
    // ✅ reduce token usage (VERY IMPORTANT for free tier)
    const simplifiedProducts = products.slice(0, 30).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
    }));

    const geminiPrompt = `
You are a product recommendation system.

Products:
${JSON.stringify(simplifiedProducts)}

User request:
"${userPrompt}"

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

    const cleanedText = aiResponseText.replace(/```json|```/g, "").trim();

    if (!cleanedText) {
      return { success: false, message: "Empty AI response" };
    }

    let ids;

    try {
      ids = JSON.parse(cleanedText);
    } catch (err) {
      console.log("RAW AI:", aiResponseText);
      return { success: false, message: "Invalid JSON from AI" };
    }

    // ✅ map back to real DB products
    const matchedProducts = products.filter((p) =>
      ids.includes(String(p.id))
    );

    return { success: true, products: matchedProducts };
  } catch (error) {
    console.error("AI ERROR:", error);
    return { success: false, message: "AI failed" };
  }
}