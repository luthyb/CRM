# NewType CRM

## Requisitos

- Node.js 22.16 ou mais recente; Node 24 LTS é recomendado.
- Em desenvolvimento, os dados ficam em `data/`. Em produção, use um diretório persistente fora da pasta publicada pelo Nginx.

## Desenvolvimento

```powershell
npm.cmd ci
npm.cmd run dev
```

Abra `http://127.0.0.1:5173`. Para executar os testes e o build, use `npm.cmd test` e `npm.cmd run build`.

## Preparação para VM Linux

O processo Node escuta somente em `127.0.0.1:5174`; o Nginx serve `dist/` e encaminha `/api/` ao Node. Não publique as portas 5173 ou 5174 na Internet.

1. Instale Node 24 LTS, Nginx e Certbot. Crie usuário de sistema `crm`, diretórios `/opt/newtype-crm`, `/var/lib/newtype-crm`, `/var/backups/newtype-crm` e `/etc/newtype-crm`. O usuário `crm` deve poder ler o projeto e escrever somente nos dois diretórios de dados.
2. Faça o build em ambiente confiável com `npm ci`, `npm run build`; publique o projeto e `dist/` em `/opt/newtype-crm`.
3. Crie `/etc/newtype-crm/crm.env` a partir de `.env.example`. Troque domínio e e-mail, gere o token com `openssl rand -hex 32` e proteja o arquivo (`root:crm`, modo `640`). Nunca coloque valores reais no Git.
4. `data/accounts.json` é ignorado pelo Git. Se for manter a conta atual, transfira esse arquivo por um canal seguro para `${CRM_DATA_DIR}/accounts.json` antes do primeiro início e configure `CRM_OWNER_EMAIL` com o e-mail já cadastrado. Sem essa transferência, será necessário configurar uma nova conta proprietária.
5. Copie `deploy/newtype-crm.service` e `deploy/newtype-crm-backup.service`/`.timer` para `/etc/systemd/system/`. Ajuste caminhos se a instalação não usar `/opt/newtype-crm`; execute `systemctl daemon-reload`, habilite/inicie `newtype-crm.service` e habilite `newtype-crm-backup.timer`.
6. Ajuste `deploy/nginx.conf` para o domínio e certificados TLS, habilite o site e valide com `nginx -t`. Configure DNS e Certbot antes de iniciar o bloco HTTPS.
7. No firewall, permita somente SSH administrativo e portas 80/443. Não permita acesso externo às portas 5173/5174.
8. Antes da mudança de domínio, baixe um backup JSON em Configurações no CRM antigo. Abra o domínio HTTPS, entre/configure o administrador e restaure esse arquivo em Configurações. `localStorage` não é compartilhado entre `localhost` e o novo domínio; a importação automática só encontra dados se estiverem disponíveis na origem atual. Confira empresas, leads, follow-ups e histórico antes de remover qualquer cópia antiga.

As origens em `CRM_ALLOWED_ORIGINS` devem ser origens completas HTTPS, por exemplo `https://crm.example.com`. O token de bootstrap pode permanecer no arquivo protegido: depois da criação da primeira conta, a API recusa novos cadastros. O endpoint de cadastro não deve ser reativado nem o banco/arquivo `accounts.json` deve ser servido pelo Nginx.

## Dados e backups

Empresas, leads, follow-ups, histórico, nome do workspace e sessões ficam em `CRM_DATA_DIR`; contas e hashes de senha ficam em `accounts.json` no mesmo diretório. Configure esse diretório em disco persistente e restrinja-o ao usuário `crm`. Trocar de navegador já não separa os dados do CRM.

O timer gera snapshots SQLite e cópias de `accounts.json` diariamente e mantém os últimos 30 conjuntos. Para recuperação de desastre, copie ambos os arquivos de cada conjunto para armazenamento externo à VM, com acesso restrito e criptografia, e teste periodicamente uma restauração. Um backup que só existe na própria VM não protege contra perda da VM.

Para restaurar um conjunto, pare `newtype-crm.service`, copie o arquivo `.sqlite` escolhido para `${CRM_DATA_DIR}/crm.sqlite` e o arquivo correspondente `.accounts.json` para `${CRM_DATA_DIR}/accounts.json`, ajuste proprietário/permissões para `crm` e inicie o serviço novamente. Faça isso primeiro em uma VM de teste; a restauração substitui os dados atuais.

Os dados locais antigos são migrados uma única vez no primeiro acesso do administrador se o navegador atual ainda tiver esses dados. Ao trocar de origem/domínio, restaure o arquivo JSON exportado no CRM antigo; os dados de conta (`accounts.json`) são separados e precisam ser transferidos/configurados à parte.
