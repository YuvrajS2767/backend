export async function getAIRecommendation(userPrompt, products) {
  const API_KEY = process.env.GEMINI_API_KEY;
  const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

  try {
    const geminiPrompt = `
Here is a list of available products:
${JSON.stringify(products)}

User request:
"${userPrompt}"

Return ONLY matching products in JSON array format.
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

    let parsedProducts;

    try {
      parsedProducts = JSON.parse(cleanedText);
    } catch (err) {
      return { success: false, message: "Invalid JSON from AI" };
    }

    return { success: true, products: parsedProducts };
  } catch (error) {
    console.error("AI ERROR:", error);
    return { success: false, message: "AI failed" };
  }
}