export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file) return json({ error: "Arquivo ausente." }, 400);

    const arrayBuffer = await file.arrayBuffer();
    const base64 = bufferToBase64(arrayBuffer);
    const dataUrl = `data:${file.type || "image/png"};base64,${base64}`;

    // 👉 Aqui entra o seu prompt atualizado:
    const prompt = `
      Analise esta imagem de um projeto de construção. Detecte todas as lajes e extraia dimensões para cada uma (largura e comprimento em metros, altura da viga como HX).
      Retorne apenas um array JSON: [{"largura": X.X, "comprimento": Y.Y, "alturaViga": "HX"}, ...].
      Se não encontrar lajes, retorne [].
    `;

    // Chamada à OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Você é engenheiro especialista em projetos estruturais." },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "input_image", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    const text = await response.text();

    // Extrai e valida o JSON retornado
    let arr = [];
    try {
      const match = text.match(/\[[\s\S]*\]/);
      arr = match ? JSON.parse(match[0]) : [];
    } catch (err) {
      arr = [];
    }

    return json(arr.length ? arr : []);
  } catch (err) {
    return json({ error: "Erro na função analisar", detail: String(err) }, 500);
  }
}

function bufferToBase64(buf) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
