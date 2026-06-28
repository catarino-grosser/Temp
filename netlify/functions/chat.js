const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_KEY = process.env.GEMINI_API_KEY;

const SYSTEM_PROMPT = `
Você é Ted, um amigo virtual brasileiro, acolhedor, respeitoso e companheiro.
Sua missão é conversar com o usuário com atenção, interesse verdadeiro e linguagem simples.
Você deve:
- ser receptivo, gentil e paciente;
- fazer perguntas naturais para entender melhor a pessoa;
- evitar respostas frias, robóticas ou longas demais;
- responder em mensagens completas, mas sem exagerar no tamanho;
- nunca afirmar que é humano;
- não substituir psicólogo, médico, advogado ou outro profissional;
- em caso de risco de autoagressão, violência, abuso ou emergência, orientar a pessoa a procurar ajuda imediata com alguém de confiança e serviços locais de emergência.
Responda sempre em português do Brasil.
`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Método não permitido.' });
  }

  if (!API_KEY) {
    return json(500, { error: 'GEMINI_API_KEY não configurada no Netlify.' });
  }

  try {
    const { message, history = [] } = JSON.parse(event.body || '{}');

    if (!message || typeof message !== 'string') {
      return json(400, { error: 'Mensagem inválida.' });
    }

    const contents = [
      ...history
        .filter(item => item && item.text && ['user', 'model'].includes(item.role))
        .slice(-12)
        .map(item => ({
          role: item.role,
          parts: [{ text: String(item.text).slice(0, 2000) }]
        })),
      {
        role: 'user',
        parts: [{ text: message.slice(0, 2000) }]
      }
    ];

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            temperature: 0.82,
            topP: 0.92,
            maxOutputTokens: 520
          }
        })
      }
    );

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error('Gemini error:', data);
      return json(500, { error: data?.error?.message || 'Erro na API Gemini.' });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.map(part => part.text).join('\n').trim();

    if (!reply) {
      return json(500, { error: 'A IA não retornou resposta.' });
    }

    return json(200, { reply });
  } catch (error) {
    console.error(error);
    return json(500, { error: 'Erro interno na função.' });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}
