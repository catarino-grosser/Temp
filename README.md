# Ted 2.2 - Meu Amigo Virtual

Versão com cobrança Pix via Mercado Pago: o usuário ganha 24 horas grátis ao criar conta e depois pode pagar R$ 1,00 via Pix para liberar mais 24 horas de conversa.

## Estrutura

- `index.html`, `style.css`, `script.js`, `firebase.js`: frontend.
- `netlify/functions/chat.js`: conversa com Gemini.
- `netlify/functions/init-user.js`: cria perfil e libera as primeiras 24h grátis.
- `netlify/functions/create-pix.js`: gera Pix de R$ 1,00 no Mercado Pago.
- `netlify/functions/check-pix.js`: verifica pagamento e libera mais 24h.
- `netlify/functions/payment-webhook.js`: webhook opcional para liberar automaticamente quando o Mercado Pago notificar pagamento aprovado.
- `netlify/functions/_firebase-admin.js`: utilitário interno do Firebase Admin.
- `firestore.rules`: regras recomendadas do Firestore.
- `package.json`: dependência `firebase-admin` para as Functions.

## Variáveis de ambiente no Netlify

Obrigatórias:

```txt
GEMINI_API_KEY=sua_chave_google_ai_studio
MERCADO_PAGO_ACCESS_TOKEN=seu_access_token_do_mercado_pago
FIREBASE_SERVICE_ACCOUNT_BASE64=sua_service_account_em_base64
```

Opcional, mas recomendado para webhook:

```txt
MP_WEBHOOK_SECRET=secret_signature_do_webhook_do_mercado_pago
MP_WEBHOOK_URL=https://seu-site.netlify.app/.netlify/functions/payment-webhook
```

## Como gerar FIREBASE_SERVICE_ACCOUNT_BASE64

1. Firebase Console > Configurações do projeto > Contas de serviço.
2. Gerar nova chave privada.
3. Baixe o JSON.
4. Converta para Base64.

No computador:

```bash
base64 serviceAccountKey.json
```

No celular, você pode usar algum app/editor que converta o conteúdo do JSON para base64. Cole o resultado inteiro na variável `FIREBASE_SERVICE_ACCOUNT_BASE64` do Netlify.

## Mercado Pago

No painel do Mercado Pago Developers:

1. Crie ou abra sua aplicação.
2. Copie o `Access Token` de produção ou teste.
3. Cadastre a URL do webhook:

```txt
https://SEU-SITE.netlify.app/.netlify/functions/payment-webhook
```

Evento recomendado: `payment`.

## Firestore

Publique as regras do arquivo `firestore.rules` no Firebase Console > Firestore Database > Rules.

## Observação importante

A liberação de acesso é feita pelas Netlify Functions usando Firebase Admin. O frontend apenas solicita criação/verificação do Pix. Isso evita que o usuário altere manualmente o campo `accessUntil` pelo navegador.
