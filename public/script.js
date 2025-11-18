// ===== GALAXY STAR BACKGROUND =====
const canvas = document.createElement('canvas');
canvas.id = 'stars';
document.body.prepend(canvas);
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let stars = [];
const numStars = 300;

for (let i = 0; i < numStars; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: Math.random() * 1.5,
    speed: Math.random() * 0.5 + 0.2
  });
}

function drawStars() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#00ffc8'; // Neon green stars
  for (let star of stars) {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  updateStars();
}

function updateStars() {
  for (let star of stars) {
    star.y += star.speed;
    if (star.y > canvas.height) {
      star.y = 0;
      star.x = Math.random() * canvas.width;
    }
  }
}

function animateStars() {
  drawStars();
  requestAnimationFrame(animateStars);
}

animateStars();

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

// ===== TEXT EDITOR + LOCK/SHARE + LOADING BAR LOGIC =====
document.addEventListener('DOMContentLoaded', () => {
    const pastebox = document.getElementById('pastebox');
    const rawBtn = document.getElementById('rawBtn');
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const linkBtn = document.getElementById('linkBtn');
    const lockBtn = document.getElementById('lockBtn');
    const usageBtn = document.getElementById('usageBtn'); // (১ নম্বর থেকে)

    const message = document.getElementById('message');

    // Loading bar elements
    const loadingContainer = document.querySelector('.loading-container');
    const loadingBar = document.querySelector('.loading-bar');

    let textId = null;
    const baseLink = window.location.origin;
    let isLocked = false;

    // ===== LOCK BUTTON =====
    lockBtn.addEventListener('click', async () => {
        const password = prompt("Enter a password to lock:");
        if (!password) return;
        try {
            const response = await fetch(`/api/lock/${textId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (response.ok) {
                pastebox.readOnly = true;
                isLocked = true;
                alert('Text is now locked! Password required to edit.');
            }
        } catch (e) {
            console.error('Lock error:', e);
        }
    });

    // ===== USAGE BUTTON (from ১ নম্বর কোড) =====
    usageBtn.addEventListener('click', ()=>{
        openUsagePage();
    });

    function openUsagePage(){
        const usageDiv = document.createElement('div');
        usageDiv.id='usagePage';
        usageDiv.style.display='flex';
        usageDiv.innerHTML=`
            <h1 class="usage-title">Muzan Text Pro</h1>
            <div class="progress-bar">
                <div class="progress"></div>
            </div>
        `;
        document.body.appendChild(usageDiv);

        setTimeout(()=>{
            window.location.href = 'usage.html'; // নতুন page
        }, 3000);
    }

    // ===== CHECK URL =====
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length > 2 && pathParts[1] === 'link') {
        textId = pathParts[2];
        loadText(textId);
        startAutoUpdate(textId);
    }

    // ===== LOAD TEXT =====
    async function loadText(id) {
        try {
            const response = await fetch(`/api/text/${id}`);
            if (!response.ok) {
                if (response.status === 404) {
                    message.textContent = 'Text not found or expired.';
                    pastebox.disabled = true;
                    return;
                }
                throw new Error('Failed to fetch text');
            }
            const data = await response.json();
            pastebox.value = data.text;
            pastebox.focus();
            pastebox.setSelectionRange(pastebox.value.length, pastebox.value.length);
        } catch (error) {
            console.error('Error loading text:', error);
            message.textContent = 'Error loading text.';
        }
    }

    // ===== UPDATE TEXT =====
    async function updateText(id, text) {
        if (!text) return;
        try {
            await fetch(`/api/text/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
        } catch (error) {
            console.error('Error updating text:', error);
        }
    }

    // ===== AUTO UPDATE =====
    function startAutoUpdate(id) {
        let timeout = null;
        pastebox.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                updateText(id, pastebox.value);
            }, 1000);
        });
    }

    // ===== CREATE NEW TEXT =====
    async function createNewText() {
        const text = pastebox.value;
        if (!text) {
            message.textContent = 'Please enter some text first.';
            setTimeout(() => { message.textContent = ''; }, 3000);
            return null;
        }
        try {
            const response = await fetch('/api/text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await response.json();
            window.history.pushState({}, '', `/link/${data.rawId}`);
            message.textContent = `New link created! Expires in 20 mins.`;
            startAutoUpdate(data.rawId);
            return data.rawId;
        } catch (error) {
            console.error('Error creating new text:', error);
            message.textContent = 'Error creating new text.';
            return null;
        }
    }

    // ===== LOADING FUNCTION =====
    function runLoading(callback){
        if(!loadingContainer || !loadingBar) return callback();
        loadingContainer.style.display = 'block';
        loadingBar.style.width = '0%';
        void loadingBar.offsetWidth; // reset
        loadingBar.style.width = '100%';
        setTimeout(()=>{
            loadingContainer.style.display = 'none';
            callback();
        }, 3000);
    }

    // ===== BUTTON EVENTS =====
    rawBtn.addEventListener('click', async () => {
        if(!textId) textId = await createNewText();
        if(textId){
            runLoading(()=> {
                window.location.href = `${baseLink}/api/text/${textId}`;
            });
        }
    });

    linkBtn.addEventListener('click', async () => {
        if(!textId) textId = await createNewText();
        if(textId){
            runLoading(()=> {
                const shareLink = `${baseLink}/link/${textId}`;
                navigator.clipboard.writeText(shareLink);
                message.textContent = 'Share link copied!';
                setTimeout(()=>{ message.textContent=''; },3000);
            });
        }
    });

    copyBtn.addEventListener('click', () => {
        runLoading(()=> {
            pastebox.select();
            document.execCommand('copy');
            message.textContent = 'Text copied!';
            setTimeout(()=>{ message.textContent=''; },3000);
        });
    });

    downloadBtn.addEventListener('click', async () => {
        if(!textId) textId = await createNewText();
        if(textId){
            runLoading(()=> {
                window.location.href = `${baseLink}/api/download/${textId}`;
            });
        }
    });

});
