# essential

plugin simples para revenge classic.

## o que ele faz

- mostra `nick • @usuario` no cabeçalho das mensagens;
- adiciona `editar localmente` ao segurar qualquer mensagem;
- a edição muda apenas o texto guardado no seu aplicativo e não envia uma edição ao discord;
- não possui configurações;
- as edições locais somem ao reiniciar o aplicativo ou desativar o plugin.

## colocar no github

1. crie um repositório público no github;
2. envie todos os arquivos desta pasta, mantendo a estrutura;
3. abra `settings > pages` e selecione `github actions` como fonte;
4. aguarde a action `build and deploy` terminar;
5. no revenge, instale usando:

```text
https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/essential/
```

## arquivos principais

```text
plugins/essential/manifest.json
plugins/essential/src/index.ts
```

O diretório `dist/essential` contém uma versão já compilada. A action recompila esse diretório a cada envio ao GitHub.

## compatibilidade

Este projeto usa a API do Revenge Classic/Vendetta. Revenge Next usa uma API e um formato de plugin diferentes.

Como os componentes internos do Discord mudam com atualizações, o patch de nomes ou o menu de mensagens pode precisar de ajuste em versões futuras. O projeto foi validado estruturalmente e compilado, mas não foi executado dentro de um aparelho com Discord nesta entrega.

## créditos

A lógica de edição local foi adaptada do plugin Local Edit de シグマ siguma, publicado em CC0.
