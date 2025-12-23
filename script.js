// Tourist Digital ID System - JavaScript Implementation

class TouristIDSystem {
    constructor() {
        this.currentUser = null;
        this.trackingActive = false;
        this.watchId = null;
        this.trackingMap = null;
        this.authorityMap = null;
        this.currentPosition = null;
        this.safeZones = [];
        this.riskyZones = [];
        this.tourists = [];
        this.alerts = [];
        
        this.init();
    }

    init() {
        this.loadStoredData();
        this.setupEventListeners();
        this.updateUI();
        this.initializeMaps();
        this.setupGeofencing();
    }

    loadStoredData() {
        // Load data from localStorage
        this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
        this.tourists = JSON.parse(localStorage.getItem('tourists')) || [];
        this.alerts = JSON.parse(localStorage.getItem('alerts')) || [];
        this.safeZones = JSON.parse(localStorage.getItem('safeZones')) || this.getDefaultSafeZones();
        this.riskyZones = JSON.parse(localStorage.getItem('riskyZones')) || this.getDefaultRiskyZones();
    }

    saveData() {
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        localStorage.setItem('tourists', JSON.stringify(this.tourists));
        localStorage.setItem('alerts', JSON.stringify(this.alerts));
        localStorage.setItem('safeZones', JSON.stringify(this.safeZones));
        localStorage.setItem('riskyZones', JSON.stringify(this.riskyZones));
    }

    getDefaultSafeZones() {
        return [
            {
                id: 'safe1',
                name: 'Tourist District',
                center: [40.7589, -73.9851], // Times Square area
                radius: 1000,
                type: 'safe'
            },
            {
                id: 'safe2',
                name: 'Hotel Zone',
                center: [40.7505, -73.9934], // Near Penn Station
                radius: 800,
                type: 'safe'
            }
        ];
    }

    getDefaultRiskyZones() {
        return [
            {
                id: 'risky1',
                name: 'Construction Area',
                center: [40.7614, -73.9776], // Central Park South
                radius: 500,
                type: 'risky'
            },
            {
                id: 'risky2',
                name: 'High Crime Area',
                center: [40.7282, -73.9942], // Chelsea area
                radius: 600,
                type: 'risky'
            }
        ];
    }

    setupEventListeners() {
        // Registration form
        document.getElementById('registrationForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegistration();
        });

        // GPS tracking buttons
        document.getElementById('startTracking').addEventListener('click', () => {
            this.startGPSTracking();
        });

        document.getElementById('stopTracking').addEventListener('click', () => {
            this.stopGPSTracking();
        });

        // Panic button - changed to single click
        const panicBtn = document.getElementById('panicButton');
        
        panicBtn.addEventListener('click', () => {
            this.triggerPanicAlert();
        });

        // Authority dashboard
        document.getElementById('refreshMap').addEventListener('click', () => {
            this.refreshAuthorityMap();
        });

        document.getElementById('addSafeZone').addEventListener('click', () => {
            this.addZone('safe');
        });

        document.getElementById('addRiskyZone').addEventListener('click', () => {
            this.addZone('risky');
        });

        // Modal close
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('alertOk').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('alertModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    handleRegistration() {
        const formData = {
            id: Date.now().toString(),
            fullName: document.getElementById('fullName').value,
            passport: document.getElementById('passport').value,
            nationality: document.getElementById('nationality').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
            hotel: document.getElementById('hotel').value,
            emergencyContact: document.getElementById('emergencyContact').value,
            registrationTime: new Date().toISOString(),
            lastLocation: null,
            status: 'active'
        };

        this.currentUser = formData;
        
        // Add to tourists list if not already there
        const existingIndex = this.tourists.findIndex(t => t.passport === formData.passport);
        if (existingIndex >= 0) {
            this.tourists[existingIndex] = formData;
        } else {
            this.tourists.push(formData);
        }

        this.saveData();
        this.updateUI();
        this.showAlert('Success', 'Digital ID registered successfully!');
        
        // Switch to tracking tab
        this.showTab('tracking');
    }

    startGPSTracking() {
        if (!this.currentUser) {
            this.showAlert('Error', 'Please register your Digital ID first.');
            return;
        }

        if (!navigator.geolocation) {
            this.showAlert('Error', 'Geolocation is not supported by this browser.');
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handleLocationUpdate(position),
            (error) => this.handleLocationError(error),
            options
        );

        this.trackingActive = true;
        this.updateTrackingUI();
    }

    stopGPSTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        this.trackingActive = false;
        this.updateTrackingUI();
    }

    handleLocationUpdate(position) {
        const { latitude, longitude } = position.coords;
        this.currentPosition = { lat: latitude, lng: longitude };

        // Update current user location
        if (this.currentUser) {
            this.currentUser.lastLocation = {
                lat: latitude,
                lng: longitude,
                timestamp: new Date().toISOString()
            };

            // Update in tourists array
            const userIndex = this.tourists.findIndex(t => t.id === this.currentUser.id);
            if (userIndex >= 0) {
                this.tourists[userIndex] = this.currentUser;
            }
        }

        // Check geofencing
        this.checkGeofencing(latitude, longitude);

        // Update UI
        document.getElementById('currentPosition').textContent = 
            `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();

        // Update map
        this.updateTrackingMap();
        
        this.saveData();
    }

    handleLocationError(error) {
        let message = 'Unknown error occurred.';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location access denied by user.';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Location information is unavailable.';
                break;
            case error.TIMEOUT:
                message = 'Location request timed out.';
                break;
        }
        
        this.showAlert('Location Error', message);
        this.stopGPSTracking();
    }

    checkGeofencing(lat, lng) {
        let inSafeZone = false;
        let inRiskyZone = false;

        // Check safe zones
        for (const zone of this.safeZones) {
            const distance = this.calculateDistance(lat, lng, zone.center[0], zone.center[1]);
            if (distance <= zone.radius) {
                inSafeZone = true;
                break;
            }
        }

        // Check risky zones
        for (const zone of this.riskyZones) {
            const distance = this.calculateDistance(lat, lng, zone.center[0], zone.center[1]);
            if (distance <= zone.radius) {
                inRiskyZone = true;
                this.triggerZoneAlert(zone.name);
                break;
            }
        }

        // Update zone status
        const zoneStatus = document.getElementById('zoneStatus');
        if (inRiskyZone) {
            zoneStatus.textContent = 'Risky Zone';
            zoneStatus.className = 'zone-risky';
        } else if (inSafeZone) {
            zoneStatus.textContent = 'Safe Zone';
            zoneStatus.className = 'zone-safe';
        } else {
            zoneStatus.textContent = 'Unknown Zone';
            zoneStatus.className = '';
        }
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    triggerPanicAlert() {
        if (!this.currentUser) {
            this.showAlert('Error', 'Please register your Digital ID first.');
            return;
        }

        const alert = {
            id: Date.now().toString(),
            userId: this.currentUser.id,
            userName: this.currentUser.fullName,
            type: 'panic',
            message: 'EMERGENCY: Panic button activated',
            location: this.currentPosition,
            timestamp: new Date().toISOString()
        };

        this.alerts.push(alert);
        this.saveData();
        this.updateAlertHistory();
        
        this.showAlert('Emergency Alert Sent', 
            'Your emergency alert has been sent to authorities. Help is on the way!');
        
        // In a real system, this would send to emergency services
        console.log('EMERGENCY ALERT:', alert);
    }

    triggerZoneAlert(zoneName) {
        if (!this.currentUser) return;

        const alert = {
            id: Date.now().toString(),
            userId: this.currentUser.id,
            userName: this.currentUser.fullName,
            type: 'zone',
            message: `Tourist entered risky zone: ${zoneName}`,
            location: this.currentPosition,
            timestamp: new Date().toISOString()
        };

        this.alerts.push(alert);
        this.saveData();
        
        this.showAlert('Zone Alert', 
            `Warning: You have entered a risky area (${zoneName}). Please exercise caution.`);
    }

    initializeMaps() {
        // Initialize tracking map
        if (document.getElementById('trackingMap')) {
            this.trackingMap = L.map('trackingMap').setView([40.7589, -73.9851], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.trackingMap);
        }

        // Initialize authority map
        if (document.getElementById('authorityMap')) {
            this.authorityMap = L.map('authorityMap').setView([40.7589, -73.9851], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.authorityMap);
            
            this.refreshAuthorityMap();
        }
    }

    updateTrackingMap() {
        if (!this.trackingMap || !this.currentPosition) return;

        // Clear existing markers
        this.trackingMap.eachLayer((layer) => {
            if (layer instanceof L.Marker || layer instanceof L.Circle) {
                this.trackingMap.removeLayer(layer);
            }
        });

        // Add current position marker
        L.marker([this.currentPosition.lat, this.currentPosition.lng])
            .addTo(this.trackingMap)
            .bindPopup('Your Current Location')
            .openPopup();

        // Add safe zones
        this.safeZones.forEach(zone => {
            L.circle(zone.center, {
                color: 'green',
                fillColor: 'lightgreen',
                fillOpacity: 0.3,
                radius: zone.radius
            }).addTo(this.trackingMap).bindPopup(`Safe Zone: ${zone.name}`);
        });

        // Add risky zones
        this.riskyZones.forEach(zone => {
            L.circle(zone.center, {
                color: 'red',
                fillColor: 'lightcoral',
                fillOpacity: 0.3,
                radius: zone.radius
            }).addTo(this.trackingMap).bindPopup(`Risky Zone: ${zone.name}`);
        });

        // Center map on current position
        this.trackingMap.setView([this.currentPosition.lat, this.currentPosition.lng], 15);
    }

    refreshAuthorityMap() {
        if (!this.authorityMap) return;

        // Clear existing markers
        this.authorityMap.eachLayer((layer) => {
            if (layer instanceof L.Marker || layer instanceof L.Circle) {
                this.authorityMap.removeLayer(layer);
            }
        });

        // Add tourist markers
        this.tourists.forEach(tourist => {
            if (tourist.lastLocation && tourist.status === 'active') {
                const marker = L.marker([tourist.lastLocation.lat, tourist.lastLocation.lng])
                    .addTo(this.authorityMap);
                
                const popupContent = `
                    <strong>${tourist.fullName}</strong><br>
                    Passport: ${tourist.passport}<br>
                    Phone: ${tourist.phone}<br>
                    Last Update: ${new Date(tourist.lastLocation.timestamp).toLocaleString()}
                `;
                marker.bindPopup(popupContent);
            }
        });

        // Add zones
        this.safeZones.forEach(zone => {
            L.circle(zone.center, {
                color: 'green',
                fillColor: 'lightgreen',
                fillOpacity: 0.2,
                radius: zone.radius
            }).addTo(this.authorityMap).bindPopup(`Safe Zone: ${zone.name}`);
        });

        this.riskyZones.forEach(zone => {
            L.circle(zone.center, {
                color: 'red',
                fillColor: 'lightcoral',
                fillOpacity: 0.2,
                radius: zone.radius
            }).addTo(this.authorityMap).bindPopup(`Risky Zone: ${zone.name}`);
        });

        this.updateTouristList();
    }

    updateTouristList() {
        const container = document.getElementById('touristList');
        const activeTourists = this.tourists.filter(t => t.status === 'active');
        
        document.getElementById('activeTourists').textContent = activeTourists.length;

        if (activeTourists.length === 0) {
            container.innerHTML = '<p class="no-data">No tourists registered</p>';
            return;
        }

        container.innerHTML = activeTourists.map(tourist => `
            <div class="tourist-item">
                <div class="tourist-info">
                    <div class="tourist-name">${tourist.fullName}</div>
                    <div class="tourist-status">
                        ${tourist.lastLocation ? 
                            `Last seen: ${new Date(tourist.lastLocation.timestamp).toLocaleString()}` : 
                            'No location data'}
                    </div>
                </div>
                <div class="tourist-actions">
                    <span class="contact-number">${tourist.phone}</span>
                </div>
            </div>
        `).join('');
    }

    addZone(type) {
        const name = prompt(`Enter ${type} zone name:`);
        if (!name) return;

        const lat = parseFloat(prompt('Enter latitude:'));
        const lng = parseFloat(prompt('Enter longitude:'));
        const radius = parseInt(prompt('Enter radius (meters):'));

        if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
            this.showAlert('Error', 'Invalid coordinates or radius.');
            return;
        }

        const zone = {
            id: Date.now().toString(),
            name: name,
            center: [lat, lng],
            radius: radius,
            type: type
        };

        if (type === 'safe') {
            this.safeZones.push(zone);
        } else {
            this.riskyZones.push(zone);
        }

        this.saveData();
        this.refreshAuthorityMap();
        this.showAlert('Success', `${type} zone "${name}" added successfully.`);
    }

    updateTrackingUI() {
        const startBtn = document.getElementById('startTracking');
        const stopBtn = document.getElementById('stopTracking');
        const locationStatus = document.getElementById('locationStatus');

        if (this.trackingActive) {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            locationStatus.textContent = 'Active';
            locationStatus.style.color = '#38a169';
        } else {
            startBtn.disabled = false;
            stopBtn.disabled = true;
            locationStatus.textContent = 'Disabled';
            locationStatus.style.color = '#e53e3e';
        }
    }

    updateAlertHistory() {
        const container = document.getElementById('alertHistory');
        
        if (this.alerts.length === 0) {
            container.innerHTML = '<p class="no-alerts">No emergency alerts sent</p>';
            return;
        }

        container.innerHTML = this.alerts
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .map(alert => `
                <div class="alert-item">
                    <div class="alert-time">${new Date(alert.timestamp).toLocaleString()}</div>
                    <div class="alert-text">${alert.message}</div>
                </div>
            `).join('');
    }

    updateUI() {
        // Update user status
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');

        if (this.currentUser) {
            statusDot.classList.add('active');
            statusText.textContent = `Registered: ${this.currentUser.fullName}`;
        } else {
            statusDot.classList.remove('active');
            statusText.textContent = 'Not Registered';
        }

        // Update forms with saved data
        if (this.currentUser) {
            document.getElementById('fullName').value = this.currentUser.fullName || '';
            document.getElementById('passport').value = this.currentUser.passport || '';
            document.getElementById('nationality').value = this.currentUser.nationality || '';
            document.getElementById('phone').value = this.currentUser.phone || '';
            document.getElementById('email').value = this.currentUser.email || '';
            document.getElementById('hotel').value = this.currentUser.hotel || '';
            document.getElementById('emergencyContact').value = this.currentUser.emergencyContact || '';
        }

        this.updateTrackingUI();
        this.updateAlertHistory();
    }

    setupGeofencing() {
        // This sets up the default geofencing zones
        // In a real application, these would be loaded from a server
    }

    showTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab
        document.getElementById(tabName).classList.add('active');
        
        // Add active class to corresponding button
        const buttons = document.querySelectorAll('.tab-btn');
        const tabNames = ['registration', 'tracking', 'emergency', 'authority'];
        const index = tabNames.indexOf(tabName);
        if (index >= 0 && buttons[index]) {
            buttons[index].classList.add('active');
        }

        // Refresh maps when switching to map tabs
        if (tabName === 'tracking' && this.trackingMap) {
            setTimeout(() => this.trackingMap.invalidateSize(), 100);
        }
        if (tabName === 'authority' && this.authorityMap) {
            setTimeout(() => {
                this.authorityMap.invalidateSize();
                this.refreshAuthorityMap();
            }, 100);
        }
    }

    showAlert(title, message) {
        document.getElementById('alertTitle').textContent = title;
        document.getElementById('alertMessage').textContent = message;
        document.getElementById('alertModal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('alertModal').style.display = 'none';
    }
}

// Global functions for tab switching
function showTab(tabName) {
    window.touristSystem.showTab(tabName);
}

// Initialize the system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.touristSystem = new TouristIDSystem();
});

// Add some demo data for testing
function addDemoData() {
    const demoTourists = [
        {
            id: 'demo1',
            fullName: 'John Smith',
            passport: 'US123456789',
            nationality: 'USA',
            phone: '+1-555-0123',
            email: 'john@example.com',
            hotel: 'Grand Hotel NYC',
            emergencyContact: 'Jane Smith +1-555-0124',
            registrationTime: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            lastLocation: {
                lat: 40.7589,
                lng: -73.9851,
                timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
            },
            status: 'active'
        },
        {
            id: 'demo2',
            fullName: 'Maria Garcia',
            passport: 'ES987654321',
            nationality: 'Spain',
            phone: '+34-600-123456',
            email: 'maria@example.com',
            hotel: 'Plaza Hotel',
            emergencyContact: 'Carlos Garcia +34-600-123457',
            registrationTime: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
            lastLocation: {
                lat: 40.7505,
                lng: -73.9934,
                timestamp: new Date(Date.now() - 1800000).toISOString() // 30 minutes ago
            },
            status: 'active'
        }
    ];

    // Add demo data if no tourists exist
    if (!localStorage.getItem('tourists')) {
        localStorage.setItem('tourists', JSON.stringify(demoTourists));
    }
}

// Call demo data function
addDemoData();