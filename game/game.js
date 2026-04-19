/* =========================
   Clown Mayhem — Full JS
   Учитывает все требования пользователя.
   Вставь в JS-панель CodePen.
   ========================= */

/* ==========================
   ASSETS - заменил эффект атаки на твою новую ссылку
   Проверь, что URL доступны
   ========================== */
const ASSETS = {
  background: "https://i.postimg.cc/dQr1Fbkf/image-(5).jpg",
  player: "https://i.postimg.cc/Z5K6s8YM/image-4-removebg-preview.png",
  enemies: {
    melee: "https://i.postimg.cc/Y0ZTDrYY/image-7-removebg-preview.png",
    ranged: "https://i.postimg.cc/SR3H1SC6/image-8-removebg-preview.png",
    mimic: "https://i.postimg.cc/2yMg9khb/image-9-removebg-preview.png"
  },
  bullet: "https://i.postimg.cc/zf61yFPL/image-10-removebg-preview.png",
  attackEffect: "https://i.postimg.cc/43bSgbkq/image-12-removebg-preview.png" // <- новая эффект-картинка (смотрит влево)
};

/* ==========================
   Scene DOM references and constants
   ========================== */
const GAME_WIDTH = 960, GAME_HEIGHT = 540;
const playerEl = document.getElementById("player");
const backgroundEl = document.getElementById("background");
const enemiesContainer = document.getElementById("enemies");
const projectilesContainer = document.getElementById("projectiles");

const hpEl = document.getElementById("hp");
const levelEl = document.getElementById("level");
const difficultyDisplay = document.getElementById("difficultyDisplay");
const btnPause = document.getElementById("btnPause");
const btnRespawn = document.getElementById("btnRespawn");

/* Menu & modal DOM */
const menuOverlay = document.getElementById("menuOverlay");
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalText = document.getElementById("modalText");
const modalButtons = document.getElementById("modalButtons");
const menuDifficulty = document.getElementById("menuDifficulty");
const menuStartLevel = document.getElementById("menuStartLevel");
const btnStartGame = document.getElementById("btnStartGame");

/* Fill levels in menu */
for (let i=1;i<=10;i++){
  const opt = document.createElement("option");
  opt.value = i; opt.textContent = i;
  menuStartLevel.appendChild(opt);
}

/* ==========================
   Game state
   ========================== */
let difficulty = "Easy";
let level = 1;
let hp = 100;
let running = false;
let paused = false;

/* Player */
const PLAYER_W = 84, PLAYER_H = 84;
const PLAYER_SPEED = 220; // px/sec
let player = { x:(GAME_WIDTH-PLAYER_W)/2, y:(GAME_HEIGHT-PLAYER_H)/2, w:PLAYER_W, h:PLAYER_H, facing: "left" };

/* Entities */
const enemies = []; // objects {el,type,x,y,vx,vy,shootCooldown}
const projectiles = []; // {el,from,type,x,y,vx,vy,life,created,damage}

/* Player trail for mimic (mimic copies movements with delay) */
const playerTrail = [];
const PLAYER_TRAIL_MAX = 800;

/* Level config (counts) */
const levelConfig = {
  1: { melee:4, ranged:2, mimic:0 },
  2: { melee:6, ranged:3, mimic:0 },
  3: { melee:8, ranged:4, mimic:1 },
  4: { melee:10, ranged:5, mimic:1 },
  5: { melee:12, ranged:6, mimic:1 },
  6: { melee:14, ranged:8, mimic:1 },
  7: { melee:16, ranged:10, mimic:2 },
  8: { melee:18, ranged:12, mimic:2 },
  9: { melee:20, ranged:14, mimic:2 },
 10: { melee:25, ranged:16, mimic:3 }
};

/* Base stats */
const BASE_ENEMY_SPEED = { melee: 80, ranged: 60, mimic: 70 };
const BASE_DAMAGE = { melee: 12, ranged: 8, mimic: 14 };

