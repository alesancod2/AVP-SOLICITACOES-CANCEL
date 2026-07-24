// =============================================
// GOOGLE APPS SCRIPT - SISTEMA DE GESTAO DE CANCELAMENTOS
// =============================================
// Este script transforma sua planilha em uma Web App completa
// com CRUD (Create, Read, Update, Delete)
// =============================================

// CONFIGURACAO: ID da planilha (pegue na URL da sua planilha)
const SPREADSHEET_ID = '16DjjPOMnWu-9P88fKkLCxSGFHOSFtv8N7_kt1yWkiOE';

// Colunas da planilha (ordem A-J) - coluna J = DATA DE CRIACAO
const COLUMNS = [
  'NOME DO ASSOCIADO',
  'PLACA',
  'VALOR DA PARCELA',
  'VALOR PAGO',
  'CONSULTOR',
  'MOTIVO DO CANCELAMENTO',
  'STATUS ATUAL',
  'OBSERVACAO',
  'ATENDENTE',
  'DATA DE CRIACAO'
];

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
 * Retorna todas as abas (meses) da planilha
 */
function getSheetTabs() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheets = ss.getSheets();
    var tabs = [];
    
    for (var i = 0; i < sheets.length; i++) {
      tabs.push({
        name: sheets[i].getName(),
        id: sheets[i].getSheetId()
      });
    }
    
    return { success: true, data: tabs };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Busca todos os registros de uma aba
 * @param {string} sheetName - Nome da aba (mes)
 * @param {string} searchQuery - Texto para filtrar (opcional)
 */
function getRecords(sheetName, searchQuery) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { success: false, error: 'Aba "' + sheetName + '" nao encontrada' };
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow <= 2) {
      return { success: true, data: [], meta: { total: 0 } };
    }
    
    // Dados comecam na linha 3 (linha 1 = titulo, linha 2 = headers)
    var lastCol = sheet.getLastColumn();
    var colCount = Math.max(lastCol, 10);
    var data = sheet.getRange(3, 1, lastRow - 2, colCount).getValues();
    var records = [];
    
    // Lista de headers conhecidos para filtrar
    var headerValues = [
      'nome do associado', 'placa', 'valor da parcela', 'valor pago',
      'consultor', 'motivo do cancelamento', 'status atual', 'observacao',
      'observação', 'atendente', 'data de criacao', 'data de criação'
    ];
    
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      
      // Pular linhas completamente vazias ou so com "-"
      var hasData = row.some(function(cell) {
        return cell && cell.toString().trim() !== '' && cell.toString().trim() !== '-';
      });
      
      if (!hasData) continue;
      
      // Pular linha se for cabecalho
      var firstCell = row[0] ? row[0].toString().trim().toLowerCase() : '';
      if (headerValues.indexOf(firstCell) >= 0) continue;
      
      var headerMatchCount = 0;
      for (var h = 0; h < Math.min(row.length, 10); h++) {
        var cellValue = row[h] ? row[h].toString().trim().toLowerCase() : '';
        if (headerValues.indexOf(cellValue) >= 0) {
          headerMatchCount++;
        }
      }
      if (headerMatchCount >= 3) continue;
      
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
        dataCriacao: row[9] ? row[9].toString() : ''
      };
      
      // Filtro de busca
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
    
    return {
      success: true,
      data: records,
      meta: { total: records.length }
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// =============================================
// FUNCOES DE ESCRITA
// =============================================

/**
 * Cria um novo registro na planilha (com data de criacao automatica)
 */
function createRecord(sheetName, data) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { success: false, error: 'Aba "' + sheetName + '" nao encontrada' };
    }
    
    if (!data.nomeDoAssociado || !data.placa) {
      return { success: false, error: 'Nome do Associado e Placa sao obrigatorios' };
    }
    
    // Capturar data/hora atual automaticamente
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
      data: {
        id: newRowNumber,
        nomeDoAssociado: newRow[0],
        placa: newRow[1],
        valorDaParcela: newRow[2],
        valorPago: newRow[3],
        consultor: newRow[4],
        motivoDoCancelamento: newRow[5],
        statusAtual: newRow[6],
        observacao: newRow[7],
        atendente: newRow[8],
        dataCriacao: newRow[9]
      },
      message: 'Solicitacao criada com sucesso!'
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza um registro existente (preserva data de criacao)
 */
