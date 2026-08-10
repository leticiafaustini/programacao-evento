require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TIPOS_VALIDOS = ['abertura', 'louvor', 'oracao', 'mensagem', 'dinamica', 'intervalo', 'encerramento'];

function montarEmailHtml(parsed, diag, lead) {
  const cor = { fundo: '#221731', card: '#34204F', destaque: '#35D6B8', texto: '#EDE6F5', textoDim: '#B8A9CE' };

  const blocosHtml = (parsed.blocos || []).map(b => `
    <tr>
      <td style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.08); vertical-align:top;">
        <div style="font-size:12px; color:${cor.destaque}; font-weight:700;">${b.inicio} – ${b.fim}</div>
        <div style="font-size:15px; font-weight:700; color:${cor.texto}; margin-top:2px;">${b.titulo}</div>
        <div style="font-size:13px; color:${cor.textoDim}; margin-top:2px;">${b.descricao}</div>
      </td>
    </tr>`).join('');

  const listaSimples = (items) => `<ul style="margin:8px 0; padding-left:18px; color:${cor.textoDim}; font-size:13.5px; line-height:1.7;">${(items || []).map(i => `<li>${i}</li>`).join('')}</ul>`;

  const paresHtml = (items, kKey, vKey) => (items || []).map(it => `
    <div style="margin-bottom:10px; padding:12px 14px; background:${cor.card}; border-radius:8px;">
      <div style="font-size:13px; font-weight:700; color:${cor.texto};">${it[kKey]}</div>
      <div style="font-size:13px; color:${cor.textoDim}; margin-top:2px;">${it[vKey]}</div>
    </div>`).join('');

  const tabelaHtml = (items, itemKey, qtyKey) => (items || []).map(it => `
    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.08); font-size:13.5px;">
      <span style="color:${cor.texto};">${it[itemKey]}</span>
      <span style="color:${cor.destaque}; font-weight:700;">${it[qtyKey]}</span>
    </div>`).join('');

  const secao = (titulo, conteudoHtml) => conteudoHtml ? `
    <tr><td style="padding:28px 0 8px;"><h2 style="font-size:17px; color:${cor.texto}; margin:0;">${titulo}</h2></td></tr>
    <tr><td>${conteudoHtml}</td></tr>` : '';

  return `
  <div style="background:${cor.fundo}; padding:32px 16px; font-family: Arial, sans-serif;">
    <table role="presentation" width="100%" style="max-width:600px; margin:0 auto;" cellpadding="0" cellspacing="0">
      <tr><td style="padding-bottom:6px;">
        <div style="font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:${cor.destaque};">Seu plano de evento</div>
        <h1 style="font-size:24px; color:${cor.texto}; margin:6px 0 4px;">${parsed.titulo_evento || diag.b1.nomeEvento}</h1>
        <div style="font-size:13px; color:${cor.textoDim};">${diag.b1.objetivo} · ${diag.b1.tipoEvento} · ${diag.b2.quantidade} pessoas · ${diag.b2.cidade}</div>
      </td></tr>
      ${parsed.resumo_diagnostico ? `<tr><td style="padding:18px 0;"><div style="background:${cor.card}; border-left:3px solid ${cor.destaque}; padding:14px 16px; border-radius:0 8px 8px 0; font-size:13.5px; color:${cor.texto}; line-height:1.6;">${parsed.resumo_diagnostico}</div></td></tr>` : ''}

      ${secao('Programação completa', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${blocosHtml}</table>`)}
      ${secao('Checklist operacional', listaSimples(parsed.checklist_operacional))}
      ${secao('Riscos do evento', paresHtml(parsed.riscos_evento, 'risco', 'sugestao'))}
      ${secao('Materiais necessários', tabelaHtml(parsed.materiais_necessarios, 'item', 'quantidade'))}
      ${secao('Equipe mínima', tabelaHtml(parsed.equipe_minima, 'funcao', 'quantidade_sugerida'))}
      ${secao('Plano B', paresHtml(parsed.plano_b, 'cenario', 'acao'))}
      ${secao('Sugestões do consultor', listaSimples(parsed.sugestoes_inteligentes))}

      <tr><td style="padding:32px 0 8px; border-top:1px solid rgba(255,255,255,0.1); margin-top:20px;">
        <p style="font-size:13px; color:${cor.textoDim}; line-height:1.6;">
          Este é um resumo do seu plano completo. Para ver todos os detalhes — incluindo cronograma da equipe, checklist pré-evento, checklist do dia e kit de divulgação — acesse a ferramenta novamente.
        </p>
        <a href="https://e-inscricao.com/cadastro" style="display:inline-block; margin-top:10px; background:${cor.destaque}; color:${cor.fundo}; text-decoration:none; font-weight:700; font-size:14px; padding:12px 22px; border-radius:8px;">Organizar as inscrições deste evento →</a>
      </td></tr>
    </table>
  </div>`;
}

async function enviarPlanoPorEmail(parsed, diag, lead) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — envio de e-mail pulado. Veja o README.md.');
    return;
  }
  if (!lead || !lead.email) {
    console.warn('[email] Nenhum e-mail de lead informado — envio pulado.');
    return;
  }
  try {
    const fromEmail = process.env.FROM_EMAIL || 'Planejador de Eventos <onboarding@resend.dev>';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [lead.email],
        subject: `Seu plano do evento "${parsed.titulo_evento || diag.b1.nomeEvento}" está pronto`,
        html: montarEmailHtml(parsed, diag, lead)
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error('[email] Falha ao enviar via Resend:', response.status, errText);
    } else {
      console.log(`[email] Plano enviado para ${lead.email}`);
    }
  } catch (err) {
    console.error('[email] Erro ao enviar e-mail:', err);
  }
}

app.post('/api/gerar-plano', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY não configurada. Copie .env.example para .env e preencha sua chave.');
      return res.status(500).json({ error: 'Servidor não configurado: falta a chave de API. Veja o README.md.' });
    }

    const { b1: bloco1, b2: bloco2, b3: bloco3, b4: bloco4, b5: bloco5, b6: bloco6, lead } = req.body || {};

    if (!bloco1 || !bloco2 || !bloco3 || !bloco4 || !bloco5 || !bloco6 || !bloco6.preocupacao) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }

    if (lead && lead.email) {
      console.log(`[lead] ${lead.nome} <${lead.email}> — ${lead.igreja} — diagnóstico: "${bloco1.nomeEvento}" (${bloco2.quantidade} pessoas, ${bloco2.cidade})`);
    }

    const estruturaTexto = Array.isArray(bloco3.itens) && bloco3.itens.length
      ? bloco3.itens.join(', ')
      : 'não especificado';

    const preocupacaoTexto = bloco6 && bloco6.preocupacao ? bloco6.preocupacao : 'não informado';

    const prompt = `Você é um consultor sênior especialista em planejamento de eventos cristãos (cultos, conferências, retiros, congressos). Você não entrega apenas uma programação — você entrega um DIAGNÓSTICO e um PLANO COMPLETO DE EVENTO, como um consultor faria para um cliente.

