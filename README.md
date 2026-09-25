# Futebol & Amigos

Lista de chegada para o futebol do grupo. Quem chega entra no fim da fila. Os 10 primeiros jogam a primeira partida — os times ficam com eles. Cada nome tem um cheque de **Pagou?**. Quando o dia fecha, quem não pagou fica salvo como devedor.

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

- Anotar quem chegou, na ordem.
- Subir, descer, corrigir o nome ou tirar alguém da lista do dia aberto.
- Marcar **Pagou?**
- **Começar novo dia**: a lista vai para o histórico e quem não pagou vira devedor.
- Em **Devedores**, quitar um dia ou todas as dívidas de uma pessoa.
- Num dia já encerrado, desmarcar o pagamento devolve a pessoa para devedores.

Os dados ficam em `data/futebol.db`, nesta máquina.
