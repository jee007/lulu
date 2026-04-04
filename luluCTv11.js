javascript:(function(){
  const API_URL = "https://script.google.com/macros/s/AKfycbxq26ohowEP2C4H1Z9CvevqAFiK2oG-viK75f7tGQPN6oucP0V8-rNNL3rRRBq0kMha/exec";
  console.log("Matrix Sync Started...");
  
  function scrapeData() {
    const quick = [];
    const schedule = [];
    
    // Scrape logic for Lulu system (example selectors, adjust as needed)
    document.querySelectorAll('tr').forEach(tr => {
      const cells = tr.querySelectorAll('td');
      if (cells.length >= 5) {
        const item = {
          status: cells[0].innerText.trim(),
          storeID: cells[1].innerText.trim(),
          bucket: cells[2].innerText.trim(),
          slot: cells[3].innerText.trim(),
          orderID: cells[4].innerText.trim()
        };
        // Logic to differentiate quick vs schedule
        if (item.bucket.includes('Min')) quick.push(item);
        else schedule.push(item);
      }
    });
    
    return { quick, schedule };
  }

  try {
    const data = scrapeData();
    if (data.quick.length === 0 && data.schedule.length === 0) {
      alert("No data found on this page. Make sure you are on the correct dashboard.");
      return;
    }

    fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "syncMatrix", data })
    }).then(() => {
      alert("Matrix Synced Successfully! Refresh your dashboard to see updates.");
    }).catch(err => {
      alert("Sync Failed: " + err.message);
    });
  } catch (e) {
    alert("Error: " + e.message);
  }
})();
