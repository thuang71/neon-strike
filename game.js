/* NEON STRIKE —— 纯 Canvas 2D，无外部库 */

(function () {
  var CANVAS_W = 800;
  var CANVAS_H = 600;
  var PLAYER_SIZE = 40;
  var PLAYER_SPEED = 280;
  var MAX_DT = 0.1;
  var PLAYER_MAX_HP = 3;
  var HURT_IFRAME = 1;

  var TELEPORT_DIST = 120;
  var TELEPORT_IFRAME = 0.28;
  var TELEPORT_COOLDOWN = 2;

  var ENEMY_SPEED_START = 155;
  var ENEMY_SPEED_STEP = 12;
  var SPEED_EVERY = 10;
  var SPAWN_INTERVAL_START = 0.95;
  var SPAWN_INTERVAL_STEP = 0.08;
  var SPAWN_INTERVAL_MIN = 0.38;
  var SPAWN_EVERY = 15;
  var SPAWN_STEPS_MAX = 5;
  var STAGE_COMBAT = 60;

  var SIZE_NORMAL = 36;
  var SIZE_RARE = 38;
  var SIZE_ELITE = 54;
  var HP_NORMAL = 1;
  var HP_RARE = 1;
  var HP_ELITE = 5;
  var SCORE_NORMAL = 50;
  var SCORE_RARE = 150;
  var SCORE_ELITE = 500;
  var SCORE_MISSILE = 25;
  var SCORE_TURRET = 500;
  var XP_NORMAL = 1;
  var XP_RARE = 3;
  var XP_ELITE = 8;
  var XP_BOSS = 50;
  var ELITE_UNLOCK = 5;

  var NORMAL_TURN = 1.85;
  var RARE_Y_MIN = CANVAS_H * 0.15;
  var RARE_Y_MAX = CANVAS_H * 0.5;
  var ELITE_Y_MIN = CANVAS_H * 0.1;
  var ELITE_Y_MAX = CANVAS_H * 0.45;

  var RARE_WARN = 0.4;
  var MISSILE_W = 10;
  var MISSILE_H = 20;
  var MISSILE_SPEED = 265;
  var MISSILE_TURN_RARE = 1.35;
  var MISSILE_TURN_BOSS = 1.12;
  var MISSILE_LIFE_RARE = 4.5;
  var MISSILE_LIFE_BOSS = 5;
  var MISSILE_HP = 3;

  var ELITE_AIM = 0.7;
  var ELITE_LOCK = 0.3;
  var ELITE_BEAM = 0.6;
  var ELITE_BEAM_W = 22;

  var MAX_NORMAL_BASE = 8;
  var MAX_NORMAL_HARD = 14;
  var MAX_RARE_BASE = 2;
  var MAX_RARE_HARD = 4;
  var MAX_ELITE_BASE = 1;
  var MAX_ELITE_HARD = 2;

  var BOSS_W = 160;
  var BOSS_H = 90;
  var BOSS_ARRIVE_Y = 70;
  var BOSS_SCORE = 5000;
  var FAN_SPEED = 300;
  var TURRET_HP = 25;
  var TURRET_W = 34;
  var TURRET_H = 34;

  var BULLET_W = 6;
  var BULLET_H = 18;
  var BULLET_SPEED = 950;
  var BULLET_DAMAGE = 1;
  var FIRE_INTERVAL = 0.1;
  var FIRE_MIN = 0.045;
  var SIZE_MIN = 0.7;

  var ITEM_SIZE = 20;
  var ITEM_SPEED = 70;
  var DROP_NORMAL = 0.03;
  var DROP_RARE = 0.15;
  var DROP_ELITE = 0.4;
  var POWER_TIME = 10;

  var CARD_W = 210;
  var CARD_H = 268;
  var CARD_GAP = 18;

  var BEST_KEY = "dodge-blocks-best";
  var STAGE_KEY = "neon-strike-best-stage";
  var SFX_KEY = "neon-strike-sfx";
  var MUSIC_KEY = "neon-strike-music";

  var UI_FONT = "600 18px Segoe UI, Helvetica Neue, Arial, sans-serif";
  var UI_FONT_LG = "700 56px Segoe UI, Helvetica Neue, Arial, sans-serif";
  var UI_FONT_MD = "600 22px Segoe UI, Helvetica Neue, Arial, sans-serif";
  var UI_FONT_SM = "500 16px Segoe UI, Helvetica Neue, Arial, sans-serif";
  var UI_FONT_TITLE = "700 64px Segoe UI, Helvetica Neue, Arial, sans-serif";

  var cleanupPrev = null;
  var audioCtx = null;
  var musicNodes = null;

  function loadInt(key, fallback) {
    try {
      var n = parseInt(localStorage.getItem(key), 10);
      if (isNaN(n) || n < 0) return fallback;
      return n;
    } catch (err) {
      return fallback;
    }
  }

  function loadFlag(key, fallback) {
    try {
      var v = localStorage.getItem(key);
      if (v === "0") return false;
      if (v === "1") return true;
      return fallback;
    } catch (err) {
      return fallback;
    }
  }

  function saveVal(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch (err) {}
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  function xpNeeded(lv) {
    return Math.ceil(10 * Math.pow(1.25, lv - 1));
  }

  function bossMaxHp(stage) {
    if (stage <= 1) return 180;
    if (stage === 2) return 260;
    if (stage === 3) return 360;
    return Math.round(360 * Math.pow(1.35, stage - 3));
  }

  function ensureAudio() {
    if (audioCtx) return audioCtx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    } catch (err) {
      audioCtx = null;
    }
    return audioCtx;
  }

  function beep(freq, dur, type, vol) {
    var ctx = ensureAudio();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || "square";
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.06, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch (err) {}
  }

  function startMusic() {
    stopMusic();
    var ctx = ensureAudio();
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") ctx.resume();
      var o = ctx.createOscillator();
      var o2 = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = "triangle";
      o2.type = "sine";
      o.frequency.value = 110;
      o2.frequency.value = 165;
      g.gain.value = 0.03;
      o.connect(g);
      o2.connect(g);
      g.connect(ctx.destination);
      o.start();
      o2.start();
      musicNodes = { o: o, o2: o2, g: g };
    } catch (err) {
      musicNodes = null;
    }
  }

  function stopMusic() {
    if (!musicNodes) return;
    try {
      musicNodes.o.stop();
      musicNodes.o2.stop();
    } catch (err) {}
    musicNodes = null;
  }

  function startDodgeGame() {
    if (cleanupPrev) cleanupPrev();

    var canvas = document.getElementById("gameCanvas");
    if (!canvas) return function () {};
    var ctx = canvas.getContext("2d");
    if (!ctx) return function () {};

    var keys = {};
    var injectedKeys = null;
    var rafId = 0;
    var lastTime = 0;
    var spawnTimer = 0;
    var fireTimer = 0;
    var score = 0;
    var best = loadInt(BEST_KEY, 0);
    var bestStage = loadInt(STAGE_KEY, 1);
    var sfxOn = loadFlag(SFX_KEY, true);
    var musicOn = loadFlag(MUSIC_KEY, true);
    var elapsed = 0;
    var stageTime = 0;
    var stage = 1;
    var state = "menu";
    var enemies = [];
    var playerBullets = [];
    var enemyBullets = [];
    var items = [];
    var particles = [];
    var floaters = [];
    var stars = [];
    var enemySpeed = ENEMY_SPEED_START;
    var spawnInterval = SPAWN_INTERVAL_START;
    var threat = 1;
    var blinkCooldown = 0;
    var invulnTime = 0;
    var waveState = "normal";
    var warningTimer = 0;
    var defeatedTimer = 0;
    var introTimer = 0;
    var boss = null;
    var fireInterval = FIRE_INTERVAL;
    var bulletSpeed = BULLET_SPEED;
    var moveSpeed = PLAYER_SPEED;
    var bulletDamage = BULLET_DAMAGE;
    var sizeScale = 1;
    var blinkCdMax = TELEPORT_COOLDOWN;
    var bossDmgMult = 1;
    var extraShot = 0;
    var pierceCount = 0;
    var hasDrone = false;
    var droneAngle = 0;
    var missilePod = false;
    var missilePodTimer = 0;
    var playerLevel = 1;
    var xp = 0;
    var upgradeOpen = false;
    var upgradeChoices = [];
    var upgradeKind = "level";
    var hoverCard = -1;
    var uiButtons = [];
    var hoverBtn = -1;
    var powerTime = 0;
    var muzzleTime = 0;
    var shakeTime = 0;
    var shakeMag = 0;
    var hurtFlash = 0;
    var hurtWhite = 0;
    var bannerText = "";
    var bannerTime = 0;
    var lastBossPhase = 1;
    var enemiesDestroyed = 0;
    var bossesDestroyed = 0;
    var shootSfxWait = 0;
    var empEnergy = 0;
    var empRing = 0;
    var pendingBossReward = false;
    var pendingBossXp = 0;
    var player = resetPlayer();
    var bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, "#0b1224");
    bgGrad.addColorStop(1, "#05070f");

    for (var s = 0; s < 70; s++) {
      stars.push({
        x: Math.random() * CANVAS_W,
        y: Math.random() * CANVAS_H,
        speed: 30 + Math.random() * 90,
        size: Math.random() < 0.7 ? 1 : 2,
        alpha: 0.25 + Math.random() * 0.55,
      });
    }

    function sfx(kind) {
      if (!sfxOn) return;
      if (kind === "shoot") beep(880, 0.04, "square", 0.025);
      else if (kind === "explode") beep(140, 0.18, "sawtooth", 0.07);
      else if (kind === "hurt") beep(90, 0.22, "square", 0.09);
      else if (kind === "warn") beep(420, 0.35, "triangle", 0.08);
      else if (kind === "boss") {
        beep(80, 0.5, "sawtooth", 0.1);
        beep(50, 0.55, "triangle", 0.08);
      } else if (kind === "upgrade") beep(660, 0.12, "sine", 0.07);
      else if (kind === "pickup") beep(740, 0.1, "sine", 0.06);
      else if (kind === "emp") {
        beep(220, 0.28, "sine", 0.08);
        beep(90, 0.32, "triangle", 0.07);
      }
    }

    function resetPlayer() {
      return {
        x: (CANVAS_W - PLAYER_SIZE * sizeScale) / 2,
        y: CANVAS_H - PLAYER_SIZE * sizeScale,
        w: PLAYER_SIZE * sizeScale,
        h: PLAYER_SIZE * sizeScale,
        hp: PLAYER_MAX_HP,
        maxHp: PLAYER_MAX_HP,
        shields: 0,
      };
    }

    function resetCombatStats() {
      fireInterval = FIRE_INTERVAL;
      bulletSpeed = BULLET_SPEED;
      moveSpeed = PLAYER_SPEED;
      bulletDamage = BULLET_DAMAGE;
      sizeScale = 1;
      blinkCdMax = TELEPORT_COOLDOWN;
      bossDmgMult = 1;
      extraShot = 0;
      pierceCount = 0;
      hasDrone = false;
      droneAngle = 0;
      missilePod = false;
      missilePodTimer = 0;
      playerLevel = 1;
      xp = 0;
      upgradeOpen = false;
      upgradeChoices = [];
      upgradeKind = "level";
      hoverCard = -1;
      powerTime = 0;
      empEnergy = 0;
      empRing = 0;
      pendingBossReward = false;
      pendingBossXp = 0;
    }

    function applyPlayerSize() {
      var cx = player.x + player.w / 2;
      var cy = player.y + player.h / 2;
      player.w = PLAYER_SIZE * sizeScale;
      player.h = PLAYER_SIZE * sizeScale;
      player.x = cx - player.w / 2;
      player.y = cy - player.h / 2;
      clampPlayer();
    }

    var UPGRADE_POOL = [
      {
        id: "rapid",
        name: "Rapid Fire",
        desc: "Fire interval -10%\n(min 0.045s)",
        available: function () {
          return fireInterval > FIRE_MIN + 0.0001;
        },
        apply: function () {
          fireInterval *= 0.9;
          if (fireInterval < FIRE_MIN) fireInterval = FIRE_MIN;
        },
      },
      {
        id: "bspeed",
        name: "Bullet Speed",
        desc: "Player bullet speed +15%",
        available: function () {
          return true;
        },
        apply: function () {
          bulletSpeed *= 1.15;
        },
      },
      {
        id: "move",
        name: "Move Speed",
        desc: "Move speed +10%",
        available: function () {
          return true;
        },
        apply: function () {
          moveSpeed *= 1.1;
        },
      },
      {
        id: "hp",
        name: "Max HP",
        desc: "Max HP +1\nRestore 1 HP",
        available: function () {
          return true;
        },
        apply: function () {
          player.maxHp += 1;
          player.hp += 1;
          if (player.hp > player.maxHp) player.hp = player.maxHp;
        },
      },
      {
        id: "dmg",
        name: "Bullet Damage",
        desc: "Bullet damage +1",
        available: function () {
          return true;
        },
        apply: function () {
          bulletDamage += 1;
        },
      },
      {
        id: "small",
        name: "Small Ship",
        desc: "Hitbox -8%\n(floor 70%)",
        available: function () {
          return sizeScale > SIZE_MIN + 0.001;
        },
        apply: function () {
          sizeScale *= 0.92;
          if (sizeScale < SIZE_MIN) sizeScale = SIZE_MIN;
          applyPlayerSize();
        },
      },
      {
        id: "dashcd",
        name: "Dash Cooldown",
        desc: "Blink cooldown -15%",
        available: function () {
          return blinkCdMax > 0.4;
        },
        apply: function () {
          blinkCdMax *= 0.85;
        },
      },
      {
        id: "bossk",
        name: "Boss Killer",
        desc: "Damage to Boss +25%",
        available: function () {
          return true;
        },
        apply: function () {
          bossDmgMult *= 1.25;
        },
      },
    ];

    var BOSS_REWARD_POOL = [
      {
        id: "doubleshot",
        name: "Double Shot",
        desc: "Fire an extra\nside bullet",
        available: function () {
          return extraShot < 2;
        },
        apply: function () {
          extraShot += 1;
        },
      },
      {
        id: "missilepod",
        name: "Missile Pod",
        desc: "Periodically fire\nside missiles",
        available: function () {
          return !missilePod;
        },
        apply: function () {
          missilePod = true;
        },
      },
      {
        id: "drone",
        name: "Drone",
        desc: "Orbiting drone\nthat also shoots",
        available: function () {
          return !hasDrone;
        },
        apply: function () {
          hasDrone = true;
        },
      },
      {
        id: "laser",
        name: "Pierce Laser",
        desc: "Player bullets\npierce +1 target",
        available: function () {
          return pierceCount < 2;
        },
        apply: function () {
          pierceCount += 1;
        },
      },
      {
        id: "hp",
        name: "Max HP",
        desc: "Max HP +1\nRestore 1 HP",
        available: function () {
          return true;
        },
        apply: function () {
          player.maxHp += 1;
          player.hp += 1;
          if (player.hp > player.maxHp) player.hp = player.maxHp;
        },
      },
      {
        id: "dmg",
        name: "Bullet Damage",
        desc: "Bullet damage +1",
        available: function () {
          return true;
        },
        apply: function () {
          bulletDamage += 1;
        },
      },
    ];

    function isDown(code) {
      var source = injectedKeys || keys;
      return !!source[code];
    }

    function stageMult() {
      return Math.pow(1.08, Math.max(0, stage - 1));
    }

    function capNormal() {
      return Math.min(MAX_NORMAL_HARD, MAX_NORMAL_BASE + Math.floor((stage - 1) * 1.2));
    }
    function capRare() {
      return Math.min(MAX_RARE_HARD, MAX_RARE_BASE + Math.floor((stage - 1) / 2));
    }
    function capElite() {
      return Math.min(MAX_ELITE_HARD, MAX_ELITE_BASE + (stage >= 3 ? 1 : 0));
    }

    function countType(type) {
      var n = 0;
      for (var i = 0; i < enemies.length; i++) {
        if (enemies[i].type === type) n += 1;
      }
      return n;
    }

    function countMissiles(from) {
      var n = 0;
      for (var i = 0; i < enemyBullets.length; i++) {
        if (enemyBullets[i].type === "missile") {
          if (!from || enemyBullets[i].from === from) n += 1;
        }
      }
      return n;
    }

    function updateDifficulty() {
      var speedSteps = Math.floor(stageTime / SPEED_EVERY);
      var spawnSteps = Math.floor(stageTime / SPAWN_EVERY);
      if (spawnSteps > SPAWN_STEPS_MAX) spawnSteps = SPAWN_STEPS_MAX;
      var m = stageMult();
      enemySpeed = (ENEMY_SPEED_START + speedSteps * ENEMY_SPEED_STEP) * m;
      spawnInterval =
        (SPAWN_INTERVAL_START - spawnSteps * SPAWN_INTERVAL_STEP) / m;
      if (spawnInterval < SPAWN_INTERVAL_MIN) spawnInterval = SPAWN_INTERVAL_MIN;
      threat = 1 + speedSteps + spawnSteps;
    }

    function rareRate() {
      return Math.min(0.26, 0.14 + (stage - 1) * 0.018);
    }
    function eliteRate() {
      return Math.min(0.16, 0.08 + (stage - 1) * 0.012);
    }

    function maybeUpdateBest() {
      var shown = Math.floor(score);
      if (shown > best) {
        best = shown;
        saveVal(BEST_KEY, best);
      }
      if (stage > bestStage) {
        bestStage = stage;
        saveVal(STAGE_KEY, bestStage);
      }
    }

    function addShake(mag, time) {
      if (mag >= shakeMag || shakeTime <= 0) {
        shakeMag = mag;
        shakeTime = time;
      }
    }

    function addEmp(n) {
      empEnergy += n;
      if (empEnergy > 100) empEnergy = 100;
    }

    function spawnExplosion(x, y, color, count) {
      var n = count || 14;
      for (var i = 0; i < n; i++) {
        var ang = Math.random() * Math.PI * 2;
        var spd = 50 + Math.random() * 180;
        var life = 0.28 + Math.random() * 0.28;
        particles.push({
          x: x,
          y: y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: life,
          maxLife: life,
          size: 2 + Math.random() * 4,
          color: color,
        });
      }
    }

    function spawnFloater(x, y, text, color) {
      floaters.push({
        x: x,
        y: y,
        text: text,
        color: color || "#e8eefc",
        life: 0.85,
        maxLife: 0.85,
      });
    }

    function showBanner(text, time) {
      bannerText = text;
      bannerTime = time || 1.4;
    }

    function resetBlink() {
      blinkCooldown = 0;
      invulnTime = 0;
    }

    function clearWorld() {
      enemies = [];
      playerBullets = [];
      enemyBullets = [];
      items = [];
      particles = [];
      floaters = [];
      boss = null;
      spawnTimer = 0;
      fireTimer = 0;
      empRing = 0;
    }

    function goMenu() {
      state = "menu";
      upgradeOpen = false;
      clearWorld();
      stopMusic();
      lastTime = 0;
    }

    function resetGame() {
      resetCombatStats();
      player = resetPlayer();
      clearWorld();
      score = 0;
      elapsed = 0;
      stageTime = 0;
      stage = 1;
      lastTime = 0;
      resetBlink();
      updateDifficulty();
      waveState = "normal";
      warningTimer = 0;
      defeatedTimer = 0;
      introTimer = 0;
      enemiesDestroyed = 0;
      bossesDestroyed = 0;
      lastBossPhase = 1;
      muzzleTime = 0;
      shakeTime = 0;
      hurtFlash = 0;
      hurtWhite = 0;
      bannerTime = 0;
      state = "playing";
      if (musicOn) startMusic();
    }

    function tryBlink() {
      if (state !== "playing" || upgradeOpen) return;
      if (blinkCooldown > 0) return;
      var move = currentMove();
      var dx = move.dx;
      var dy = move.dy;
      if (dx === 0 && dy === 0) dy = -1;
      var len = Math.hypot(dx, dy);
      if (len < 0.001) len = 1;
      player.x += (dx / len) * TELEPORT_DIST;
      player.y += (dy / len) * TELEPORT_DIST;
      clampPlayer();
      if (invulnTime < TELEPORT_IFRAME) invulnTime = TELEPORT_IFRAME;
      blinkCooldown = blinkCdMax;
    }

    function hurtPlayer(amount) {
      if (state !== "playing" || upgradeOpen) return;
      if (invulnTime > 0) return;
      if (player.shields > 0) {
        player.shields -= 1;
        invulnTime = 0.35;
        sfx("pickup");
        return;
      }
      player.hp -= amount;
      invulnTime = HURT_IFRAME;
      hurtFlash = 0.28;
      hurtWhite = 0.12;
      sfx("hurt");
      if (player.hp <= 0) {
        player.hp = 0;
        state = "gameover";
        score = Math.floor(score);
        maybeUpdateBest();
        stopMusic();
      }
    }

    function grantXP(amount) {
      if (state !== "playing") return;
      xp += amount;
      tryLevelUp();
    }

    function shufflePool(src) {
      var pool = [];
      for (var i = 0; i < src.length; i++) {
        if (src[i].available()) pool.push(src[i]);
      }
      for (var a = pool.length - 1; a > 0; a--) {
        var b = Math.floor(Math.random() * (a + 1));
        var tmp = pool[a];
        pool[a] = pool[b];
        pool[b] = tmp;
      }
      return pool;
    }

    function tryLevelUp() {
      if (state !== "playing" || upgradeOpen) return;
      var need = xpNeeded(playerLevel);
      if (xp < need) return;
      var pool = shufflePool(UPGRADE_POOL);
      upgradeChoices = pool.slice(0, Math.min(3, pool.length));
      if (upgradeChoices.length === 0) return;
      upgradeKind = "level";
      upgradeOpen = true;
      hoverCard = -1;
      clearKeys();
    }

    function showBossReward() {
      var pool = shufflePool(BOSS_REWARD_POOL);
      upgradeChoices = pool.slice(0, Math.min(3, pool.length));
      if (upgradeChoices.length === 0) {
        pendingBossReward = false;
        if (pendingBossXp) {
          grantXP(pendingBossXp);
          pendingBossXp = 0;
        }
        enterNextStage();
        return;
      }
      upgradeKind = "boss";
      upgradeOpen = true;
      hoverCard = -1;
      clearKeys();
    }

    function pickUpgrade(index) {
      if (!upgradeOpen) return;
      if (index < 0 || index >= upgradeChoices.length) return;
      var kind = upgradeKind;
      upgradeChoices[index].apply();
      sfx("upgrade");
      if (kind === "boss") {
        upgradeOpen = false;
        upgradeChoices = [];
        hoverCard = -1;
        pendingBossReward = false;
        lastTime = 0;
        if (pendingBossXp) {
          grantXP(pendingBossXp);
          pendingBossXp = 0;
        }
        enterNextStage();
        return;
      }
      var need = xpNeeded(playerLevel);
      xp -= need;
      if (xp < 0) xp = 0;
      playerLevel += 1;
      upgradeOpen = false;
      upgradeChoices = [];
      hoverCard = -1;
      lastTime = 0;
      tryLevelUp();
    }

    function cardRect(i) {
      var total =
        upgradeChoices.length * CARD_W + (upgradeChoices.length - 1) * CARD_GAP;
      var x0 = (CANVAS_W - total) / 2;
      return {
        x: x0 + i * (CARD_W + CARD_GAP),
        y: (CANVAS_H - CARD_H) / 2,
        w: CARD_W,
        h: CARD_H,
      };
    }

    function canvasPos(e) {
      var r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) * CANVAS_W) / r.width,
        y: ((e.clientY - r.top) * CANVAS_H) / r.height,
      };
    }

    function addBtn(id, x, y, w, h, label) {
      uiButtons.push({ id: id, x: x, y: y, w: w, h: h, label: label });
    }

    function hitBtn(p) {
      for (var i = 0; i < uiButtons.length; i++) {
        var b = uiButtons[i];
        if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
          return i;
        }
      }
      return -1;
    }

    function downloadSource() {
      var a = document.createElement("a");
      a.href = "/download/neon-strike.zip";
      a.download = "neon-strike.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    function clickBtn(id) {
      if (id === "start") resetGame();
      else if (id === "howto") state = "howto";
      else if (id === "back") state = "menu";
      else if (id === "resume") {
        state = "playing";
        lastTime = 0;
        if (musicOn) startMusic();
      } else if (id === "restart") resetGame();
      else if (id === "menu") goMenu();
      else if (id === "download") downloadSource();
      else if (id === "sfx") {
        sfxOn = !sfxOn;
        saveVal(SFX_KEY, sfxOn ? "1" : "0");
      } else if (id === "music") {
        musicOn = !musicOn;
        saveVal(MUSIC_KEY, musicOn ? "1" : "0");
        if (!musicOn) stopMusic();
        else if (state === "playing") startMusic();
      }
    }

    function onKeyDown(e) {
      keys[e.code] = true;
      if (
        e.code === "ArrowUp" ||
        e.code === "ArrowDown" ||
        e.code === "ArrowLeft" ||
        e.code === "ArrowRight" ||
        e.code === "KeyW" ||
        e.code === "KeyA" ||
        e.code === "KeyS" ||
        e.code === "KeyD" ||
        e.code === "KeyR" ||
        e.code === "Space" ||
        e.code === "Escape" ||
        e.code === "Digit1" ||
        e.code === "Digit2" ||
        e.code === "Digit3" ||
        e.code === "ShiftLeft" ||
        e.code === "ShiftRight"
      ) {
        e.preventDefault();
      }
      if (e.repeat) return;
      ensureAudio();
      if (e.code === "Escape") {
        if (state === "playing" && !upgradeOpen) {
          state = "paused";
          stopMusic();
        } else if (state === "paused") {
          state = "playing";
          lastTime = 0;
          if (musicOn) startMusic();
        } else if (state === "howto") {
          state = "menu";
        }
        return;
      }
      if (upgradeOpen) {
        if (e.code === "Digit1") pickUpgrade(0);
        if (e.code === "Digit2") pickUpgrade(1);
        if (e.code === "Digit3") pickUpgrade(2);
        return;
      }
      if (state === "menu" && e.code === "Space") {
        resetGame();
        return;
      }
      if (state === "gameover" && e.code === "KeyR") {
        resetGame();
        return;
      }
      if (state === "playing") {
        if (e.code === "Space") {
          if (empEnergy >= 100) fireEmp();
          else tryBlink();
          return;
        }
        if (e.code === "ShiftLeft" || e.code === "ShiftRight") tryBlink();
      }
    }

    function onKeyUp(e) {
      keys[e.code] = false;
    }

    function clearKeys() {
      keys = {};
    }

    function onVisibility() {
      if (document.hidden) {
        clearKeys();
        if (state === "playing" && !upgradeOpen) {
          state = "paused";
          stopMusic();
        }
      }
    }

    function onMouseMove(e) {
      var p = canvasPos(e);
      hoverBtn = hitBtn(p);
      if (!upgradeOpen) return;
      hoverCard = -1;
      for (var i = 0; i < upgradeChoices.length; i++) {
        var r = cardRect(i);
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          hoverCard = i;
        }
      }
    }

    function onMouseDown(e) {
      ensureAudio();
      var p = canvasPos(e);
      if (upgradeOpen) {
        for (var i = 0; i < upgradeChoices.length; i++) {
          var r = cardRect(i);
          if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
            pickUpgrade(i);
            return;
          }
        }
        return;
      }
      var idx = hitBtn(p);
      if (idx >= 0) clickBtn(uiButtons[idx].id);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearKeys);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);

    function boxW(obj) {
      return obj.w != null ? obj.w : obj.width;
    }
    function boxH(obj) {
      return obj.h != null ? obj.h : obj.height;
    }
    function hitTest(a, b) {
      return (
        a.x < b.x + boxW(b) &&
        a.x + boxW(a) > b.x &&
        a.y < b.y + boxH(b) &&
        a.y + boxH(a) > b.y
      );
    }

    function distPointSeg(px, py, x0, y0, x1, y1) {
      var dx = x1 - x0;
      var dy = y1 - y0;
      var len2 = dx * dx + dy * dy || 1;
      var t = ((px - x0) * dx + (py - y0) * dy) / len2;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
    }

    function rayToEdge(x, y, ang) {
      var dx = Math.cos(ang);
      var dy = Math.sin(ang);
      var t = 2400;
      if (dx > 0.0001) t = Math.min(t, (CANVAS_W - x) / dx);
      if (dx < -0.0001) t = Math.min(t, (0 - x) / dx);
      if (dy > 0.0001) t = Math.min(t, (CANVAS_H - y) / dy);
      if (dy < -0.0001) t = Math.min(t, (0 - y) / dy);
      if (t < 8) t = 8;
      return { x: x + dx * t, y: y + dy * t };
    }

    function playerHitsBeam(x0, y0, x1, y1, halfW) {
      var cx = player.x + player.w / 2;
      var cy = player.y + player.h / 2;
      var r = Math.max(player.w, player.h) * 0.42;
      return distPointSeg(cx, cy, x0, y0, x1, y1) < halfW + r;
    }

    function typeStats(type) {
      if (type === "rare") {
        return {
          width: SIZE_RARE,
          height: SIZE_RARE,
          hp: HP_RARE,
          scoreValue: SCORE_RARE,
          speed: enemySpeed * 0.72,
        };
      }
      if (type === "elite") {
        return {
          width: SIZE_ELITE,
          height: SIZE_ELITE,
          hp: HP_ELITE,
          scoreValue: SCORE_ELITE,
          speed: enemySpeed * 0.42,
        };
      }
      return {
        width: SIZE_NORMAL,
        height: SIZE_NORMAL,
        hp: HP_NORMAL,
        scoreValue: SCORE_NORMAL,
        speed: enemySpeed,
      };
    }

    function pickEnemyType() {
      var rRate = rareRate();
      var eRate = stageTime < ELITE_UNLOCK ? 0 : eliteRate();
      var roll = Math.random();
      if (roll < rRate) return "rare";
      if (roll < rRate + eRate) return "elite";
      return "normal";
    }

    function makeEnemy(type, x, y) {
      var stats = typeStats(type);
      var vx = 0;
      var vy = stats.speed;
      if (type === "rare") {
        vx = (Math.random() < 0.5 ? -1 : 1) * (70 + Math.random() * 40);
        vy = 40;
      }
      if (type === "elite") {
        vx = (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 30);
        vy = 28;
      }
      return {
        type: type,
        x: x,
        y: y,
        width: stats.width,
        height: stats.height,
        vx: vx,
        vy: vy,
        speed: stats.speed,
        hp: stats.hp,
        maxHp: stats.hp,
        scoreValue: stats.scoreValue,
        entered: y > 20,
        attackTimer: 1.2 + Math.random() * 2.2,
        laserState: "idle",
        laserTimer: 0,
        laserAng: Math.PI / 2,
        laserHit: false,
        flash: 0,
      };
    }

    function spawnEnemyOfType(type) {
      if (type === "normal" && countType("normal") >= capNormal()) return;
      if (type === "rare" && countType("rare") >= capRare()) return;
      if (type === "elite" && countType("elite") >= capElite()) return;
      var stats = typeStats(type);
      var x = 40 + Math.random() * (CANVAS_W - stats.width - 80);
      enemies.push(makeEnemy(type, x, -stats.height));
    }

    function spawnEnemy() {
      var type = pickEnemyType();
      if (type === "rare" && countType("rare") >= capRare()) type = "normal";
      if (type === "elite" && countType("elite") >= capElite()) type = "normal";
      if (type === "normal" && countType("normal") >= capNormal()) return;
      spawnEnemyOfType(type);
    }

    function currentFireInterval() {
      var iv = fireInterval;
      if (powerTime > 0) iv = iv / 1.25;
      if (iv < FIRE_MIN) iv = FIRE_MIN;
      return iv;
    }

    function spawnPlayerBulletAt(x, y, damage) {
      playerBullets.push({
        x: x,
        y: y,
        width: BULLET_W,
        height: BULLET_H,
        speed: bulletSpeed,
        damage: damage != null ? damage : bulletDamage,
        pierce: pierceCount,
      });
    }

    function spawnPlayerBullet() {
      var cx = player.x + player.w / 2;
      spawnPlayerBulletAt(cx - BULLET_W / 2, player.y - BULLET_H, bulletDamage);
      if (extraShot >= 1) {
        spawnPlayerBulletAt(cx - 12 - BULLET_W / 2, player.y - BULLET_H + 4, bulletDamage);
      }
      if (extraShot >= 2) {
        spawnPlayerBulletAt(cx + 12 - BULLET_W / 2, player.y - BULLET_H + 4, bulletDamage);
      }
      if (hasDrone) {
        var dx = player.x + player.w / 2 + Math.cos(droneAngle) * 38 - BULLET_W / 2;
        var dy = player.y + player.h / 2 + Math.sin(droneAngle) * 28 - BULLET_H;
        spawnPlayerBulletAt(dx, dy, bulletDamage);
      }
      muzzleTime = 0.05;
      if (shootSfxWait <= 0) {
        sfx("shoot");
        shootSfxWait = 0.09;
      }
    }

    function spawnEnemyBullet(spec) {
      enemyBullets.push({
        x: spec.x,
        y: spec.y,
        width: spec.width,
        height: spec.height,
        vx: spec.vx,
        vy: spec.vy,
        damage: spec.damage,
        type: spec.type,
        from: spec.from || "",
        life: spec.life != null ? spec.life : 8,
        hp: spec.hp != null ? spec.hp : 0,
        maxHp: spec.maxHp != null ? spec.maxHp : 0,
        destructible: !!spec.destructible,
        turn: spec.turn || 0,
        speed: spec.speed || 0,
      });
    }

    function spawnMissile(fromX, fromY, from) {
      var cx = fromX;
      var cy = fromY;
      var tx = player.x + player.w / 2 - cx;
      var ty = player.y + player.h / 2 - cy;
      var dist = Math.hypot(tx, ty) || 1;
      var isBoss = from === "boss";
      spawnEnemyBullet({
        x: cx - MISSILE_W / 2,
        y: cy,
        width: MISSILE_W,
        height: MISSILE_H,
        vx: (tx / dist) * MISSILE_SPEED,
        vy: (ty / dist) * MISSILE_SPEED,
        damage: 1,
        type: "missile",
        from: from,
        life: isBoss ? MISSILE_LIFE_BOSS : MISSILE_LIFE_RARE,
        hp: MISSILE_HP,
        maxHp: MISSILE_HP,
        destructible: true,
        turn: isBoss ? MISSILE_TURN_BOSS : MISSILE_TURN_RARE,
        speed: MISSILE_SPEED,
      });
    }

    function spawnFan(originX, originY, count, speed) {
      var base = Math.PI / 2;
      var span = count >= 7 ? 1.05 : count >= 5 ? 0.85 : 0.5;
      for (var i = 0; i < count; i++) {
        var t = count === 1 ? 0.5 : i / (count - 1);
        var ang = base + (t - 0.5) * span;
        spawnEnemyBullet({
          x: originX - 4,
          y: originY,
          width: 8,
          height: 14,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          damage: 1,
          type: "spread",
          from: "boss",
          life: 6,
          destructible: false,
        });
      }
    }

    function dropChance(type) {
      if (type === "rare") return DROP_RARE;
      if (type === "elite") return DROP_ELITE;
      return DROP_NORMAL;
    }

    function spawnItemAt(x, y, forced) {
      var kinds = ["heal", "shield", "power", "bomb"];
      var type = forced || kinds[Math.floor(Math.random() * kinds.length)];
      items.push({
        type: type,
        x: x - ITEM_SIZE / 2,
        y: y - ITEM_SIZE / 2,
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        vy: ITEM_SPEED,
      });
    }

    function maybeDrop(dead) {
      var cx = dead.x + dead.width / 2;
      var cy = dead.y + dead.height / 2;
      if (Math.random() < dropChance(dead.type)) spawnItemAt(cx, cy);
    }

    function spawnBossSupply() {
      var kinds = ["heal", "shield", "power"];
      var type = kinds[Math.floor(Math.random() * kinds.length)];
      spawnItemAt(CANVAS_W / 2 + (Math.random() * 80 - 40), 160, type);
    }

    function damageTurret(side, amount) {
      if (!boss) return false;
      var t = side === "left" ? boss.left : boss.right;
      if (!t.alive) return false;
      t.hp -= amount;
      t.flash = 0.1;
      if (t.hp <= 0) {
        t.hp = 0;
        t.alive = false;
        score += SCORE_TURRET;
        maybeUpdateBest();
        addEmp(15);
        spawnExplosion(t.x + t.w / 2, t.y + t.h / 2, "#fb923c", 16);
        spawnFloater(t.x + t.w / 2, t.y, "+500", "#f5c542");
        sfx("explode");
      }
      return true;
    }

    function applyBomb() {
      for (var i = enemyBullets.length - 1; i >= 0; i--) {
        if (enemyBullets[i].type !== "laser") enemyBullets.splice(i, 1);
      }
      for (var e = enemies.length - 1; e >= 0; e--) {
        if (enemies[e].type === "normal" || enemies[e].type === "rare") {
          killEnemyAt(e, true);
        } else {
          enemies[e].hp -= 3;
          enemies[e].flash = 0.1;
          if (enemies[e].hp <= 0) killEnemyAt(e, true);
        }
      }
      if (boss) {
        damageTurret("left", 5);
        damageTurret("right", 5);
        boss.hp -= 10;
        if (boss.hp <= 0) defeatBoss();
      }
    }

    function fireEmp() {
      if (empEnergy < 100) return;
      if (state !== "playing" || upgradeOpen) return;
      empEnergy = 0;
      empRing = 0.4;
      addShake(10, 0.28);
      sfx("emp");
      for (var i = enemyBullets.length - 1; i >= 0; i--) {
        if (enemyBullets[i].type !== "laser") enemyBullets.splice(i, 1);
      }
      for (var e = enemies.length - 1; e >= 0; e--) {
        if (enemies[e].type === "normal" || enemies[e].type === "rare") {
          killEnemyAt(e, true);
        } else {
          enemies[e].hp -= 3;
          enemies[e].flash = 0.12;
          if (enemies[e].hp <= 0) killEnemyAt(e, true);
        }
      }
      if (boss) {
        damageTurret("left", 4);
        damageTurret("right", 4);
        boss.hp -= 8;
        if (boss.hp <= 0) defeatBoss();
      }
    }

    function pickupItem(it) {
      sfx("pickup");
      if (it.type === "heal") {
        player.hp += 1;
        if (player.hp > player.maxHp) player.hp = player.maxHp;
      } else if (it.type === "shield") {
        player.shields += 1;
        if (player.shields > 2) player.shields = 2;
      } else if (it.type === "power") {
        powerTime = POWER_TIME;
      } else if (it.type === "bomb") {
        applyBomb();
      }
    }

    function currentMove() {
      var dx = 0;
      var dy = 0;
      if (isDown("KeyA") || isDown("ArrowLeft")) dx -= 1;
      if (isDown("KeyD") || isDown("ArrowRight")) dx += 1;
      if (isDown("KeyW") || isDown("ArrowUp")) dy -= 1;
      if (isDown("KeyS") || isDown("ArrowDown")) dy += 1;
      return { dx: dx, dy: dy };
    }

    function clampPlayer() {
      if (player.x < 0) player.x = 0;
      if (player.y < 0) player.y = 0;
      if (player.x > CANVAS_W - player.w) player.x = CANVAS_W - player.w;
      if (player.y > CANVAS_H - player.h) player.y = CANVAS_H - player.h;
    }

    function keepIn(obj, minY, maxY) {
      if (obj.x < 4) {
        obj.x = 4;
        obj.vx = Math.abs(obj.vx);
      }
      if (obj.x + obj.width > CANVAS_W - 4) {
        obj.x = CANVAS_W - 4 - obj.width;
        obj.vx = -Math.abs(obj.vx);
      }
      if (obj.y < minY) {
        obj.y = minY;
        obj.vy = Math.abs(obj.vy);
      }
      if (obj.y + obj.height > maxY) {
        obj.y = maxY - obj.height;
        obj.vy = -Math.abs(obj.vy);
      }
    }

    function steerToward(obj, tx, ty, turn, speed, dt) {
      var cx = obj.x + obj.width / 2;
      var cy = obj.y + obj.height / 2;
      var want = Math.atan2(ty - cy, tx - cx);
      var have = Math.atan2(obj.vy, obj.vx);
      if (obj.vx === 0 && obj.vy === 0) have = want;
      var diff = wrapAngle(want - have);
      var maxTurn = turn * dt;
      if (diff > maxTurn) diff = maxTurn;
      if (diff < -maxTurn) diff = -maxTurn;
      var ang = have + diff;
      obj.vx = Math.cos(ang) * speed;
      obj.vy = Math.sin(ang) * speed;
    }

    function xpOf(type) {
      if (type === "rare") return XP_RARE;
      if (type === "elite") return XP_ELITE;
      return XP_NORMAL;
    }

    function empOf(type) {
      if (type === "rare") return 8;
      if (type === "elite") return 20;
      return 3;
    }

    function killEnemyAt(index, fromBomb) {
      var dead = enemies[index];
      score += dead.scoreValue;
      maybeUpdateBest();
      grantXP(xpOf(dead.type));
      addEmp(empOf(dead.type));
      enemiesDestroyed += 1;
      var cx = dead.x + dead.width / 2;
      var cy = dead.y + dead.height / 2;
      spawnFloater(cx, cy - 8, "+" + dead.scoreValue, "#e8eefc");
      if (dead.type === "normal") spawnExplosion(cx, cy, "#ff3b4a", 10);
      else if (dead.type === "rare") spawnExplosion(cx, cy, "#c084fc", 16);
      else {
        spawnExplosion(cx, cy, "#fb923c", 18);
        addShake(4, 0.16);
      }
      sfx("explode");
      if (!fromBomb) maybeDrop(dead);
      enemies.splice(index, 1);
    }

    function destroyMissileAt(index) {
      var m = enemyBullets[index];
      score += SCORE_MISSILE;
      maybeUpdateBest();
      spawnExplosion(m.x + m.width / 2, m.y + m.height / 2, "#e879f9", 10);
      spawnFloater(m.x, m.y, "+25", "#f0abfc");
      sfx("explode");
      enemyBullets.splice(index, 1);
    }

    function steerMissile(b, dt) {
      var cx = b.x + b.width / 2;
      var cy = b.y + b.height / 2;
      var tx = player.x + player.w / 2;
      var ty = player.y + player.h / 2;
      var want = Math.atan2(ty - cy, tx - cx);
      var have = Math.atan2(b.vy, b.vx);
      var diff = wrapAngle(want - have);
      var maxTurn = (b.turn || MISSILE_TURN_RARE) * dt;
      if (diff > maxTurn) diff = maxTurn;
      if (diff < -maxTurn) diff = -maxTurn;
      var ang = have + diff;
      var spd = b.speed || MISSILE_SPEED;
      b.vx = Math.cos(ang) * spd;
      b.vy = Math.sin(ang) * spd;
    }

    function updateNormal(enemy, dt) {
      if (!enemy.entered) {
        enemy.y += enemy.speed * dt;
        if (enemy.y > 36) enemy.entered = true;
        return;
      }
      enemy.speed = enemySpeed;
      steerToward(
        enemy,
        player.x + player.w / 2,
        player.y + player.h / 2,
        NORMAL_TURN,
        enemy.speed,
        dt
      );
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      keepIn(enemy, 8, CANVAS_H - 8);
    }

    function updateRare(enemy, dt) {
      if (!enemy.entered) {
        enemy.y += 90 * dt;
        if (enemy.y > RARE_Y_MIN) enemy.entered = true;
        return;
      }
      var pcx = player.x + player.w / 2;
      var ecx = enemy.x + enemy.width / 2;
      if (Math.abs(ecx - pcx) < 140) {
        enemy.vx += (ecx < pcx ? -1 : 1) * 40 * dt;
      }
      if (Math.abs(enemy.vx) < 40) enemy.vx += enemy.vx >= 0 ? 20 * dt : -20 * dt;
      if (enemy.y < RARE_Y_MIN + 8) enemy.vy += 50 * dt;
      if (enemy.y > RARE_Y_MAX - enemy.height - 8) enemy.vy -= 70 * dt;
      enemy.vy += Math.sin(elapsed * 1.4 + enemy.x * 0.01) * 20 * dt;
      var spd = Math.hypot(enemy.vx, enemy.vy);
      var maxS = enemySpeed * 0.75;
      if (spd > maxS) {
        enemy.vx = (enemy.vx / spd) * maxS;
        enemy.vy = (enemy.vy / spd) * maxS;
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      keepIn(enemy, RARE_Y_MIN, RARE_Y_MAX);

      if (enemy.laserState === "idle") {
        enemy.attackTimer -= dt;
        if (enemy.attackTimer <= 0) {
          enemy.laserState = "warn";
          enemy.laserTimer = RARE_WARN;
        }
        return;
      }
      if (enemy.laserState === "warn") {
        enemy.laserTimer -= dt;
        if (enemy.laserTimer <= 0) {
          spawnMissile(ecx, enemy.y + enemy.height, "rare");
          enemy.laserState = "idle";
          enemy.attackTimer = 3.5 + Math.random() * 1.0;
        }
      }
    }

    function updateElite(enemy, dt) {
      var ecx = enemy.x + enemy.width / 2;
      var ecy = enemy.y + enemy.height / 2;
      if (!enemy.entered) {
        enemy.y += 70 * dt;
        if (enemy.y > ELITE_Y_MIN) enemy.entered = true;
        return;
      }
      if (Math.abs(enemy.vx) < 20) enemy.vx = 40;
      enemy.vy += Math.sin(elapsed * 0.9 + enemy.x * 0.02) * 16 * dt;
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      keepIn(enemy, ELITE_Y_MIN, ELITE_Y_MAX);

      var want = Math.atan2(player.y + player.h / 2 - ecy, player.x + player.w / 2 - ecx);

      if (enemy.laserState === "idle") {
        enemy.attackTimer -= dt;
        if (enemy.attackTimer <= 0) {
          enemy.laserState = "aim";
          enemy.laserTimer = ELITE_AIM;
          enemy.laserAng = want;
          enemy.laserHit = false;
        }
        return;
      }
      if (enemy.laserState === "aim") {
        var diff = wrapAngle(want - enemy.laserAng);
        var maxTurn = 1.45 * dt;
        if (diff > maxTurn) diff = maxTurn;
        if (diff < -maxTurn) diff = -maxTurn;
        enemy.laserAng += diff;
        enemy.laserTimer -= dt;
        if (enemy.laserTimer <= 0) {
          enemy.laserState = "lock";
          enemy.laserTimer = ELITE_LOCK;
        }
        return;
      }
      if (enemy.laserState === "lock") {
        enemy.laserTimer -= dt;
        if (enemy.laserTimer <= 0) {
          enemy.laserState = "beam";
          enemy.laserTimer = ELITE_BEAM;
          enemy.laserHit = false;
        }
        return;
      }
      var end = rayToEdge(ecx, ecy, enemy.laserAng);
      if (!enemy.laserHit && playerHitsBeam(ecx, ecy, end.x, end.y, ELITE_BEAM_W / 2)) {
        if (invulnTime <= 0) {
          hurtPlayer(1);
          enemy.laserHit = true;
        }
      }
      enemy.laserTimer -= dt;
      if (enemy.laserTimer <= 0) {
        enemy.laserState = "idle";
        enemy.attackTimer = 3.5 + Math.random() * 1.0;
      }
    }

    function hitSparks(x, y, color) {
      spawnExplosion(x, y, color, 2 + Math.floor(Math.random() * 3));
    }

    function turretBox(side) {
      if (!boss) return null;
      var t = side === "left" ? boss.left : boss.right;
      if (!t.alive) return null;
      return { x: t.x, y: t.y, width: t.w, height: t.h };
    }

    function syncTurrets() {
      if (!boss) return;
      boss.left.x = boss.x - 10;
      boss.left.y = boss.y + 28;
      boss.right.x = boss.x + boss.width - TURRET_W + 10;
      boss.right.y = boss.y + 28;
    }

    function updatePlayerBullets(dt) {
      var iv = currentFireInterval();
      fireTimer += dt;
      while (fireTimer >= iv) {
        spawnPlayerBullet();
        fireTimer -= iv;
      }
      if (hasDrone) droneAngle += dt * 2.2;
      if (missilePod) {
        missilePodTimer += dt;
        if (missilePodTimer >= 0.45) {
          missilePodTimer = 0;
          spawnPlayerBulletAt(player.x - 4, player.y, bulletDamage);
          spawnPlayerBulletAt(player.x + player.w - 2, player.y, bulletDamage);
        }
      }

      for (var b = playerBullets.length - 1; b >= 0; b--) {
        var bullet = playerBullets[b];
        bullet.y -= bullet.speed * dt;
        if (bullet.y + bullet.height < 0) {
          playerBullets.splice(b, 1);
          continue;
        }
        var consumed = false;
        for (var m = enemyBullets.length - 1; m >= 0; m--) {
          var mis = enemyBullets[m];
          if (!mis.destructible) continue;
          if (!hitTest(bullet, mis)) continue;
          mis.hp -= bullet.damage;
          hitSparks(bullet.x, bullet.y, "#e879f9");
          if (mis.hp <= 0) destroyMissileAt(m);
          if (bullet.pierce > 0) bullet.pierce -= 1;
          else {
            playerBullets.splice(b, 1);
            consumed = true;
          }
          break;
        }
        if (consumed) continue;

        if (boss) {
          syncTurrets();
          var hitPart = false;
          var leftBox = turretBox("left");
          var rightBox = turretBox("right");
          if (leftBox && hitTest(bullet, leftBox)) {
            damageTurret("left", bullet.damage);
            hitSparks(bullet.x, bullet.y, "#ffb4b4");
            hitPart = true;
          } else if (rightBox && hitTest(bullet, rightBox)) {
            damageTurret("right", bullet.damage);
            hitSparks(bullet.x, bullet.y, "#ffb4b4");
            hitPart = true;
          } else if (hitTest(bullet, boss)) {
            boss.hp -= bullet.damage * bossDmgMult;
            hitSparks(bullet.x, bullet.y, "#ff8a90");
            hitPart = true;
            if (boss.hp <= 0) defeatBoss();
          }
          if (hitPart) {
            if (bullet.pierce > 0) bullet.pierce -= 1;
            else {
              playerBullets.splice(b, 1);
              consumed = true;
            }
          }
        }
        if (consumed) continue;

        for (var e = enemies.length - 1; e >= 0; e--) {
          if (!hitTest(bullet, enemies[e])) continue;
          enemies[e].hp -= bullet.damage;
          if (enemies[e].type === "elite") enemies[e].flash = 0.08;
          hitSparks(
            bullet.x + bullet.width / 2,
            bullet.y,
            enemies[e].type === "rare" ? "#e879f9" : "#ffb4b4"
          );
          if (enemies[e].hp <= 0) killEnemyAt(e);
          if (bullet.pierce > 0) bullet.pierce -= 1;
          else playerBullets.splice(b, 1);
          break;
        }
      }
    }

    function updateEnemyBullets(dt) {
      for (var i = enemyBullets.length - 1; i >= 0; i--) {
        var b = enemyBullets[i];
        if (b.type === "missile") steerMissile(b, dt);
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (
          b.life <= 0 ||
          b.y > CANVAS_H ||
          b.y + b.height < -20 ||
          b.x + b.width < -20 ||
          b.x > CANVAS_W + 20
        ) {
          enemyBullets.splice(i, 1);
          continue;
        }
        if (hitTest(player, b)) {
          hurtPlayer(b.damage);
          enemyBullets.splice(i, 1);
        }
      }
    }

    function updateItems(dt) {
      for (var i = items.length - 1; i >= 0; i--) {
        items[i].y += items[i].vy * dt;
        if (items[i].y > CANVAS_H) {
          items.splice(i, 1);
          continue;
        }
        if (hitTest(player, items[i])) {
          pickupItem(items[i]);
          items.splice(i, 1);
        }
      }
    }

    function updateParticles(dt) {
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (var f = floaters.length - 1; f >= 0; f--) {
        floaters[f].y -= 36 * dt;
        floaters[f].life -= dt;
        if (floaters[f].life <= 0) floaters.splice(f, 1);
      }
    }

    function spawnBoss() {
      var hp = bossMaxHp(stage);
      boss = {
        x: (CANVAS_W - BOSS_W) / 2,
        y: -BOSS_H,
        width: BOSS_W,
        height: BOSS_H,
        hp: hp,
        maxHp: hp,
        vx: 80,
        entered: false,
        fanTimer: 1.2,
        missileTimer: 2.5,
        summonTimer: 12 + Math.random() * 3,
        drop70: false,
        drop35: false,
        left: {
          alive: true,
          hp: TURRET_HP,
          maxHp: TURRET_HP,
          x: 0,
          y: 0,
          w: TURRET_W,
          h: TURRET_H,
          flash: 0,
        },
        right: {
          alive: true,
          hp: TURRET_HP,
          maxHp: TURRET_HP,
          x: 0,
          y: 0,
          w: TURRET_W,
          h: TURRET_H,
          flash: 0,
        },
      };
      lastBossPhase = 1;
      syncTurrets();
    }

    function bossPhase() {
      if (!boss) return 1;
      var pct = boss.hp / boss.maxHp;
      if (pct > 0.7) return 1;
      if (pct > 0.35) return 2;
      return 3;
    }

    function fanCount() {
      var phase = bossPhase();
      var n = phase === 3 ? 7 : 5;
      if (boss && !boss.right.alive) n = phase === 3 ? 4 : 3;
      return n;
    }

    function defeatBoss() {
      if (!boss) return;
      var bx = boss.x + boss.width / 2;
      var by = boss.y + boss.height / 2;
      spawnExplosion(bx, by, "#ff3b4a", 28);
      spawnExplosion(boss.x + 30, by, "#fb923c", 16);
      spawnExplosion(boss.x + boss.width - 30, by, "#f5c542", 16);
      spawnExplosion(bx, by + 20, "#fff", 12);
      addShake(16, 0.5);
      sfx("boss");
      score += BOSS_SCORE;
      maybeUpdateBest();
      addEmp(100);
      bossesDestroyed += 1;
      spawnFloater(bx, by, "+5000", "#f5c542");
      for (var i = enemyBullets.length - 1; i >= 0; i--) enemyBullets.splice(i, 1);
      boss = null;
      pendingBossReward = true;
      pendingBossXp = XP_BOSS;
      waveState = "clear";
      defeatedTimer = 2;
    }

    function enterNextStage() {
      stage += 1;
      maybeUpdateBest();
      player.hp += 1;
      if (player.hp > player.maxHp) player.hp = player.maxHp;
      enemyBullets = [];
      stageTime = 0;
      spawnTimer = 0;
      waveState = "intro";
      introTimer = 1.6;
      updateDifficulty();
    }

    function summonMinions() {
      var n = 2 + Math.floor(Math.random() * 3);
      for (var i = 0; i < n; i++) spawnEnemyOfType("normal");
      if (Math.random() < 0.28) spawnEnemyOfType("rare");
    }

    function updateBoss(dt) {
      if (!boss) return;
      if (boss.left.flash > 0) boss.left.flash -= dt;
      if (boss.right.flash > 0) boss.right.flash -= dt;
      if (!boss.entered) {
        boss.y += 80 * dt;
        if (boss.y >= BOSS_ARRIVE_Y) {
          boss.y = BOSS_ARRIVE_Y;
          boss.entered = true;
        }
      } else {
        boss.x += boss.vx * dt;
        if (boss.x < 36) {
          boss.x = 36;
          boss.vx = Math.abs(boss.vx);
        }
        if (boss.x + boss.width > CANVAS_W - 36) {
          boss.x = CANVAS_W - 36 - boss.width;
          boss.vx = -Math.abs(boss.vx);
        }
      }
      syncTurrets();
      if (invulnTime <= 0 && hitTest(player, boss)) hurtPlayer(1);
      if (!boss.entered) return;

      var pct = boss.hp / boss.maxHp;
      if (!boss.drop70 && pct <= 0.7) {
        boss.drop70 = true;
        spawnBossSupply();
      }
      if (!boss.drop35 && pct <= 0.35) {
        boss.drop35 = true;
        spawnBossSupply();
      }

      var phase = bossPhase();
      if (phase !== lastBossPhase) {
        lastBossPhase = phase;
        addShake(8, 0.28);
        if (phase === 2) showBanner("PHASE 2", 1.3);
        if (phase === 3) showBanner("FINAL PHASE", 1.4);
      }

      var ox = boss.x + boss.width / 2;
      var oy = boss.y + boss.height;
      var fanIv = phase === 1 ? 1.65 : phase === 2 ? 1.7 : 1.55;
      boss.fanTimer -= dt;
      if (boss.fanTimer <= 0) {
        spawnFan(ox, oy, fanCount(), FAN_SPEED);
        boss.fanTimer = fanIv;
        if (phase >= 2) boss.missileTimer = Math.max(boss.missileTimer, 0.55);
      }

      var maxM = 0;
      var mIv = 99;
      if (phase === 2) {
        maxM = 1;
        mIv = 5;
      }
      if (phase === 3) {
        maxM = 2;
        mIv = 4;
      }
      if (boss.left.alive && maxM > 0) {
        boss.missileTimer -= dt;
        if (boss.missileTimer <= 0 && countMissiles("boss") < maxM) {
          spawnMissile(ox - 24, oy, "boss");
          boss.missileTimer = mIv;
          boss.fanTimer = Math.max(boss.fanTimer, 0.5);
        }
      } else {
        boss.missileTimer = 1;
      }

      boss.summonTimer -= dt;
      if (boss.summonTimer <= 0) {
        summonMinions();
        boss.summonTimer = 12 + Math.random() * 3;
      }
    }

    function updateStars(dt) {
      for (var i = 0; i < stars.length; i++) {
        stars[i].y += stars[i].speed * dt;
        if (stars[i].y > CANVAS_H) {
          stars[i].y = -2;
          stars[i].x = Math.random() * CANVAS_W;
        }
      }
    }

    function update(dt) {
      if (state !== "playing") return;
      if (upgradeOpen) return;

      elapsed += dt;
      if (waveState === "normal") stageTime += dt;
      updateDifficulty();
      score += dt * 10;
      maybeUpdateBest();

      if (invulnTime > 0) {
        invulnTime -= dt;
        if (invulnTime < 0) invulnTime = 0;
      }
      if (blinkCooldown > 0) {
        blinkCooldown -= dt;
        if (blinkCooldown < 0) blinkCooldown = 0;
      }
      if (powerTime > 0) {
        powerTime -= dt;
        if (powerTime < 0) powerTime = 0;
      }
      if (muzzleTime > 0) muzzleTime -= dt;
      if (hurtFlash > 0) hurtFlash -= dt;
      if (hurtWhite > 0) hurtWhite -= dt;
      if (bannerTime > 0) bannerTime -= dt;
      if (shootSfxWait > 0) shootSfxWait -= dt;
      if (empRing > 0) empRing -= dt;
      if (shakeTime > 0) {
        shakeTime -= dt;
        if (shakeTime < 0) shakeTime = 0;
      }

      var move = currentMove();
      player.x += move.dx * moveSpeed * dt;
      player.y += move.dy * moveSpeed * dt;
      clampPlayer();

      if (waveState === "normal" && !boss && stageTime >= STAGE_COMBAT) {
        waveState = "warning";
        warningTimer = 2;
        sfx("warn");
      }

      if (waveState === "warning") {
        warningTimer -= dt;
        if (warningTimer <= 0) {
          waveState = "boss";
          spawnBoss();
        }
      } else if (waveState === "clear") {
        defeatedTimer -= dt;
        if (defeatedTimer <= 0) {
          if (pendingBossReward) showBossReward();
          else enterNextStage();
        }
      } else if (waveState === "intro") {
        introTimer -= dt;
        if (introTimer <= 0) waveState = "normal";
      }

      if (waveState === "normal") {
        spawnTimer += dt;
        while (spawnTimer >= spawnInterval) {
          spawnEnemy();
          spawnTimer -= spawnInterval;
        }
      }

      for (var i = enemies.length - 1; i >= 0; i--) {
        var enemy = enemies[i];
        if (enemy.flash > 0) enemy.flash -= dt;
        if (enemy.type === "normal") updateNormal(enemy, dt);
        else if (enemy.type === "rare") updateRare(enemy, dt);
        else updateElite(enemy, dt);

        if (
          enemy.y > CANVAS_H + 80 ||
          enemy.x + enemy.width < -80 ||
          enemy.x > CANVAS_W + 80
        ) {
          enemies.splice(i, 1);
          continue;
        }
        if (hitTest(player, enemy)) {
          hurtPlayer(1);
          if (enemy.type === "normal") killEnemyAt(i, true);
        }
      }

      updateBoss(dt);
      updateEnemyBullets(dt);
      updateItems(dt);
      if (state !== "playing") {
        updateParticles(dt);
        return;
      }
      updatePlayerBullets(dt);
      updateParticles(dt);
    }

    function blinkLabel() {
      if (blinkCooldown <= 0) return "Dash: Ready";
      return "Dash: " + blinkCooldown.toFixed(1) + "s";
    }

    function empLabel() {
      if (empEnergy >= 100) return "EMP READY";
      return "EMP: " + Math.floor(empEnergy) + "%";
    }

    function drawHud() {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#e8eefc";
      ctx.font = UI_FONT;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("HP: " + player.hp + "/" + player.maxHp, 16, 14);
      ctx.fillText("Score: " + Math.floor(score), 16, 36);
      ctx.fillText("Best: " + best, 16, 58);
      ctx.fillText("Stage: " + stage, 16, 80);
      ctx.fillText("Ship Lv: " + playerLevel, 16, 102);
      ctx.fillText("XP: " + xp + "/" + xpNeeded(playerLevel), 16, 124);
      ctx.fillText(blinkLabel(), 16, 146);
      ctx.fillStyle = empEnergy >= 100 ? "#7dd3fc" : "#e8eefc";
      ctx.fillText(empLabel(), 16, 168);
      var extraY = 190;
      if (player.shields > 0) {
        ctx.fillStyle = "#7dd3fc";
        ctx.fillText("Shield: " + player.shields, 16, extraY);
        extraY += 22;
      }
      if (powerTime > 0) {
        ctx.fillStyle = "#f5c542";
        ctx.fillText("Power: " + powerTime.toFixed(1) + "s", 16, extraY);
      }
    }

    function drawBossBar() {
      if (!boss) return;
      ctx.shadowBlur = 0;
      var bx = 180;
      var by = 12;
      var bw = 440;
      var bh = 16;
      ctx.fillStyle = "#2a2f3a";
      ctx.fillRect(bx, by, bw, bh);
      var ratio = boss.hp / boss.maxHp;
      if (ratio < 0) ratio = 0;
      ctx.fillStyle = bossPhase() === 3 ? "#ff2a3a" : "#c81e2c";
      ctx.fillRect(bx, by, bw * ratio, bh);
      ctx.strokeStyle = "#e8eefc";
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = "#e8eefc";
      ctx.font = UI_FONT_SM;
      ctx.textAlign = "left";
      ctx.fillText("BOSS", bx, by + 18);
      ctx.textAlign = "right";
      ctx.fillText(
        Math.max(0, Math.ceil(boss.hp)) + " / " + boss.maxHp,
        bx + bw,
        by + 18
      );
    }

    function drawButton(b, i) {
      var hot = hoverBtn === i;
      ctx.fillStyle = hot ? "#1a2744" : "#10182c";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = hot ? "#7eb6ff" : "#3b547c";
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      ctx.fillStyle = "#e8eefc";
      ctx.font = UI_FONT_MD;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
    }

    function drawMenu() {
      uiButtons = [];
      ctx.save();
      ctx.shadowColor = "#4da3ff";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#dce9ff";
      ctx.font = UI_FONT_TITLE;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("NEON STRIKE", CANVAS_W / 2, 150);
      ctx.restore();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#8b97b3";
      ctx.font = UI_FONT_SM;
      ctx.textAlign = "center";
      ctx.fillText("Best Score  " + best, CANVAS_W / 2, 210);
      ctx.fillText("Highest Stage  " + bestStage, CANVAS_W / 2, 236);
      addBtn("start", 275, 276, 250, 48, "START GAME");
      addBtn("howto", 275, 334, 250, 48, "HOW TO PLAY");
      addBtn("download", 275, 392, 250, 48, "DOWNLOAD SOURCE");
      addBtn("sfx", 275, 468, 118, 40, "SFX: " + (sfxOn ? "ON" : "OFF"));
      addBtn("music", 407, 468, 118, 40, "Music: " + (musicOn ? "ON" : "OFF"));
      for (var i = 0; i < uiButtons.length; i++) drawButton(uiButtons[i], i);
    }

    function drawHowTo() {
      uiButtons = [];
      ctx.fillStyle = "#e8eefc";
      ctx.font = UI_FONT_MD;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText("HOW TO PLAY", CANVAS_W / 2, 56);
      ctx.fillStyle = "#c5d0e6";
      ctx.font = UI_FONT_SM;
      var lines = [
        "WASD / Arrow Keys: Move",
        "Shift: Dash   Space: EMP when ready (else Dash)",
        "Auto fire. Shoot missiles to destroy them.",
        "Red chasers: 1 HP. Purple rares fire missiles.",
        "Orange elites charge a laser: follow, lock, fire.",
        "Break Boss turrets to disable weapons.",
        "Kill enemies to gain XP and EMP energy.",
        "Pickups: Heal / Shield / Power / Bomb",
        "ESC: Pause",
      ];
      for (var i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], CANVAS_W / 2, 110 + i * 28);
      }
      addBtn("back", 300, 500, 200, 48, "BACK");
      drawButton(uiButtons[0], 0);
    }

    function drawPaused() {
      uiButtons = [];
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#e8eefc";
      ctx.font = UI_FONT_LG;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("PAUSED", CANVAS_W / 2, 160);
      addBtn("resume", 275, 240, 250, 50, "Resume");
      addBtn("restart", 275, 306, 250, 50, "Restart");
      addBtn("menu", 275, 372, 250, 50, "Main Menu");
      for (var i = 0; i < uiButtons.length; i++) drawButton(uiButtons[i], i);
    }

    function drawGameOver() {
      uiButtons = [];
      ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#e8eefc";
      ctx.font = UI_FONT_LG;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("GAME OVER", CANVAS_W / 2, 110);
      ctx.font = UI_FONT_SM;
      ctx.fillStyle = "#c5d0e6";
      var y = 180;
      ctx.fillText("Score: " + Math.floor(score), CANVAS_W / 2, y);
      ctx.fillText("Best Score: " + best, CANVAS_W / 2, y + 26);
      ctx.fillText("Stage: " + stage, CANVAS_W / 2, y + 52);
      ctx.fillText("Player Level: " + playerLevel, CANVAS_W / 2, y + 78);
      ctx.fillText("Enemies Destroyed: " + enemiesDestroyed, CANVAS_W / 2, y + 104);
      ctx.fillText("Bosses Destroyed: " + bossesDestroyed, CANVAS_W / 2, y + 130);
      addBtn("restart", 275, 380, 250, 50, "RESTART");
      addBtn("menu", 275, 446, 250, 50, "MAIN MENU");
      for (var i = 0; i < uiButtons.length; i++) drawButton(uiButtons[i], i);
    }

    function drawUpgrade() {
      ctx.fillStyle = "rgba(4, 8, 18, 0.78)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#e8eefc";
      ctx.font = UI_FONT_MD;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        upgradeKind === "boss" ? "RARE UPGRADE  ·  Choose 1" : "LEVEL UP  ·  Choose 1",
        CANVAS_W / 2,
        86
      );
      ctx.fillStyle = "#8b97b3";
      ctx.font = UI_FONT_SM;
      ctx.fillText("Click a card  ·  or press 1 / 2 / 3", CANVAS_W / 2, 118);

      for (var i = 0; i < upgradeChoices.length; i++) {
        var r = cardRect(i);
        var hot = hoverCard === i;
        ctx.fillStyle = hot ? "#1a2744" : "#10182c";
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = hot ? "#7eb6ff" : "#3b547c";
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
        ctx.fillStyle = "#8b97b3";
        ctx.font = UI_FONT_SM;
        ctx.fillText(String(i + 1), r.x + r.w / 2, r.y + 28);
        ctx.fillStyle = "#dce9ff";
        ctx.font = UI_FONT_MD;
        ctx.fillText(upgradeChoices[i].name, r.x + r.w / 2, r.y + 78);
        ctx.fillStyle = "#9aa8c4";
        ctx.font = UI_FONT_SM;
        var lines = upgradeChoices[i].desc.split("\n");
        for (var n = 0; n < lines.length; n++) {
          ctx.fillText(lines[n], r.x + r.w / 2, r.y + 130 + n * 22);
        }
      }
    }

    function drawEliteHpBar(enemy) {
      var barW = enemy.width;
      var barH = 5;
      var bx = enemy.x;
      var by = enemy.y - 9;
      var ratio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;
      if (ratio < 0) ratio = 0;
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#2a2f3a";
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = ratio > 0.35 ? "#fb923c" : "#ff3b4a";
      ctx.fillRect(bx, by, barW * ratio, barH);
    }

    function itemColor(type) {
      if (type === "heal") return "#4ade80";
      if (type === "shield") return "#38bdf8";
      if (type === "power") return "#facc15";
      return "#f87171";
    }

    function drawLaser(enemy) {
      var ecx = enemy.x + enemy.width / 2;
      var ecy = enemy.y + enemy.height / 2;
      var end = rayToEdge(ecx, ecy, enemy.laserAng);
      if (enemy.laserState === "aim") {
        ctx.strokeStyle = "rgba(255, 80, 80, 0.35)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ecx, ecy);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      } else if (enemy.laserState === "lock") {
        ctx.strokeStyle = "rgba(255, 180, 120, 0.85)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(ecx, ecy);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      } else if (enemy.laserState === "beam") {
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#ff4d3a";
        ctx.strokeStyle = "rgba(255, 70, 40, 0.95)";
        ctx.lineWidth = ELITE_BEAM_W;
        ctx.beginPath();
        ctx.moveTo(ecx, ecy);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255, 230, 200, 0.9)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(ecx, ecy);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    function drawBodies() {
      ctx.fillStyle = "#9ecbff";
      for (var st = 0; st < stars.length; st++) {
        ctx.globalAlpha = stars[st].alpha;
        ctx.fillRect(stars[st].x, stars[st].y, stars[st].size, stars[st].size);
      }
      ctx.globalAlpha = 1;

      ctx.shadowBlur = 12;
      ctx.shadowColor = "#ff3b4a";
      ctx.fillStyle = "#ff3b4a";
      for (var i = 0; i < enemies.length; i++) {
        if (enemies[i].type === "normal") {
          ctx.fillRect(
            enemies[i].x,
            enemies[i].y,
            enemies[i].width,
            enemies[i].height
          );
        }
      }

      for (var j = 0; j < enemies.length; j++) {
        if (enemies[j].type !== "rare") continue;
        var charging = enemies[j].laserState === "warn";
        ctx.shadowColor = charging ? "#ffe0ff" : "#c084fc";
        ctx.fillStyle = charging ? "#f0abfc" : "#c084fc";
        ctx.fillRect(
          enemies[j].x,
          enemies[j].y,
          enemies[j].width,
          enemies[j].height
        );
      }

      for (var n = 0; n < enemies.length; n++) {
        if (enemies[n].type !== "elite") continue;
        if (enemies[n].flash > 0) {
          ctx.shadowColor = "#ffffff";
          ctx.fillStyle = "#ffffff";
        } else {
          ctx.shadowColor = "#fb923c";
          ctx.fillStyle = "#fb923c";
        }
        ctx.fillRect(
          enemies[n].x,
          enemies[n].y,
          enemies[n].width,
          enemies[n].height
        );
      }

      ctx.shadowBlur = 0;
      for (var h = 0; h < enemies.length; h++) {
        if (enemies[h].type === "elite") {
          drawEliteHpBar(enemies[h]);
          if (enemies[h].laserState !== "idle") drawLaser(enemies[h]);
        }
      }

      if (boss) {
        var angry = bossPhase() === 3;
        ctx.shadowBlur = 18;
        ctx.shadowColor = angry ? "#ff2a3a" : "#8b111c";
        ctx.fillStyle = angry ? "#ff2a3a" : "#8b111c";
        ctx.fillRect(boss.x, boss.y, boss.width, boss.height);
        ctx.shadowBlur = 0;
        ctx.fillStyle = angry ? "#ff8a90" : "#c44";
        ctx.fillRect(boss.x + 16, boss.y + 16, boss.width - 32, 18);
        if (boss.left.alive) {
          ctx.fillStyle = boss.left.flash > 0 ? "#fff" : "#fb7185";
          ctx.fillRect(boss.left.x, boss.left.y, boss.left.w, boss.left.h);
        }
        if (boss.right.alive) {
          ctx.fillStyle = boss.right.flash > 0 ? "#fff" : "#fb923c";
          ctx.fillRect(boss.right.x, boss.right.y, boss.right.w, boss.right.h);
        }
      }

      ctx.shadowBlur = 8;
      for (var eb = 0; eb < enemyBullets.length; eb++) {
        var shot = enemyBullets[eb];
        if (shot.type === "missile") {
          ctx.shadowColor = "#e879f9";
          ctx.fillStyle = shot.from === "boss" ? "#f43f5e" : "#e11d8f";
        } else {
          ctx.shadowColor = "#fb7185";
          ctx.fillStyle = "#f97316";
        }
        ctx.fillRect(shot.x, shot.y, shot.width, shot.height);
      }

      ctx.shadowColor = "#9fd4ff";
      ctx.fillStyle = "#b8e0ff";
      for (var k = 0; k < playerBullets.length; k++) {
        ctx.fillRect(
          playerBullets[k].x,
          playerBullets[k].y,
          playerBullets[k].width,
          playerBullets[k].height
        );
      }

      for (var it = 0; it < items.length; it++) {
        ctx.shadowColor = itemColor(items[it].type);
        ctx.fillStyle = itemColor(items[it].type);
        ctx.fillRect(items[it].x, items[it].y, items[it].width, items[it].height);
      }

      if (hasDrone) {
        var dx = player.x + player.w / 2 + Math.cos(droneAngle) * 38 - 6;
        var dy = player.y + player.h / 2 + Math.sin(droneAngle) * 28 - 6;
        ctx.shadowColor = "#7dd3fc";
        ctx.fillStyle = "#7dd3fc";
        ctx.fillRect(dx, dy, 12, 12);
      }

      ctx.shadowColor = "#3b9eff";
      ctx.shadowBlur = 16;
      var showPlayer =
        invulnTime <= 0 || Math.floor(invulnTime / 0.1) % 2 === 0;
      if (showPlayer) {
        ctx.fillStyle = hurtWhite > 0 ? "#ffffff" : "#4da3ff";
        ctx.fillRect(player.x, player.y, player.w, player.h);
        ctx.shadowBlur = 0;
        ctx.fillStyle = player.shields > 0 ? "#bae6fd" : "#cfe6ff";
        var pad = Math.max(3, player.w * 0.2);
        ctx.fillRect(
          player.x + pad,
          player.y + pad,
          player.w - pad * 2,
          player.h - pad * 2
        );
        if (muzzleTime > 0) {
          ctx.fillStyle = "#9fd4ff";
          ctx.fillRect(player.x + player.w / 2 - 5, player.y - 8, 10, 8);
        }
      } else {
        ctx.shadowBlur = 0;
      }

      for (var p = 0; p < particles.length; p++) {
        var part = particles[p];
        ctx.globalAlpha = Math.max(0, part.life / part.maxLife);
        ctx.fillStyle = part.color;
        ctx.fillRect(part.x, part.y, part.size, part.size);
      }
      ctx.globalAlpha = 1;

      if (empRing > 0) {
        var pr = (1 - empRing / 0.4) * 420;
        ctx.strokeStyle = "rgba(180, 230, 255," + (empRing / 0.4) * 0.9 + ")";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(player.x + player.w / 2, player.y + player.h / 2, pr, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = UI_FONT_SM;
      for (var fl = 0; fl < floaters.length; fl++) {
        ctx.globalAlpha = Math.max(0, floaters[fl].life / floaters[fl].maxLife);
        ctx.fillStyle = floaters[fl].color;
        ctx.fillText(floaters[fl].text, floaters[fl].x, floaters[fl].y);
      }
      ctx.globalAlpha = 1;

      if (waveState === "warning") {
        ctx.fillStyle = "rgba(80, 0, 0, 0.35)";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = "#ff4d4d";
        ctx.font = UI_FONT_LG;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("WARNING", CANVAS_W / 2, CANVAS_H / 2);
      }
      if (waveState === "clear") {
        ctx.fillStyle = "#f5c542";
        ctx.font = UI_FONT_LG;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("BOSS DEFEATED", CANVAS_W / 2, CANVAS_H / 2);
      }
      if (waveState === "intro") {
        ctx.fillStyle = "#dce9ff";
        ctx.font = UI_FONT_LG;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("STAGE " + stage, CANVAS_W / 2, CANVAS_H / 2);
      }
      if (bannerTime > 0 && bannerText) {
        ctx.globalAlpha = Math.min(1, bannerTime);
        ctx.fillStyle = "#ffb4b4";
        ctx.font = UI_FONT_MD;
        ctx.textAlign = "center";
        ctx.fillText(bannerText, CANVAS_W / 2, 90);
        ctx.globalAlpha = 1;
      }

      if (hurtFlash > 0) {
        ctx.globalAlpha = Math.min(0.45, hurtFlash * 1.6);
        ctx.fillStyle = "#ff2a3a";
        ctx.fillRect(0, 0, CANVAS_W, 18);
        ctx.fillRect(0, CANVAS_H - 18, CANVAS_W, 18);
        ctx.fillRect(0, 0, 18, CANVAS_H);
        ctx.fillRect(CANVAS_W - 18, 0, 18, CANVAS_H);
        ctx.globalAlpha = 1;
      }
    }

    function draw() {
      uiButtons = [];
      ctx.shadowBlur = 0;
      ctx.save();
      if (shakeTime > 0 && state === "playing") {
        var mag = shakeMag * (shakeTime > 0.2 ? 1 : shakeTime / 0.2);
        ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(-20, -20, CANVAS_W + 40, CANVAS_H + 40);
      drawBodies();
      ctx.restore();

      if (state === "menu") {
        drawMenu();
        return;
      }
      if (state === "howto") {
        drawHowTo();
        return;
      }
      if (state === "gameover") {
        drawGameOver();
        return;
      }
      drawHud();
      drawBossBar();
      if (upgradeOpen) drawUpgrade();
      if (state === "paused") drawPaused();
    }

    function loop(timestamp) {
      if (!lastTime) lastTime = timestamp;
      var dt = (timestamp - lastTime) / 1000;
      lastTime = timestamp;
      if (dt > MAX_DT) dt = MAX_DT;
      updateStars(dt);
      update(dt);
      draw();
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    function cleanup() {
      cancelAnimationFrame(rafId);
      stopMusic();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearKeys);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      if (window.__controlsTest) window.__controlsTest = undefined;
    }

    cleanupPrev = cleanup;

    window.__controlsTest = {
      getYaw: function () {
        return 0;
      },
      getSpeed: function () {
        if (state !== "playing" || upgradeOpen) return 0;
        var mv = currentMove();
        return Math.hypot(mv.dx, mv.dy) * moveSpeed;
      },
      getX: function () {
        return player.x;
      },
      getY: function () {
        return player.y;
      },
      isGameOver: function () {
        return state === "gameover";
      },
      getState: function () {
        return state;
      },
      getScore: function () {
        return Math.floor(score);
      },
      getBest: function () {
        return best;
      },
      getLevel: function () {
        return threat;
      },
      getStage: function () {
        return stage;
      },
      getElapsed: function () {
        return elapsed;
      },
      getHp: function () {
        return player.hp;
      },
      getMaxHp: function () {
        return player.maxHp;
      },
      getShields: function () {
        return player.shields;
      },
      getEmp: function () {
        return empEnergy;
      },
      getShipLevel: function () {
        return playerLevel;
      },
      getXp: function () {
        return xp;
      },
      isUpgradeOpen: function () {
        return upgradeOpen;
      },
      getUpgradeIds: function () {
        var ids = [];
        for (var i = 0; i < upgradeChoices.length; i++) ids.push(upgradeChoices[i].id);
        return ids;
      },
      getFireInterval: function () {
        return fireInterval;
      },
      getWave: function () {
        return waveState;
      },
      getBossHp: function () {
        return boss ? boss.hp : 0;
      },
      hasBoss: function () {
        return !!boss;
      },
      getEnemySpeed: function () {
        return enemySpeed;
      },
      getSpawnInterval: function () {
        return spawnInterval;
      },
      getDashCooldown: function () {
        return blinkCooldown;
      },
      getDashTime: function () {
        return invulnTime;
      },
      getBlinkCooldown: function () {
        return blinkCooldown;
      },
      getInvulnTime: function () {
        return invulnTime;
      },
      getEnemyCount: function () {
        return enemies.length;
      },
      getBulletCount: function () {
        return playerBullets.length;
      },
      getEnemyBulletCount: function () {
        return enemyBullets.length;
      },
      getItemCount: function () {
        return items.length;
      },
      getEnemies: function () {
        var list = [];
        for (var i = 0; i < enemies.length; i++) {
          list.push({
            type: enemies[i].type,
            eliteType: null,
            x: enemies[i].x,
            y: enemies[i].y,
            width: enemies[i].width,
            hp: enemies[i].hp,
            maxHp: enemies[i].maxHp,
            scoreValue: enemies[i].scoreValue,
            speed: enemies[i].speed,
            dashState: "idle",
            laserState: enemies[i].laserState,
          });
        }
        return list;
      },
      setElapsed: function (seconds) {
        elapsed = seconds;
        stageTime = seconds;
        updateDifficulty();
      },
      setKeys: function (codes) {
        var next = {};
        for (var i = 0; i < codes.length; i++) next[codes[i]] = true;
        injectedKeys = next;
      },
      tryDash: function () {
        tryBlink();
      },
      tryBlink: function () {
        tryBlink();
      },
      beginPlay: function () {
        resetGame();
      },
      spawnEnemyAtPlayer: function () {
        enemies.push(makeEnemy("normal", player.x, player.y));
      },
      spawnNormalAt: function (x, y) {
        enemies.push(makeEnemy("normal", x, y));
      },
      spawnRareAt: function (x, y) {
        var e = makeEnemy("rare", x, y);
        e.attackTimer = 0.05;
        e.entered = true;
        enemies.push(e);
      },
      spawnEliteAt: function (x, y) {
        var e = makeEnemy("elite", x, y);
        e.entered = true;
        e.attackTimer = 0.05;
        enemies.push(e);
      },
      spawnEliteDashAt: function (x, y) {
        var e = makeEnemy("elite", x, y);
        e.entered = true;
        enemies.push(e);
      },
      spawnItemAt: function (x, y, type) {
        spawnItemAt(x, y, type);
      },
      spawnRoll: function () {
        spawnEnemy();
      },
      fireNow: function () {
        spawnPlayerBullet();
      },
      fireEmp: function () {
        empEnergy = 100;
        fireEmp();
      },
      grantXP: function (n) {
        grantXP(n);
      },
      pickUpgrade: function (i) {
        pickUpgrade(i);
      },
      restart: function () {
        resetGame();
      },
    };

    return cleanup;
  }

  window.startDodgeGame = startDodgeGame;
})();