function updateRecord(sheetName, rowId, data) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { success: false, error: 'Aba "' + sheetName + '" nao encontrada' };
    }
    
    var row = parseInt(rowId);
    if (row < 3 || row > sheet.getLastRow()) {
      return { success: false, error: 'Linha invalida: ' + rowId };
    }
    
    // Preservar data de criacao original
    var existingData = sheet.getRange(row, 10).getValue();
    var dataCriacao = existingData ? existingData.toString() : '';
    
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
    
    return {
      success: true,
      data: {
        id: row,
        nomeDoAssociado: updatedRow[0],
        placa: updatedRow[1],
        valorDaParcela: updatedRow[2],
        valorPago: updatedRow[3],
        consultor: updatedRow[4],
        motivoDoCancelamento: updatedRow[5],
        statusAtual: updatedRow[6],
        observacao: updatedRow[7],
        atendente: updatedRow[8],
        dataCriacao: updatedRow[9]
      },
      message: 'Registro atualizado com sucesso!'
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Exclui um registro
 */
function deleteRecord(sheetName, rowId) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { success: false, error: 'Aba "' + sheetName + '" nao encontrada' };
    }
    
    var row = parseInt(rowId);
    if (row < 3 || row > sheet.getLastRow()) {
      return { success: false, error: 'Linha invalida: ' + rowId };
    }
    
    sheet.deleteRow(row);
    
    return { success: true, message: 'Registro excluido com sucesso!' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// =============================================
// FUNCOES DE CONFIGURACAO
// =============================================

/**
 * Cria as abas de Janeiro a Dezembro com headers (incluindo DATA DE CRIACAO)
 */
function criarAbasMensais() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var meses = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];
  
  var headers = [
    'NOME DO ASSOCIADO', 'PLACA', 'VALOR DA PARCELA', 'VALOR PAGO',
    'CONSULTOR', 'MOTIVO DO CANCELAMENTO', 'STATUS ATUAL', 'OBSERVACAO',
    'ATENDENTE', 'DATA DE CRIACAO'
  ];
  
  for (var i = 0; i < meses.length; i++) {
    var sheet = ss.getSheetByName(meses[i]);
    if (!sheet) {
      sheet = ss.insertSheet(meses[i]);
    }
    
    // Headers devem ficar na LINHA 2 (linha 1 fica reservada para titulo/merge)
    var row2Cell = sheet.getRange(2, 1).getValue();
    if (!row2Cell || row2Cell.toString().trim() === '') {
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
      sheet.setColumnWidth(7, 120);
      sheet.setColumnWidth(8, 200);
      sheet.setColumnWidth(9, 130);
      sheet.setColumnWidth(10, 160);
    }
  }
  
  for (var j = 0; j < meses.length; j++) {
    var s = ss.getSheetByName(meses[j]);
    if (s) s.setFrozenRows(2);
  }
  
  return { success: true, message: 'Abas de Janeiro a Dezembro criadas com sucesso!' };
}

// =============================================
// FUNCOES AUXILIARES
// =============================================

/**
 * Retorna estatisticas da aba (com "em negociacao" no lugar de "inadimplentes")
 */
function getStats(sheetName) {
  try {
    var result = getRecords(sheetName, '');
    if (!result.success) return result;
    
    var records = result.data;
    var stats = {
      total: records.length,
      ativos: 0,
      emNegociacao: 0,
      cancelados: 0,
      pendentes: 0
    };
    
    for (var i = 0; i < records.length; i++) {
      var status = records[i].statusAtual.toLowerCase();
      if (status === 'ativo') stats.ativos++;
      else if (status === 'em negociacao' || status === 'em negociação') stats.emNegociacao++;
      else if (status === 'cancelado') stats.cancelados++;
      else if (status === 'pendente') stats.pendentes++;
    }
    
    return { success: true, data: stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
