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

## Assinatura (cobrança pelo Stripe)

- `/billing` (`src/pages/BillingPage.tsx`): situação, assinar (Pix ou cartão; o Pix só aparece para lojas do Brasil),
  pagar a fatura em aberto, trocar o cartão (portal do cliente do Stripe), atualizar os dados de cobrança, cancelar e o
  histórico.
- Cartão: abre o Checkout do Stripe numa nova aba. Pix: abre a fatura do Stripe com o QR Code (no teste grátis a
  primeira fatura só sai no fim dele, por e-mail). A aba é aberta já no clique (`openPendingTab` em `src/lib/external.ts`,
  senão o navegador bloqueia); no app do celular, a página vai para o navegador do aparelho via Nexo.
- Depois de abrir o Stripe, o `BillingProvider` confere a situação direto no Stripe (`GET /api/billing?sync=1`) ao
  voltar para a aba e a cada 5 s, por até 3 min, até a assinatura ou o pagamento chegar.
- `BillingGate`: com o atacado pausado por falta de pagamento, ou com o teste grátis ainda não começado, `/` e
  `/config` levam para `/billing` (lá fica a tela de boas-vindas, que começa o teste no clique).
- "Minha assinatura" troca entre Pix e cartão (`POST /api/billing/switch`) e mostra o aviso de cartão recusado
  (outro cartão, trocar o cartão ou pagar com Pix).
- `BillingBanner`: aviso vermelho nos últimos 3 dias do teste, na assinatura cancelada terminando e no pagamento
  pendente (o app segue funcionando até o fim da tolerância); azul no teste grátis e com a fatura do Pix em aberto.
- A situação vem de `GET /api/billing` (`src/lib/billing.ts`). Se a API falhar ou demorar, o app abre liberado.
