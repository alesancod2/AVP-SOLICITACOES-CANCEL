// =============================================================
// MODULO: AUTENTICACAO, PERMISSOES E AUDITORIA
// =============================================================

const SHEET_USUARIOS = 'Usuarios';
const SHEET_LOGS = 'Logs';

const PERFIL_ADMIN = 'Admin';
const PERFIL_USER = 'User';

// Headers da aba Usuarios
const HEADERS_USUARIOS = ['NOME', 'EMAIL', 'PERFIL', 'STATUS', 'PERMISSOES', 'DATA CRIACAO', 'ULTIMO ACESSO'];

// Headers da aba Logs
const HEADERS_LOGS = ['DATA HORA', 'USUARIO', 'EMAIL', 'PERFIL', 'TIPO ACAO', 'ID SOLICITACAO', 'CAMPO ALTERADO', 'VALOR ANTERIOR', 'NOVO VALOR'];

// =============================================================
// CONFIGURACAO - EXECUTAR UMA VEZ
// =============================================================

/**
 * Cria as abas Usuarios e Logs (se nao existirem)
 * Execute esta funcao uma vez para configurar
 */
function criarAbasAuth() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Aba Usuarios
  var sheetU = ss.getSheetByName(SHEET_USUARIOS);
  if (!sheetU) {
    sheetU = ss.insertSheet(SHEET_USUARIOS);
  }
  var firstU = sheetU.getRange(1, 1).getValue();
  if (!firstU || firstU.toString().trim() === '') {
    sheetU.getRange(1, 1, 1, HEADERS_USUARIOS.length).setValues([HEADERS_USUARIOS]);
    var hR = sheetU.getRange(1, 1, 1, HEADERS_USUARIOS.length);
    hR.setFontWeight('bold');
    hR.setBackground('#7c3aed');
    hR.setFontColor('#ffffff');
    hR.setHorizontalAlignment('center');
    sheetU.setColumnWidth(1, 180);
    sheetU.setColumnWidth(2, 250);
    sheetU.setColumnWidth(3, 80);
    sheetU.setColumnWidth(4, 80);
    sheetU.setColumnWidth(5, 150);
    sheetU.setColumnWidth(6, 150);
    sheetU.setFrozenRows(1);
  }
  
  // Aba Logs
  var sheetL = ss.getSheetByName(SHEET_LOGS);
  if (!sheetL) {
    sheetL = ss.insertSheet(SHEET_LOGS);
  }
  var firstL = sheetL.getRange(1, 1).getValue();
  if (!firstL || firstL.toString().trim() === '') {
    sheetL.getRange(1, 1, 1, HEADERS_LOGS.length).setValues([HEADERS_LOGS]);
    var hRL = sheetL.getRange(1, 1, 1, HEADERS_LOGS.length);
    hRL.setFontWeight('bold');
    hRL.setBackground('#dc2626');
    hRL.setFontColor('#ffffff');
    hRL.setHorizontalAlignment('center');
    sheetL.setColumnWidth(1, 160);
    sheetL.setColumnWidth(2, 150);
    sheetL.setColumnWidth(3, 220);
    sheetL.setColumnWidth(4, 70);
    sheetL.setColumnWidth(5, 150);
    sheetL.setColumnWidth(6, 100);
    sheetL.setColumnWidth(7, 140);
    sheetL.setColumnWidth(8, 180);
    sheetL.setColumnWidth(9, 180);
    sheetL.setFrozenRows(1);
  }
  
  SpreadsheetApp.getUi().alert('Abas Usuarios e Logs criadas com sucesso!');
}

/**
 * Adiciona um usuario a aba Usuarios
 * Use para cadastrar o primeiro Admin
 */
