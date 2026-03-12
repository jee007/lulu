javascript:(async function(){
    const TOTAL_RUN_TIME = 8 * 60 * 60 * 1000; 
    const INTERVAL_WAIT = 30 * 60 * 1000; 
    const startTime = Date.now();
    
    console.log("🚀 8-Hour Automation Started. Script will run until " + new Date(startTime + TOTAL_RUN_TIME).toLocaleTimeString());

    while (Date.now() - startTime < TOTAL_RUN_TIME) {
        let allRows = [];
        const headers = ["Reference", "Creation", "Client", "Resources", "Payment Method", "Delivery", "Picking Progress", "Status"];
        const delay = (ms) => new Promise(res => setTimeout(res, ms));
        
        const now = new Date();
        const timestamp = `${now.toISOString().split('T')[0]}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
        const fileName = `Lulu_Shift_Report_${timestamp}.csv`;

        /* 1. Scrape All Pages */
        allRows.push(headers.join(","));
        while (true) {
            console.log("📄 Scraping current page...");
            const tableBody = document.querySelector('.ant-table-tbody');
            if (tableBody) {
                const rows = Array.from(tableBody.querySelectorAll('tr.ant-table-row'));
                rows.forEach(row => {
                    const cells = Array.from(row.querySelectorAll('td'));
                    if (cells.length >= headers.length) {
                        const rowValues = cells.map(cell => `"${cell.innerText.replace(/\n/g, ' ').trim().replace(/"/g, '""')}"`);
                        allRows.push(rowValues.join(","));
                    }
                });
            }

            const nextButton = document.querySelector('.ant-pagination-next:not(.ant-pagination-disabled)');
            if (nextButton) {
                nextButton.click();
                await delay(3000);
            } else {
                break;
            }
        }

        /* 2. Download File */
        const blob = new Blob([allRows.join("\n")], {type: 'text/csv;charset=utf-8;'});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        console.log(`✅ Downloaded ${allRows.length - 1} orders.`);

        /* 3. Return to Page 1 */
        console.log("🔄 Returning to Page 1...");
        const firstPageBtn = document.querySelector('.ant-pagination-item-1');
        if (firstPageBtn) firstPageBtn.click();
        await delay(5000); 

        /* 4. Wait 30 Minutes */
        if (Date.now() - startTime + INTERVAL_WAIT < TOTAL_RUN_TIME) {
            console.log("⏳ Waiting 30 minutes for the next cycle...");
            await delay(INTERVAL_WAIT);
        } else {
            break; 
        }
    }
    console.log("🏁 8-hour shift completed. Automation stopped.");
})();