Use seu conhecimento de boas práticas do setor ao longo de toda a análise. Por exemplo: eventos para casais funcionam melhor quando alternam momentos emocionais com momentos leves; conferências para jovens retêm mais atenção com intervalos de até 20 minutos; painéis mantêm mais atenção com no máximo 45 minutos; coffee breaks para públicos grandes tendem a congestionar se forem muito curtos ou concentrados em um único ponto.

=== DADOS COLETADOS NO DIAGNÓSTICO ===

BLOCO 1 — Sobre o evento
- Nome do evento: ${bloco1.nomeEvento}
- Tema: ${bloco1.tema}
- Versículo-base: ${bloco1.versiculo}
- Objetivo principal: ${bloco1.objetivo}
- Principal resultado esperado: ${bloco1.resultadoEsperado}
- Tipo de evento: ${bloco1.tipoEvento || 'não informado'} (considere isso ao sugerir credenciamento, controle de acesso e riscos financeiros/operacionais, se for pago)

BLOCO 2 — Público
- Quantidade esperada de participantes: ${bloco2.quantidade}
- Idade predominante: ${bloco2.idade}
- Primeira edição deste evento?: ${bloco2.primeiraEdicao}
- Cidade: ${bloco2.cidade}

BLOCO 3 — Estrutura prevista
- Itens que o evento terá: ${estruturaTexto}

BLOCO 4 — Palestrantes
- Quantidade de palestrantes/preletores: ${bloco4.quantidade}
- Já estão definidos?: ${bloco4.definidos}
- Formato de participação: ${bloco4.formato || 'não especificado'}

