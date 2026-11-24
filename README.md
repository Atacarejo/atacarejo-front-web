# atacarejo-front-web

Admin do Atacarejo: a tela que o lojista abre dentro do admin da Nuvemshop (iframe, via Nexo).
React + Vite. Chama a API (`atacarejo-turbo-api`) em `VITE_API_URL`, com o session token do Nexo.

## Dev

```bash
yarn install
cp .env.example .env
yarn dev
```

No `.env`: `VITE_CLIENT_ID` (ID do app no Painel de parceiros) e `VITE_API_URL`. O dev abre em
`http://localhost:5173`.

## Produção: Cloudflare Workers (só arquivos estáticos)

```bash
yarn deploy
```

Roda `yarn build` e `wrangler deploy`.

- `wrangler.jsonc`: serve o `dist/`, com fallback de SPA (`/config` aberto direto cai no `index.html`), no
  domínio `web.atacarejo.nextcubeinc.com`
- `public/_headers`: CSP `frame-ancestors` (só o admin da Nuvemshop abre o app num iframe), `nosniff` e
  `Referrer-Policy`. O arquivo vai para o `dist/` e não é servido
- `.env.production`: `VITE_CLIENT_ID` e `VITE_API_URL` do build de produção. Não são segredos: vão dentro
  do JS público
