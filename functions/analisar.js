// functions/analisar.js
export async function onRequestOptions({ request }) {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": request.headers.get("origin") || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return json({ error: "Envie multipart/form-data com o campo 'file'." }, 400);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file) return json({ error: "Arquivo obrigatório (campo 'file')." }, 400);

    const arrayBuf = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuf);
    const dataUrl = `data:${file.type || "image/png"};base64,${base64}`;

    const systemPrompt = `Você é um engenheiro de cálculo de lajes. Extraia do desenho/plantas:
- largura (metros, número)
- comprimento (metros, número)
- alturaViga (uma das: H8,H10,H12,H14,H16,H18,H20,H22,H24,H26,H28,H30,H32)
Responda APENAS JSON com as chaves: largura, comprimento, alturaViga.`;

    const userPrompt = `Analise a imagem e devolva JSON. Defaults conservadores se faltar info:
- largura: 2.0
- comprimento: 5.0
- alturaViga: H12`;

    // Chamada à OpenAI (Chat Completions com visão)
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o", // modelo com visão
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "input_image", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return json({ error: "Falha na OpenAI", detail: txt }, 500);
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || "{}";

    // tenta parsear JSON estrito; se vier com texto junto, pega só o bloco { ... }
    let parsed = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const largura = Number(parsed.largura) || 2.0;
    const comprimento = Number(parsed.comprimento) || 5.0;
    const valid = new Set(["H8","H10","H12","H14","H16","H18","H20","H22","H24","H26","H28","H30","H32"]);
    let alturaViga = String(parsed.alturaViga || "H12").toUpperCase();
    if (!valid.has(alturaViga)) alturaViga = "H12";

    return json({ largura, comprimento, alturaViga });
  } catch (e) {
    return json({ error: "Falha na análise", detail: String(e) }, 500);
  }
}

function arrayBufferToBase64(buf) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  // btoa está disponível em Pages Functions
  return btoa(binary);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
