# Ted v2.2 - Pix Mercado Pago simples

Versão com login/cadastro, chat com Gemini, histórico no Firestore e cobrança Pix simples pelo Mercado Pago.

## Como funciona

- Ao criar conta, o usuário ganha 24 horas grátis.
- Depois que o acesso expira, o chat é bloqueado.
- O usuário gera um Pix de R$ 1,00.
- O app consulta `verificar-pagamento` a cada 5 segundos.
- Quando o status retorna `approved`, o acesso é liberado por mais 24 horas.
- O botão **Cancelar compra** interrompe a verificação automática do pagamento.

## Variáveis no Netlify

Configure em Site configuration > Environment variables:

```txt
GEMINI_API_KEY
MP_ACCESS_TOKEN
```

Opcional:

```txt
GEMINI_MODEL=gemini-1.5-flash
```

## Arquivos importantes

```txt
netlify/functions/chat.js
netlify/functions/gerar-pix.js
netlify/functions/verificar-pagamento.js
```

A descrição do Pix está configurada como:

```txt
Acesso 24h ao Ted
```

## Firebase

Ative Authentication por e-mail/senha e publique as regras em `firestore.rules`.

Observação: esta versão é simples e não usa webhook. Para produção mais segura, o ideal é futuramente mover a liberação de acesso para uma função protegida no servidor.
