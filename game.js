// --- Globális Változók és Beállítások ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elemek
const menuUI = document.getElementById('menuUI');
const gameUI = document.getElementById('gameUI');
const startButton = document.getElementById('startButton');
const betInput = document.getElementById('betInput');
const multiplierInput = document.getElementById('multiplierInput');
const difficultySelect = document.getElementById('difficultySelect');

const kasszaDisplay = document.getElementById('kasszaDisplay');
const gameMessage = document.getElementById('gameMessage');
const gameKassza = document.getElementById('gameKassza');
const gameBet = document.getElementById('gameBet');
const gameScore = document.getElementById('gameScore');

// Rács Beállítások
const TILE_SIZE = 60;
const GRID_WIDTH = canvas.width / TILE_SIZE;
const GRID_HEIGHT = canvas.height / TILE_SIZE;
const TARGET_LANES = 20; // A CÉL!

const VEHICLE_WIDTH = TILE_SIZE * 1.8;
const VEHICLE_HEIGHT = TILE_SIZE * 0.8;
const LOG_WIDTH = TILE_SIZE * 2.5;
const LOG_HEIGHT = TILE_SIZE * 0.8;

// Játék Állapot (Game State)
let gameState = 'MENU'; // 'MENU', 'PLAYING'
let kassza = 10000;
let currentBet = 0;
let currentMultiplier = 1;
let currentDifficulty = 1;
let score = 0;

let player;
let lanes = []; // A sávokat tároló tömb
let cameraY = 0; // Mennyit "görgött" a pálya
let nextLaneY = (GRID_HEIGHT - 2) * TILE_SIZE; // Honnan generáljuk a következő sávot


// --- Osztályok (Player, Lane, Vehicle, stb.) ---

class Player {
    constructor(x, y) {
        this.gridX = x;
        this.gridY = y; // Rács-koordináták
        this.pixelX = this.gridX * TILE_SIZE;
        this.pixelY = this.gridY * TILE_SIZE;
        this.onLog = false; // Rönkön áll?
    }

    draw() {
        ctx.fillStyle = '#00e676'; // Zöld játékos
        // A pozíciót a kamera pozíciójával eltolva rajzoljuk ki
        ctx.fillRect(this.pixelX, this.pixelY - cameraY, TILE_SIZE, TILE_SIZE);
    }

    move(dx, dy) {
        if (gameState !== 'PLAYING') return;

        const newGridX = this.gridX + dx;
        const newGridY = this.gridY + dy;

        // Pálya határainak ellenőrzése (oldalt)
        if (newGridX >= 0 && newGridX < GRID_WIDTH) {
            this.gridX = newGridX;
            this.pixelX = this.gridX * TILE_SIZE;
        }

        // Felfelé / Lefelé mozgás
        if (dy !== 0) {
            this.gridY = newGridY;
            this.pixelY = this.gridY * TILE_SIZE;

            // Ha előre léptünk
            if (dy === -1) {
                score++;
                gameScore.textContent = score;

                // Kamera követése: ha a játékos a képernyő felső felébe ér
                if (this.pixelY - cameraY < canvas.height / 2) {
                    cameraY -= TILE_SIZE; // A kamera "feljebb" mozog (értéke csökken)
                }

                // CÉL ELLENŐRZÉSE
                if (score >= TARGET_LANES) {
                    winGame();
                }
            }
        }
    }

    reset() {
        this.gridX = Math.floor(GRID_WIDTH / 2);
        this.gridY = GRID_HEIGHT - 1;
        this.pixelX = this.gridX * TILE_SIZE;
        this.pixelY = (GRID_HEIGHT - 1) * TILE_SIZE;
        score = 0;
        cameraY = 0;
        nextLaneY = (GRID_HEIGHT - 2) * TILE_SIZE;
        gameScore.textContent = '0';
    }
}

// A Sávok Ős-osztálya
class Lane {
    constructor(y, type) {
        this.y = y; // Pixel pozíció
        this.type = type;
    }
    update() {}
    draw() {}
}

// Biztonságos Sáv (Fű)
class SafeLane extends Lane {
    constructor(y) {
        super(y, 'SAFE');
    }
    draw() {
        ctx.fillStyle = '#4caf50'; // Zöld
        ctx.fillRect(0, this.y - cameraY, canvas.width, TILE_SIZE);
    }
}

