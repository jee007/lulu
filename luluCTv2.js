(async function() {
    const TOTAL_RUN_TIME = 8 * 60 * 60 * 1000;
    const INTERVAL_WAIT = 30 * 60 * 1000;
    const startTime = Date.now();
    let lastMatrixData = { quick: [], schedule: [] };

    // --- Configuration for Matrix Headers ---
    const AGE_BUCKETS = ["0-5Min", "5-10Min", "10-15Min", "15-20Min", "20-25Min", "25-30Min", "30-35Min", "35-40Min", "40-45Min", "45-50Min", "50-55Min", "55-60Min", "60Min+"];
    const SLOTS = ["8:00 AM - 9:59 AM", "10:00 AM - 11:59 AM", "12:00 PM - 1:59 PM", "2:00 PM - 3:59 PM", "4:00 PM - 5:59 PM", "6:00 PM - 7:59 PM", "8:00 PM - 9:59 PM", "10:00 PM - 11:59 PM", "12:00 AM - 1:59 AM"];
    const STATUSES = ["Created", "Picking with packing", "Picking with unassigned zone", "Parking", "Auditing", "Stored", "Going to Origin", "Transferring", "Going to destination", "In Route", "Delivering"];

    // --- UI Setup ---
    const ui = document.createElement('div');
    ui.style = 'position:fixed; top:10px; right:10px; z-index:9999; background:rgba(0,0,0,0.9); color:white; padding:15px; border-radius:8px; font-family:sans-serif; border:1px solid #4CAF50;';
    document.body.appendChild(ui);

    const updateUI = (status, nextRun = null) => {
        ui.innerHTML = `
            <h4 style="margin:0; color:#4CAF50;">🟢 Lulu Matrix View</h4>
            <div style="font-size:12px; margin:5px 0;">Status: ${status}</div>
            <button id="view-matrix-btn" style="width:100%; background:#4CAF50; color:white; border:none; padding:8px; cursor:pointer; font-weight:bold;">📊 Open Matrix Dashboard</button>
            <div style="font-size:10px; color:#888; margin-top:5px;">Next: ${nextRun ? nextRun.toLocaleTimeString() : '--:--'}</div>
        `;
        document.getElementById('view-matrix-btn').onclick = showMatrixWindow;
    };

    // --- Processing Logic ---
    const processToMatrix = (rawData) => {
        let quick = [], schedule = [];
        
        rawData.forEach(row => {
            const ref = row.Reference || "";
            const status = row.Status || "";
            const creationStamp = new Date((row.Creation || "").replace(" - ", " "));
            const ageing = isNaN(creationStamp) ? 0 : Math.floor((new Date() - creationStamp) / 60000);
            
            // Extract Store ID (INPXXXX)
            let storeID = "N/A";
            const pos = ref.indexOf("INP");
            if (pos > -1) storeID = ref.substring(pos + 5, pos + 9).trim();

            // Bucket Logic
            let bucket = ageing > 60 ? "60Min+" : `${Math.floor(ageing/5)*5}-${Math.floor(ageing/5)*5 + 5}Min`;

            // Type and Slot Logic
            let type = "Quick";
            let slot = "N/A";
            const delText = row.Delivery || "";
            if (delText.includes("-")) {
                const parts = delText.split("-");
                if (parts.length >= 2) {
                    const startT = parts[0].trim().split(" ").slice(-2).join(" ");
                    const endT = parts[1].trim().split(" ").slice(-2).join(" ");
                    slot = `${startT} - ${endT}`;
                    const diff = (new Date("1/1/2000 " + endT) - new Date("1/1/2000 " + startT)) / 3600000;
                    if (diff >= 1.9) type = "Schedule";
                }
            }

            const item = { status, storeID, bucket, slot };
            if (type === "Quick") quick.push(item); else schedule.push(item);
        });
        return { quick, schedule };
    };

    const generateTable = (title, headers, data, keyField) => {
        let html = `<h3>${title}</h3><table><thead><tr><th>Order Status</th>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
        STATUSES.forEach(stat => {
            html += `<tr><td>${stat}</td>`;
            headers.forEach(h => {
                const count = data.filter(d => d.status.toLowerCase() === stat.toLowerCase() && d[keyField] === h).length;
                html += `<td style="${count > 0 ? 'background:#e6ffed; font-weight:bold;' : 'color:#ccc;'}">${count > 0 ? count : '-'}</td>`;
            });
            html += `</tr>`;
        });
        return html + `</tbody></table>`;
    };

    const showMatrixWindow = () => {
        const win = window.open("", "LuluMatrix", "width=1200,height=800");
        const stores = [...new Set([...lastMatrixData.quick, ...lastMatrixData.schedule].map(d => d.storeID))].sort();
        
        win.document.body.innerHTML = `
            <style>
                body { font-family: sans-serif; padding: 20px; background: #f4f4f4; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 30px; background: white; font-size: 11px; }
                th { background: #ba0000; color: white; padding: 8px; border: 1px solid #ddd; }
                td { border: 1px solid #ddd; padding: 6px; text-align: center; }
                h3 { background: #ba0000; color: white; padding: 10px; margin-bottom: 0; }
            </style>
            <h2>Lulu Jeddah Operations Matrix - ${new Date().toLocaleString()}</h2>
            ${generateTable("Quick Commerce Hourly View", AGE_BUCKETS, lastMatrixData.quick, "bucket")}
            ${generateTable("Quick Commerce Store Wise View", stores, lastMatrixData.quick, "storeID")}
            ${generateTable("Schedule Commerce Hourly View - Slot Wise", SLOTS, lastMatrixData.schedule, "slot")}
            ${generateTable("Schedule Delivery Store Wise View", stores, lastMatrixData.schedule, "storeID")}
        `;
    };

    // --- Main Loop ---
    while (Date.now() - startTime < TOTAL_RUN_TIME) {
        updateUI("🚀 Syncing Dashboard...");
        let rawData = [];
        // [Pagination & Scraping Logic remains same as previous version]
        // ... (Scrape all pages into rawData array)
        
        lastMatrixData = processToMatrix(rawData);
        updateUI("⏳ Waiting...", new Date(Date.now() + INTERVAL_WAIT));
        await new Promise(r => setTimeout(r, INTERVAL_WAIT));
    }
})();
