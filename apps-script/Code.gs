// =============================================
// GOOGLE APPS SCRIPT - GESTAO DE CANCELAMENTOS
// =============================================
// Planilha com ABA UNICA e filtros por data (coluna J)
// =============================================

const SPREADSHEET_ID = '16DjjPOMnWu-9P88fKkLCxSGFHOSFtv8N7_kt1yWkiOE';
const SHEET_NAME = 'DB_Cancelamentos'; // Nome da aba unica

// =============================================
// FUNCAO PRINCIPAL - SERVE A PAGINA WEB
// =============================================
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Gestao de Cancelamentos')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// =============================================
// FUNCOES DE LEITURA
// =============================================

/**
 * Busca todos os registros da aba unica
 * @param {string} searchQuery - Texto para busca
 * @param {Object} filters - Filtros: { mes, ano, dataInicio, dataFim, status }
 */
function getRecords(searchQuery, filters) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return { success: false, error: 'Aba "' + SHEET_NAME + '" nao encontrada. Execute criarAba() primeiro.' };
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow <= 2) {
      return { success: true, data: [], meta: { total: 0 } };
    }
    
    var lastCol = sheet.getLastColumn();
    var colCount = Math.max(lastCol, 10);
    var data = sheet.getRange(3, 1, lastRow - 2, colCount).getValues();
    var records = [];
    
    // Headers para filtrar linhas que sao cabecalho duplicado
    var headerValues = [
      'nome do associado', 'placa', 'valor da parcela', 'valor pago',
      'consultor', 'motivo do cancelamento', 'status atual', 'observacao',
      'observação', 'atendente', 'data de criacao', 'data de criação'
    ];
    
    // Nomes dos meses para filtro
    var mesesNomes = ['', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
                      'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      
      // Pular linhas vazias
      var hasData = row.some(function(cell) {
        return cell && cell.toString().trim() !== '' && cell.toString().trim() !== '-';
      });
      if (!hasData) continue;
      
      // Pular cabecalhos duplicados
      var firstCell = row[0] ? row[0].toString().trim().toLowerCase() : '';
      if (headerValues.indexOf(firstCell) >= 0) continue;
      var headerMatchCount = 0;
      for (var h = 0; h < Math.min(row.length, 10); h++) {
        var cellValue = row[h] ? row[h].toString().trim().toLowerCase() : '';
        if (headerValues.indexOf(cellValue) >= 0) headerMatchCount++;
      }
      if (headerMatchCount >= 3) continue;
      
      // Extrair data da coluna J
      var dataRaw = row[9] ? row[9].toString() : '';
      var dataParts = null;
      var dataObj = null;
      
      if (dataRaw) {
        // Formato esperado: dd/MM/yyyy HH:mm:ss ou dd/MM/yyyy
        var dateStr = dataRaw.split(' ')[0];
        var parts = dateStr.split('/');
        if (parts.length === 3) {
          dataParts = { dia: parseInt(parts[0]), mes: parseInt(parts[1]), ano: parseInt(parts[2]) };
          dataObj = new Date(dataParts.ano, dataParts.mes - 1, dataParts.dia);
        }
      }
      
      // === APLICAR FILTROS ===
      if (filters) {
        // Filtro por MES
        if (filters.mes && filters.mes !== '') {
          var mesIdx = mesesNomes.indexOf(filters.mes.toUpperCase());
          if (mesIdx > 0 && dataParts) {
            if (dataParts.mes !== mesIdx) continue;
          } else if (mesIdx > 0 && !dataParts) {
            continue;
          }
        }
        
        // Filtro por ANO
        if (filters.ano && filters.ano !== '') {
          var anoFiltro = parseInt(filters.ano);
          if (dataParts) {
            if (dataParts.ano !== anoFiltro) continue;
          } else {
            continue;
          }
        }
        
        // Filtro por DATA INICIO
        if (filters.dataInicio && filters.dataInicio !== '' && dataObj) {
          var inicio = new Date(filters.dataInicio + 'T00:00:00');
          if (dataObj < inicio) continue;
        } else if (filters.dataInicio && !dataObj) {
          continue;
        }
        
        // Filtro por DATA FIM
        if (filters.dataFim && filters.dataFim !== '' && dataObj) {
          var fim = new Date(filters.dataFim + 'T23:59:59');
          if (dataObj > fim) continue;
        } else if (filters.dataFim && !dataObj) {
          continue;
        }
        
        // Filtro por STATUS
        if (filters.status && filters.status !== '') {
          var statusAtual = row[6] ? row[6].toString().toLowerCase() : '';
          if (statusAtual !== filters.status.toLowerCase()) continue;
        }
      }
      
      var record = {
        id: i + 3,
        nomeDoAssociado: row[0] ? row[0].toString() : '',
        placa: row[1] ? row[1].toString() : '',
        valorDaParcela: row[2] ? row[2].toString() : '',
        valorPago: row[3] ? row[3].toString() : '',
        consultor: row[4] ? row[4].toString() : '',
        motivoDoCancelamento: row[5] ? row[5].toString() : '-',
        statusAtual: row[6] ? row[6].toString() : '-',
        observacao: row[7] ? row[7].toString() : '-',
        atendente: row[8] ? row[8].toString() : '',
        dataCriacao: dataRaw
      };
      
      // Filtro de busca por texto
      if (searchQuery && searchQuery.trim() !== '') {
        var query = searchQuery.toLowerCase();
        var match = record.nomeDoAssociado.toLowerCase().indexOf(query) >= 0 ||
                    record.placa.toLowerCase().indexOf(query) >= 0 ||
                    record.consultor.toLowerCase().indexOf(query) >= 0 ||
                    record.atendente.toLowerCase().indexOf(query) >= 0 ||
                    record.statusAtual.toLowerCase().indexOf(query) >= 0;
        if (!match) continue;
      }
      
      records.push(record);
    }
    
    return { success: true, data: records, meta: { total: records.length } };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// =============================================
