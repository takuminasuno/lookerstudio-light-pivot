function drawViz(data) {

    // Container setup
    let container = document.getElementById('container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'container';
        document.body.appendChild(container);
    } else {
        container.innerHTML = '';
    }

    // Pivot original table output
    const {rowFields, columnFields, metricFields, theadRows, tbodyRows} = transformTable(data.tables.DEFAULT.headers, data.tables.DEFAULT.rows);
    

    // create table structure
    const height = dscc.getHeight();    
    const tableContainer = d3.select(container).append('div')
        .attr('class', 'table-container')
        .style('height', height + 'px');
    
    // Create table structure
    const table = tableContainer.append('table');
    const thead = table.append('thead');
    const tbody = table.append('tbody');

    // download function for csv data
    const downloadTable = [...theadRows, ...tbodyRows];
    const generateCSV = (downloadTable) => {
        const rows = downloadTable.map(row => Object.values(row).map(function(cell){return '"' + cell + '"';}).join(','));
        return rows.join('\n');
    };
    const generateDataURI = (csvContent) => {
        const bomPrefix = '%EF%BB%BF';
        const encodedContent = encodeURIComponent(csvContent);
        return `data:text/csv;charset=shift_jis,${bomPrefix}${encodedContent}`;
    };
    const downloadCSV = () => {
        const csvContent = generateCSV(downloadTable);
        const dataURI = generateDataURI(csvContent);
        window.open(dataURI, '_blank');
    };

    // Create description
    const description = thead.append('tr').append('th')
        .attr('class', 'description')
        .attr('colspan', theadRows[0].length);
    description.append('div')
        .text(columnFields.join(' / ') + ' / ' + metricFields.join('・'))
        .attr('class', 'description-text');
    /*
    const buttonBox = description.append('div')
        .attr('class', 'buttonBox')
        .on('click', downloadCSV);
    buttonBox.append('div')
        .attr('class', 'gg-software-download');
    */

    // Create headers
    theadRows.forEach(row => {
        const headerRow = thead.append('tr')
            .selectAll('th')
            .data(row)
            .enter()
            .append('th')
            .text(d => d)
            .classed('tside', (d, colIndex) => colIndex < rowFields.length)
            .each(function(d, colIndex) {
                let span = 1;
                while (colIndex + span < row.length && row[colIndex + span] === '') {
                    span++;
                }
                if (span > 1) {
                    d3.select(this).attr('colspan', span);
                }
            });
        headerRow.filter((d, i) => i > 0 && d === '').remove();
    });

    // Create body rows
    const columnTypeList = getColummTypeList(tbodyRows,0);
    const integerFormatter = new Intl.NumberFormat('ja-JP');
    const decimalFormatter = new Intl.NumberFormat('ja-JP', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });
    const rows = tbody.selectAll('tr')
        .data(tbodyRows)
        .enter()
        .append('tr');
    const cells = rows.selectAll('td')
        .data(d => d)
        .enter()
        .append('td')
        .text((d,colIndex) => {
            // assign appropriate formatter based on columnType (*null is changed to '-')
            const columnType = columnTypeList[colIndex];
            if (columnType === 'integer') {
                return d !== null ? integerFormatter.format(d) : '-';
            } else if (columnType === 'decimal') {
                return d !== null ? decimalFormatter.format(Math.round(d * 10) / 10) : '-';
            } else {
                return d;
            }
        })
        .classed('tside', (d, colIndex) => colIndex < rowFields.length);
    
    // Process rowspans after all cells are created
    for (let colIndex = rowFields.length - 1; colIndex >= 0; colIndex--) {
        tbodyRows.forEach((row, rowIndex) => {
            if (row[colIndex] !== '') {
                let span = 1;
                while (rowIndex + span < tbodyRows.length && tbodyRows[rowIndex + span][colIndex] === '') {
                    span++;
                }
                if (span > 1) {
                    d3.select(tbody.selectAll('tr').nodes()[rowIndex])
                    .select(`td:nth-child(${colIndex + 1})`)
                    .attr('rowspan', span);
                  
                    // Remove the spanned cells
                    for (let i = 1; i < span; i++) {
                        d3.select(tbody.selectAll('tr').nodes()[rowIndex + i])
                        .select(`td:nth-child(${colIndex + 1})`)
                        .remove();
                    }
                }
            }
        });
    }

    /*
    // Set parameter designs
    table.style.borderRadius = data.style.borderRadius.value.BORDER_RADIUS;
    if (data.style.boxShadow.value.CHECKBOX){
        table.style.boxShadow = "rgba(0,0,0,0.14) 0px 2px 2px 0px, rgba(0,0,0,0.2) 0px 1px 1px 0px, rgba(0,0,0,0.12) 0px 1px 5px 0px";
    }
    */

    // add event listeners
    table.selectAll('td:not(.tside)')
        .on('mouseover', handleMouseOver)
        .on('mouseout', handleMouseOut);

    function handleMouseOver(event) {
        const cell = d3.select(this);
        const cellPosition = getCellPosition(this);
        
        clearHighlights();

        // highlighting cell
        cell.classed("highlight-cell", true);

        // highlighting row
        const table = d3.select(cell.node().closest('table'));
        table.selectAll("thead tr, tbody tr").each(function(row,rowIndex) {
            // processing row
            d3.select(this).selectAll("td, th:not(.description)").each(function(cell,colIndex) {
                const rowspan = parseInt(d3.select(this).attr("rowspan")) || 1;
                if (rowIndex <= cellPosition.rowIndex && cellPosition.rowIndex < rowIndex + rowspan) {
                    d3.select(this).classed("highlight-row", true);
                }
            });
        });

        // highlighting column
        const rowCount = table.selectAll('tr').size();
        let rowspanStock = Array(rowCount).fill(0);
        table.selectAll("thead tr, tbody tr").each(function(row,rowIndex) {
            
            let colspanStock = 0;
            d3.select(this).selectAll("td, th:not(.description)").each(function(cell,colIndex) {
                const rowspan = parseInt(d3.select(this).attr("rowspan")) || 1;
                if (rowspan > 1){
                    for (let i = 1; i < rowspan; i++){
                        rowspanStock[rowIndex + i]++;
                    }
                }
                const colspan = parseInt(d3.select(this).attr("colspan")) || 1;
                const adjustedColIndex = rowspanStock[rowIndex] + colIndex + colspanStock;
                if (adjustedColIndex <= cellPosition.colIndex && cellPosition.colIndex < adjustedColIndex + colspan) {
                    d3.select(this).classed("highlight-col", true);
                }
                if (colspan > 1){
                    colspanStock += colspan - 1;
                }
            });
        });
    }

    // returns cell's rowIndex and colIndex
    // considering the existence of thead and tbody, including rowspan and colspan, but expecting no cells with both rowpsan and colspan
    function getCellPosition(cell) {

        // get indexes from table structure
        const row = cell.parentNode;
        const table = row.parentNode.parentNode;
        const allRows = Array.from(table.querySelectorAll("thead tr, tbody tr"));
        const originalRowIndex = allRows.indexOf(row);
        const originalColIndex = Array.from(row.cells).indexOf(cell);

        // adjusting rowIndex considering colspan in previous cells
        let rowIndex = originalRowIndex;

        // adjusting colIndex considering rowspan in previous cells
        let colIndex = originalColIndex;
        let unmergedCellCount;
        for (let i = 0; i < originalRowIndex; i++) {
            const prevRow = allRows[i];
            unmergedCellCount = 0;
            for (let j = 0; j < prevRow.children.length; j++) {
                const prevCell = prevRow.children[j];
                const rowspan = parseInt(prevCell.getAttribute("rowspan")) || 1;
                if (rowspan == 1){
                    unmergedCellCount++;
                    if (unmergedCellCount > originalColIndex){
                        break;
                    }
                } else if (i + rowspan > originalRowIndex) {
                    colIndex++;
                }
            }
        }
        return {
            rowIndex: rowIndex,
            colIndex: colIndex
        };
    }    
    
    function handleMouseOut(event) {
        if (!event.target.closest('table').contains(event.relatedTarget)) {
            clearHighlights();
        }
        const cell = d3.select(event.target);
        const table = d3.select(cell.node().closest('table'));
        
        if (!table.selectAll('td:not(.tside)').nodes().includes(event.relatedTarget)) {
        //if (!cell.classed('tside') && !table.selectAll('td:not(.tside)').nodes().includes(event.relatedTarget)) {
            clearHighlights();
        }
    }
    
    function clearHighlights() {
        d3.selectAll('.highlight-row, .highlight-col, .highlight-cell')
            .classed('highlight-row', false)
            .classed('highlight-col', false)
            .classed('highlight-cell', false);
    }

}

