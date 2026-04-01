# Rollback Playbook — Duedilis

## Quando Usar

Usar este playbook quando:
- Uma deploy causa erros em produção (Sentry mostra spike de erros)
- `/api/health` retorna `"degraded"` ou `503`
- Features críticas (login, criação de issues, upload) deixam de funcionar

---

## Vercel Instant Rollback

O método mais rápido — sem downtime, sem alterações de código.

1. Aceder a [Vercel Deployments](https://vercel.com/josuedutra/duedilis/deployments)
2. Encontrar o último deploy com status **"Ready"** que estava saudável
3. Clicar **"..."** → **"Promote to Production"**
4. Confirmar na modal → rollback instantâneo (`<30s`)

> **Nota:** Guardar o deployment ID antes de cada deploy de risco (ex: `dpl_abc123`).
> Verificar no dashboard Vercel após cada deploy se o status é "Ready".

---

## Neon DB Restore (Point-in-time)

Usar apenas se o rollback Vercel não for suficiente (ex: migração destrutiva).

1. Aceder a [Neon Console](https://console.neon.tech/)
2. Seleccionar projecto **Duedilis**
3. Navegar para **Branches → main**
4. Clicar **"Point-in-time restore"**
5. Seleccionar timestamp **anterior** ao problema
6. Clicar **"Restore"** e confirmar

> **Atenção:** O restore do Neon cria uma nova branch. Verificar o `DATABASE_URL` em Vercel se necessário.

---

## Checklist Pós-Rollback

Executar em sequência após qualquer rollback:

- [ ] Verificar `/api/health` retorna `{ "status": "healthy" }` (HTTP 200)
- [ ] Verificar Sentry — ausência de novos erros após rollback
- [ ] Testar smoke manual:
  - [ ] Login com Google / credenciais
  - [ ] Criar issue num projecto existente
  - [ ] Upload de documento (presign URL funciona)
- [ ] Notificar equipa (Josue) com: deployment ID anterior, deployment ID problemático, causa identificada

---

## Referências Rápidas

| Recurso | URL |
|---------|-----|
| Vercel Deployments | https://vercel.com/josuedutra/duedilis/deployments |
| Sentry Dashboard | https://sentry.io/organizations/duedilis/issues/ |
| Neon Console | https://console.neon.tech/ |
| Health Check | https://duedilis.vercel.app/api/health |

---

## Histórico de Rollbacks

| Data | Deployment Revertido | Causa | Tempo de Resolução |
|------|---------------------|-------|-------------------|
| _(a preencher)_ | — | — | — |