function adicionarUsuario(nome, email, perfil) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_USUARIOS);
  if (!sheet) { criarAbasAuth(); sheet = ss.getSheetByName(SHEET_USUARIOS); }
  
  // Verificar se ja existe
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var emails = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (var i = 0; i < emails.length; i++) {
      if (emails[i][0].toString().trim().toLowerCase() === email.trim().toLowerCase()) {
        return { success: false, error: 'Usuario ja cadastrado: ' + email };
      }
    }
  }
  
  var agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
  sheet.appendRow([nome, email.trim().toLowerCase(), perfil || PERFIL_USER, 'Ativo', '', agora, '']);
  
  return { success: true, message: 'Usuario ' + nome + ' cadastrado como ' + perfil };
}

// =============================================================
// AUTENTICACAO
// =============================================================

/**
 * Retorna o usuario logado - vai direto ao login manual
 * pois o deploy e "Executar como: Eu" (getActiveUser nao funciona)
 */
function getUsuarioLogado() {
  return { 
    success: false, 
    requireLogin: true,
    error: 'Faça login para continuar.' 
  };
}

/**
 * Login manual - usuario informa o email cadastrado
 * Validacao: so aceita emails que estao na aba Usuarios
 */
function loginManual(emailInformado) {
  try {
    if (!emailInformado || emailInformado.trim() === '') {
      return { success: false, error: 'Email é obrigatório.' };
    }
    
    return autenticarPorEmail(emailInformado.trim().toLowerCase());
    
  } catch (error) {
    return { success: false, error: 'Erro no login: ' + error.message };
  }
}

/**
 * Funcao interna que busca o usuario pelo email na aba Usuarios
 * Coluna PERMISSOES (col 5): valores separados por virgula
 * Opcoes: cancelamentos, suspensos, dashboard
 * Admin tem acesso total independente da coluna
 */
function autenticarPorEmail(email) {
  // Garantir que email e uma string
  if (!email) return { success: false, error: 'Email não informado.' };
  email = String(email).trim().toLowerCase();
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_USUARIOS);
  
  if (!sheet) {
    return { success: false, error: 'Aba Usuários não encontrada. Execute criarAbasAuth().' };
  }
  
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { success: false, error: 'Nenhum usuário cadastrado. Cadastre pelo menos um Admin.' };
  }
  
  var lastCol = sheet.getLastColumn();
  var numCols = Math.max(lastCol, 7);
  var data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var userEmail = row[1] ? row[1].toString().trim().toLowerCase() : '';
    
    if (userEmail === email) {
      var status = row[3] ? row[3].toString().trim() : '';
      
      if (status !== 'Ativo') {
        return { success: false, error: 'Sua conta está inativa. Contate o administrador.' };
      }
      
      // Atualizar ultimo acesso (coluna 7 agora)
      var agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
      sheet.getRange(i + 2, 7).setValue(agora);
      
      var perfil = row[2] ? row[2].toString().trim() : PERFIL_USER;
      var isAdmin = perfil === PERFIL_ADMIN;
      
      // Permissoes: Admin tem tudo, User usa coluna PERMISSOES
      var permissoesRaw = row[4] ? row[4].toString().trim() : '';
      var permissoes = [];
      
      if (isAdmin) {
        permissoes = ['dashboard', 'cancelamentos', 'suspensos', 'usuarios'];
      } else if (permissoesRaw) {
        permissoes = permissoesRaw.toLowerCase().split(',').map(function(p) { return p.trim(); });
      } else {
        // Se nao tem permissoes definidas, acesso a nenhuma pagina
        permissoes = [];
      }
      
      var usuario = {
        nome: row[0] ? row[0].toString() : '',
        email: userEmail,
        perfil: perfil,
        status: status,
        isAdmin: isAdmin,
        permissoes: permissoes
      };
      
      // Registrar login
      registrarLog('Login', '', '', '', usuario.nome + ' (' + userEmail + ')', usuario);
      
      return { success: true, data: usuario };
    }
  }
  
  return { success: false, error: 'Acesso negado. O email (' + email + ') não está cadastrado no sistema.' };
}

/**
 * Verifica se o usuario atual tem perfil Admin
 * Recebe email do frontend (ja autenticado)
 */
