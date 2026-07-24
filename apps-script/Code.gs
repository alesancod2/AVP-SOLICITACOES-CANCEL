// =============================================
// GOOGLE APPS SCRIPT - SISTEMA DE GESTAO DE ASSOCIADOS
// =============================================
// Este script transforma sua planilha em uma Web App completa
// com CRUD (Create, Read, Update, Delete)
// =============================================

// CONFIGURACAO: ID da planilha (pegue na URL da sua planilha)
const SPREADSHEET_ID = '16DjjPOMnWu-9P88fKkLCxSGFHOSFtv8N7_kt1yWkiOE';

// Colunas da planilha (ordem A-I)
const COLUMNS = [
  'NOME DO ASSOCIADO',
  'PLACA',
  'VALOR DA PARCELA',
  'VALOR PAGO',
  'CONSULTOR',
  'MOTIVO DO CANCELAMENTO',
  'STATUS ATUAL',
  'OBSERVACAO',
  'ATENDENTE'
];

// =============================================
// FUNCAO PRINCIPAL - SERVE A PAGINA WEB
// =============================================
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Sistema de Gestao de Associados')
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
    if (lastRow <= 1) {
      return { success: true, data: [], meta: { total: 0 } };
    }
    
    var data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
    var records = [];
    
    // Lista de headers conhecidos para filtrar (caso cabecalho apareca nos dados)
    var headerValues = [
      'nome do associado', 'placa', 'valor da parcela', 'valor pago',
      'consultor', 'motivo do cancelamento', 'status atual', 'observacao',
      'observação', 'atendente'
    ];
    
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      
      // Pular linhas completamente vazias ou so com "-"
      var hasData = row.some(function(cell) {
        return cell && cell.toString().trim() !== '' && cell.toString().trim() !== '-';
      });
      
      if (!hasData) continue;
      
      // CORRECAO: Pular linha se for cabecalho (verificar primeira celula)
      var firstCell = row[0] ? row[0].toString().trim().toLowerCase() : '';
      if (headerValues.indexOf(firstCell) >= 0) continue;
      
      // Verificar se a linha inteira parece ser um cabecalho
      var isHeader = false;
      var headerMatchCount = 0;
      for (var h = 0; h < row.length; h++) {
        var cellValue = row[h] ? row[h].toString().trim().toLowerCase() : '';
        if (headerValues.indexOf(cellValue) >= 0) {
          headerMatchCount++;
        }
      }
      // Se 3+ celulas batem com nomes de cabecalho, pular a linha
      if (headerMatchCount >= 3) continue;
      
      var record = {
        id: i + 2, // Numero da linha na planilha
        nomeDoAssociado: row[0] ? row[0].toString() : '',
        placa: row[1] ? row[1].toString() : '',
        valorDaParcela: row[2] ? row[2].toString() : '',
        valorPago: row[3] ? row[3].toString() : '',
        consultor: row[4] ? row[4].toString() : '',
        motivoDoCancelamento: row[5] ? row[5].toString() : '-',
        statusAtual: row[6] ? row[6].toString() : '-',
        observacao: row[7] ? row[7].toString() : '-',
        atendente: row[8] ? row[8].toString() : ''
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
 * Cria um novo registro na planilha
 * @param {string} sheetName - Nome da aba
 * @param {Object} data - Dados do registro
 */
function createRecord(sheetName, data) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { success: false, error: 'Aba "' + sheetName + '" nao encontrada' };
    }
    
    // Validacao basica
    if (!data.nomeDoAssociado || !data.placa) {
      return { success: false, error: 'Nome do Associado e Placa sao obrigatorios' };
    }
    
    var newRow = [
      data.nomeDoAssociado || '',
      data.placa || '',
      data.valorDaParcela || '',
      data.valorPago || '',
      data.consultor || '',
      data.motivoDoCancelamento || '-',
      data.statusAtual || '-',
      data.observacao || '-',
      data.atendente || ''
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
        atendente: newRow[8]
      },
      message: 'Registro criado com sucesso!'
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza um registro existente
 * @param {string} sheetName - Nome da aba
 * @param {number} rowId - Numero da linha
 * @param {Object} data - Dados atualizados
 */