// FUNCOES DE ESCRITA
// =============================================

/**
 * Cria novo registro com data automatica na coluna J
 */
function createRecord(data) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return { success: false, error: 'Aba "' + SHEET_NAME + '" nao encontrada' };
    }
    
    if (!data.nomeDoAssociado || !data.placa) {
      return { success: false, error: 'Nome do Associado e Placa sao obrigatorios' };
    }
    
    var agora = new Date();
    var dataCriacao = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    
    var newRow = [
      data.nomeDoAssociado || '',
      data.placa || '',
      data.valorDaParcela || '',
      data.valorPago || '',
      data.consultor || '',
      data.motivoDoCancelamento || '-',
      data.statusAtual || '-',
      data.observacao || '-',
      data.atendente || '',
      dataCriacao
    ];
    
    sheet.appendRow(newRow);
    var newRowNumber = sheet.getLastRow();
    
    return {
      success: true,
      data: { id: newRowNumber, dataCriacao: dataCriacao },
      message: 'Solicitacao criada com sucesso!'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza registro existente (preserva data de criacao)
 */
function updateRecord(rowId, data) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return { success: false, error: 'Aba nao encontrada' };
    }
    
    var row = parseInt(rowId);
    if (row < 3 || row > sheet.getLastRow()) {
      return { success: false, error: 'Linha invalida: ' + rowId };
    }
    
    var existingDate = sheet.getRange(row, 10).getValue();
    var dataCriacao = existingDate ? existingDate.toString() : '';
    
    var updatedRow = [
      data.nomeDoAssociado || '',
      data.placa || '',
      data.valorDaParcela || '',
      data.valorPago || '',
      data.consultor || '',
      data.motivoDoCancelamento || '-',
      data.statusAtual || '-',
      data.observacao || '-',
      data.atendente || '',
      dataCriacao
    ];
    
    sheet.getRange(row, 1, 1, 10).setValues([updatedRow]);
    
    return { success: true, message: 'Registro atualizado com sucesso!' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Exclui registro
 */
function deleteRecord(rowId) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return { success: false, error: 'Aba nao encontrada' };
    }
    
    var row = parseInt(rowId);
    if (row < 3 || row > sheet.getLastRow()) {
      return { success: false, error: 'Linha invalida: ' + rowId };
    }
    
    sheet.deleteRow(row);
    return { success: true, message: 'Excluido com sucesso!' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// =============================================
// ESTATISTICAS
// =============================================

function getStats(filters) {
  try {
    var result = getRecords('', filters);
    if (!result.success) return result;
    
    var records = result.data;
    var stats = { total: records.length, ativos: 0, emNegociacao: 0, cancelados: 0 };
    
    for (var i = 0; i < records.length; i++) {
      var status = records[i].statusAtual.toLowerCase();
      if (status === 'ativo') stats.ativos++;
      else if (status === 'em negociacao' || status === 'em negociação') stats.emNegociacao++;
      else if (status === 'cancelado') stats.cancelados++;
    }
    
    return { success: true, data: stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// =============================================
// CONFIGURACAO - EXECUTAR UMA VEZ
// =============================================

/**
 * Cria a aba unica CANCELAMENTOS com headers na linha 2
 */
function criarAba() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  
  var headers = [
    'NOME DO ASSOCIADO', 'PLACA', 'VALOR DA PARCELA', 'VALOR PAGO',
    'CONSULTOR', 'MOTIVO DO CANCELAMENTO', 'STATUS ATUAL', 'OBSERVACAO',
    'ATENDENTE', 'DATA DE CRIACAO'
  ];
  
  var row2 = sheet.getRange(2, 1).getValue();
  if (!row2 || row2.toString().trim() === '') {
    sheet.getRange(2, 1, 1, 10).setValues([headers]);
    var headerRange = sheet.getRange(2, 1, 1, 10);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#166534');
    headerRange.setFontColor('#ffffff');
    headerRange.setHorizontalAlignment('center');
    sheet.setColumnWidth(1, 200);
    sheet.setColumnWidth(2, 100);
    sheet.setColumnWidth(3, 130);
    sheet.setColumnWidth(4, 130);
    sheet.setColumnWidth(5, 130);
    sheet.setColumnWidth(6, 200);
    sheet.setColumnWidth(7, 130);
    sheet.setColumnWidth(8, 200);
    sheet.setColumnWidth(9, 130);
    sheet.setColumnWidth(10, 170);
  }
  
  sheet.setFrozenRows(2);
  
  return { success: true, message: 'Aba CANCELAMENTOS criada com sucesso!' };
}


// =============================================================
// MODULO: DB_SUSPENSOS - GESTAO DE SUSPENSOS
// =============================================================

const SHEET_SUSPENSOS = 'DB_Suspensos';

const HEADERS_SUSPENSOS = [
  'ASSOCIADO', 'DATA RECEBIMENTO', 'DATA VENCIMENTO', 'PLACA',
  'SITUAÇÃO ATUAL', 'FORMA PGTO', 'VALOR RECEBIDO',
  'VALOR ORIGINAL', 'ATENDENTE', 'OBSERVAÇÕES', 'CONFERENCIA'
];

// =============================================
// MENU PERSONALIZADO NA PLANILHA
// =============================================

/**
 * Cria menu personalizado ao abrir a planilha
 * Este menu aparece no topo: "Sistema > Importar Dados Excel"
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Sistema')
    .addItem('Importar Dados Excel', 'abrirModalImportacao')
    .addItem('Criar Aba DB_Suspensos', 'criarAbaSuspensos')
    .addToUi();
}

/**
 * Abre o modal de importacao de Excel/CSV
 */
function abrirModalImportacao() {
  var html = HtmlService.createHtmlOutputFromFile('ModalImport')
    .setWidth(500)
    .setHeight(400)
    .setTitle('Importar Dados - DB_Suspensos');
  SpreadsheetApp.getUi().showModalDialog(html, 'Importar Dados Excel/CSV');
}

// =============================================
// CRIAR ABA DB_SUSPENSOS
// =============================================

/**
 * Cria a aba DB_Suspensos com headers formatados (se nao existir)
 */
function criarAbaSuspensos() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_SUSPENSOS);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SUSPENSOS);
  }
  
  // Verificar se headers ja existem na linha 1
  var firstCell = sheet.getRange(1, 1).getValue();
  if (!firstCell || firstCell.toString().trim() === '') {
    sheet.getRange(1, 1, 1, HEADERS_SUSPENSOS.length).setValues([HEADERS_SUSPENSOS]);
    
    // Formatar headers
    var headerRange = sheet.getRange(1, 1, 1, HEADERS_SUSPENSOS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1e40af');
    headerRange.setFontColor('#ffffff');
    headerRange.setHorizontalAlignment('center');
    headerRange.setWrap(true);
    
    // Ajustar larguras
    sheet.setColumnWidth(1, 200);  // ASSOCIADO
    sheet.setColumnWidth(2, 140);  // DATA RECEBIMENTO
    sheet.setColumnWidth(3, 140);  // DATA VENCIMENTO
    sheet.setColumnWidth(4, 100);  // PLACA
    sheet.setColumnWidth(5, 140);  // SITUAÇÃO ATUAL
    sheet.setColumnWidth(6, 120);  // FORMA PGTO
    sheet.setColumnWidth(7, 130);  // VALOR RECEBIDO
    sheet.setColumnWidth(8, 130);  // VALOR ORIGINAL
    sheet.setColumnWidth(9, 120);  // ATENDENTE
    sheet.setColumnWidth(10, 200); // OBSERVAÇÕES
    sheet.setColumnWidth(11, 120); // CONFERENCIA
    
    // Congelar header
    sheet.setFrozenRows(1);
  }
  
  SpreadsheetApp.getUi().alert('Aba "DB_Suspensos" criada/verificada com sucesso!');
  return { success: true, message: 'Aba DB_Suspensos pronta!' };
}