// Út Sáv (Autók)
class RoadLane extends Lane {
    constructor(y, difficulty) {
        super(y, 'ROAD');
        this.vehicles = [];
        this.direction = Math.random() < 0.5 ? 1 : -1;

        // NEHÉZSÉG ALAPJÁN BEÁLLÍTÁS
        // [minSpeed, maxSpeed, minGap, maxGap, minCluster, maxCluster]
        const diffSettings = {
            1: [1.0, 1.8, 180, 250, 1, 2], // Könnyű
            2: [1.5, 2.5, 120, 200, 2, 3], // Közepes
            3: [2.2, 3.5, 100, 150, 2, 4], // Nehéz
            4: [3.0, 5.0, 80, 120, 3, 5]  // Rémálom
        };
        const s = diffSettings[difficulty];

        this.speed = Math.random() * (s[1] - s[0]) + s[0];
        this.spawnTimerMax = [s[2], s[3]]; // [min, max] frame
        this.clusterSize = [s[4], s[5]]; // [min, max] autó
        
        this.spawnTimer = this.rand(this.spawnTimerMax[0], this.spawnTimerMax[1]);
    }

    rand(min, max) { return Math.random() * (max - min) + min; }

    update() {
        this.vehicles.forEach(v => v.update());
        this.vehicles = this.vehicles.filter(v => v.x < canvas.width + 100 && v.x > -VEHICLE_WIDTH - 100);

        this.spawnTimer--;
        if (this.spawnTimer <= 0) {
            this.spawnCluster();
            this.spawnTimer = this.rand(this.spawnTimerMax[0], this.spawnTimerMax[1]);
        }
    }

    spawnCluster() {
        const clusterSize = Math.floor(this.rand(this.clusterSize[0], this.clusterSize[1]));
        const startX = (this.direction === 1) ? -VEHICLE_WIDTH - 50 : canvas.width + 50;
        const spacing = this.rand(TILE_SIZE * 1.5, TILE_SIZE * 2.5);
        const vehicleY = this.y + (TILE_SIZE - VEHICLE_HEIGHT) / 2;

        for (let i = 0; i < clusterSize; i++) {
            let vehicleX = startX - (i * (VEHICLE_WIDTH + spacing) * this.direction);
            this.vehicles.push(new Vehicle(vehicleX, vehicleY, this.speed, this.direction));
        }
    }

    draw() {
        ctx.fillStyle = '#424242'; // Sötétszürke út
        ctx.fillRect(0, this.y - cameraY, canvas.width, TILE_SIZE);
        this.vehicles.forEach(v => v.draw(cameraY));
    }
}

// Folyó Sáv (Rönkök)
class RiverLane extends Lane {
    constructor(y, difficulty) {
        super(y, 'RIVER');
        this.logs = []; // Rönkök
        this.direction = Math.random() < 0.5 ? 1 : -1;
        
        const diffSettings = {
            1: [0.8, 1.2, 150, 200, 2, 3], // Könnyű: lassú, nagy rések
            2: [1.0, 1.8, 120, 180, 2, 3], // Közepes
            3: [1.5, 2.2, 100, 150, 1, 2], // Nehéz: gyorsabb, kevesebb rönk
            4: [2.0, 3.0, 80, 120, 1, 2]  // Rémálom: gyors, nagy rések
        };
        const s = diffSettings[difficulty];

        this.speed = Math.random() * (s[1] - s[0]) + s[0];
        this.spawnTimerMax = [s[2], s[3]];
        this.clusterSize = [s[4], s[5]];
        this.spawnTimer = this.rand(this.spawnTimerMax[0], this.spawnTimerMax[1]);
    }
    
    rand(min, max) { return Math.random() * (max - min) + min; }

    update() {
        this.logs.forEach(log => log.update());
        this.logs = this.logs.filter(log => log.x < canvas.width + 100 && log.x > -LOG_WIDTH - 100);

        this.spawnTimer--;
        if (this.spawnTimer <= 0) {
            this.spawnCluster();
            this.spawnTimer = this.rand(this.spawnTimerMax[0], this.spawnTimerMax[1]);
        }
    }

    spawnCluster() {
        const clusterSize = Math.floor(this.rand(this.clusterSize[0], this.clusterSize[1]));
        const startX = (this.direction === 1) ? -LOG_WIDTH - 50 : canvas.width + 50;
        const spacing = this.rand(TILE_SIZE * 2, TILE_SIZE * 3.5);
        const logY = this.y + (TILE_SIZE - LOG_HEIGHT) / 2;

        for (let i = 0; i < clusterSize; i++) {
            let logX = startX - (i * (LOG_WIDTH + spacing) * this.direction);
            this.logs.push(new Log(logX, logY, this.speed, this.direction));
        }
    }

    draw() {
        ctx.fillStyle = '#1e88e5'; // Kék víz
        ctx.fillRect(0, this.y - cameraY, canvas.width, TILE_SIZE);
        this.logs.forEach(log => log.draw(cameraY));
    }
}