/* Input handling */
const keyState = { up:false, down:false, left:false, right:false };
function setKeyState(e, down){
  const code = e.code;
  if (code === "KeyW") keyState.up = down;
  if (code === "KeyS") keyState.down = down;
  if (code === "KeyA") keyState.left = down;
  if (code === "KeyD") keyState.right = down;
  if (code === "ArrowUp") keyState.up = down;
  if (code === "ArrowDown") keyState.down = down;
  if (code === "ArrowLeft") keyState.left = down;
  if (code === "ArrowRight") keyState.right = down;
}

/* Prevent default on navigation keys to avoid page scrolling */
window.addEventListener("keydown", (e) => {
  const prevent = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space","KeyW","KeyA","KeyS","KeyD"];
  if (prevent.includes(e.code)) e.preventDefault();
  setKeyState(e, true);

  // Attack on KeyF
  if (e.code === "KeyF") {
    e.preventDefault();
    if (running && !paused) playerAttack();
  }
});
window.addEventListener("keyup", (e) => setKeyState(e, false));

/* Apply assets to DOM */
function applyAssets(){
  backgroundEl.style.backgroundImage = `url("${ASSETS.background}")`;
  playerEl.style.backgroundImage = `url("${ASSETS.player}")`;
}
applyAssets();

/* Utility */
function randEdgePos(){
  const side = Math.floor(Math.random()*4);
  if (side===0) return { x: Math.random()*GAME_WIDTH, y: -80 };
  if (side===1) return { x: Math.random()*GAME_WIDTH, y: GAME_HEIGHT + 10 };
  if (side===2) return { x: -80, y: Math.random()*GAME_HEIGHT };
  return { x: GAME_WIDTH + 10, y: Math.random()*GAME_HEIGHT };
}
function dist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }

/* ======= SPAWN LOGIC (gradual spawning) ======= */
/* spawnQueue stores scheduled timeouts so we can cancel on reset */
let spawnQueue = [];
function clearSpawnQueue(){
  for (const t of spawnQueue) clearTimeout(t);
  spawnQueue = [];
}

function spawnEnemyInstance(type, x, y){
  const el = document.createElement("div");
  el.className = "enemy";
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.style.backgroundImage = `url("${ASSETS.enemies[type]}")`;
  enemiesContainer.appendChild(el);
  const obj = { el, type, x, y, vx:0, vy:0, shootCooldown: 0 };
  enemies.push(obj);
  return obj;
}

/* spawnLevelGradual spawns enemies one by one with small delay so they approach gradually */
function spawnLevelGradual(){
  clearEnemies();
  clearProjectiles();
  clearSpawnQueue();
  hp = 100; updateHUD();

  const cfg = levelConfig[level] || levelConfig[1];
  const mul = (difficulty === "Easy") ? 1 : 1.6;
  const meleeCount = Math.round(cfg.melee * mul);
  const rangedCount = Math.round(cfg.ranged * mul);
  const mimicCount = Math.round(cfg.mimic * mul);

  const list = [];
  for (let i=0;i<meleeCount;i++) list.push("melee");
  for (let i=0;i<rangedCount;i++) list.push("ranged");
  for (let i=0;i<mimicCount;i++) list.push("mimic");

  // shuffle to mix types
  for (let i=list.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [list[i],list[j]] = [list[j],list[i]];
  }

  // spawn with interval
  let t = 0;
  const baseDelay = (difficulty === "Easy") ? 450 : 300;
  list.forEach((type, idx) => {
    const delay = baseDelay + Math.floor(Math.random()*200);
    t += delay;
    const timeout = setTimeout(() => {
      const p = randEdgePos();
      spawnEnemyInstance(type, p.x, p.y);
    }, t);
    spawnQueue.push(timeout);
  });

  // after last spawn, clear spawnQueue array items that are done automatically by time; not strictly necessary
}

