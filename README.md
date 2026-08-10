# Planejador Inteligente de Eventos — e-inscrição

Gerador de programação de eventos cristãos com IA. O usuário responde um diagnóstico rápido (objetivo, público, estrutura, palestrantes, duração, preocupações) e recebe um plano de evento completo: programação minuto a minuto, cronograma de equipe, checklist operacional, riscos, materiais, plano B e kit de divulgação pronto.

## 🧠 Como funciona

- **Front-end** (`index.html`): quiz guiado + captura de lead (integrado ao HubSpot) + tela de resultado.
- **Backend** (`server.js`): recebe o diagnóstico, monta um prompt estruturado e chama a API da Anthropic (Claude) pra gerar o plano em JSON, que o front-end renderiza.

## 🚀 Rodando localmente

```bash
npm install
export ANTHROPIC_API_KEY="sua-chave-aqui"
npm start
```

Acesse `http://localhost:3000`.

## ☁️ Deploy no Render

Esse projeto **precisa ser criado como "Web Service"** no Render (não "Static Site"), porque tem um backend Node.js que roda de verdade.

1. **New + → Web Service**, conecte o repositório.
2. **Build Command:** `npm install`
3. **Start Command:** `npm start`
4. Em **Environment**, adicione a variável:
   - `ANTHROPIC_API_KEY` = sua chave da API da Anthropic (gerada em platform.claude.com)
5. Deploy.

## 🔑 Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ANTHROPIC_API_KEY` | Sim | Chave da API da Anthropic, usada para gerar o plano do evento. |
| `PORT` | Não | Porta do servidor (o Render define automaticamente). |

## 📄 Licença

Distribuído sob a licença MIT.