BLOCO 5 — Tempo e formato
- Quantidade de dias do evento: ${bloco5.dias}
- Horas por dia: ${bloco5.horasPorDia}
- Horário de início: ${bloco5.horaInicio}
- Horário previsto de término: ${bloco5.horaFim}
- Formato: ${bloco5.formatoEvento}
- Restrição de horário do local: ${bloco5.restricaoLocal || 'nenhuma informada'}

BLOCO 6 — Principal preocupação do organizador
"${preocupacaoTexto}"
Trate essa preocupação como prioridade — endereça-a explicitamente em "riscos_evento" ou "sugestoes_inteligentes".

=== O QUE ENTREGAR ===

Responda APENAS com um JSON válido, sem texto antes ou depois, sem markdown, no formato exato abaixo. Preencha TODOS os campos com conteúdo real e específico ao contexto — nunca deixe genérico.

{
  "titulo_evento": "string curta e criativa para o evento",
  "resumo_diagnostico": "2-3 frases em tom consultivo, resumindo a leitura que você fez do evento e o principal ponto de atenção identificado",
  "estimativa_duracao_real": {
    "duracao_planejada": "resumo do que foi informado (ex: '${bloco5.horasPorDia}h por dia, ${bloco5.dias} dia(s)')",
    "duracao_estimada": "sua estimativa realista considerando os blocos que você vai montar, em horas e minutos",
    "observacao": "1 frase explicando a diferença, se houver, e o impacto prático"
  },
  "blocos": [
    {
      "inicio": "HH:MM", "fim": "HH:MM",
      "tipo": "abertura|louvor|oracao|mensagem|dinamica|intervalo|encerramento",
      "titulo": "string curta", "descricao": "até 18 palavras",
      "checklist": ["até 3 itens de material/responsável"],
      "sugestao_musical": "apenas em blocos de louvor: estilo/direção musical, NUNCA nomes de música/artista/letra real"
    }
  ],
  "cronograma_equipe": [
    { "horario": "HH:MM", "atividade": "o que a equipe (não o público) precisa estar fazendo nesse horário, ex: 'Equipe de som faz teste final'" }
  ],
  "checklist_operacional": ["itens operacionais do dia, específicos à estrutura marcada no Bloco 3 e ao tamanho do público"],
  "riscos_evento": [
    { "risco": "um risco concreto identificado a partir dos números/estrutura informados", "sugestao": "recomendação prática para mitigar" }
  ],
  "calendario_editorial": [
    { "quando": "ex: '7 dias antes'", "plataforma": "Instagram Feed | Instagram Stories | WhatsApp | Facebook", "formato": "ex: 'Teaser em vídeo'", "ideia": "até 25 palavras" }
  ],
  "checklist_pre_evento": [
    { "quando": "30 dias antes", "itens": ["itens específicos"] },
    { "quando": "15 dias antes", "itens": ["itens específicos"] },
    { "quando": "7 dias antes", "itens": ["itens específicos"] },
    { "quando": "3 dias antes", "itens": ["itens específicos"] },
    { "quando": "1 dia antes", "itens": ["itens específicos"] }
  ],
  "checklist_dia_evento": [
    { "horario": "HH:MM", "item": "ação pontual de checklist do dia (não confundir com cronograma_equipe — aqui é uma lista simples de verificação)" }
  ],
  "materiais_necessarios": [
    { "item": "nome do material", "quantidade": "quantidade estimada com base no público informado" }
  ],
  "equipe_minima": [
    { "funcao": "nome da função (ex: Recepção, Louvor, Foto, Vídeo, Apoio, Segurança, Limpeza)", "quantidade_sugerida": "número sugerido de pessoas" }
  ],
  "plano_b": [
    { "cenario": "ex: 'E se chover?'", "acao": "o que fazer" }
  ],
  "sugestoes_inteligentes": [
    "insights de consultor específicos ao tipo/público/formato deste evento, no estilo: 'Eventos para X funcionam melhor quando Y'"
  ],
  "kit_divulgacao": {
    "post_instagram": "legenda de Instagram, tom envolvente, 1-2 emojis, até 60 palavras",
    "convite_whatsapp": "mensagem curta e calorosa para WhatsApp, até 40 palavras"
  }
}