/* ======= Clear helpers ======= */
function clearEnemies(){
  enemiesContainer.innerHTML = "";
  enemies.length = 0;
}
function clearProjectiles(){
  projectilesContainer.innerHTML = "";
  projectiles.length = 0;
}

/* ======= PLAYER ATTACK (F) ======= */
function playerAttack(){
  if (enemies.length === 0) return;

  // find nearest enemy center
  let nearest = null; let bestD = Infinity;
  for (const e of enemies){
    const d = dist(player.x, player.y, e.x, e.y);
    if (d < bestD){ bestD = d; nearest = e; }
  }
  if (!nearest) return;

  const spawnX = player.x + player.w/2 - 20;
  const spawnY = player.y + player.h/2 - 20;

  const angle = Math.atan2((nearest.y + nearest.el.offsetHeight/2) - (player.y + player.h/2),
                           (nearest.x + nearest.el.offsetWidth/2) - (player.x + player.w/2));
  const speed = 140; // slow
  const life = 2200;

  const el = document.createElement("div");
  el.className = "projectile";
  el.style.width = "44px"; el.style.height = "44px";
  el.style.left = spawnX + "px"; el.style.top = spawnY + "px";
  el.style.backgroundImage = `url("${ASSETS.attackEffect}")`;
  // rotate by angle in degrees; image originally looks left — rotate(deg) is ok
  const deg = angle * 180 / Math.PI;
  el.style.transform = `rotate(${deg}deg) scaleX(${player.facing === "right" ? -1 : 1})`;
  projectilesContainer.appendChild(el);

  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  projectiles.push({ el, from:"player", type:"attack", x:spawnX, y:spawnY, vx, vy, life, created: performance.now(), damage: 30 });

  // MIMICS: now copy attack ALWAYS regardless of distance (as requested)
  for (const e of enemies){
    if (e.type === "mimic"){
      // small copy delay to feel natural
      const copyDelay = (difficulty === "Easy") ? 240 : 140;
      setTimeout(()=> mimicCopyAttack(e), copyDelay);
    }
  }
}

/* mimic copies attack: shoots at player current position */
function mimicCopyAttack(mimicEnemy){
  if (!mimicEnemy) return;
  const angle = Math.atan2((player.y + player.h/2) - (mimicEnemy.y + mimicEnemy.el.offsetHeight/2),
                           (player.x + player.w/2) - (mimicEnemy.x + mimicEnemy.el.offsetWidth/2));
  const speed = 180;
  const vx = Math.cos(angle) * speed; const vy = Math.sin(angle) * speed;
  const sx = mimicEnemy.x + mimicEnemy.el.offsetWidth/2 - 18;
  const sy = mimicEnemy.y + mimicEnemy.el.offsetHeight/2 - 18;

  const el = document.createElement("div");
  el.className = "projectile";
  el.style.width = "36px"; el.style.height = "36px";
  el.style.left = sx + "px"; el.style.top = sy + "px";
  el.style.backgroundImage = `url("${ASSETS.attackEffect}")`;
  el.style.transform = `rotate(${angle * 180 / Math.PI}deg)`;
  projectilesContainer.appendChild(el);

  projectiles.push({ el, from:"mimic", type:"mimic_proj", x: sx, y: sy, vx, vy, life:2200, created:performance.now(), damage:18 });
}