// =============================================
// IMPORTAR DADOS DO EXCEL/CSV
// =============================================

/**
 * Recebe os dados do arquivo importado - IMPORTA APENAS 4 COLUNAS:
 * Associado, Placa, Data de Vencimento, Valor Original
 * As demais colunas ficam em branco para preenchimento inline
 */
function importarDadosSuspensos(dados) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_SUSPENSOS);
    
    if (!sheet) {
      criarAbaSuspensos();
      sheet = ss.getSheetByName(SHEET_SUSPENSOS);
    }
    
    if (!dados || dados.length === 0) {
      return { success: false, error: 'Nenhum dado para importar' };
    }
    
    // Buscar dados existentes para verificar duplicatas (ASSOCIADO + PLACA)
    var lastRow = sheet.getLastRow();
    var existingKeys = {};
    
    if (lastRow > 1) {
      var existingData = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
      for (var e = 0; e < existingData.length; e++) {
        var assoc = existingData[e][0] ? existingData[e][0].toString().trim().toUpperCase() : '';
        var pl = existingData[e][3] ? existingData[e][3].toString().trim().toUpperCase() : '';
        if (assoc || pl) {
          existingKeys[assoc + '|' + pl] = e + 2;
        }
      }
    }
    
    var inseridos = 0;
    var atualizados = 0;
    var ignorados = 0;
    var rowsToAppend = [];
    
    for (var i = 0; i < dados.length; i++) {
      var importRow = dados[i];
      
      // Extrair apenas as 4 colunas relevantes do arquivo importado
      // Esperado: [Associado, ..., ..., Placa, ..., ..., ..., ValorOriginal, ...]
      // Ou mapeamento direto: col0=Associado, col1=Placa, col2=DataVencimento, col3=ValorOriginal
      var associado = importRow[0] ? importRow[0].toString().trim() : '';
      var placa = importRow[1] ? importRow[1].toString().trim() : '';
      var dataVencimento = importRow[2] ? importRow[2].toString().trim() : '';
      var valorOriginal = importRow[3] ? importRow[3].toString().trim() : '';
      
      // Pular linhas vazias
      if (!associado && !placa) { ignorados++; continue; }
      
      // Pular cabecalhos
      var assocUpper = associado.toUpperCase();
      if (assocUpper === 'ASSOCIADO' || assocUpper === 'NOME' || assocUpper === 'NOME DO ASSOCIADO') {
        ignorados++; continue;
      }
      
      // Montar linha com 11 colunas (headers do DB_Suspensos)
      // ASSOCIADO | DATA RECEBIMENTO | DATA VENCIMENTO | PLACA | SITUAÇÃO ATUAL | FORMA PGTO | VALOR RECEBIDO | VALOR ORIGINAL | ATENDENTE | OBSERVAÇÕES | CONFERENCIA
      var newRow = [associado, '', dataVencimento, placa, 'Ativo', '', '', valorOriginal, '', '', 'Verificar'];
      
      var key = assocUpper + '|' + placa.toUpperCase();
      
      if (existingKeys[key]) {
        // Atualizar apenas Associado, DataVencimento, Placa, ValorOriginal (colunas 1,3,4,8)
        var rowNum = existingKeys[key];
        sheet.getRange(rowNum, 1).setValue(associado);
        sheet.getRange(rowNum, 3).setValue(dataVencimento);
        sheet.getRange(rowNum, 4).setValue(placa);
        sheet.getRange(rowNum, 8).setValue(valorOriginal);
        atualizados++;
      } else {
        rowsToAppend.push(newRow);
        existingKeys[key] = true;
        inseridos++;
      }
    }
    
    if (rowsToAppend.length > 0) {
      var startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToAppend.length, HEADERS_SUSPENSOS.length).setValues(rowsToAppend);
    }
    
    return {
      success: true,
      message: 'Importacao concluida!',
      data: { inseridos: inseridos, atualizados: atualizados, ignorados: ignorados, total: dados.length }
    };
    
  } catch (error) {
    return { success: false, error: 'Erro na importacao: ' + error.message };
  }
}

