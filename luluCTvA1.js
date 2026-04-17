javascript:(async function() {
    const API_URL = "https://script.google.com/macros/s/AKfycbxUVldHO9dPY9uTfuCc-A_RZUhkyngPQvMDpMC31nrjZV-SXWH2ZzXWIyDh3HDD_Zom/exec";
    const TOTAL_RUN_TIME = 18 * 60 * 60 * 1000;
    const INTERVAL_WAIT = 10 * 60 * 1000; 
    const startTime = Date.now();
    let cycleCount = 0;
    let lastMatrixData = { quick: [], schedule: [] };
    let forceRefresh = false; 
    let isWorking = false;

    const AGE_BUCKETS = ["0-5Min", "5-10Min", "10-15Min", "15-20Min", "20-25Min", "25-30Min", "30-35Min", "35-40Min", "40-45Min", "45-50Min", "50-55Min", "55-60Min", "60Min+"];
    const SLOTS = ["8:00 AM - 9:59 AM", "10:00 AM - 11:59 AM", "12:00 PM - 1:59 PM", "2:00 PM - 3:59 PM", "4:00 PM - 5:59 PM", "6:00 PM - 7:59 PM", "8:00 PM - 9:59 PM", "10:00 PM - 11:59 PM", "12:00 AM - 1:59 AM"];
    const STATUSES = ["Created", "Picking with packing", "Picking with unassigned zone", "Parking", "Auditing", "Stored", "Going to Origin", "Transferring", "Going to destination", "In Route", "Delivering"];

    const ui = document.createElement('div');
    ui.style = 'position:fixed; top:10px; right:10px; z-index:9999; background:rgba(0,0,0,0.95); color:white; padding:15px; border-radius:8px; font-family:sans-serif; border:1px solid #4CAF50; width:200px; box-shadow: 0 4px 15px rgba(0,0,0,0.5);';
    document.body.appendChild(ui);

    const updateUI = (status, nextRun = null) => {
        const btnText = isWorking ? "🔄 Working..." : "🔄 Sync Now";
        const btnColor = isWorking ? "#FF9800" : "#2196F3";

        ui.innerHTML = `
            <h4 style="margin:0; color:#4CAF50;">🟢 Lulu Matrix Sync</h4>
            <div style="font-size:12px; margin:5px 0;">Cycle: ${cycleCount} | ${status}</div>
            <button id="refresh-now-btn" style="width:100%; background:${btnColor}; color:white; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:4px; transition: background 0.3s;">${btnText}</button>
            <div style="font-size:10px; color:#aaa; margin-top:5px;">Next Auto: ${nextRun ? nextRun.toLocaleTimeString() : '--:--'}</div>
        `;
        document.getElementById('refresh-now-btn').onclick = () => { 
            if (!isWorking) forceRefresh = true; 
        };
    };

    const softRefresh = async () => {
        updateUI("🔄 Resetting View...");
        const firstPageBtn = document.querySelector('.ant-pagination-item-1');
        const refreshBtn = document.querySelector('.anticon-reload')?.parentElement;
        if (refreshBtn) refreshBtn.click(); else if (firstPageBtn) firstPageBtn.click();
        await new Promise(r => setTimeout(r, 5000));
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
            let type = "Quick", slot = "N/A";
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

    while (Date.now() - startTime < TOTAL_RUN_TIME) {
        isWorking = true; 
        await softRefresh();
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
            if (next) { 
                next.click(); 
                await new Promise(r => setTimeout(r, 3000)); 
            } else break;
        }

        lastMatrixData = processToMatrix(rawData);
        
        // --- SYNC TO BACKEND ---
        updateUI("☁️ Syncing to Cloud...");
        try {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: new URLSearchParams({
                    action: 'uploadMatrixData',
                    timestamp: new Date().toISOString(),
                    data: JSON.stringify(lastMatrixData)
                })
            });
            console.log("Matrix synced!");
        } catch (e) { console.error("Sync failed", e); }

        cycleCount++;
        isWorking = false; 
        forceRefresh = false; 
        
        let nextTime = Date.now() + INTERVAL_WAIT;
        while (Date.now() < nextTime && !forceRefresh) {
            updateUI("⏳ Standby", new Date(nextTime));
            await new Promise(r => setTimeout(r, 1000)); 
        }
    }
})();