/* Enemy ranged shooting with bullet sprite */
function enemyShootAt(enemyObj, targetX, targetY){
  const sx = enemyObj.x + enemyObj.el.offsetWidth/2 - 12;
  const sy = enemyObj.y + enemyObj.el.offsetHeight/2 - 12;
  const angle = Math.atan2(targetY - (enemyObj.y + enemyObj.el.offsetHeight/2),
                           targetX - (enemyObj.x + enemyObj.el.offsetWidth/2));
  const speed = 260;
  const vx = Math.cos(angle)*speed; const vy = Math.sin(angle)*speed;

  const el = document.createElement("div");
  el.className = "projectile";
  el.style.width = "28px"; el.style.height = "28px";
  el.style.left = sx + "px"; el.style.top = sy + "px";
  el.style.backgroundImage = `url("${ASSETS.bullet}")`;
  const deg = angle * 180 / Math.PI;
  el.style.transform = `rotate(${deg + 90}deg)`; // bullet image points up, so +90 correction
  projectilesContainer.appendChild(el);

  projectiles.push({ el, from:"enemy", type:"bullet", x:sx, y:sy, vx, vy, life:3500, created:performance.now(), damage:10 });
}

/* ======= UPDATE LOOP sections ======= */
function updatePlayer(delta){
  const prevX = player.x;
  if (keyState.up) player.y -= PLAYER_SPEED * delta;
  if (keyState.down) player.y += PLAYER_SPEED * delta;
  if (keyState.left) player.x -= PLAYER_SPEED * delta;
  if (keyState.right) player.x += PLAYER_SPEED * delta;

  player.x = Math.max(0, Math.min(GAME_WIDTH - player.w, player.x));
  player.y = Math.max(0, Math.min(GAME_HEIGHT - player.h, player.y));

  playerEl.style.left = player.x + "px";
  playerEl.style.top = player.y + "px";

  if (player.x > prevX) player.facing = "right";
  else if (player.x < prevX) player.facing = "left";
  const scaleX = (player.facing === "right") ? -1 : 1;
  playerEl.style.transform = `scaleX(${scaleX})`;

  // add to trail
  playerTrail.push({ x: player.x, y: player.y, t: performance.now() });
  if (playerTrail.length > PLAYER_TRAIL_MAX) playerTrail.shift();
}

/* enemies move: melee approaches, ranged keeps distance, mimic follows playerTrail (always) */
function updateEnemies(delta){
  const now = performance.now();
  for (const e of enemies){
    const dx = (player.x) - e.x;
    const dy = (player.y) - e.y;
    const distance = Math.hypot(dx, dy) || 1;
    const speedMul = 1 + (level - 1) * 0.04;
    const diffMul = (difficulty === "Easy") ? 0.9 : 1.22;

    if (e.type === "melee"){
      const speed = BASE_ENEMY_SPEED.melee * speedMul * diffMul;
      e.vx = (dx/distance)*speed; e.vy = (dy/distance)*speed;
    } else if (e.type === "ranged"){
      const pref = 180;
      const speed = BASE_ENEMY_SPEED.ranged * speedMul * diffMul;
      if (distance > pref + 16){ e.vx = (dx/distance)*speed; e.vy = (dy/distance)*speed; }
      else if (distance < pref - 30){ e.vx = -(dx/distance)*speed; e.vy = -(dy/distance)*speed; }
      else { e.vx *= 0.92; e.vy *= 0.92; }
      // shooting cooldown
      e.shootCooldown -= delta*1000;
      if (e.shootCooldown <= 0){
        enemyShootAt(e, player.x + player.w/2, player.y + player.h/2);
        e.shootCooldown = (difficulty === "Easy") ? 1400 : 900;
      }
    } else if (e.type === "mimic"){
      // find trail position with delay (so mimic is slightly behind)
      const trailDelay = (difficulty === "Easy") ? 300 : 160; // ms
      const targetTime = now - trailDelay;
      let target = null;
      for (let i=playerTrail.length-1;i>=0;i--){
        if (playerTrail[i].t <= targetTime){ target = playerTrail[i]; break; }
      }
      if (!target && playerTrail.length) target = playerTrail[0];
      if (target){
        const mdx = target.x - e.x; const mdy = target.y - e.y;
        const mdist = Math.hypot(mdx, mdy) || 1;
        const speed = BASE_ENEMY_SPEED.mimic * speedMul * diffMul;
        e.vx = (mdx/mdist)*speed; e.vy = (mdy/mdist)*speed;
      } else { e.vx *= 0.9; e.vy *= 0.9; }
    }

    e.x += e.vx * delta;
    e.y += e.vy * delta;
    // limit to playable area (allow a bit off-screen)
    e.x = Math.max(-120, Math.min(GAME_WIDTH + 80, e.x));
    e.y = Math.max(-120, Math.min(GAME_HEIGHT + 80, e.y));
    e.el.style.left = e.x + "px"; e.el.style.top = e.y + "px";

    // flip enemy depending on player's relative position (source images look left)
    const facing = (player.x > e.x) ? "right" : "left";
    const scaleX = (facing === "right") ? -1 : 1;
    e.el.style.transform = `scaleX(${scaleX})`;

    // melee damage on contact
    if (e.type === "melee"){
      const hitDist = 48;
      if (dist(e.x, e.y, player.x, player.y) < hitDist){
        const dps = BASE_DAMAGE.melee * (difficulty === "Easy" ? 0.9 : 1.5);
        hp -= dps * delta;
        flashDamage();
        if (hp <= 0){ hp = 0; updateHUD(); gameOver(); return; }
      }
    }
  }
}

