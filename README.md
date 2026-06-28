# Meu Amigo Virtual v3 - Ted com Avatar 3D

Esta versão adiciona um avatar 3D animado em CSS para o Ted, com movimento de cabeça, piscadas, boca animada enquanto fala, voz em português e conversa via Gemini usando Netlify Functions.

## Arquivos

```txt
meu-amigo-virtual-v3-avatar-3d/
├── index.html
├── style.css
├── app.js
├── netlify.toml
└── netlify/
    └── functions/
        └── chat.js
```

## Como publicar no Netlify

1. Envie todos os arquivos desta pasta para o seu projeto no GitHub ou arraste a pasta no deploy manual do Netlify.
2. No Netlify, confira se existe a variável de ambiente:

```txt
GEMINI_API_KEY=sua_chave_aqui
```

3. Opcionalmente, configure:

```txt
GEMINI_MODEL=gemini-2.5-flash
```

4. Faça o deploy.

## Observações

- A chave Gemini continua protegida dentro da função `netlify/functions/chat.js`.
- O avatar 3D é feito em HTML/CSS, então não depende de bibliotecas externas.
- A voz usa `speechSynthesis` do próprio navegador. No Android costuma funcionar bem no Chrome.
- O microfone depende da permissão do navegador e pode não funcionar em todos os WebViews.
