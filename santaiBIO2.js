// --- CONFIG ---
const USER_ID = '1147180876183121972'; 

// --- DOM ELEMENTS ---
const avatarEl = document.getElementById('user-avatar');
const statusEl = document.getElementById('user-status');
const bioEl = document.getElementById('custom-status');
const activityNameEl = document.getElementById('activity-name');
const activityDetailsEl = document.getElementById('activity-details');
const activityImgEl = document.getElementById('activity-img');
const activityDefaultIcon = document.getElementById('activity-default-icon');
const activityTimerEl = document.getElementById('activity-timer');
const activityTimeWrapper = document.getElementById('activity-time-wrapper');
const liveDot = document.getElementById('live-dot');
const spotifyTrackEl = document.getElementById('spotify-track');
const spotifyArtistEl = document.getElementById('spotify-artist');
const spotifyArtEl = document.getElementById('spotify-art');
const spotifyProgressEl = document.getElementById('spotify-progress');
const timeCurrentEl = document.getElementById('time-current');
const timeTotalEl = document.getElementById('time-total');

let socket;
let heartbeatInterval;
let timerInterval;
let spotifyUpdateInterval;

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
}

function connectLanyard() {
    socket = new WebSocket('wss://api.lanyard.rest/socket');

    socket.onopen = () => {
        console.log('Lanyard: Connected');
        liveDot.style.display = 'block';
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Отображение сырых данных для отладки
        const rawPre = document.getElementById('raw-presence');
        if (rawPre) rawPre.textContent = JSON.stringify(data, null, 2);

        if (data.op === 1) { 
            heartbeatInterval = setInterval(() => {
                socket.send(JSON.stringify({ op: 3 }));
            }, data.d.heartbeat_interval);
            
            socket.send(JSON.stringify({
                op: 2,
                d: { subscribe_to_id: USER_ID }
            }));
        } else if (data.t === 'INIT_STATE' || data.t === 'PRESENCE_UPDATE') {
            updateUI(data.d);
        }
    };

    socket.onclose = () => {
        clearInterval(heartbeatInterval);
        setTimeout(connectLanyard, 3000);
    };
}

function updateUI(d) {
    if (!d) return;

    // 1. Аватар и статус
    if (d.discord_user) {
        avatarEl.src = `https://cdn.discordapp.com/avatars/${USER_ID}/${d.discord_user.avatar}.png?size=256`;
    }
    statusEl.style.backgroundColor = `var(--${d.discord_status || 'offline'})`;

    // 2. Поиск активностей (Игнорируем Spotify и кастомный статус)
    const activities = d.activities || [];
    
    // Кастомный статус (текст под ником)
    const custom = activities.find(a => a.type === 4);
    bioEl.innerText = custom ? (custom.state || "Fullstack Develop") : "Frontend Developer";

    // Основная активность (Игра, VS Code и т.д.)
    const activity = activities.find(a => a.type !== 4 && a.id !== 'spotify:1');

    if (timerInterval) clearInterval(timerInterval);

    if (activity) {
        activityNameEl.innerText = activity.name;
        activityDetailsEl.innerText = activity.details || activity.state || "Играет";
        
        // Обработка изображения
        if (activity.assets && activity.assets.large_image) {
            let imgUrl = activity.assets.large_image;
            if (imgUrl.startsWith('mp:')) {
                imgUrl = `https://media.discordapp.net/${imgUrl.replace('mp:', '')}`;
            } else if (imgUrl.startsWith('external:')) {
                // Обработка внешних ссылок (например, из некоторых приложений)
                imgUrl = `https://media.discordapp.net/external/${imgUrl.split('external:')[1]}`;
            } else {
                imgUrl = `https://cdn.discordapp.com/app-assets/${activity.application_id}/${activity.assets.large_image}.png`;
            }
            activityImgEl.src = imgUrl;
            activityImgEl.style.display = 'block';
            activityDefaultIcon.style.display = 'none';
        } else {
            activityImgEl.style.display = 'none';
            activityDefaultIcon.style.display = 'block';
        }

        // Таймер
        if (activity.timestamps && activity.timestamps.start) {
            activityTimeWrapper.style.display = 'block';
            const start = activity.timestamps.start;
            const tick = () => {
                const now = Date.now();
                const diff = now - start;
                const h = Math.floor(diff / 3600000);
                const m = Math.floor((diff % 3600000) / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                activityTimerEl.innerText = `${h > 0 ? h + ':' : ''}${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}  `;
            };
            tick();
            timerInterval = setInterval(tick, 1000);
        } else {
            activityTimeWrapper.style.display = 'none';
        }
    } else {
        activityNameEl.innerText = "Нет активностей...";
        activityDetailsEl.innerText = "Спит или отдыхает";
        activityImgEl.style.display = 'none';
        activityDefaultIcon.style.display = 'block';
        activityTimeWrapper.style.display = 'none';
    }

    // 3. Spotify
    if (d.listening_to_spotify && d.spotify) {
        spotifyTrackEl.innerText = d.spotify.song;
        spotifyArtistEl.innerText = d.spotify.artist;
        spotifyArtEl.src = d.spotify.album_art_url;
        spotifyArtEl.classList.remove('gray');
        
        const total = d.spotify.timestamps.end - d.spotify.timestamps.start;
        timeTotalEl.innerText = formatTime(total);
        
        // Очистить предыдущий интервал
        if (spotifyUpdateInterval) clearInterval(spotifyUpdateInterval);
        
        // Обновлять ползунок каждые 50ms
        const progressTick = () => {
            const current = Date.now() - d.spotify.timestamps.start;
            const percent = Math.min((current / total) * 100, 100);
            spotifyProgressEl.style.width = percent + '%';
            timeCurrentEl.innerText = formatTime(current);
        };
        progressTick();
        spotifyUpdateInterval = setInterval(progressTick, 50);
    } else {
        spotifyTrackEl.innerText = "Ничего не слушает...";
        spotifyArtistEl.innerText = "Spotify";
        spotifyArtEl.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/2048px-Spotify_logo_without_text.svg.png";
        spotifyArtEl.classList.add('gray');
        spotifyProgressEl.style.width = '0%';
        timeCurrentEl.innerText = '0:00';
        timeTotalEl.innerText = '0:00';
        if (spotifyUpdateInterval) clearInterval(spotifyUpdateInterval);
    }
}

// Запуск частиц 
const canvas = document.getElementById('particles-js');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let particlesArray = [];
class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2;
        this.speedX = (Math.random() * 0.5) - 0.25;
        this.speedY = (Math.random() * 0.5) - 0.25;
        this.color = Math.random() > 0.5 ? '#a855f7' : '#3b82f6';
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x > canvas.width || this.x < 0) this.speedX = -this.speedX;
        if (this.y > canvas.height || this.y < 0) this.speedY = -this.speedY;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}
function initParticles() {
    particlesArray = [];
    for (let i = 0; i < 40; i++) particlesArray.push(new Particle());
}
function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particlesArray.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animateParticles);
}
initParticles();
animateParticles();
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; initParticles(); });

connectLanyard();