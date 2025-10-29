const prompt = `
    Analise esta imagem de um projeto de construção. Detecte todas as lajes e extraia dimensões para cada uma (largura e comprimento em metros, altura da viga como HX).
    Retorne apenas um array JSON: [{"largura": X.X, "comprimento": Y.Y, "alturaViga": "HX"}, ...].
    Se não encontrar lajes, retorne [].
`;
