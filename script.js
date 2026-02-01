// --- CONFIGURATION ---
let currentRackIdx = null;
let currentBoxIdx = null;
let shelvingDatabase = [];
const MAX_BOXES = 15;
const MAX_FILES_PER_BOX = 100;
const DATA_FILE = 'inventory.json';

// 1. DATA INITIALIZATION (Replaces Firebase Listener)
async function initDatabase() {
    try {
        // Fetch the JSON file from your GitHub Pages site
        const response = await fetch(DATA_FILE);
        if (!response.ok) throw new Error("File not found");
        shelvingDatabase = await response.json();
    } catch (err) {
        console.warn("Inventory file not found or empty. Starting fresh.");
        shelvingDatabase = [];
    }
    
    updateStats();
    renderShelfGrid();
    renderDatabase();
}

// 2. THE SAVE FUNCTION (The "No API" Method)
function syncToGitHub() {
    const dataStr = JSON.stringify(shelvingDatabase, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = DATA_FILE;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert("DATABASE EXPORTED!\n\n1. Go to your GitHub Repo.\n2. Click 'Add file' -> 'Upload files'.\n3. Drop this inventory.json there to save changes.");
}

// 3. RACK MANAGEMENT
function addShelvingRack() {
    let nextNumber = 1;
    if (shelvingDatabase.length > 0) {
        const currentNumbers = shelvingDatabase.map(rack => {
            const match = rack.id.match(/\d+$/);
            return match ? parseInt(match[0]) : 0;
        });
        nextNumber = Math.max(...currentNumbers) + 1;
    }
    const newId = `SSS-RACK-${nextNumber}`;
    shelvingDatabase.push({ id: newId, boxes: [] });
    
    refreshUI();
    alert("Rack added locally. Remember to click the SAVE button in the ledger to keep changes!");
}

function deleteRack(rackId) {
    if (confirm(`Delete ${rackId}?`)) {
        shelvingDatabase = shelvingDatabase.filter(r => r.id !== rackId);
        refreshUI();
    }
}

// 4. BOX MANAGEMENT
function openRack(idx) {
    currentRackIdx = idx;
    refreshRackView();
    showSection('single-shelf-view');
}

function refreshRackView() {
    const rack = shelvingDatabase[currentRackIdx];
    if (!rack) return;
    document.getElementById('current-rack-title').innerText = rack.id;
    document.getElementById('add-box-btn').onclick = () => addBoxToShelf(currentRackIdx);
    
    const grid = document.getElementById('box-grid');
    grid.innerHTML = (rack.boxes || []).map((box, bIdx) => `
        <div class="box-item">
            <button class="btn-delete-box" onclick="deleteBox(${bIdx})"><i class="fas fa-times"></i></button>
            <i class="fas fa-box" style="font-size: 2rem; color: var(--accent); margin-bottom:10px; display:block;"></i>
            <span class="box-id">BOX ${box.id}</span>
            <small style="display:block; margin:5px 0;">${(box.files || []).length} Files</small>
            <button class="btn-open-box" onclick="openBox(${bIdx})">OPEN BOX</button>
        </div>`).join('');
}

function addBoxToShelf(rackIdx) {
    const rack = shelvingDatabase[rackIdx];
    if (rack.boxes.length >= MAX_BOXES) return alert("Rack Full");
    const newBox = { id: rack.boxes.length + 1, files: [] };
    rack.boxes.push(newBox);
    refreshRackView();
    updateStats();
}

function deleteBox(bIdx) {
    if (confirm(`Delete this box?`)) {
        shelvingDatabase[currentRackIdx].boxes.splice(bIdx, 1);
        refreshRackView();
        updateStats();
    }
}

// 5. FILE MANAGEMENT
function openBox(boxIdx) {
    currentBoxIdx = boxIdx;
    const box = shelvingDatabase[currentRackIdx].boxes[boxIdx];
    document.getElementById('box-num-display').innerText = `BOX #${box.id}`;
    document.getElementById('entry-date').value = new Date().toISOString().split('T')[0];
    updateBoxFileList();
    showSection('box-detail-view');
}

function addFileToBox() {
    const name = document.getElementById('full-name').value;
    const num = document.getElementById('file-number').value;
    if (!name || !num) return alert("Name and File Number required");

    const file = {
        date: document.getElementById('entry-date').value,
        fileNumber: num,
        fullName: name,
        label: document.getElementById('entry-label').value
    };

    shelvingDatabase[currentRackIdx].boxes[currentBoxIdx].files.push(file);
    
    document.getElementById('full-name').value = '';
    document.getElementById('file-number').value = '';
    document.getElementById('entry-label').value = '';
    
    updateBoxFileList();
    updateStats();
    renderDatabase();
}

function updateBoxFileList() {
    const box = shelvingDatabase[currentRackIdx].boxes[currentBoxIdx];
    const files = box.files || [];
    document.getElementById('file-count-display').innerText = `${files.length}/${MAX_FILES_PER_BOX} Files`;
    document.getElementById('current-box-list').innerHTML = files.map((f, i) => `
        <div class="file-item-mini">
            <span><strong>${f.fileNumber}</strong> - ${f.fullName}</span>
            <button onclick="deleteFile(${i})"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}

function deleteFile(fIdx) {
    shelvingDatabase[currentRackIdx].boxes[currentBoxIdx].files.splice(fIdx, 1);
    updateBoxFileList();
    updateStats();
}

// 6. UI REFRESH & SEARCH
function refreshUI() {
    updateStats();
    renderShelfGrid();
    renderDatabase();
}

function executeSearch() {
    const query = document.getElementById('global-search').value.toLowerCase();
    const resultsTable = document.getElementById('monitor-results');
    if (!query) return resultsTable.innerHTML = '<tr><td colspan="5" style="text-align:center;">Enter search terms...</td></tr>';

    let html = '';
    shelvingDatabase.forEach(rack => {
        (rack.boxes || []).forEach(box => {
            (box.files || []).forEach(file => {
                if (box.id.toString().includes(query) || file.fileNumber.toLowerCase().includes(query) || file.fullName.toLowerCase().includes(query) || file.label.toLowerCase().includes(query)) {
                    html += `<tr><td>Box ${box.id}</td><td><span class="rack-tag">${rack.id}</span></td><td>${file.fileNumber}</td><td>${file.fullName}</td><td><span class="label-badge">${file.label}</span></td></tr>`;
                }
            });
        });
    });
    resultsTable.innerHTML = html || '<tr><td colspan="5" style="text-align:center; color:var(--danger);">No records found.</td></tr>';
}

function renderShelfGrid() {
    const grid = document.getElementById('shelf-grid');
    if (!grid) return;
    grid.innerHTML = shelvingDatabase.map((rack, i) => `
        <div class="shelf-card">
            <div class="card-header">
                <h3>${rack.id}</h3>
                <button class="btn-delete-small" onclick="deleteRack('${rack.id}')"><i class="fas fa-times"></i></button>
            </div>
            <p>${(rack.boxes || []).length} / ${MAX_BOXES} Boxes</p>
            <button class="btn-open-rack" onclick="openRack(${i})">VIEW RACK</button>
        </div>
    `).join('');
}

function renderDatabase() {
    const tbody = document.getElementById('db-body');
    if (!tbody) return;
    let html = '';
    shelvingDatabase.forEach(rack => {
        (rack.boxes || []).forEach(box => {
            (box.files || []).forEach(file => {
                html += `<tr><td>${box.id}</td><td><span class="rack-tag">${rack.id}</span></td><td>${file.date}</td><td>${file.fileNumber}</td><td>${file.fullName}</td><td><span class="label-badge">${file.label}</span></td></tr>`;
            });
        });
    });
    tbody.innerHTML = html;
}

function updateStats() {
    let racks = shelvingDatabase.length, boxes = 0, files = 0;
    shelvingDatabase.forEach(r => {
        boxes += (r.boxes || []).length;
        (r.boxes || []).forEach(b => files += (b.files || []).length);
    });
    document.getElementById('stat-racks').innerText = racks;
    document.getElementById('stat-boxes').innerText = boxes;
    document.getElementById('stat-files').innerText = files;
}

// 7. NAVIGATION & UTILS
function showSection(id) {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
}

function goBackToRack() { currentBoxIdx = null; showSection('single-shelf-view'); }

function toggleTheme() { 
    document.body.classList.toggle('dark-mode');
    document.getElementById('theme-text').innerText = document.body.classList.contains('dark-mode') ? 'LIGHT MODE' : 'DARK MODE';
}

function updateClock() {
    const now = new Date();
    document.getElementById('live-clock').textContent = now.toTimeString().split(' ')[0];
    document.getElementById('live-date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

setInterval(updateClock, 1000);
updateClock();
window.onload = initDatabase;