class Vehicle {
    constructor(x, y, speed, direction) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.direction = direction;
    }
    update() { this.x += this.speed * this.direction; }
    draw(cameraY) {
        ctx.fillStyle = '#e53935'; // Piros autó
        ctx.fillRect(this.x, this.y - cameraY, VEHICLE_WIDTH, VEHICLE_HEIGHT);
    }
}

class Log {
    constructor(x, y, speed, direction) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.direction = direction;
    }
    update() { this.x += this.speed * this.direction; }
    draw(cameraY) {
        ctx.fillStyle = '#795548'; // Barna rönk
        ctx.fillRect(this.x, this.y - cameraY, LOG_WIDTH, LOG_HEIGHT);
    }
}


// --- Játék Logika (Állapotok, Ciklus) ---

function init() {
    player = new Player(Math.floor(GRID_WIDTH / 2), GRID_HEIGHT - 1);
    updateKasszaUI();

    // Eseménykezelők a Menü UI-hoz
    startButton.addEventListener('click', startGame);
    betInput.addEventListener('input', updateStartButton);
    // PWA regisztráció
    registerServiceWorker();

    // A fő ciklus elindítása
    gameLoop();
}

function updateStartButton() {
    const bet = parseInt(betInput.value) || 0;
    startButton.textContent = `Kihívás Indítása (Tét: ${bet})`;
}

function updateKasszaUI() {
    kasszaDisplay.textContent = kassza;
}

function startGame() {
    // 1. Értékek beolvasása
    const bet = parseInt(betInput.value) || 0;
    const multiplier = parseInt(multiplierInput.value);
    const difficulty = parseInt(difficultySelect.value);

    // 2. Validálás
    if (bet <= 0) {
        gameMessage.textContent = "A tétnek nullánál nagyobbnak kell lennie!";
        gameMessage.style.color = '#e53935';
        return;
    }
    if (bet > kassza) {
        gameMessage.textContent = "Nincs elég Aranytojásod erre a tétre!";
        gameMessage.style.color = '#e53935';
        return;
    }

    // 3. Játék állapot beállítása
    kassza -= bet;
    currentBet = bet;
    currentMultiplier = multiplier;
    currentDifficulty = difficulty;
    gameState = 'PLAYING';

    // 4. UI váltás
    menuUI.classList.add('hidden');
    gameUI.classList.remove('hidden');
    gameKassza.textContent = kassza;
    gameBet.textContent = `${currentBet} x ${currentMultiplier}`;

    // 5. Játék nullázása és pálya generálása
    player.reset();
    generateInitialLanes();
}

function generateInitialLanes() {
    lanes = [];
    // Kezdő biztonságos sávok
    for (let i = 0; i < GRID_HEIGHT; i++) {
        lanes.push(new SafeLane(i * TILE_SIZE));
    }
    // Az első "valódi" sáv a 8. indexen (alulról a 3.)
    nextLaneY = (GRID_HEIGHT - 2) * TILE_SIZE; 
    
    // Generálunk pár sávot előre
    for(let i = 0; i < 5; i++) {
        generateNextLane();
    }
}

// Új sáv generálása a pálya tetejére
function generateNextLane() {
    let laneType;
    const r = Math.random();
    
    // Nehézségtől függő sávtípus
    const safeChance = 0.5 / currentDifficulty; // Minél nehezebb, annál kevesebb fű

    if (r < safeChance) {
        laneType = new SafeLane(nextLaneY);
    } else if (r < safeChance + (1 - safeChance) / 2) {
        laneType = new RoadLane(nextLaneY, currentDifficulty);
    } else {
        laneType = new RiverLane(nextLaneY, currentDifficulty);
    }
    
    lanes.push(laneType);
    nextLaneY -= TILE_SIZE; // A következő sáv eggyel feljebb jön
}

function endGame(isWin) {
    gameState = 'MENU';
    
    // 1. UI Visszaváltás
    gameUI.classList.add('hidden');
    menuUI.classList.remove('hidden');

    // 2. Kassza frissítése és üzenet
    if (isWin) {
        const winnings = currentBet * currentMultiplier;
        kassza += winnings;
        gameMessage.textContent = `KIHÍVÁS TELJESÍTVE! Nyertél ${winnings} Aranytojást!`;
        gameMessage.style.color = '#00e676'; // Zöld
    } else {
        // A tétet már az elején levontuk
        gameMessage.textContent = `Játék Vége! Elvesztetted a tétet: ${currentBet} Aranytojás.`;
        gameMessage.style.color = '#e53935'; // Piros
    }
    
    // 3. UI frissítése
    updateKasszaUI();
    betInput.value = Math.min(currentBet, kassza); // Tétet beállítjuk az előzőre (ha van rá pénz)
    updateStartButton();
}

function winGame() {
    endGame(true);
}

function loseGame() {
    endGame(false);
}

