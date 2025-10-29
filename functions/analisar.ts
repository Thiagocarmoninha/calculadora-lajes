// functions/analisar.ts
export const onRequestPost: PagesFunction<{ OPENAI_API_KEY: string }> = async (ctx) => {
  try {
    const req = ctx.request;
    const origin = req.headers.get("origin") || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const ct = req.headers.get("content-type") || "";
    if (!ct.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Envie multipart/form-data com o campo 'file'." }), {
        status: 400,
        headers: { "content-type": "application/json", ...cors },
      });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "Arquivo ausente (campo 'file')." }), {
        status: 400,
        headers: { "content-type": "application/json", ...cors },
      });
    }

    const buf = await file.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);
    const mime = file.type || "application/octet-stream";

    const systemPrompt =
      "Você é um engenheiro civil que extrai medidas de lajes a partir de plantas ou PDFs. " +
      "Responda sempre em JSON no formato {largura, comprimento, alturaViga}.";
    const userPrompt =
      "Identifique a largura (m), comprimento (m) e altura da viga (H8 a H32). Retorne números com ponto decimal.";

    const body = {
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        {
          role: "user",
          content: [
            { type: "input_text", text: userPrompt },
            { type: "input_image", image_url: `data:${mime};base64,${b64}` },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "laje_schema",
          schema: {
            type: "object",
            properties: {
              largura: { type: "number" },
              comprimento: { type: "number" },
              alturaViga: {
                type: "string",
                enum: ["H8", "H10", "H12", "H14", "H16", "H18", "H20", "H22", "H24", "H26", "H28", "H30", "H32"],
              },
            },
            required: ["largura", "comprimento", "alturaViga"],
          },
        },
      },
    };

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ctx.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return new Response(JSON.stringify({ error: "Erro OpenAI", detail: err }), {
        status: 502,
        headers: { "content-type": "application/json", ...cors },
      });
    }

    const data = await resp.json();
    const text = data.output_text || JSON.stringify(data);
    const result = JSON.parse(text);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json", ...cors },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