function verificarAdmin_(email) {
  if (!email) return null;
  email = String(email).trim();
  var result = autenticarPorEmail(email);
  if (!result.success) return null;
  if (!result.data.isAdmin) return null;
  return result.data;
}

/**
 * Verifica se o usuario atual esta autenticado (qualquer perfil)
 * Recebe email do frontend (ja autenticado)
 */
function verificarAutenticado_(email) {
  if (!email) return null;
  email = String(email).trim();
  var result = autenticarPorEmail(email);
  if (!result.success) return null;
  return result.data;
}

// =============================================================
// AUDITORIA (LOGS)
// =============================================================

/**
 * Registra uma acao no log de auditoria
 * @param {string} tipoAcao - Ex: 'Nova solicitacao', 'Alteracao', 'Exclusao'
 * @param {string} idSolicitacao - ID/linha do registro afetado
 * @param {string} campoAlterado - Nome do campo (ou '' se nao aplicavel)
 * @param {string} valorAnterior - Valor antes da alteracao
 * @param {string} novoValor - Novo valor
 */
function registrarLog(tipoAcao, idSolicitacao, campoAlterado, valorAnterior, novoValor, usuario) {
  try {
    if (!usuario) return;
    
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_LOGS);
    if (!sheet) {
      criarAbasAuth();
      sheet = ss.getSheetByName(SHEET_LOGS);
    }
    
    var agora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    
    var logRow = [
      agora,
      usuario.nome,
      usuario.email,
      usuario.perfil,
      tipoAcao,
      idSolicitacao || '',
      campoAlterado || '',
      valorAnterior || '',
      novoValor || ''
    ];
    
    sheet.appendRow(logRow);
    
  } catch (error) {
    // Log silencioso - nao quebrar a operacao principal
    Logger.log('Erro ao registrar log: ' + error.message);
  }
}

// =============================================================
// FUNCOES PROTEGIDAS (WRAPPERS COM PERMISSAO)
// =============================================================

/**
 * Criar registro - qualquer usuario autenticado
 */
function createRecordAuth(email, data) {
  var usuario = verificarAutenticado_(email);
  if (!usuario) return { success: false, error: 'Acesso negado. Faca login.' };
  
  var result = createRecord(data);
  
  if (result.success) {
    registrarLog('Nova solicitacao', result.data.id, '', '', 'Associado: ' + (data.nomeDoAssociado || ''), usuario);
  }
  
  return result;
}

/**
 * Atualizar registro - qualquer usuario autenticado
 */
function updateRecordAuth(email, rowId, data) {
  var usuario = verificarAutenticado_(email);
  if (!usuario) return { success: false, error: 'Acesso negado. Faca login.' };
  
  var result = updateRecord(rowId, data);
  
  if (result.success) {
    registrarLog('Alteracao solicitacao', rowId, 'Multiplos campos', '', JSON.stringify(data).substring(0, 200), usuario);
  }
  
  return result;
}

/**
 * Excluir registro - APENAS ADMIN (exclusao logica)
 */
function deleteRecordAuth(email, rowId) {
  var usuario = verificarAdmin_(email);
  if (!usuario) return { success: false, error: 'Apenas administradores podem excluir registros.' };
  
  // Antes de excluir, registrar o que existia
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  var valorAnterior = '';
  if (sheet) {
    var row = sheet.getRange(parseInt(rowId), 1, 1, 10).getValues()[0];
    valorAnterior = row[0] + ' | ' + row[1]; // Nome + Placa
  }
  
  var result = deleteRecord(rowId);
  
  if (result.success) {
    registrarLog('Exclusao solicitacao', rowId, '', valorAnterior, 'EXCLUIDO por ' + usuario.nome, usuario);
  }
  
  return result;
}

/**
 * Atualizar celula de Suspensos - com verificacao de permissao
 * Coluna 11 (Conferencia) = apenas Admin
 */