/* projectiles update: move, rotate, collisions, lifetime */
function updateProjectiles(delta){
  const now = performance.now();
  for (let i=projectiles.length-1;i>=0;i--){
    const p = projectiles[i];
    p.x += p.vx * delta; p.y += p.vy * delta;
    p.el.style.left = p.x + "px"; p.el.style.top = p.y + "px";

    const ang = Math.atan2(p.vy, p.vx);
    const deg = ang * 180 / Math.PI;
    if (p.type === "attack" || p.type === "mimic_proj") p.el.style.transform = `rotate(${deg}deg)`;
    else if (p.type === "bullet") p.el.style.transform = `rotate(${deg + 90}deg)`; // bullet image pointed up

    // collisions:
    if (p.from === "player" && p.type === "attack"){
      for (let j=enemies.length-1;j>=0;j--){
        const e = enemies[j];
        const exC = e.x + e.el.offsetWidth/2; const eyC = e.y + e.el.offsetHeight/2;
        const pxC = p.x + p.el.offsetWidth/2; const pyC = p.y + p.el.offsetHeight/2;
        if (dist(exC,eyC,pxC,pyC) < 40){
          // hit: remove enemy (simple)
          if (e.el.parentNode) e.el.parentNode.removeChild(e.el);
          enemies.splice(j,1);
          // remove projectile
          if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
          projectiles.splice(i,1);
          break;
        }
      }
    } else if (p.from === "enemy" || p.from === "mimic"){
      const pxC = p.x + p.el.offsetWidth/2; const pyC = p.y + p.el.offsetHeight/2;
      const playerCx = player.x + player.w/2; const playerCy = player.y + player.h/2;
      if (dist(pxC,pyC,playerCx,playerCy) < 28){
        hp -= p.damage || 8; flashDamage();
        if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
        projectiles.splice(i,1);
        if (hp <= 0){ hp = 0; updateHUD(); gameOver(); return; }
        continue;
      }
    }

    // lifetime / bounds
    if (now - p.created > (p.life || 3000) || p.x < -300 || p.x > GAME_WIDTH + 300 || p.y < -300 || p.y > GAME_HEIGHT + 300){
      if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
      projectiles.splice(i,1);
      continue;
    }
  }
}

/* visual damage flash */
let flashTimeout = null;
function flashDamage(){
  if (flashTimeout) return;
  const f = document.createElement("div"); f.className = "damage-flash";
  document.getElementById("game").appendChild(f);
  flashTimeout = setTimeout(()=>{ f.remove(); flashTimeout = null; }, 90);
}

/* HUD update */
function updateHUD(){ hpEl.textContent = "HP: " + Math.max(0, Math.floor(hp)); levelEl.textContent = "Level: " + level; difficultyDisplay.textContent = "Difficulty: " + difficulty; }

