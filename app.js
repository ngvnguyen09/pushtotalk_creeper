const micBtn = document.getElementById('micBtn');
const pulseRing = document.getElementById('pulseRing');
const statusText = document.getElementById('micStatusText');
const transcriptionContainer = document.getElementById('transcriptionContainer');
const transcriptionText = document.getElementById('transcriptionText');

// Queue Elements
const queueStatusCard = document.getElementById('queueStatusCard');
const stepProcessing = document.getElementById('stepProcessing');
const stepAnswering = document.getElementById('stepAnswering');
const stepAnswered = document.getElementById('stepAnswered');
const queueBadge = document.getElementById('queueBadge');
const queueInfo = document.getElementById('queueInfo');
const queuePosition = document.getElementById('queuePosition');

// Settings Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const apiUrlInput = document.getElementById('apiUrlInput');
const saveApiBtn = document.getElementById('saveApiBtn');
const closeApiBtn = document.getElementById('closeApiBtn');

let API_BASE_URL = localStorage.getItem('CREEPIE_API_URL') || 'http://localhost:8000';
apiUrlInput.value = API_BASE_URL;

let isRecording = false;
let recognition = null;
let currentTaskId = null;
let pollInterval = null;

// Initialize Speech Recognition
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
        isRecording = true;
        micBtn.classList.add('recording');
        pulseRing.classList.add('active');
        statusText.textContent = "Đang nghe...";
        transcriptionContainer.style.display = 'block';
        transcriptionText.textContent = "...";
        
        // Hide queue status from previous run
        queueStatusCard.style.display = 'none';
        clearInterval(pollInterval);
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        
        transcriptionText.innerHTML = finalTranscript + '<i style="color:#a0aabf">' + interimTranscript + '</i>';
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        statusText.textContent = "Lỗi mic: " + event.error;
        resetMicUi();
    };

    recognition.onend = () => {
        resetMicUi();
        const text = transcriptionText.textContent.trim();
        if (text && text !== "..." && text !== "") {
            statusText.textContent = "Đang gửi câu hỏi...";
            sendQuestionToApi(text);
        } else {
            statusText.textContent = "Nhấn để bắt đầu nói";
        }
    };
} else {
    statusText.textContent = "Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.";
    micBtn.disabled = true;
}

function resetMicUi() {
    isRecording = false;
    micBtn.classList.remove('recording');
    pulseRing.classList.remove('active');
}

micBtn.addEventListener('click', () => {
    if (!recognition) return;
    
    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
});

// API Integration
async function sendQuestionToApi(text) {
    try {
        const response = await fetch(`${API_BASE_URL}/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        });
        
        if (!response.ok) throw new Error("Network response was not ok");
        
        const data = await response.json();
        currentTaskId = data.task_id;
        
        statusText.textContent = "Đã gửi! Vui lòng chờ...";
        showQueueCard();
        
        // Start polling
        pollInterval = setInterval(pollStatus, 2000);
        
    } catch (err) {
        console.error(err);
        statusText.textContent = "Lỗi kết nối đến Bot API.";
    }
}

function showQueueCard() {
    queueStatusCard.style.display = 'block';
    
    // Reset steps
    stepProcessing.classList.add('active');
    stepProcessing.classList.remove('completed');
    
    stepAnswering.classList.remove('active', 'completed');
    stepAnswered.classList.remove('active', 'completed');
    
    queueBadge.textContent = "Đang chờ";
    queueBadge.className = "badge processing";
    queueInfo.style.display = 'none';
}

async function pollStatus() {
    if (!currentTaskId) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/status/${currentTaskId}`);
        if (!response.ok) return;
        
        const data = await response.json();
        
        if (data.status === 'processing') {
            queueBadge.textContent = "Đang chờ tới lượt";
            queueBadge.className = "badge processing";
            if (data.queue_position > 0) {
                queueInfo.style.display = 'block';
                queuePosition.textContent = Math.max(1, data.queue_position);
            }
        } 
        else if (data.status === 'answering') {
            queueBadge.textContent = "Bot đang trả lời...";
            queueBadge.className = "badge answering";
            queueInfo.style.display = 'none';
            
            stepProcessing.classList.add('completed');
            stepAnswering.classList.add('active');
        } 
        else if (data.status === 'answered') {
            queueBadge.textContent = "Hoàn tất";
            queueBadge.className = "badge answered";
            queueInfo.style.display = 'none';
            
            stepProcessing.classList.add('completed');
            stepAnswering.classList.add('completed');
            stepAnswered.classList.add('active', 'completed');
            
            statusText.textContent = "Nhấn để hỏi câu khác";
            clearInterval(pollInterval); // Stop polling
        }
        
    } catch (err) {
        console.error("Polling error", err);
    }
}

// Settings Modal
settingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
});

closeApiBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

saveApiBtn.addEventListener('click', () => {
    let url = apiUrlInput.value.trim();
    if(url.endsWith('/')) url = url.slice(0, -1);
    API_BASE_URL = url;
    localStorage.setItem('CREEPIE_API_URL', API_BASE_URL);
    settingsModal.style.display = 'none';
    alert("Đã lưu API URL: " + API_BASE_URL);
});