function updateSuspensosCellAuth(email, rowId, colIndex, value) {
  var usuario = verificarAutenticado_(email);
  if (!usuario) return { success: false, error: 'Acesso negado. Faca login.' };
  
  // Coluna 11 = Conferencia (Verificado) - apenas Admin
  if (parseInt(colIndex) === 11 && !usuario.isAdmin) {
    return { success: false, error: 'Apenas administradores podem alterar o campo Conferencia/Verificado.' };
  }
  
  // Buscar valor anterior para o log
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_SUSPENSOS);
  var valorAnterior = '';
  if (sheet) {
    valorAnterior = sheet.getRange(parseInt(rowId), parseInt(colIndex)).getValue().toString();
  }
  
  var result = updateSuspensosCell(rowId, colIndex, value);
  
  if (result.success) {
    var colNames = ['', 'ASSOCIADO', 'DATA RECEBIMENTO', 'DATA VENCIMENTO', 'PLACA', 'SITUAÇÃO', 'FORMA PGTO', 'VALOR RECEBIDO', 'VALOR ORIGINAL', 'ATENDENTE', 'OBSERVAÇÕES', 'CONFERENCIA'];
    var campo = colNames[parseInt(colIndex)] || 'Col ' + colIndex;
    registrarLog('Alteracao Suspensos', rowId, campo, valorAnterior, value, usuario);
  }
  
  return result;
}

// =============================================================
// GESTAO DE USUARIOS (APENAS ADMIN)
// =============================================================

/**
 * Lista todos os usuarios cadastrados (apenas Admin)
 */
function listarUsuarios(adminEmail) {
  var admin = verificarAdmin_(adminEmail);
  if (!admin) return { success: false, error: 'Apenas administradores podem gerenciar usuarios.' };
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_USUARIOS);
  if (!sheet) return { success: false, error: 'Aba Usuarios nao encontrada.' };
  
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: true, data: [] };
  
  var lastCol = sheet.getLastColumn();
  var numCols = Math.max(lastCol, 7);
  var data = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  var usuarios = [];
  
  for (var i = 0; i < data.length; i++) {
    // Verificar se a linha tem dados
    var hasData = data[i][0] || data[i][1];
    if (!hasData) continue;
    
    usuarios.push({
      id: i + 2,
      nome: data[i][0] ? data[i][0].toString() : '',
      email: data[i][1] ? data[i][1].toString() : '',
      perfil: data[i][2] ? data[i][2].toString() : '',
      status: data[i][3] ? data[i][3].toString() : '',
      permissoes: data[i][4] ? data[i][4].toString() : '',
      dataCriacao: data[i][5] ? data[i][5].toString() : '',
      ultimoAcesso: data[i][6] ? data[i][6].toString() : ''
    });
  }
  
  return { success: true, data: usuarios };
}

/**
 * Cadastrar novo usuario (apenas Admin)
 */
function cadastrarUsuarioAuth(adminEmail, nome, email, perfil) {
  var admin = verificarAdmin_(adminEmail);
  if (!admin) return { success: false, error: 'Apenas administradores podem cadastrar usuarios.' };
  
  if (!nome || !email) return { success: false, error: 'Nome e email sao obrigatorios.' };
  if (perfil !== PERFIL_ADMIN && perfil !== PERFIL_USER) perfil = PERFIL_USER;
  
  var result = adicionarUsuario(nome, email, perfil);
  
  if (result.success) {
    registrarLog('Cadastro usuario', '', 'Novo usuario', '', nome + ' (' + email + ') como ' + perfil);
  }
  
  return result;
}

/**
 * Alterar status de usuario (Ativo/Inativo) - apenas Admin
 */
function alterarStatusUsuario(adminEmail, rowId, novoStatus) {
  var admin = verificarAdmin_(adminEmail);
  if (!admin) return { success: false, error: 'Apenas administradores podem alterar status de usuarios.' };
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_USUARIOS);
  if (!sheet) return { success: false, error: 'Aba nao encontrada.' };
  
  var row = parseInt(rowId);
  if (row < 2 || row > sheet.getLastRow()) return { success: false, error: 'Usuario invalido.' };
  
  var statusAnterior = sheet.getRange(row, 4).getValue().toString();
  sheet.getRange(row, 4).setValue(novoStatus);
  
  var emailAlterado = sheet.getRange(row, 2).getValue().toString();
  registrarLog('Alteracao status usuario', rowId, 'STATUS', statusAnterior, novoStatus + ' (' + emailAlterado + ')');
  
  return { success: true, message: 'Status alterado para ' + novoStatus };
}

