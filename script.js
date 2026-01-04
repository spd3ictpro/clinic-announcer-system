// ============================================
// BROWSER COMPATIBILITY CHECK
// ============================================
function checkBrowserCompatibility() {
    let warnings = [];
    
    // Check for Web Speech API
    if (!('speechSynthesis' in window)) {
        warnings.push('Your browser does not support voice announcements. The app will work without voice features.');
    }
    
    // Check for LocalStorage
    if (!('localStorage' in window)) {
        warnings.push('Your browser does not support saving data. Queue data will not persist.');
    }
    
    // Show warnings if any
    if (warnings.length > 0) {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'browser-warning';
        warningDiv.innerHTML = `
            <strong><i class="fas fa-exclamation-triangle"></i> Browser Compatibility Notice:</strong>
            <ul>${warnings.map(w => `<li>${w}</li>`).join('')}</ul>
        `;
        document.querySelector('.container').prepend(warningDiv);
        warningDiv.style.display = 'block';
    }
}

// ============================================
// STATE MANAGEMENT
// ============================================
class QueueManager {
    constructor() {
        this.waitingList = [];
        this.currentlyCalling = null;
        this.totalCalled = 0;
        this.totalPatients = 0;
        this.totalRecalls = 0;
        
        // Event listener flags to prevent duplication
        this.recallListenerAttached = false;
        this.arrivedListenerAttached = false;
        
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('clinicQueue');
            if (saved) {
                const data = JSON.parse(saved);
                this.waitingList = data.waitingList || [];
                this.currentlyCalling = data.currentlyCalling || null;
                this.totalCalled = data.totalCalled || 0;
                this.totalPatients = data.totalPatients || 0;
                this.totalRecalls = data.totalRecalls || 0;
            }
        } catch (e) {
            console.warn('Failed to load from localStorage:', e);
        }
    }
    
    saveToStorage() {
        try {
            const data = {
                waitingList: this.waitingList,
                currentlyCalling: this.currentlyCalling,
                totalCalled: this.totalCalled,
                totalPatients: this.totalPatients,
                totalRecalls: this.totalRecalls
            };
            localStorage.setItem('clinicQueue', JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }
    }
    
    addPatient(name, counter) {
        if (!name.trim() || !counter.trim()) {
            this.showNotification('Please enter both patient name and counter', 'error');
            return false;
        }
        
        const patient = {
            id: Date.now(),
            name: this.sanitizeInput(name),
            counter: this.sanitizeInput(counter),
            addedTime: new Date().toLocaleTimeString(),
            queueNumber: this.waitingList.length + 1,
            callCount: 0
        };
        
        this.waitingList.push(patient);
        this.totalPatients++;
        this.saveToStorage();
        this.showNotification(`Added ${patient.name} to queue`, 'success');
        return true;
    }
    
    callNextPatient() {
        if (this.waitingList.length === 0) {
            this.showNotification('No patients in waiting list', 'error');
            return null;
        }
        
        const patient = this.waitingList.shift();
        this.currentlyCalling = patient;
        patient.callCount = 1; // First call
        patient.lastCalledTime = new Date().toLocaleTimeString();
        this.totalCalled++;
        
        // Update queue numbers
        this.waitingList.forEach((p, index) => {
            p.queueNumber = index + 1;
        });
        
        this.saveToStorage();
        return patient;
    }
    
    recallPatient() {
        if (!this.currentlyCalling) {
            this.showNotification('No patient is currently being called', 'error');
            return null;
        }
        
        // Increment call count
        this.currentlyCalling.callCount = (this.currentlyCalling.callCount || 1) + 1;
        this.currentlyCalling.lastCalledTime = new Date().toLocaleTimeString();
        this.totalRecalls++;
        
        this.showNotification(`Recalling ${this.currentlyCalling.name} (Call #${this.currentlyCalling.callCount})`, 'warning');
        this.saveToStorage();
        return this.currentlyCalling;
    }
    
    markPatientArrived() {
        if (!this.currentlyCalling) {
            this.showNotification('No patient is currently being called', 'error');
            return false;
        }
        
        const patientName = this.currentlyCalling.name;
        const callCount = this.currentlyCalling.callCount || 1;
        
        this.currentlyCalling = null;
        this.saveToStorage();
        
        this.showNotification(`Marked ${patientName} as arrived (Called ${callCount} times)`, 'success');
        return true;
    }
    
    removePatient(id) {
        const index = this.waitingList.findIndex(p => p.id === id);
        if (index !== -1) {
            this.waitingList.splice(index, 1);
            
            // Update queue numbers
            this.waitingList.forEach((p, index) => {
                p.queueNumber = index + 1;
            });
            
            this.saveToStorage();
            this.showNotification('Patient removed from queue', 'info');
        }
    }
    
    clearAll() {
        if (this.waitingList.length === 0) return;
        
        if (confirm('Clear all patients from waiting list?')) {
            this.waitingList = [];
            this.saveToStorage();
            this.showNotification('Waiting list cleared', 'info');
        }
    }
    
    sanitizeInput(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showNotification(message, type) {
        // Remove existing notifications
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 
                                type === 'error' ? 'exclamation-circle' : 
                                type === 'warning' ? 'exclamation-triangle' : 
                                'info-circle'}"></i>
            ${message}
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
    
    updateUI() {
        // Update waiting list display
        const waitingListEl = document.getElementById('waiting-list');
        const waitingCount = document.getElementById('waiting-count');
        
        if (this.waitingList.length === 0) {
            waitingListEl.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>No patients waiting</p>
                </div>
            `;
            waitingCount.textContent = '0';
        } else {
            waitingListEl.innerHTML = this.waitingList.map(patient => `
                <div class="queue-item" data-id="${patient.id}">
                    <div class="queue-info">
                        <span class="queue-number">#${patient.queueNumber}</span>
                        <div class="patient-name">${patient.name}</div>
                        <div class="counter-name">${patient.counter} • Added ${patient.addedTime}</div>
                    </div>
                    <div class="queue-actions">
                        <button class="btn call-btn" title="Call Now">
                            <i class="fas fa-bullhorn"></i>
                        </button>
                        <button class="btn remove-btn" title="Remove">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `).join('');
            
            waitingCount.textContent = this.waitingList.length;
            
            // Use event delegation instead of adding listeners to each button
            // Remove existing listeners first to prevent duplicates
            waitingListEl.removeEventListener('click', this.handleWaitingListClick);
            
            // Add new event listener using arrow function to maintain 'this' context
            this.handleWaitingListClick = (e) => {
                const target = e.target;
                
                // Handle remove button clicks
                if (target.closest('.remove-btn')) {
                    const item = target.closest('.queue-item');
                    const id = parseInt(item.dataset.id);
                    this.removePatient(id);
                    this.updateUI();
                }
                
                // Handle call button clicks
                if (target.closest('.call-btn')) {
                    const item = target.closest('.queue-item');
                    const id = parseInt(item.dataset.id);
                    // Move to front of queue
                    const index = this.waitingList.findIndex(p => p.id === id);
                    if (index !== -1) {
                        const [patient] = this.waitingList.splice(index, 1);
                        this.waitingList.unshift(patient);
                        this.updateUI();
                        speechEngine.callPatient(patient.name, patient.counter);
                    }
                }
            };
            
            waitingListEl.addEventListener('click', this.handleWaitingListClick);
        }
        
        // Update currently calling display
        const callingDisplay = document.getElementById('calling-display');
        if (this.currentlyCalling) {
            const callCount = this.currentlyCalling.callCount || 1;
            callingDisplay.innerHTML = `
                <div class="calling-icon">
                    <i class="fas fa-bullhorn"></i>
                </div>
                <div class="calling-name">${this.currentlyCalling.name}</div>
                <div class="calling-counter">${this.currentlyCalling.counter}</div>
                <div class="call-info">
                    <div>Called ${callCount} time${callCount > 1 ? 's' : ''}</div>
                    <div>Last called: ${this.currentlyCalling.lastCalledTime || 'Just now'}</div>
                    ${callCount > 1 ? '<div><i class="fas fa-exclamation-triangle"></i> Patient may need assistance</div>' : ''}
                </div>
                <div class="calling-controls">
                    <button id="recall-patient" class="btn btn-warning">
                        <i class="fas fa-redo"></i> Recall Patient
                    </button>
                    <button id="patient-arrived" class="btn btn-success">
                        <i class="fas fa-check"></i> Patient Arrived
                    </button>
                </div>
            `;
            
            // Remove existing listeners to prevent duplicates
            const recallBtn = document.getElementById('recall-patient');
            const arrivedBtn = document.getElementById('patient-arrived');
            
            if (recallBtn) {
                // Clone and replace to remove all event listeners
                const newRecallBtn = recallBtn.cloneNode(true);
                recallBtn.parentNode.replaceChild(newRecallBtn, recallBtn);
                
                // Add fresh event listener
                newRecallBtn.addEventListener('click', () => {
                    const patient = this.recallPatient();
                    if (patient) {
                        speechEngine.callPatient(patient.name, patient.counter, true);
                        this.updateUI();
                    }
                });
            }
            
            if (arrivedBtn) {
                // Clone and replace to remove all event listeners
                const newArrivedBtn = arrivedBtn.cloneNode(true);
                arrivedBtn.parentNode.replaceChild(newArrivedBtn, arrivedBtn);
                
                // Add fresh event listener
                newArrivedBtn.addEventListener('click', () => {
                    if (this.markPatientArrived()) {
                        this.updateUI();
                    }
                });
            }
        } else {
            callingDisplay.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-clock"></i>
                    <p>No patient being called</p>
                </div>
            `;
        }
        
        // Update statistics
        document.getElementById('total-called').textContent = this.totalCalled;
        document.getElementById('waiting-total').textContent = this.waitingList.length;
        document.getElementById('total-patients').textContent = this.totalPatients;
        document.getElementById('total-recalls').textContent = this.totalRecalls;
    }
}

// ============================================
// SPEECH ENGINE
// ============================================
class SpeechEngine {
    constructor() {
        this.speechSynthesis = window.speechSynthesis;
        this.voices = [];
        this.currentUtterance = null;
        this.selectedVoiceIndex = -1;
        this.volume = 1;
        this.rate = 1;
        
        // Track collapsible state
        this.isAdvancedControlsVisible = false;
        
        this.init();
    }
    
    init() {
        // Load voices
        this.loadVoices();
        
        // Handle voices changed event
        if (this.speechSynthesis) {
            this.speechSynthesis.onvoiceschanged = () => {
                this.loadVoices();
            };
        }
        
        // Set up event listeners
        document.getElementById('test-voice').addEventListener('click', () => {
            this.testVoice();
        });
        
        document.getElementById('stop-voice').addEventListener('click', () => {
            this.stopSpeech();
        });
        
        document.getElementById('voice-select').addEventListener('change', (e) => {
            this.selectedVoiceIndex = parseInt(e.target.value);
        });
        
        // Volume and rate controls
        document.getElementById('volume').addEventListener('input', (e) => {
            this.volume = parseFloat(e.target.value);
        });
        
        document.getElementById('rate').addEventListener('input', (e) => {
            this.rate = parseFloat(e.target.value);
        });
        
        // Toggle advanced controls
        document.getElementById('toggle-voice-controls').addEventListener('click', () => {
            this.toggleAdvancedControls();
        });
    }
    
    loadVoices() {
        if (!this.speechSynthesis) {
            const voiceSelect = document.getElementById('voice-select');
            voiceSelect.innerHTML = '<option value="">Voice not supported</option>';
            voiceSelect.disabled = true;
            return;
        }
        
        this.voices = this.speechSynthesis.getVoices();
        const voiceSelect = document.getElementById('voice-select');
        
        // Clear existing options
        voiceSelect.innerHTML = '';
        
        if (this.voices.length === 0) {
            voiceSelect.innerHTML = '<option value="">No voices available</option>';
            return;
        }
        
        let malayIndex = -1;
        
        // Populate voice options with smart auto-select logic
        this.voices.forEach((v, i) => {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${v.name} (${v.lang})`;
            voiceSelect.appendChild(option);
            
            // Smart auto-select logic (prefer Yasmin or Malay voices)
            if (v.name.includes("Yasmin") || (malayIndex === -1 && v.lang.includes("ms"))) {
                malayIndex = i;
            }
        });
        
        // Auto-select the best voice (Malay if available)
        if (malayIndex !== -1) {
            voiceSelect.value = malayIndex;
            this.selectedVoiceIndex = malayIndex;
        } else if (this.voices.length > 0) {
            // Fallback to first voice
            voiceSelect.value = 0;
            this.selectedVoiceIndex = 0;
        }
    }
    
    toggleAdvancedControls() {
        this.isAdvancedControlsVisible = !this.isAdvancedControlsVisible;
        const controls = document.getElementById('advanced-voice-controls');
        const toggleBtn = document.getElementById('toggle-voice-controls');
        
        if (this.isAdvancedControlsVisible) {
            controls.classList.remove('collapsed');
            controls.classList.add('expanded');
            toggleBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Hide Advanced';
        } else {
            controls.classList.remove('expanded');
            controls.classList.add('collapsed');
            toggleBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Advanced';
        }
    }
    
    playChime() {
        try {
            const chime = document.getElementById('chime-sound');
            chime.currentTime = 0;
            chime.volume = this.volume;
            chime.play().catch(e => {
                console.log('Chime playback failed:', e);
            });
        } catch (e) {
            console.log('Audio not available:', e);
        }
    }
    
    speak(text) {
        if (!this.speechSynthesis) {
            console.warn('Speech synthesis not available');
            return;
        }
        
        this.stopSpeech();
        
        if (this.selectedVoiceIndex < 0 || this.selectedVoiceIndex >= this.voices.length) {
            console.error('Invalid voice selection');
            return;
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set voice using index
        utterance.voice = this.voices[this.selectedVoiceIndex];
        
        // Set speech parameters
        utterance.volume = this.volume;
        utterance.rate = this.rate;
        utterance.pitch = 1;
        
        utterance.onstart = () => {
            document.getElementById('currently-calling').style.animation = 'pulse 1s infinite';
        };
        
        utterance.onend = () => {
            document.getElementById('currently-calling').style.animation = 'pulse 2s infinite';
        };
        
        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            document.getElementById('currently-calling').style.animation = 'pulse 2s infinite';
        };
        
        this.currentUtterance = utterance;
        this.speechSynthesis.speak(utterance);
    }
    
    stopSpeech() {
        if (this.speechSynthesis && this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }
        this.currentUtterance = null;
    }
    
    callPatient(patientName, counterName, isRecall = false) {
        this.playChime();
        
        setTimeout(() => {
            if (!this.speechSynthesis) {
                console.warn('Voice announcement skipped - speech not supported');
                return;
            }
            
            if (isRecall) {
                this.speak(`${patientName}, untuk kali kedua, sila hadir ke ${counterName}.`);
            } else {
                this.speak(`${patientName}, sila hadir ke ${counterName}.`);
            }
        }, 500);
    }
    
    testVoice() {
        this.playChime();
        setTimeout(() => {
            if (!this.speechSynthesis) {
                alert('Voice synthesis is not supported in your browser.');
                return;
            }
            this.speak("Ini adalah percubaan suara. Cubaan satu, dua, tiga .");
        }, 500);
    }
}

// ============================================
// APPLICATION INITIALIZATION
// ============================================

// Initialize components
const queueManager = new QueueManager();
const speechEngine = new SpeechEngine();

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Check browser compatibility
    checkBrowserCompatibility();
    
    // Initialize UI
    queueManager.updateUI();
    
    // Add patient button
    document.getElementById('add-patient').addEventListener('click', () => {
        const name = document.getElementById('patient-name').value;
        const counter = document.getElementById('counter-name').value;
        
        if (queueManager.addPatient(name, counter)) {
            document.getElementById('patient-name').value = '';
            document.getElementById('counter-name').value = '';
            document.getElementById('patient-name').focus();
            queueManager.updateUI();
        }
    });
    
    // Call next patient button
    document.getElementById('call-next').addEventListener('click', () => {
        const patient = queueManager.callNextPatient();
        if (patient) {
            speechEngine.callPatient(patient.name, patient.counter);
            queueManager.updateUI();
        }
    });
    
    // Clear all button
    document.getElementById('clear-all').addEventListener('click', () => {
        queueManager.clearAll();
        queueManager.updateUI();
    });
    
    // Enter key support
    document.getElementById('patient-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('counter-name').focus();
        }
    });
    
    document.getElementById('counter-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('add-patient').click();
        }
    });
    
    // Service Worker registration for PWA (optional)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
        });
    }
});

// Global functions for button event handlers
function callNextPatient() {
    const patient = queueManager.callNextPatient();
    if (patient) {
        speechEngine.callPatient(patient.name, patient.counter);
        queueManager.updateUI();
    }
}

function recallPatient() {
    const patient = queueManager.recallPatient();
    if (patient) {
        speechEngine.callPatient(patient.name, patient.counter, true);
        queueManager.updateUI();
    }
}

function markPatientArrived() {
    if (queueManager.markPatientArrived()) {
        queueManager.updateUI();
    }
}

function testAnnouncement() {
    speechEngine.testVoice();
}

function stopAnnouncement() {
    speechEngine.stopSpeech();
}