/* ======= Game over & level complete modals (in-game) ======= */
function showModal(title, text, buttons){
  modalTitle.textContent = title;
  modalText.textContent = text;
  modalButtons.innerHTML = "";
  buttons.forEach(btn => {
    const b = document.createElement("button");
    b.textContent = btn.label;
    b.addEventListener("click", () => { btn.onClick(); hideModal(); });
    modalButtons.appendChild(b);
  });
  modalOverlay.classList.remove("hidden");
  modalOverlay.classList.add("visible");
  paused = true;
}

function hideModal(){
  modalOverlay.classList.remove("visible");
  modalOverlay.classList.add("hidden");
  paused = false;
}

/* Game Over: show modal with restart & menu */
function gameOver(){
  running = false;
  showModal("Game Over", "You lost! Choose an option:", [
    { label: "Restart Level", onClick: ()=> { spawnLevelGradual(); running = true; } },
    { label: "Main Menu", onClick: ()=> { openMenu(); } }
  ]);
}

/* Level complete: if no enemies and no pending spawns and no projectiles */
function checkLevelComplete(){
  if (enemies.length === 0 && projectiles.length === 0 && spawnQueue.length === 0){
    running = false;
    showModal("Level Complete", "All enemies defeated!", [
      { label: "Next Level", onClick: ()=> { level = Math.min(10, level+1); spawnLevelGradual(); running = true; } },
      { label: "Main Menu", onClick: ()=> { openMenu(); } }
    ]);
  }
}

/* ======= Main loop ======= */
let last = performance.now();
function loop(now){
  if (!running || paused){ last = now; requestAnimationFrame(loop); return; }
  const delta = (now - last)/1000; last = now;

  updatePlayer(delta);
  updateEnemies(delta);
  updateProjectiles(delta);
  updateHUD();

  // after updates, check for level completion
  checkLevelComplete();

  requestAnimationFrame(loop);
}

/* ======= Start / Init / Menu handling ======= */
function spawnLevelStart(){
  clearSpawnQueue();
  clearEnemies();
  clearProjectiles();
  hp = 100; updateHUD();
  spawnLevelGradual();
  running = true; paused = false;
  last = performance.now();
}

/* Menu open */
function openMenu(){
  running = false;
  paused = true;
  menuOverlay.classList.remove("hidden");
  menuOverlay.classList.add("visible");
  modalOverlay.classList.add("hidden");
  modalOverlay.classList.remove("visible");
}

/* Menu close */
function closeMenu(){
  menuOverlay.classList.remove("visible");
  menuOverlay.classList.add("hidden");
  paused = false;
}

/* Buttons */
btnStartGame.addEventListener("click", () => {
  difficulty = menuDifficulty.value;
  level = parseInt(menuStartLevel.value,10) || 1;
  closeMenu();
  spawnLevelStart();
});

/* Pause / Respawn controls */
btnPause.addEventListener("click", () => {
  paused = !paused;
  btnPause.textContent = paused ? "Resume" : "Pause";
});
btnRespawn.addEventListener("click", () => { spawnLevelStart(); });

/* Focus on game on click */
const gameDiv = document.getElementById("game");
gameDiv.addEventListener("mousedown", () => gameDiv.focus());

/* Init positions and start loop */
function init(){
  document.getElementById("game").style.width = GAME_WIDTH + "px";
  document.getElementById("game").style.height = GAME_HEIGHT + "px";
  player.x = (GAME_WIDTH-player.w)/2; player.y = (GAME_HEIGHT-player.h)/2;
  applyAssets();
  openMenu(); // show menu first as requested
  last = performance.now();
  requestAnimationFrame(loop);
}
init();

/* Expose spawnLevelGradual for menu actions */
window.spawnLevel = spawnLevelGradual;