// =============================================
// FUNCOES CRUD PARA DB_SUSPENSOS (Web App)
// =============================================

/**
 * Busca registros da aba DB_Suspensos
 */
function getSuspensosRecords(searchQuery, filters) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_SUSPENSOS);
    
    if (!sheet) {
      return { success: false, error: 'Aba DB_Suspensos nao encontrada. Execute criarAbaSuspensos().' };
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { success: true, data: [], meta: { total: 0 } };
    }
    
    var data = sheet.getRange(2, 1, lastRow - 1, HEADERS_SUSPENSOS.length).getValues();
    var records = [];
    
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      
      var hasData = row.some(function(cell) {
        return cell && cell.toString().trim() !== '';
      });
      if (!hasData) continue;
      
      var record = {
        id: i + 2,
        associado: row[0] ? row[0].toString() : '',
        dataRecebimento: row[1] ? row[1].toString() : '',
        dataVencimento: row[2] ? row[2].toString() : '',
        placa: row[3] ? row[3].toString() : '',
        situacaoAtual: row[4] ? row[4].toString() : '',
        formaPgto: row[5] ? row[5].toString() : '',
        valorRecebido: row[6] ? row[6].toString() : '',
        valorOriginal: row[7] ? row[7].toString() : '',
        atendente: row[8] ? row[8].toString() : '',
        observacoes: row[9] ? row[9].toString() : '',
        conferencia: row[10] ? row[10].toString() : ''
      };
      
      // Filtro de busca
      if (searchQuery && searchQuery.trim() !== '') {
        var q = searchQuery.toLowerCase();
        var match = record.associado.toLowerCase().indexOf(q) >= 0 ||
                    record.placa.toLowerCase().indexOf(q) >= 0 ||
                    record.atendente.toLowerCase().indexOf(q) >= 0 ||
                    record.situacaoAtual.toLowerCase().indexOf(q) >= 0;
        if (!match) continue;
      }
      
      // Filtros adicionais
      if (filters) {
        if (filters.status && filters.status !== '') {
          if (record.situacaoAtual.toLowerCase() !== filters.status.toLowerCase()) continue;
        }
        if (filters.conferencia && filters.conferencia !== '') {
          if (record.conferencia.toLowerCase() !== filters.conferencia.toLowerCase()) continue;
        }
      }
      
      records.push(record);
    }
    
    return { success: true, data: records, meta: { total: records.length } };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Estatisticas de Suspensos
 */