//return rowFields, columnFields, metricFields, theadRows, tbodyRows by pivotting normal table
function transformTable(headers, input_table) {
    // Extract row, column, and metric fields
    const rowFields = headers.filter(h => h.configId === 'row').map(h => h.name);
    const columnFields = headers.filter(h => h.configId === 'column').map(h => h.name);
    const metricFields = headers.filter(h => h.configId === 'metric').map(h => h.name);

    // Create a map to store the transformed data
    const dataMap = new Map();
    
    // Process input table
    for (const row of input_table) {
        const rowKey = rowFields.map((_, i) => row[i]).join('|');
        const columnKey = columnFields.map((_, i) => row[i + rowFields.length]).join('|');
        
        if (!dataMap.has(rowKey)) {
        dataMap.set(rowKey, new Map());
        }
        
        dataMap.get(rowKey).set(columnKey, row.slice(-metricFields.length));
    }
    
    // Generate column headers
    const uniqueColumnValues = [...new Set(input_table.map(row => 
        columnFields.map((_, i) => row[i + rowFields.length]).join('|')
    ))];
    
    // Create output table
    let outputTable = [];

    // Add column headers
    if (columnFields.length > 0) {
        for (let i = 0; i < columnFields.length; i++) {
            const row = Array(rowFields.length).fill("");
            for (const colValue of uniqueColumnValues) {
                const values = colValue.split('|');
                for (let j = 0; j < metricFields.length; j++) {
                    row.push(values[i]);
                }
            }
            outputTable.push(row);
        }
    }
    
    // Add metric headers
    const row = [...rowFields, ...uniqueColumnValues.flatMap(() => metricFields)];
    outputTable.push(row);
    
    // Add data rows
    for (const [rowKey, columnMap] of dataMap) {
        const row = [
        ...rowKey.split('|'),
        ...uniqueColumnValues.flatMap(columnKey => 
            columnMap.has(columnKey) ? columnMap.get(columnKey) : Array(metricFields.length).fill('')
        )
        ];
        outputTable.push(row);
    }

    // Sort table, and make duplicated fixed cells to blank
    const fixedRowCount = columnFields.length + 1;
    const sortedRowCount = columnFields.length;
    const fixedColumnCount = rowFields.length;
    const sortedColumnCount = rowFields.length;
    outputTable = dualSortTable(outputTable, fixedRowCount, sortedRowCount,fixedColumnCount,sortedColumnCount);
    outputTable = resolveFixedCellsDuplication(outputTable, fixedRowCount, fixedColumnCount);

    // Separate headers and (body)rows
    const theadRows = outputTable.slice(0, fixedRowCount);
    const tbodyRows = outputTable.slice(fixedRowCount);

    return {
        rowFields: rowFields,
        columnFields: columnFields,
        metricFields: metricFields,
        theadRows: theadRows,
        tbodyRows: tbodyRows
    };
}


