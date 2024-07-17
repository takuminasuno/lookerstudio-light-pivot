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
    const width = dscc.getWidth();
    const height = dscc.getHeight();    
    const tableContainer = d3.select(container).append('div')
        .attr('class', 'table-container')
        .style('height', height + 'px');
    
    // Create table structure
    const table = tableContainer.append('table');
    const thead = table.append('thead');
    const tbody = table.append('tbody');

    // Create description
    const description = thead.append('tr').append('th')
        .text(columnFields.join(' / ') + ' / ' + metricFields.join(' / '))
        .attr('class', 'description')
        .attr('colSpan', theadRows[0].length)
    
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
                if (d !== ''){
                    let span = 1;
                    while (colIndex + span < row.length && row[colIndex + span] === '') {
                        span++;
                    }
                    if (span > 1) {
                        d3.select(this).attr('colspan', span);
                    }
                } 
            });
        headerRow.filter((d, i) => i >= rowFields.length && d === '').remove();
    });

    // Create body rows
    const formatter = new Intl.NumberFormat();
    const rows = tbody.selectAll('tr')
        .data(tbodyRows)
        .enter()
        .append('tr');
    const cells = rows.selectAll('td')
        .data(d => d)
        .enter()
        .append('td')
        .text(d => {
            if (typeof d === 'number') {
                if (Number.isInteger(d)){
                    return formatter.format(d);
                } else {
                    return formatter.format(Math.round(d * 10) / 10);
                }
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

    // Set parameter designs
    table.style.borderRadius = data.style.borderRadius.value.BORDER_RADIUS;
    if (data.style.boxShadow.value.CHECKBOX){
        table.style.boxShadow = "rgba(0,0,0,0.14) 0px 2px 2px 0px, rgba(0,0,0,0.2) 0px 1px 1px 0px, rgba(0,0,0,0.12) 0px 1px 5px 0px";
    }

    // add event listeners
    /*
    table.selectAll('th:not(.description), td')
        .on('mouseover', handleMouseOver)
        .on('mouseout', handleMouseOut);

    function handleMouseOver(event) {
        const cell = event.target;
        const table = cell.closest('table');
        const allRows = Array.from(table.querySelectorAll('tr'));
        
        clearHighlights();
    
        const { colIndex, rowIndex } = getCellIndices(cell);
    
        highlightRowsAndColumns(allRows, rowIndex, colIndex);
    
        // セルのハイライト
        d3.select(cell).classed('highlight-cell', true);
    }
    
    function getCellIndices(cell) {
        const row = cell.closest('tr');
        const allRows = Array.from(row.closest('table').querySelectorAll('tr'));
        const rowIndex = allRows.indexOf(row);
        
        let colIndex = 0;
        let currentCell = row.firstElementChild;
        while (currentCell !== cell) {
            colIndex += parseInt(currentCell.getAttribute('colspan') || 1);
            currentCell = currentCell.nextElementSibling;
        }
        
        return { colIndex, rowIndex };
    }
    
    function highlightRowsAndColumns(allRows, targetRowIndex, targetColIndex) {
        let currentRowIndex = 0;
        let rowspans = [];
        let highestRowspan = 1;
    
        allRows.forEach((row, rowIndex) => {
            let currentColIndex = 0;
            let isRowHighlighted = false;
    
            Array.from(row.cells).forEach(cell => {
                const rowspan = parseInt(cell.getAttribute('rowspan') || 1);
                const colspan = parseInt(cell.getAttribute('colspan') || 1);
    
                // 行のハイライト
                if (currentRowIndex <= targetRowIndex && targetRowIndex < currentRowIndex + rowspan) {
                    d3.select(cell).classed('highlight-row', true);
                    isRowHighlighted = true;
                    highestRowspan = Math.max(highestRowspan, rowspan);
                }
    
                // 列のハイライト
                if (currentColIndex <= targetColIndex && targetColIndex < currentColIndex + colspan) {
                    for (let i = 0; i < rowspan; i++) {
                        if (rowIndex + i < allRows.length) {
                            const cellToHighlight = getCellAtIndex(allRows[rowIndex + i], currentColIndex);
                            if (cellToHighlight) {
                                d3.select(cellToHighlight).classed('highlight-col', true);
                            }
                        }
                    }
                }
    
                // rowspanの更新
                while (rowspans.length <= currentColIndex) {
                    rowspans.push(0);
                }
                for (let i = 0; i < colspan; i++) {
                    rowspans[currentColIndex + i] = Math.max(rowspans[currentColIndex + i], rowspan);
                }
    
                currentColIndex += colspan;
            });
    
            // rowspanによる行のハイライト
            if (isRowHighlighted) {
                for (let i = 1; i < highestRowspan; i++) {
                    if (rowIndex + i < allRows.length) {
                        d3.select(allRows[rowIndex + i]).classed('highlight-row', true);
                    }
                }
            }
    
            // rowspanの減少
            rowspans = rowspans.map(span => Math.max(0, span - 1));
    
            currentRowIndex++;
        });
    }
    
    function getCellAtIndex(row, targetIndex) {
        let currentIndex = 0;
        for (const cell of row.cells) {
            const colspan = parseInt(cell.getAttribute('colspan') || 1);
            if (currentIndex <= targetIndex && targetIndex < currentIndex + colspan) {
                return cell;
            }
            currentIndex += colspan;
        }
        return null;
    }
    
    function handleMouseOut(event) {
        if (!event.target.closest('table').contains(event.relatedTarget)) {
            clearHighlights();
        }
    }
    
    function clearHighlights() {
        d3.selectAll('.highlight-row, .highlight-col, .highlight-cell')
            .classed('highlight-row', false)
            .classed('highlight-col', false)
            .classed('highlight-cell', false);
    }
    */

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

    for (let i = columnsToSort - 1; i >= 0; i--) {
        sortedTable.sort((a, b) => {
            if (a[i] < b[i]) return -1;
            if (a[i] > b[i]) return 1;
            return 0;
        });
    }
    return [...fixedTable, ...sortedTable];
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
    for (let iRow = 0; iRow < fixedRowCount; iRow++) {
        for (let iCol = table[0].length - 1; iCol > 1; iCol--) {
            if (table[iRow][iCol] === table[iRow][iCol - 1]) {
                table[iRow][iCol] = '';
            }
        }
    }
    // resolve duplications in fixed columns
    for (let iCol = 0; iCol < fixedColumnCount; iCol++) {
        for (let iRow = table.length - 1; iRow > 1; iRow--) {
            if (table[iRow][iCol] === table[iRow - 1][iCol]) {
                table[iRow][iCol] = '';
            }
        }
    }
    return table;
}

// Subscribe to data and style changes. Use the table format for data.
dscc.subscribeToData(drawViz, { transform: dscc.tableTransform });