function getSuspensosStats() {
  try {
    var result = getSuspensosRecords('', null);
    if (!result.success) return result;
    
    var records = result.data;
    var stats = { total: records.length, pendentes: 0, pagos: 0, vencidos: 0 };
    
    for (var i = 0; i < records.length; i++) {
      var sit = records[i].situacaoAtual.toLowerCase();
      if (sit.indexOf('pago') >= 0 || sit.indexOf('quitado') >= 0) stats.pagos++;
      else if (sit.indexOf('vencid') >= 0) stats.vencidos++;
      else stats.pendentes++;
    }
    
    return { success: true, data: stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
}



// =============================================
// INLINE EDIT - ATUALIZAR CELULA INDIVIDUAL
// =============================================

/**
 * Atualiza uma celula especifica na aba DB_Suspensos
 * @param {number} rowId - Numero da linha
 * @param {number} colIndex - Indice da coluna (1-based)
 * @param {string} value - Novo valor
 */
function updateSuspensosCell(rowId, colIndex, value) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_SUSPENSOS);
    
    if (!sheet) {
      return { success: false, error: 'Aba nao encontrada' };
    }
    
    var row = parseInt(rowId);
    var col = parseInt(colIndex);
    
    if (row < 2 || row > sheet.getLastRow()) {
      return { success: false, error: 'Linha invalida' };
    }
    if (col < 1 || col > HEADERS_SUSPENSOS.length) {
      return { success: false, error: 'Coluna invalida' };
    }
    
    sheet.getRange(row, col).setValue(value);
    
    return { success: true, message: 'Salvo!' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