// return complicated sorting result
function dualSortTable(table, fixedRowCount, sortedRowCount,fixedColumnCount,sortedColumnCount){

    let outputTable = transposeTable(table);
    outputTable = sortTable(outputTable, fixedColumnCount, sortedRowCount);
    outputTable = transposeTable(outputTable);
    outputTable = sortTable(outputTable, fixedRowCount, sortedColumnCount);
    return outputTable;

}

// return sorted table by certain number of left columns with fixed rows  
function sortTable(table, fixedRowCount, columnsToSort) {

    const fixedTable = table.slice(0, fixedRowCount);
    const sortedTable = table.slice(fixedRowCount);

    if (sortedTable.length == 1){
        return table;
    }
    for (let i = columnsToSort - 1; i >= 0; i--) {        
        if (isNumberColumn(sortedTable,i)) {
            //sort as numbers
            sortedTable.sort((a, b) => {
                if (a[i] == '' && b[i] == '') return 0;
                if (a[i] == '') return 1;
                if (b[i] == '') return -1;
                return Number(a[i]) - Number(b[i]);
            });
        } else {
            //sort as texts
            sortedTable.sort((a, b) => {
                if (a[i] == '' && b[i] == '') return 0;
                if (a[i] == '') return 1;
                if (b[i] == '') return -1;
                if (a[i] < b[i]) return -1;
                if (a[i] > b[i]) return 1;
                return 0;
            });
        }   
    }
    return [...fixedTable, ...sortedTable];
}