// --- Ütközésvizsgálat ---
function checkCollision() {
    if (gameState !== 'PLAYING') return;

    // A játékos rács-pozíciója
    const playerGridY = Math.round(player.pixelY / TILE_SIZE);
    
    // A játékos pixel-pozíciója (téglalapja)
    const playerRect = {
        x: player.pixelX,
        y: player.pixelY,
        width: TILE_SIZE,
        height: TILE_SIZE
    };
    
    player.onLog = false; // Alapból nincs rönkön
    
    let collided = false;

    // Sáv keresése a játékos pozícióján
    const currentLane = lanes.find(lane => lane.y === playerGridY * TILE_SIZE);

    if (currentLane) {
        if (currentLane.type === 'ROAD') {
            // AUTÓ ÜTKÖZÉS
            for (const vehicle of currentLane.vehicles) {
                const vehicleRect = { x: vehicle.x, y: vehicle.y, width: VEHICLE_WIDTH, height: VEHICLE_HEIGHT };
                if (isRectOverlap(playerRect, vehicleRect)) {
                    collided = true;
                    break;
                }
            }
        } else if (currentLane.type === 'RIVER') {
            // FOLYÓ ÜTKÖZÉS (VÍZBE ESETT?)
            let onLog = false;
            for (const log of currentLane.logs) {
                const logRect = { x: log.x, y: log.y, width: LOG_WIDTH, height: LOG_HEIGHT };
                if (isRectOverlap(playerRect, logRect)) {
                    onLog = true;
                    player.onLog = true;
                    // Játékos mozgatása a rönkkel
                    player.pixelX += log.speed * log.direction;
                    player.gridX = Math.round(player.pixelX / TILE_SIZE);
                    // Pálya szélén leesés
                    if (player.pixelX < -TILE_SIZE || player.pixelX > canvas.width) {
                        collided = true;
                    }
                    break;
                }
            }
            if (!onLog) {
                collided = true; // Vízbe esett
            }
        }
    }
    
    if (collided) {
        loseGame();
    }
}

// Segédfüggvény téglalap-ütközéshez
function isRectOverlap(rect1, rect2) {
    // Igazítjuk a játékos téglalapját (kisebb hitbox)
    const margin = TILE_SIZE * 0.1; 
    return (
        rect1.x + margin < rect2.x + rect2.width &&
        rect1.x + rect1.width - margin > rect2.x &&
        rect1.y + margin < rect2.y + rect2.height &&
        rect1.y + rect1.height - margin > rect2.y
    );
}

// --- Fő Játék Ciklus (Game Loop) ---
function gameLoop() {
    // 1. Állapot ellenőrzése
    if (gameState === 'PLAYING') {
        
        // 2. Frissítés (Update)
        lanes.forEach(lane => lane.update());
        
        // Sáv generálás, ha kell
        while (nextLaneY > cameraY - TILE_SIZE * 2) {
            generateNextLane();
        }
        
        // Sávok törlése, ha már messze vannak
        lanes = lanes.filter(lane => lane.y < cameraY + canvas.height + TILE_SIZE * 2);

        // 3. Törlés (Háttér)
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 4. Rajzolás (Draw)
        // Először a sávokat (és autókat/rönköket)
        lanes.forEach(lane => lane.draw(cameraY));
        
        // Végül a játékost
        player.draw(cameraY);

        // 5. Ütközés
        checkCollision();
    }
    
    // 6. Következő képkocka kérése
    requestAnimationFrame(gameLoop);
}

// --- Irányítás (Billentyűzet + Érintés) ---

function handleInput(e) {
    if (gameState !== 'PLAYING') return;

    switch (e.key) {
        case 'ArrowUp': player.move(0, -1); break;
        case 'ArrowDown': player.move(0, 1); break;
        case 'ArrowLeft': player.move(-1, 0); break;
        case 'ArrowRight': player.move(1, 0); break;
    }
}

// Érintéses irányítás
let touchStartX = 0, touchStartY = 0;
const minSwipeDistance = 30;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    handleSwipe(touchEndX - touchStartX, touchEndY - touchStartY);
}, { passive: false });

function handleSwipe(diffX, diffY) {
    if (gameState !== 'PLAYING') return;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        // Vízszintes
        if (Math.abs(diffX) > minSwipeDistance) {
            player.move(diffX > 0 ? 1 : -1, 0);
        }
    } else {
        // Függőleges
        if (Math.abs(diffY) > minSwipeDistance) {
            player.move(0, diffY > 0 ? 1 : -1);
        }
    }
}

window.addEventListener('keydown', handleInput);

// --- PWA Service Worker Regisztráció ---
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('Service Worker sikeresen regisztrálva:', registration);
            })
            .catch(error => {
                console.log('Service Worker regisztráció sikertelen:', error);
            });
    }
}


// --- Indítás! ---
init();
