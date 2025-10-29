// functions/analisar.js
export async function onRequestPost({ request, env }) {
  try {
    // 1) recebe o arquivo
    const form = await request.formData();
    const file = form.get("file");
    if (!file) return json({ error: "Campo 'file' ausente." }, 400);

    // 2) transforma em data URL (para enviar à OpenAI)
    const ab = await file.arrayBuffer();
    const base64 = toB64(ab);
    const dataUrl = `data:${file.type || "image/png"};base64,${base64}`;

    // 3) seu prompt (múltiplas lajes)
    const prompt = `
Analise esta imagem de um projeto de construção. Detecte todas as lajes e extraia dimensões para cada uma (largura e comprimento em metros, altura da viga como HX).
Retorne apenas um array JSON: [{"largura": X.X, "comprimento": Y.Y, "alturaViga": "HX"}, ...].
Se não encontrar lajes, retorne [].
    `;

    // 4) verifica a chave
    if (!env.OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY não configurada." }, 500);

    // 5) chama a OpenAI
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0,
        messages: [
          { role: "system", content: "Você é engenheiro especialista em plantas." },
          { role: "user", content: [
            { type: "text", text: prompt },
            { type: "input_image", image_url: { url: dataUrl } }
          ]}
        ],
      }),
    });

    const raw = await r.text();
    if (!r.ok) return json({ error: "OpenAI error", detail: raw }, 502);

    // 6) extrai só o ARRAY JSON da resposta
    let arr = [];
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      arr = match ? JSON.parse(match[0]) : [];
    } catch { arr = []; }

    // 7) saneia os valores
    const valid = new Set(["H8","H10","H12","H14","H16","H18","H20","H22","H24","H26","H28","H30","H32"]);
    arr = (Array.isArray(arr) ? arr : []).map(x => ({
      largura: Number(x.largura) || 0,
      comprimento: Number(x.comprimento) || 0,
      alturaViga: valid.has(String(x.alturaViga).toUpperCase()) ? String(x.alturaViga).toUpperCase() : "H12",
    }));

    return json(arr);
  } catch (e) {
    return json({ error: "Falha na análise", detail: String(e) }, 500);
  }
}

// GET opcional para teste rápido no navegador
export async function onRequestGet() {
  return new Response(JSON.stringify({ route: "analisar", ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

// utilitários
function toB64(buf) { let s=""; const b=new Uint8Array(buf); for (let i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s); }
function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
