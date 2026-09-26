# Futebol & Amigos

Lista de chegada para o futebol do grupo. O elenco guarda quem joga. No dia, essa gente entra na ordem de chegada. Os 10 primeiros jogam a primeira partida — os times ficam com eles. O pagamento é a mensalidade do mês, não o jogo.

Só o administrador entra no app.

## Como rodar

```bash
npm install
npm run dev
```

Abre [http://127.0.0.1:43123](http://127.0.0.1:43123).

No primeiro acesso:

- usuário: `admin`
- senha: `futebol123`

Troque a senha no botão **Senha**, depois de entrar. O aviso some quando a senha deixa de ser a inicial.

Para definir o administrador antes de criar o banco, copie `.env.example` para `.env.local` e ajuste `ADMIN_USER` e `ADMIN_PASSWORD`. Isso vale só enquanto o arquivo `data/futebol.db` ainda não existe.

## O que dá para fazer

- Cadastrar o elenco de quem joga.
- No dia, marcar a chegada a partir desse elenco, na ordem.
- Subir, descer, corrigir o nome ou tirar alguém da lista do dia aberto.
- Marcar a mensalidade do mês no elenco ou na lista do dia.
- **Começar novo dia**: a ordem vai para o histórico. O pagamento do mês continua.
- Em **Devem**, quitar um mês ou todos os meses em aberto de uma pessoa.
- Em **Meses**, ver cada mês de uso e quem pagou. Dá para marcar um mês só, mesmo que a pessoa deva vários.

Nesta máquina os dados ficam em `data/futebol.db`. No ar, o app usa um banco Turso (as variáveis `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`).

## Colocar no ar de graça

O endereço no ar é [futebol-amigos-virid.vercel.app](https://futebol-amigos-virid.vercel.app). Não precisa de domínio pago.

1. Crie uma conta em [turso.tech](https://turso.tech). O plano starter não pede cartão.
2. Crie um banco vazio e copie a URL (`libsql://...`) e o token.
3. Na [Vercel](https://vercel.com), plano Hobby, importe [juliomondin/Futebol-Amigos](https://github.com/juliomondin/Futebol-Amigos).
4. Antes do primeiro deploy, defina:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `AUTH_SECRET` — uma frase longa, diferente da de exemplo
   - `ADMIN_USER` e `ADMIN_PASSWORD` — só valem na primeira subida, quando o banco ainda não tem administrador
5. Abra o site, entre e troque a senha no botão **Senha**. No ar, a tela de login não mostra a senha.

Sem o Turso, a Vercel não guarda o arquivo do SQLite e a lista se perde.
