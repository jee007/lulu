(async function() {
    const TOTAL_RUN_TIME = 8 * 60 * 60 * 1000;
    const INTERVAL_WAIT = 5 * 60 * 1000;
    const startTime = Date.now();
    let cycleCount = 0;
    let lastMatrixData = { quick: [], schedule: [] };

    const AGE_BUCKETS = ["0-5Min", "5-10Min", "10-15Min", "15-20Min", "20-25Min", "25-30Min", "30-35Min", "35-40Min", "40-45Min", "45-50Min", "50-55Min", "55-60Min", "60Min+"];
    const SLOTS = ["8:00 AM - 9:59 AM", "10:00 AM - 11:59 AM", "12:00 PM - 1:59 PM", "2:00 PM - 3:59 PM", "4:00 PM - 5:59 PM", "6:00 PM - 7:59 PM", "8:00 PM - 9:59 PM", "10:00 PM - 11:59 PM", "12:00 AM - 1:59 AM"];
    const STATUSES = ["Created", "Picking with packing", "Picking with unassigned zone", "Parking", "Auditing", "Stored", "Going to Origin", "Transferring", "Going to destination", "In Route", "Delivering"];

    const ui = document.createElement('div');
    ui.style = 'position:fixed; top:10px; right:10px; z-index:9999; background:rgba(0,0,0,0.95); color:white; padding:15px; border-radius:8px; font-family:sans-serif; border:1px solid #4CAF50;';
    document.body.appendChild(ui);

    const updateUI = (status, nextRun = null) => {
        ui.innerHTML = `
            <h4 style="margin:0; color:#4CAF50;">🟢 Lulu Matrix Pro</h4>
            <div style="font-size:12px; margin:5px 0;">Cycle: ${cycleCount} | ${status}</div>
            <button id="view-matrix-btn" style="width:100%; background:#4CAF50; color:white; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:4px;">📊 Open Today's Matrix</button>
            <div style="font-size:10px; color:#aaa; margin-top:5px;">Next Sync: ${nextRun ? nextRun.toLocaleTimeString() : '--:--'}</div>
        `;
        document.getElementById('view-matrix-btn').onclick = showMatrixWindow;
    };

    const processToMatrix = (rawData) => {
        let quick = [], schedule = [];
        const todayStr = new Date().toDateString();

        rawData.forEach(row => {
            const rawDelText = row.Delivery || "";
            const dateMatch = rawDelText.match(/[a-zA-Z]{3}\s\d{1,2},\s\d{4}/);
            if (dateMatch && new Date(dateMatch[0]).toDateString() !== todayStr) return; 

            const ref = row.Reference || "";
            const status = row.Status || "";
            const creationStamp = new Date((row.Creation || "").replace(" - ", " "));
            const ageing = isNaN(creationStamp) ? 0 : Math.floor((Date.now() - creationStamp) / 60000);
            
            const orderID = ref.split(',')[0].substring(0, 22).trim();
            let storeID = "N/A";
            const pos = ref.indexOf("INP");
            if (pos > -1) storeID = ref.substring(pos + 5, pos + 9).trim();

            let bucket = ageing > 60 ? "60Min+" : `${Math.floor(ageing/5)*5}-${Math.floor(ageing/5)*5 + 5}Min`;

            let type = "Quick";
            let slot = "N/A";
            let cleanDel = rawDelText.split("Left")[0].replace(/\+UTC.*/g, "").trim();

            if (cleanDel.includes("-")) {
                const parts = cleanDel.split("-");
                const startMatch = parts[0]?.match(/\d{1,2}:\d{2}\s[APM]{2}/i);
                const endMatch = parts[1]?.match(/\d{1,2}:\d{2}\s[APM]{2}/i);
                if (startMatch && endMatch) {
                    slot = `${startMatch[0]} - ${endMatch[0]}`;
                    const diff = (new Date("1/1/2000 " + endMatch[0]) - new Date("1/1/2000 " + startMatch[0])) / 3600000;
                    if (diff >= 1.9 || rawDelText.toLowerCase().includes("day")) type = "Schedule";
                }
            }
            
            const item = { status, storeID, bucket, slot, orderID };
            if (type === "Quick") quick.push(item); else schedule.push(item);
        });
        return { quick, schedule };
    };

    const generateTable = (title, headers, data, keyField, themeColor) => {
        let html = `<h3 style="background:${themeColor}; color:white; padding:8px; margin-bottom:0;">${title}</h3>`;
        html += `<table><thead><tr><th>Status</th>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
        STATUSES.forEach(stat => {
            html += `<tr><td style="text-align:left; font-weight:bold;">${stat}</td>`;
            headers.forEach(h => {
                const matches = data.filter(d => d.status.toLowerCase() === stat.toLowerCase() && d[keyField] === h);
                const count = matches.length;
                
                // Tooltip shows OrderID and StoreID
                const hoverText = matches.map(m => `${m.orderID} (${m.storeID})`).join('\n');
                // Copy text only contains OrderID
                const copyText = matches.map(m => m.orderID).join('\n');
                
                const cellColor = count > 0 ? (themeColor === '#ba0000' ? '#fff0f0' : '#f0fff4') : 'transparent';
                
                // Added onclick to trigger clipboard copy
                html += `<td title="${hoverText}" 
                            onclick="if(${count}>0) { navigator.clipboard.writeText(\`${copyText}\`); alert('Copied ${count} Order IDs'); }" 
                            style="background:${cellColor}; color:${count > 0 ? '#000' : '#ccc'}; cursor:${count > 0 ? 'pointer' : 'default'};">
                            ${count > 0 ? count : '-'}
                        </td>`;
            });
            html += `</tr>`;
        });
        return html + `</tbody></table>`;
    };

    const showMatrixWindow = () => {
        const win = window.open("", "LuluMatrix", "width=1300,height=900");
        const quickStores = [...new Set(lastMatrixData.quick.map(d => d.storeID))].sort();
        const scheduleStores = [...new Set(lastMatrixData.schedule.map(d => d.storeID))].sort();
        
        win.document.body.innerHTML = `
            <style>
                body { font-family: sans-serif; padding: 20px; background: #f8f9fa; }
                table { border-collapse: collapse; width: 100%; margin-bottom: 40px; background: white; font-size: 11px; }
                th { background: #444; color: white; padding: 10px; border: 1px solid #ddd; }
                td { border: 1px solid #ddd; padding: 8px; text-align: center; transition: 0.2s; }
                td:hover { filter: brightness(0.9) contrast(1.1); }
            </style>
            <h2>Today's Jeddah Matrix (Hover to see StoreIDs | Click to Copy Order IDs)</h2>
            ${generateTable("Quick Commerce Hourly View", AGE_BUCKETS, lastMatrixData.quick, "bucket", "#ba0000")}
            ${generateTable("Quick Commerce Store Wise View", quickStores, lastMatrixData.quick, "storeID", "#ba0000")}
            <div style="margin: 40px 0; border-top: 2px solid #ccc;"></div>
            ${generateTable("Schedule Commerce Hourly View", SLOTS, lastMatrixData.schedule, "slot", "#2e7d32")}
            ${generateTable("Schedule Delivery Store Wise View", scheduleStores, lastMatrixData.schedule, "storeID", "#2e7d32")}
        `;
    };

    while (Date.now() - startTime < TOTAL_RUN_TIME) {
        updateUI("🚀 Scraping...");
        let rawData = [];
        const headers = ["Reference", "Creation", "Client", "Resources", "Payment Method", "Delivery", "Picking Progress", "Status"];
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
        lastMatrixData = processToMatrix(rawData);
        cycleCount++;
        if (document.querySelector('.ant-pagination-item-1')) document.querySelector('.ant-pagination-item-1').click();
        updateUI("⏳ Standby", new Date(Date.now() + INTERVAL_WAIT));
        await new Promise(r => setTimeout(r, INTERVAL_WAIT));
    }
})();
