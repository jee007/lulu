/* Update this code in your GitHub: jee007/lulu/main/luluCT.js 
  The Bookmarklet will pull this automatically.
*/
(async function() {
    const TOTAL_RUN_TIME = 8 * 60 * 60 * 1000;
    const INTERVAL_WAIT = 30 * 60 * 1000;
    const startTime = Date.now();
    let cycleCount = 0;

    // Create Visual UI
    const ui = document.createElement('div');
    ui.id = 'lulu-status-ui';
    ui.style = 'position:fixed; top:10px; right:10px; z-index:9999; background:rgba(0,0,0,0.8); color:white; padding:15px; border-radius:8px; font-family:sans-serif; min-width:200px; border:1px solid #444;';
    ui.innerHTML = `
        <h4 style="margin:0 0 10px 0; color:#4CAF50;">🟢 Lulu Automator</h4>
        <div id="lulu-stat-cycles">Cycles: 0</div>
        <div id="lulu-stat-status">Status: Initializing...</div>
        <div id="lulu-stat-next">Next run: --:--</div>
        <hr style="margin:10px 0; border:0; border-top:1px solid #555;">
        <div style="font-size:11px; color:#aaa;">Shift ends at: ${new Date(startTime + TOTAL_RUN_TIME).toLocaleTimeString()}</div>
    `;
    document.body.appendChild(ui);

    const updateUI = (status, nextRunTime = null) => {
        document.getElementById('lulu-stat-cycles').innerText = `Cycles Completed: ${cycleCount}`;
        document.getElementById('lulu-stat-status').innerText = `Status: ${status}`;
        if (nextRunTime) {
            document.getElementById('lulu-stat-next').innerText = `Next run: ${nextRunTime.toLocaleTimeString()}`;
        }
    };

    while (Date.now() - startTime < TOTAL_RUN_TIME) {
        updateUI("🚀 Scraping Pages...");
        let allRows = [];
        const headers = ["Reference", "Creation", "Client", "Resources", "Payment Method", "Delivery", "Picking Progress", "Status"];
        const delay = (ms) => new Promise(res => setTimeout(res, ms));

        allRows.push(headers.join(","));
        while (true) {
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

        // Download and Reset
        cycleCount++;
        const now = new Date();
        const blob = new Blob([allRows.join("\n")], {type: 'text/csv'});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Lulu_Report_${now.toISOString().split('T')[0]}_${cycleCount}.csv`;
        link.click();

        // Go back to page 1
        const firstPageBtn = document.querySelector('.ant-pagination-item-1');
        if (firstPageBtn) firstPageBtn.click();
        await delay(5000);

        // Wait cycle
        if (Date.now() - startTime + INTERVAL_WAIT < TOTAL_RUN_TIME) {
            const nextTime = new Date(Date.now() + INTERVAL_WAIT);
            updateUI("⏳ Waiting...", nextTime);
            await delay(INTERVAL_WAIT);
        } else {
            break;
        }
    }
    updateUI("🏁 Shift Finished");
    document.querySelector('#lulu-status-ui h4').style.color = "red";
    document.querySelector('#lulu-status-ui h4').innerText = "🔴 Automation Stopped";
})();
