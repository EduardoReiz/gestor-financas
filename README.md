# GestorDeFinanças

App pessoal de finanças: contas, cartões, contas a pagar, metas e investimentos,
com os dados do Open Finance (via Meu Pluggy). Web + PWA para o iPhone.
Roda no servidor de casa, acessível só pela rede Tailscale.

## Rodar no Mac

```sh
docker compose up -d                 # Postgres na porta 5434 (só local)
cd backend && npm install
npx prisma migrate dev               # cria as tabelas
npm run db:exemplo                   # dados de exemplo (as mesmas telas do desenho)
npm run start:dev                    # API em http://127.0.0.1:3100/api

cd ../web && npm install && npm run dev   # app em http://localhost:5173
```

Antes da primeira vez: copie `.env.example` para `.env` (na raiz e em `backend/`)
e troque a senha do banco.
