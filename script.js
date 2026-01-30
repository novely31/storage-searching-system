const firebaseConfig = {
    apiKey: "AIzaSyBjZgEPAivAgxFJP0x1QA8Rr04uZxqwJcs",
    authDomain:  "boxsim.firebaseapp.com",
    databaseURL: "https://boxsim-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId:"boxsim",
    storageBucket:"boxsim.firebasestorage.app",
    messagingSenderId: "978064446117",
    appId: "1:978064446117:web:77bcb08ac6dd8c7c0ff34c"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentRackIdx = null;
let currentBoxIdx = null;
let shelvingDatabase = [];
const MAX_BOXES = 15;
const MAX_FILES_PER_BOX = 100;

// 1. DATA LISTENER
db.ref('inventory').on('value', (snapshot) => {
    const data = snapshot.val();
    shelvingDatabase = data ? Object.keys(data).map(key => ({
        id: key,
        boxes: data[key].boxes || [] 
    })) : [];
    
    updateStats();
    renderShelfGrid();
    renderDatabase();
    
    if (currentRackIdx !== null) {
        refreshRackView();
        if (currentBoxIdx !== null) updateBoxFileList();
    }
});

// 2. RACK MANAGEMENT
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
    db.ref('inventory/' + newId).set({ createdAt: firebase.database.ServerValue.TIMESTAMP, boxes: [] });
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

function deleteRack(rackId) {
    if (confirm(`Delete ${rackId}?`)) db.ref('inventory/' + rackId).remove();
}

// 3. BOX MANAGEMENT (WITH DELETE X)
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
    const boxes = rack.boxes || [];
    if (boxes.length >= MAX_BOXES) return alert("Rack Full");
    const newBox = { id: boxes.length + 1, files: [] };
    db.ref('inventory/' + rack.id).update({ boxes: [...boxes, newBox] });
}

function deleteBox(bIdx) {
    const rack = shelvingDatabase[currentRackIdx];
    if (confirm(`Delete Box ${rack.boxes[bIdx].id} and all its files?`)) {
        const updatedBoxes = [...rack.boxes];
        updatedBoxes.splice(bIdx, 1);
        db.ref('inventory/' + rack.id).update({ boxes: updatedBoxes });
    }
}

// 4. FILE MANAGEMENT
function openBox(boxIdx) {
    currentBoxIdx = boxIdx;
    const box = shelvingDatabase[currentRackIdx].boxes[boxIdx];
    document.getElementById('box-num-display').innerText = `BOX #${box.id}`;
    document.getElementById('entry-date').value = new Date().toISOString().split('T')[0];
    updateBoxFileList();
    showSection('box-detail-view');
}

function addFileToBox() {
    const rack = shelvingDatabase[currentRackIdx];
    const boxes = [...rack.boxes];
    const files = boxes[currentBoxIdx].files || [];
    const name = document.getElementById('full-name').value;
    const num = document.getElementById('file-number').value;
    if (!name || !num) return alert("Name and File Number required");

    files.push({
        date: document.getElementById('entry-date').value,
        fileNumber: num,
        fullName: name,
        label: document.getElementById('entry-label').value
    });

    boxes[currentBoxIdx].files = files;
    db.ref('inventory/' + rack.id).update({ boxes: boxes }).then(() => {
        document.getElementById('full-name').value = '';
        document.getElementById('file-number').value = '';
        document.getElementById('entry-label').value = '';
    });
}

function updateBoxFileList() {
    const box = shelvingDatabase[currentRackIdx].boxes[currentBoxIdx];
    if (!box) return;
    const files = box.files || [];
    document.getElementById('file-count-display').innerText = `${files.length}/${MAX_FILES_PER_BOX} Files`;
    document.getElementById('current-box-list').innerHTML = files.map((f, i) => `
        <div class="file-item-mini">
            <span><strong>${f.fileNumber}</strong> - ${f.fullName}</span>
            <button onclick="deleteFile(${i})" style="color:var(--danger); border:none; background:none; cursor:pointer;"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}

function deleteFile(fIdx) {
    const rack = shelvingDatabase[currentRackIdx];
    const boxes = [...rack.boxes];
    boxes[currentBoxIdx].files.splice(fIdx, 1);
    db.ref('inventory/' + rack.id).update({ boxes: boxes });
}

// 5. SEARCH & LEDGER
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

// NAVIGATION & THEME
function showSection(id) {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.getElementById(id).style.display = 'block';
}
function goBackToRack() { currentBoxIdx = null; showSection('single-shelf-view'); }
function toggleTheme() { 
    document.body.classList.toggle('dark-mode');
    document.getElementById('theme-text').innerText = document.body.classList.contains('dark-mode') ? 'LIGHT MODE' : 'DARK MODE';
}

// CLOCK LOGIC
function updateClock() {
    const now = new Date();
    document.getElementById('live-clock').textContent = now.toTimeString().split(' ')[0];
    document.getElementById('live-date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
setInterval(updateClock, 1000);
updateClock();