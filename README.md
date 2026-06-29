# Ted 2.3 - Meu Amigo Virtual

Versão 2.3 do Ted, com login/cadastro, histórico por usuário, diário, memórias, respostas locais para economizar API, limite diário, voz, avatar emocional e Netlify Function para proteger a chave do Gemini.

## Estrutura correta no GitHub

Os arquivos devem ficar na raiz do repositório:

```txt
index.html
style.css
script.js
firebase.js
netlify.toml
firestore.rules
README.md
netlify/
  functions/
    chat.js
```

## Netlify

Crie a variável de ambiente:

```txt
GEMINI_API_KEY
```

Opcionalmente, você pode criar:

```txt
GEMINI_MODEL=gemini-1.5-flash
```

## Firebase

Ative no Authentication:

```txt
Email/Password
```

Publique as regras do arquivo `firestore.rules` no Firestore.

## Melhorias da v2.1

- Respostas locais para mensagens simples, economizando chamadas à API.
- Contador diário de uso com IA por usuário.
- Memórias automáticas e manuais.
- Diário com humor.
- Nível de amizade baseado no uso.
- Avatar muda de humor conforme a resposta.
- Botões rápidos no chat.
- `netlify.toml` corrigido para publicar Functions.


## Versão 2.3 - Pix simples Mercado Pago

Esta versão preserva a base funcional do Ted e adiciona cobrança simples via Pix:

- 24 horas grátis no cadastro;
- quando o acesso expira, o chat é bloqueado;
- Pix de R$ 1,00 libera mais 24 horas;
- descrição da cobrança: `Acesso 24h ao Ted`;
- botão `Cancelar compra` interrompe a verificação automática do pagamento;
- funções usadas:
  - `netlify/functions/gerar-pix.js`
  - `netlify/functions/verificar-pagamento.js`

## Variáveis de ambiente no Netlify

Configure:

```txt
GEMINI_API_KEY
MP_ACCESS_TOKEN
```

Se o Netlify bloquear o deploy por causa da chave pública do Firebase em `firebase.js`, adicione também:

```txt
SECRETS_SCAN_OMIT_PATHS=firebase.js
```

## Observação de segurança

Esta é uma implementação simples para MVP. A liberação de acesso é feita no frontend após consultar o status do pagamento. Para uma versão comercial mais protegida, o ideal é validar o pagamento e atualizar o acesso no backend com Firebase Admin.