/**
 * Alterar perfil de usuario - apenas Admin
 */
function alterarPerfilUsuario(adminEmail, rowId, novoPerfil) {
  var admin = verificarAdmin_(adminEmail);
  if (!admin) return { success: false, error: 'Apenas administradores podem alterar perfis.' };
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_USUARIOS);
  if (!sheet) return { success: false, error: 'Aba nao encontrada.' };
  
  var row = parseInt(rowId);
  var perfilAnterior = sheet.getRange(row, 3).getValue().toString();
  sheet.getRange(row, 3).setValue(novoPerfil);
  
  var emailAlterado = sheet.getRange(row, 2).getValue().toString();
  registrarLog('Alteracao perfil usuario', rowId, 'PERFIL', perfilAnterior, novoPerfil + ' (' + emailAlterado + ')');
  
  return { success: true, message: 'Perfil alterado para ' + novoPerfil };
}

// =============================================================
// HELPER: Cadastrar primeiro Admin manualmente
// Execute esta funcao UMA VEZ no editor para se cadastrar
// =============================================================

function cadastrarPrimeiroAdmin() {
  // ALTERE ESTES VALORES com seu nome e email real:
  var nome = 'Administrador';
  var email = Session.getActiveUser().getEmail();
  
  if (!email) {
    Logger.log('Erro: nao foi possivel obter o email. Execute pelo editor do Apps Script.');
    return;
  }
  
  var result = adicionarUsuario(nome, email, PERFIL_ADMIN);
  Logger.log(JSON.stringify(result));
  
  if (result.success) {
    SpreadsheetApp.getUi().alert('Admin cadastrado!\nEmail: ' + email + '\nPerfil: Admin');
  } else {
    SpreadsheetApp.getUi().alert('Erro: ' + result.error);
  }
}



// =============================================================
// ATUALIZAR PERMISSOES DE USUARIO
// =============================================================

/**
 * Atualiza permissoes de usuario por email (usado ao cadastrar)
 */
function atualizarPermissoesUsuario(adminEmail, email, permissoes) {
  var admin = verificarAdmin_(adminEmail);
  if (!admin) return { success: false, error: 'Apenas Admin.' };
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_USUARIOS);
  if (!sheet) return { success: false, error: 'Aba nao encontrada.' };
  
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: 'Nenhum usuario.' };
  
  var emails = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (var i = 0; i < emails.length; i++) {
    if (emails[i][0].toString().trim().toLowerCase() === email.trim().toLowerCase()) {
      sheet.getRange(i + 2, 5).setValue(permissoes);
      registrarLog('Alteracao permissoes', i + 2, 'PERMISSOES', '', permissoes + ' (' + email + ')');
      return { success: true };
    }
  }
  return { success: false, error: 'Email nao encontrado.' };
}

/**
 * Atualiza permissoes de usuario por ID de linha
 */
function atualizarPermissoesById(adminEmail, rowId, permissoes) {
  var admin = verificarAdmin_(adminEmail);
  if (!admin) return { success: false, error: 'Apenas Admin.' };
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_USUARIOS);
  if (!sheet) return { success: false, error: 'Aba nao encontrada.' };
  
  var row = parseInt(rowId);
  if (row < 2 || row > sheet.getLastRow()) return { success: false, error: 'Linha invalida.' };
  
  var anterior = sheet.getRange(row, 5).getValue().toString();
  sheet.getRange(row, 5).setValue(permissoes);
  
  var email = sheet.getRange(row, 2).getValue().toString();
  registrarLog('Alteracao permissoes', rowId, 'PERMISSOES', anterior, permissoes + ' (' + email + ')');
  
  return { success: true, message: 'Permissoes atualizadas.' };
}