//returns whether the column is all numbers or not
function isNumberColumn(table, columnIndex){
    if (table.length === 0) {
        return false;
    }
    for (let rowIndex = 0; rowIndex < table.length; rowIndex++){
        if (isNumberCell(table[rowIndex][columnIndex]) == false){
            return false;
        }
    }
    return true;
}

// returns whether the cells is a number or not
function isNumberCell(cell){
    if (typeof cell === 'number'){
        return true;
    }
    if (!isNaN(Number(cell))){
        return true;
    }
    return false;
}

// return transposed table
function transposeTable(table) {

    const transposed = [];
    for (let j = 0; j < table[0].length; j++) {
        transposed[j] = [];
        for (let i = 0; i < table.length; i++) {
            transposed[j][i] = table[i][j];
        }
    }
    return transposed;
}

// Make duplicated fixed cells to blank
function resolveFixedCellsDuplication(table, fixedRowCount, fixedColumnCount){

    // resolve duplications in fixed rows
    for (let rowIndex = fixedRowCount - 1; rowIndex >= 0; rowIndex--) {
        for (let colIndex = table[rowIndex].length - 1; colIndex > 1; colIndex--) {
            //if (table[rowIndex][colIndex] === table[rowIndex][colIndex - 1]) {
            if (extractColumnJSON(table,colIndex,rowIndex) === extractColumnJSON(table,colIndex - 1,rowIndex)){
                table[rowIndex][colIndex] = '';
            }
            //table[rowIndex][colIndex] = extractColumnJSON(table,colIndex,rowIndex) + '<br><br>' + extractColumnJSON(table,colIndex-1,rowIndex)
        }
    }
    // resolve duplications in fixed columns
    for (let colIndex = fixedColumnCount - 1; colIndex >= 0; colIndex--) {
        for (let rowIndex = table.length - 1; rowIndex > 1; rowIndex--) {
            //if (table[rowIndex][colIndex] === table[rowIndex - 1][colIndex]) {
            if (extractRowJSON(table,rowIndex,colIndex) === extractRowJSON(table,rowIndex - 1,colIndex)){
                table[rowIndex][colIndex] = '';
            }
        }
    }
    return table;
}
function extractColumnJSON(table,colIndex,rowCount){
    let cells = [];
    for (let i = 0; i < rowCount + 1; i++){
        cells.push(table[i][colIndex]);
    }
    return JSON.stringify(cells);
}
function extractRowJSON(table,rowIndex,colCount){
    return JSON.stringify(table[rowIndex].slice(0,colCount + 1));
}

// returns array of data type [integer, decimal, text] for each column
function getColummTypeList(inputTable, headerRowCount){
    
    const table = inputTable.slice(headerRowCount);

    let columnTypeList = [];
    for (let colIndex = 0; colIndex < table[0].length; colIndex++){

        // check each cell to find column data type
        // one cell is text => text
        // all cells are number but include decimal => decimal
        // all cells are integer => integer
        let columnType = 'integer';
        for (let rowIndex = 0; rowIndex < table.length; rowIndex++){
            const dataType = getDataType(table[rowIndex][colIndex]);
            if (dataType == 'text'){
                columnType = 'text';
                break; 
            } else if (dataType == 'decimal'){
                columnType = 'decimal';
            }
        }
        columnTypeList.push(columnType);
    }
    return columnTypeList;
}

// returns data type [integer, decimal, text] for cell
function getDataType(cell){
    if (typeof cell === 'number') {
        if (Number.isInteger(cell)){
            return 'integer';
        } else {
            return 'decimal';
        }
    }
    if (cell === null || cell === undefined || cell === ''){
        return 'integer';
    }
    return 'text';
}

// Subscribe to data and style changes. Use the table format for data.
dscc.subscribeToData(drawViz, { transform: dscc.tableTransform });