function updateRecord(sheetName, rowId, data) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { success: false, error: 'Aba "' + sheetName + '" nao encontrada' };
    }
    
    var row = parseInt(rowId);
    if (row < 2 || row > sheet.getLastRow()) {
      return { success: false, error: 'Linha invalida: ' + rowId };
    }
    
    var updatedRow = [
      data.nomeDoAssociado || '',
      data.placa || '',
      data.valorDaParcela || '',
      data.valorPago || '',
      data.consultor || '',
      data.motivoDoCancelamento || '-',
      data.statusAtual || '-',
      data.observacao || '-',
      data.atendente || ''
    ];
    
    sheet.getRange(row, 1, 1, 9).setValues([updatedRow]);
    
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
        atendente: updatedRow[8]
      },
      message: 'Registro atualizado com sucesso!'
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Exclui (limpa) um registro
 * @param {string} sheetName - Nome da aba
 * @param {number} rowId - Numero da linha
 */
function deleteRecord(sheetName, rowId) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { success: false, error: 'Aba "' + sheetName + '" nao encontrada' };
    }
    
    var row = parseInt(rowId);
    if (row < 2 || row > sheet.getLastRow()) {
      return { success: false, error: 'Linha invalida: ' + rowId };
    }
    
    // Deleta a linha inteira (move as de baixo pra cima)
    sheet.deleteRow(row);
    
    return {
      success: true,
      message: 'Registro excluido com sucesso!'
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// =============================================
// FUNCOES DE CONFIGURACAO
// =============================================

/**
 * Cria as abas de Janeiro a Dezembro com headers
 * Execute esta funcao UMA VEZ para configurar a planilha
 */
function criarAbasMensais() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var meses = [
    'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];
  
  var headers = [
    'NOME DO ASSOCIADO', 'PLACA', 'VALOR DA PARCELA', 'VALOR PAGO',
    'CONSULTOR', 'MOTIVO DO CANCELAMENTO', 'STATUS ATUAL', 'OBSERVACAO', 'ATENDENTE'
  ];
  
  for (var i = 0; i < meses.length; i++) {
    var sheet = ss.getSheetByName(meses[i]);
    
    // Se a aba nao existe, criar
    if (!sheet) {
      sheet = ss.insertSheet(meses[i]);
    }
    
    // Verificar se ja tem header na linha 1
    var firstCell = sheet.getRange(1, 1).getValue();
    if (!firstCell || firstCell.toString().trim() === '') {
      // Adicionar headers
      sheet.getRange(1, 1, 1, 9).setValues([headers]);
      
      // Formatar header (negrito, fundo verde, texto branco)
      var headerRange = sheet.getRange(1, 1, 1, 9);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#166534');
      headerRange.setFontColor('#ffffff');
      headerRange.setHorizontalAlignment('center');
      
      // Ajustar largura das colunas
      sheet.setColumnWidth(1, 200); // Nome
      sheet.setColumnWidth(2, 100); // Placa
      sheet.setColumnWidth(3, 130); // Valor Parcela
      sheet.setColumnWidth(4, 130); // Valor Pago
      sheet.setColumnWidth(5, 130); // Consultor
      sheet.setColumnWidth(6, 200); // Motivo Cancel.
      sheet.setColumnWidth(7, 120); // Status
      sheet.setColumnWidth(8, 200); // Observacao
      sheet.setColumnWidth(9, 130); // Atendente
    }
  }
  
  // Congelar primeira linha em todas as abas
  for (var j = 0; j < meses.length; j++) {
    var s = ss.getSheetByName(meses[j]);
    if (s) s.setFrozenRows(1);
  }
  
  return { success: true, message: 'Abas de Janeiro a Dezembro criadas com sucesso!' };
}

// =============================================
// FUNCOES AUXILIARES
// =============================================

/**
 * Retorna estatisticas da aba
 */
function getStats(sheetName) {
  try {
    var result = getRecords(sheetName, '');
    if (!result.success) return result;
    
    var records = result.data;
    var stats = {
      total: records.length,
      ativos: 0,
      inadimplentes: 0,
      cancelados: 0,
      pendentes: 0
    };
    
    for (var i = 0; i < records.length; i++) {
      var status = records[i].statusAtual.toLowerCase();
      if (status === 'ativo') stats.ativos++;
      else if (status === 'inadimplente') stats.inadimplentes++;
      else if (status === 'cancelado') stats.cancelados++;
      else if (status === 'pendente') stats.pendentes++;
    }
    
    return { success: true, data: stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
