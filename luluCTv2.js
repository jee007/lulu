(async function() {
    const TOTAL_RUN_TIME = 8 * 60 * 60 * 1000;
    const INTERVAL_WAIT = 30 * 60 * 1000;
    const startTime = Date.now();
    let cycleCount = 0;
    let lastCleanedData = [];

    // --- UI Setup ---
    const ui = document.createElement('div');
    ui.id = 'lulu-status-ui';
    ui.style = 'position:fixed; top:10px; right:10px; z-index:9999; background:rgba(0,0,0,0.9); color:white; padding:15px; border-radius:8px; font-family:sans-serif; min-width:220px; border:1px solid #4CAF50; box-shadow: 0 4px 15px rgba(0,0,0,0.5);';
    document.body.appendChild(ui);

    const updateUI = (status, nextRunTime = null) => {
        ui.innerHTML = `
            <h4 style="margin:0 0 10px 0; color:#4CAF50; display:flex; justify-content:between;">
                <span>🟢 Lulu Automator</span>
                <span style="font-size:10px; color:#aaa; margin-left:10px;">v1.2</span>
            </h4>
            <div style="font-size:13px; margin-bottom:5px;">Cycles Completed: <b>${cycleCount}</b></div>
            <div style="font-size:13px; margin-bottom:5px;">Status: <span style="color:#FFD700;">${status}</span></div>
            <div style="font-size:13px; margin-bottom:10px;">Next Sync: <b>${nextRunTime ? nextRunTime.toLocaleTimeString() : '--:--'}</b></div>
            <button id="view-clean-btn" style="width:100%; background:#4CAF50; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; font-weight:bold; margin-bottom:10px;">📊 View Clean Data</button>
            <div style="font-size:11px; color:#888; border-top:1px solid #444; pt:5px;">Shift ends: ${new Date(startTime + TOTAL_RUN_TIME).toLocaleTimeString()}</div>
        `;
        document.getElementById('view-clean-btn').onclick = showDataWindow;
    };

    // --- VBA Logic Ported to JS ---
    const processData = (rawRows) => {
        return rawRows.map(row => {
            const ref = row.Reference || "";
            const creationText = (row.Creation || "").replace(" - ", " ");
            const deliveryText = row.Delivery || "";
            
            // 1. Order ID & Store Name
            const refParts = ref.split(',');
            const orderID = refParts[0] ? refParts[0].substring(0, 22) : "N/A";
            const storeName = refParts[1] ? refParts[1].trim() : "N/A";
            
            // 2. Extract Store ID (Search for INP)
            let storeID = "N/A";
            const pos = ref.indexOf("INP");
            if (pos > -1) storeID = ref.substring(pos + 5, pos + 9).trim();

            // 3. Ageing & Buckets
            const creationStamp = new Date(creationText);
            const ageing = isNaN(creationStamp) ? 0 : Math.floor((new Date() - creationStamp) / 60000);
            
            let bucket = "";
            if (ageing <= 5) bucket = "0-5Min";
            else if (ageing <= 60) {
                const step = Math.floor((ageing - 1) / 5) * 5;
                bucket = `${step}-${step + 5}Min`;
            } else bucket = "60Min+";

            // 4. Delivery Logic
            let deliveryType = "Quick";
            let deliverySlot = "N/A";
            let cleanDel = deliveryText.split("Left")[0].trim();
            
            if (cleanDel.includes("-")) {
                const slots = cleanDel.split("-");
                if (slots.length >= 2) {
                    const startT = slots[0].trim().split(" ").slice(-2).join(" ");
                    const endT = slots[1].trim().split(" ").slice(-2).join(" ");
                    deliverySlot = `${startT} - ${endT}`;
                    
                    // VBA Logic: Schedule if slot >= 1.9 hours
                    const diff = (new Date("1/1/2000 " + endT) - new Date("1/1/2000 " + startT)) / 3600000;
                    if (diff >= 1.9 || cleanDel.toLowerCase().includes("hour")) deliveryType = "Schedule";
                }
            }

            return { orderID, storeID, storeName, creationStamp: creationText, ageing, bucket, deliveryType, deliverySlot, status: row.Status };
        });
    };

    const showDataWindow = () => {
        const win = window.open("", "CleanData", "width=900,height=600");
        win.document.body.innerHTML = `
            <style>
                table { border-collapse: collapse; width: 100%; font-family: sans-serif; font-size: 12px; }
                th { background: #4CAF50; color: white; position: sticky; top: 0; padding: 10px; }
                td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                tr:nth-child(even) { background: #f2f2f2; }
            </style>
            <h3>Cleaned Order Data - ${new Date().toLocaleTimeString()}</h3>
            <table>
                <thead><tr><th>Order ID</th><th>Store ID</th><th>Store</th><th>Created</th><th>Ageing</th><th>Bucket</th><th>Type</th><th>Slot</th><th>Status</th></tr></thead>
                <tbody>${lastCleanedData.map(d => `<tr><td>${d.orderID}</td><td>${d.storeID}</td><td>${d.storeName}</td><td>${d.creationStamp}</td><td>${d.ageing}</td><td>${d.bucket}</td><td>${d.deliveryType}</td><td>${d.deliverySlot}</td><td>${d.status}</td></tr>`).join('')}</tbody>
            </table>
        `;
    };

    // --- Main Loop ---
    while (Date.now() - startTime < TOTAL_RUN_TIME) {
        updateUI("🚀 Scraping...");
        let rawData = [];
        const headers = ["Reference", "Creation", "Client", "Resources", "Payment Method", "Delivery", "Picking Progress", "Status"];
        
        // Paginate and Scrape
        while (true) {
            const tableBody = document.querySelector('.ant-table-tbody');
            if (tableBody) {
                Array.from(tableBody.querySelectorAll('tr.ant-table-row')).forEach(row => {
                    const cells = Array.from(row.querySelectorAll('td'));
                    if (cells.length >= 8) {
                        let obj = {};
                        headers.forEach((h, i) => obj[h] = cells[i].innerText.replace(/\n/g, ' ').trim());
                        rawData.push(obj);
                    }
                });
            }
            const next = document.querySelector('.ant-pagination-next:not(.ant-pagination-disabled)');
            if (next) { next.click(); await new Promise(r => setTimeout(r, 3000)); } else break;
        }

        // Process and Save
        lastCleanedData = processData(rawData);
        cycleCount++;

        // CSV Export (Original Raw Format for safety)
        const csv = [headers.join(","), ...rawData.map(r => headers.map(h => `"${(r[h]||'').replace(/"/g,'""')}"`).join(","))].join("\n");
        const blob = new Blob([csv], {type: 'text/csv'});
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Lulu_Raw_${new Date().toISOString().split('T')[0]}_C${cycleCount}.csv`;
        link.click();

        // Reset to Page 1
        const first = document.querySelector('.ant-pagination-item-1');
        if (first) first.click();
        
        const nextTime = new Date(Date.now() + INTERVAL_WAIT);
        updateUI("⏳ Waiting...", nextTime);
        await new Promise(r => setTimeout(r, INTERVAL_WAIT));
    }
    updateUI("🏁 Shift Completed");
})();
