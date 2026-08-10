// server.js
// Servidor do Planejador Inteligente de Eventos — e-inscrição
// Recebe o diagnóstico preenchido no quiz, pede pra IA (Claude) montar
// um plano de evento completo, e devolve em JSON pro front-end renderizar.

const express = require("express");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
const PORT = process.env.PORT || 3000;

// A chave de API é lida de uma variável de ambiente — NUNCA fica escrita no código.
// Configure ANTHROPIC_API_KEY nas Environment Variables do Render.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

// ---------------------------------------------------------------
// Monta o prompt para a IA a partir do diagnóstico preenchido
// ---------------------------------------------------------------
function montarPrompt(diag) {
  const { b1, b2, b3, b4, b5, b6 } = diag;

  return `Você é um consultor especialista em planejamento de eventos cristãos (congressos, retiros, cultos especiais, conferências). Com base nas respostas abaixo, monte um plano de evento completo, realista e prático.

DADOS DO EVENTO:
- Nome do evento: ${b1.nomeEvento || "não informado"}
- Tema: ${b1.tema || "não informado"}
- Versículo-base: ${b1.versiculo || "não informado"}
- Objetivo principal: ${b1.objetivo || "não informado"}
- Resultado esperado: ${b1.resultadoEsperado || "não informado"}
- Tipo de evento (pago/gratuito): ${b1.tipoEvento || "não informado"}
- Quantidade estimada de participantes: ${b2.quantidade || "não informado"}
- Faixa etária do público: ${b2.idade || "não informado"}
- É a primeira edição? ${b2.primeiraEdicao || "não informado"}
- Cidade: ${b2.cidade || "não informado"}
- Itens da estrutura do evento: ${(b3.itens || []).join(", ") || "não informado"}
- Quantidade de palestrantes/pregadores: ${b4.quantidade || "não informado"}
- Palestrantes já definidos? ${b4.definidos || "não informado"}
- Formato dos palestrantes: ${b4.formato || "não informado"}
- Duração: ${b5.dias || "?"} dia(s), ${b5.horasPorDia || "?"} horas por dia
- Data prevista: ${b5.data || "não informada"}
- Horário: ${b5.horaInicio || "?"} às ${b5.horaFim || "?"}
- Formato do evento (presencial/online/híbrido): ${b5.formatoEvento || "não informado"}
- Restrições de local: ${b5.restricaoLocal || "nenhuma informada"}
- Principal preocupação do organizador: ${b6.preocupacao || "não informada"}

Responda ESTRITAMENTE em formato JSON válido, sem nenhum texto antes ou depois, seguindo exatamente este schema (respeite os nomes de campos e a estrutura; use array vazio [] quando não houver itens para uma seção, nunca omita uma chave):

{
  "titulo_evento": "string - título do evento",
  "resumo_diagnostico": "string - 2-3 frases resumindo o diagnóstico e a estratégia do plano",
  "blocos": [
    {
      "inicio": "string - horário HH:MM",
      "fim": "string - horário HH:MM",
      "tipo": "abertura | louvor | mensagem | oracao | dinamica | intervalo | encerramento",
      "titulo": "string - título do bloco",
      "descricao": "string - descrição do que acontece",
      "sugestao_musical": "string opcional, apenas quando tipo=louvor",
      "checklist": ["array opcional de strings com itens de checklist específicos do bloco"]
    }
  ],
  "cronograma_equipe": [
    { "horario": "HH:MM", "atividade": "string - o que a equipe deve estar fazendo" }
  ],
  "checklist_operacional": ["array de strings com itens operacionais gerais"],
  "riscos_evento": [
    { "risco": "string - risco identificado", "sugestao": "string - como mitigar" }
  ],
  "calendario_editorial": [
    { "quando": "string - ex: 3 semanas antes", "formato": "string - ex: Reels", "plataforma": "string - ex: Instagram", "ideia": "string - ideia de conteúdo" }
  ],
  "checklist_pre_evento": [
    { "quando": "string - ex: 1 mês antes", "itens": ["array de strings"] }
  ],
  "checklist_dia_evento": [
    { "horario": "HH:MM", "item": "string - tarefa do dia do evento" }
  ],
  "materiais_necessarios": [
    { "item": "string", "quantidade": "string" }
  ],
  "equipe_minima": [
    { "funcao": "string", "quantidade_sugerida": "string" }
  ],
  "plano_b": [
    { "cenario": "string - cenário de risco", "acao": "string - plano de contingência" }
  ],
  "sugestoes_inteligentes": ["array de strings com sugestões extras do consultor"],
  "estimativa_duracao_real": {
    "duracao_planejada": "string",
    "duracao_estimada": "string",
    "observacao": "string"
  },
  "kit_divulgacao": {
    "post_instagram": "string - texto pronto para post",
    "convite_whatsapp": "string - texto pronto para convite via WhatsApp"
  }
}`;
}

// ---------------------------------------------------------------
// Endpoint principal
// ---------------------------------------------------------------
app.post("/api/gerar-plano", async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error:
          "ANTHROPIC_API_KEY não configurada no servidor. Configure a variável de ambiente no Render.",
      });
    }

    const diag = req.body;
    if (!diag || !diag.b1 || !diag.b2 || !diag.b3 || !diag.b4 || !diag.b5) {
      return res.status(400).json({ error: "Dados do diagnóstico incompletos." });
    }

    const prompt = montarPrompt(diag);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock) {
      return res.status(502).json({ error: "Resposta inesperada da IA (sem texto)." });
    }

    // Remove eventuais crases de bloco de código (```json ... ```) antes de parsear
    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Falha ao parsear JSON da IA:", parseErr, cleaned);
      return res.status(502).json({ error: "A IA retornou um formato inesperado. Tente novamente." });
    }

    return res.json(parsed);
  } catch (err) {
    console.error("Erro ao gerar plano:", err);
    return res.status(500).json({ error: "Erro interno ao gerar o plano. Tente novamente em instantes." });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