/* ========== Notes for adjustments ==========
- ASSETS: change URLs at top if needed
- levelConfig: adjust enemy counts
- spawn timing: baseDelay in spawnLevelGradual controls gradual spawn speed
- mimic behavior: trail delay controls how closely it follows player
- playerAttack(): projectile speed, life and damage adjustable
- enemyShootAt(): bullet speed and damage adjustable
============================================= */
/* =========================
   SOUND SYSTEM (added only)
   ========================= */

// Audio objects
const menuMusic = new Audio("https://files.catbox.moe/2eec8f.mp3");
const gameMusic = new Audio("https://files.catbox.moe/4aq7f6.mp3");
const hitSound = new Audio("https://files.catbox.moe/zo0ck8.mp3");

// settings
menuMusic.loop = true;
gameMusic.loop = true;

menuMusic.volume = 0.5;
gameMusic.volume = 0.5;
hitSound.volume = 0.7;

/* ---- MENU MUSIC ---- */
function playMenuMusic(){
  gameMusic.pause();
  gameMusic.currentTime = 0;
  menuMusic.play().catch(()=>{});
}

/* ---- GAME MUSIC ---- */
function playGameMusic(){
  menuMusic.pause();
  menuMusic.currentTime = 0;
  gameMusic.play().catch(()=>{});
}

/* --- Override openMenu to add sound --- */
const originalOpenMenu = openMenu;
openMenu = function(){
  originalOpenMenu();
  playMenuMusic();
};

/* --- Override spawnLevelStart to add sound --- */
const originalSpawnLevelStart = spawnLevelStart;
spawnLevelStart = function(){
  originalSpawnLevelStart();
  playGameMusic();
};

/* ---- Bullet hit sound ---- */
/* We hook into damage event by overriding flashDamage */

const originalFlashDamage = flashDamage;
flashDamage = function(){
  hitSound.currentTime = 0;
  hitSound.play().catch(()=>{});
  originalFlashDamage();
};

/* Start menu music on load */
playMenuMusic();
/* =========================
   MENU MUSIC ADD (no edits to script)
   ========================= */

const menuMusicOnly = new Audio("https://files.catbox.moe/2eec8f.mp3");
menuMusicOnly.loop = true;
menuMusicOnly.volume = 0.5;

/* Разблокировка автоплея (нужно для браузеров) */
let menuMusicUnlocked = false;
function unlockMenuMusic(){
  if (menuMusicUnlocked) return;
  menuMusicUnlocked = true;
  menuMusicOnly.play().catch(()=>{});
  document.removeEventListener("mousedown", unlockMenuMusic);
  document.removeEventListener("keydown", unlockMenuMusic);
}
document.addEventListener("mousedown", unlockMenuMusic);
document.addEventListener("keydown", unlockMenuMusic);

/* Перехватываем openMenu чтобы включать музыку */
const __originalOpenMenu = openMenu;
openMenu = function(){
  __originalOpenMenu();
  menuMusicOnly.currentTime = 0;
  menuMusicOnly.play().catch(()=>{});
};

/* Останавливаем музыку при старте игры */
const __originalSpawnLevelStart = spawnLevelStart;
spawnLevelStart = function(){
  menuMusicOnly.pause();
  __originalSpawnLevelStart();
};

/* =========================
   HIT SOUND ON ENEMY (ADD ONLY)
   ========================= */

const enemyHitSound = new Audio("https://files.catbox.moe/zo0ck8.mp3");
enemyHitSound.volume = 0.8;

/* Перехватываем updateProjectiles */
const __originalUpdateProjectiles = updateProjectiles;

updateProjectiles = function(delta){
  const enemiesBefore = enemies.length;

  __originalUpdateProjectiles(delta);

  const enemiesAfter = enemies.length;

  // если врагов стало меньше — значит был хит
  if (enemiesAfter < enemiesBefore){
    enemyHitSound.currentTime = 0;
    enemyHitSound.play().catch(()=>{});
  }
};