Regras:
- O evento começa EXATAMENTE às ${bloco5.horaInicio}. Distribua "blocos" a partir desse horário.
- Considere ${bloco2.quantidade} participantes ao dimensionar materiais, equipe mínima e riscos (ex: filas, tempo de coffee, capacidade do espaço).
- "riscos_evento": gere entre 2 e 4 riscos reais, cruzando os dados (ex: muitas mensagens longas, intervalos curtos para o público grande, estrutura ambiciosa para o tempo disponível).
- "sugestoes_inteligentes": gere entre 3 e 5 insights, sempre amarrados ao objetivo/público/idade informados, não genéricos.
- Máximo 8 itens em "blocos". Máximo 6 itens em "cronograma_equipe" e em "checklist_dia_evento". Máximo 8 itens em "checklist_operacional". Máximo 6 itens em "materiais_necessarios" e "equipe_minima". Exatamente 3 cenários em "plano_b". Entre 5 e 6 itens em "calendario_editorial".`;

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      console.error('Erro da API da Anthropic:', anthropicResponse.status, errText);
      return res.status(502).json({ error: 'Falha ao gerar o plano. Tente novamente.' });
    }

    const data = await anthropicResponse.json();
    const rawText = (data.content || []).map(b => b.text || '').join('\n');
    const clean = rawText.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error('Falha ao interpretar JSON da IA:', clean);
      return res.status(502).json({ error: 'A IA retornou um formato inesperado. Tente novamente.' });
    }

    if (Array.isArray(parsed.blocos)) {
      parsed.blocos = parsed.blocos.map(b => ({
        ...b,
        tipo: TIPOS_VALIDOS.includes(b.tipo) ? b.tipo : 'dinamica',
        checklist: Array.isArray(b.checklist) ? b.checklist.slice(0, 3) : [],
        sugestao_musical: typeof b.sugestao_musical === 'string' ? b.sugestao_musical : ''
      }));
    } else {
      parsed.blocos = [];
    }

    const arrayOrEmpty = (v) => Array.isArray(v) ? v : [];
    parsed.cronograma_equipe = arrayOrEmpty(parsed.cronograma_equipe);
    parsed.checklist_operacional = arrayOrEmpty(parsed.checklist_operacional);
    parsed.riscos_evento = arrayOrEmpty(parsed.riscos_evento);
    parsed.calendario_editorial = arrayOrEmpty(parsed.calendario_editorial);
    parsed.checklist_pre_evento = arrayOrEmpty(parsed.checklist_pre_evento);
    parsed.checklist_dia_evento = arrayOrEmpty(parsed.checklist_dia_evento);
    parsed.materiais_necessarios = arrayOrEmpty(parsed.materiais_necessarios);
    parsed.equipe_minima = arrayOrEmpty(parsed.equipe_minima);
    parsed.plano_b = arrayOrEmpty(parsed.plano_b);
    parsed.sugestoes_inteligentes = arrayOrEmpty(parsed.sugestoes_inteligentes);

    if (!parsed.kit_divulgacao || typeof parsed.kit_divulgacao !== 'object') {
      parsed.kit_divulgacao = { post_instagram: '', convite_whatsapp: '' };
    }
    if (!parsed.estimativa_duracao_real || typeof parsed.estimativa_duracao_real !== 'object') {
      parsed.estimativa_duracao_real = { duracao_planejada: '', duracao_estimada: '', observacao: '' };
    }
    if (typeof parsed.resumo_diagnostico !== 'string') {
      parsed.resumo_diagnostico = '';
    }

    // Envia o plano por e-mail em paralelo — não bloqueia nem falha a resposta se o e-mail der erro.
    enviarPlanoPorEmail(parsed, { b1: bloco1, b2: bloco2, b3: bloco3, b4: bloco4, b5: bloco5, b6: bloco6 }, lead)
      .catch(err => console.error('[email] Erro não tratado ao enviar:', err));

    res.json(parsed);
  } catch (err) {
    console.error('Erro interno em /api/gerar-plano:', err);
    res.status(500).json({ error: 'Erro interno ao gerar plano.' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Planejador Inteligente de Eventos rodando em http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('AVISO: ANTHROPIC_API_KEY não definida. Copie .env.example para .env e preencha sua chave.');
  }
});
