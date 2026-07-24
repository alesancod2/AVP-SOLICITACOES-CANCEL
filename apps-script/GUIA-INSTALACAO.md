# GUIA DE INSTALACAO - Google Apps Script Web App

## Como funciona?

Este codigo transforma sua planilha Google Sheets em um **aplicativo web completo**
diretamente no Google, sem necessidade de servidor externo, hospedagem ou custos.

---

## PASSO A PASSO

### 1. Abrir o Editor de Scripts

1. Abra sua planilha no Google Sheets
2. No menu superior, clique em **Extensoes** > **Apps Script**
3. O editor de codigo sera aberto em uma nova aba

### 2. Criar o Arquivo Code.gs

1. No editor, voce vera um arquivo chamado `Code.gs` (padrao)
2. **Apague todo o conteudo** que estiver la
3. **Copie e cole** todo o conteudo do arquivo `Code.gs` deste repositorio
4. **IMPORTANTE**: Na linha 8, confirme que o ID da planilha esta correto:
   ```javascript
   const SPREADSHEET_ID = '16DjjPOMnWu-9P88fKkLCxSGFHOSFtv8N7_kt1yWkiOE';
   ```
   (O ID esta na URL da sua planilha: `https://docs.google.com/spreadsheets/d/ESTE_E_O_ID/edit`)

### 3. Criar o Arquivo Index.html

1. No editor de scripts, clique no **"+"** ao lado de "Arquivos"
2. Selecione **"HTML"**
3. Nomeie como **Index** (sem extensao, ele adiciona .html automaticamente)
4. **Apague** o conteudo padrao
5. **Copie e cole** todo o conteudo do arquivo `Index.html` deste repositorio

### 4. Salvar

1. Clique no icone de **disquete** (ou Ctrl+S) para salvar ambos os arquivos

### 5. Fazer o Deploy (Publicar como Web App)

1. Clique no botao **"Implantar"** (canto superior direito)
2. Selecione **"Nova implantacao"**
3. Clique no icone de **engrenagem** ao lado de "Tipo"
4. Selecione **"App da Web"**
5. Configure:
   - **Descricao**: `Sistema de Gestao de Associados v1`
   - **Executar como**: `Eu` (seu email)
   - **Quem tem acesso**: Escolha conforme sua necessidade:
     - `Somente eu` - so voce acessa
     - `Qualquer pessoa com conta Google` - qualquer pessoa logada
     - `Qualquer pessoa` - acesso publico (sem login)
6. Clique em **"Implantar"**

### 6. Autorizar Permissoes

1. Na primeira vez, o Google pedira autorizacao
2. Clique em **"Autorizar acesso"**
3. Selecione sua conta Google
4. Se aparecer "Google nao verificou este app":
   - Clique em **"Avancado"** (canto inferior esquerdo)
   - Clique em **"Ir para [nome do projeto] (nao seguro)"**
5. Clique em **"Permitir"**

### 7. Acessar o App

1. Apos o deploy, voce recebera uma **URL do Web App**
2. Copie essa URL e acesse no navegador
3. Pronto! Seu sistema esta funcionando!

---

## ATUALIZAR O APP (Novo Deploy)

Sempre que modificar o codigo:

1. Salve os arquivos (Ctrl+S)
2. Clique em **"Implantar"** > **"Gerenciar implantacoes"**
3. Clique no icone de **lapis** (editar) na implantacao ativa
4. Em "Versao", selecione **"Nova versao"**
5. Clique em **"Implantar"**

> A URL permanece a mesma!

---

## ESTRUTURA DA PLANILHA

Certifique-se que sua planilha tem:

- **Abas** nomeadas por mes (AGOSTO, SETEMBRO, etc.)
- **Linha 1** de cada aba com os headers:

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| NOME DO ASSOCIADO | PLACA | VALOR DA PARCELA | VALOR PAGO | CONSULTOR | MOTIVO DO CANCELAMENTO | STATUS ATUAL | OBSERVACAO | ATENDENTE |

---

## FUNCIONALIDADES

- Dashboard com cards de estatisticas
- Tabela com todos os registros
- Busca rapida (por nome, placa, consultor)
- Criar novo associado
- Editar associado existente
- Excluir associado (com confirmacao)
- Navegacao entre abas/meses
- Notificacoes de sucesso/erro (toasts)
- Interface responsiva (funciona no celular)

---

## SOLUCAO DE PROBLEMAS

### "Nao tenho permissao"
- Verifique se voce esta logado com a conta correta
- Refaca o deploy com a permissao adequada

### "Aba nao encontrada"
- Verifique se o nome da aba na planilha bate exatamente (maiusculas/minusculas)

### "Erro ao carregar dados"
- Verifique se o SPREADSHEET_ID esta correto no Code.gs
- Verifique se a planilha tem dados na linha 2+

### App nao carrega
- Tente acessar em uma aba anonima
- Verifique se fez o deploy como "App da Web"
- Confirme que autorizou todas as permissoes

---

## LIMITES DO GOOGLE APPS SCRIPT

- **Tempo de execucao**: Maximo 6 minutos por chamada
- **Chamadas por dia**: 20.000 (conta gratuita)
- **Tamanho do HTML**: Maximo 500KB
- **Usuarios simultaneos**: Sem limite definido (mas pode ficar lento com muitos)

Para a maioria dos times pequenos/medios, esses limites sao mais que suficientes!
