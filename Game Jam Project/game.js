/* Phaser 3 Puzzle Prototype — The Changing of Time (Polished)
 - Multiple levels, level select, level restart
 - Procedurally generated simple textures (no external art files)
 - Undo (Z) and rewind (hold R) with limited rewind energy
 - Adjustable timeScale with + / - keys
 - Simple ambient audio generated with WebAudio (toggleable)
 - Visual polish: shadows, goal highlights, UI energy bar
*/

const TILE = 64;
const ROWS = 8;
const COLS = 10;
const CANVAS_WIDTH = window.innerWidth;
const CANVAS_HEIGHT = window.innerHeight;
const BASE_TIME = 60; // base seconds per level
const DEFAULT_VOLUME = 0.6;

// Level difficulty (1-3 stars)
const LEVEL_DIFFICULTY = [1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3];
const BASE_LEVEL_COUNT = 12; // Number of pre-made levels (not custom)

const LEVELS = [
  [
    '##########',
    '#   .    #',
    '#  $$    #',
    '#  @     #',
    '#        #',
    '#   .    #',
    '#        #',
    '##########'
  ],
  [
    '##########',
    '#  .     #',
    '# $$$    #',
    '#  @     #',
    '#   $    #',
    '#   .    #',
    '#        #',
    '##########'
  ],
  [
    '##########',
    '#   ...  #',
    '#  $$ $  #',
    '#   @    #',
    '#        #',
    '#        #',
    '#        #',
    '##########'
  ],
  [
    '##########',
    '#  ..    #',
    '#  $$    #',
    '# ## @   #',
    '#   $    #',
    '#   .    #',
    '#        #',
    '##########'
  ],
  [
    '##########',
    '# .  .   #',
    '# $$ $   #',
    '#  @     #',
    '#   $C   #',
    '#   .    #',
    '#        #',
    '##########'
  ],
  [
    '##########',
    '#M    . .#',
    '#.$$  $  #',
    '#  @@    #',
    '# $$ . C #',
    '#   $    #',
    '#        #',
    '##########'
  ],
  [
    '##########',
    '# . . M  #',
    '#  $$  C #',
    '#  @$    #',
    '#  $$    #',
    '#  ...   #',
    '#        #',
    '##########'
  ],
  [
    '##########',
    '# $M$ $  #',
    '# $$$$   #',
    '#  @ C   #',
    '###...## #',
    '# $ $ $$ #',
    '#        #',
    '##########'
  ],
  [
    '##########',
    '# . . .M #',
    '#  $ $   #',
    '#  $$$   #',
    '##$@$  ###',
    '# . .    #',
    '#        #',
    '##########'
  ],
  [
    '##########',
    '# . M .  #',
    '#  $$  C #',
    '#  @$    #',
    '#  $$    #',
    '#  ...   #',
    '#        #',
    '##########'
  ],
  [
    '##########',
    '#M . . M #',
    '# $$$$$C #',
    '#   @    #',
    '# $$     #',
    '#  ...   #',
    '#        #',
    '##########'
  ],
  [
    '##########',
    '# M   M  #',
    '#  . . C #',
    '# $$ $$  #',
    '#   @    #',
    '# . M .  #',
    '#        #',
    '##########'
  ]
];

const LEVEL_TIPS = [
  'Nudge crates so you never trap a goal against a wall.',
  'Push from the sides to leave room for diagonals later.',
  'Use space near the bottom to realign before committing.',
  'Clear the left goal first so you do not lock the corner.',
  'Stagger boxes; do not push two into the same lane early.',
  'Plan around the pull: keep crates out of the inner ring.',
  'Move one crate at a time; bait the pull to free space.',
  'Solve the lower goals first; leave the top lane for last.',
  'Drop one crate at a time; reset if the pull steals spacing.',
  'Escort each crate; do not park them within two tiles of M.',
  'Navigate between two black holes; prioritize safe lanes.',
  'Three hazards: map a safe path before moving any crate.'
];

let currentLevelIndex = 0;

const config = {
  type: Phaser.AUTO,
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#0a0a0f',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: { preload, create, update }
};

const game = new Phaser.Game(config);

function preload() {
  // try loading the user's background music file. Place your file at:
  // `assets/music/Komiku - Bleu.mp3` (recommended) or adjust the path below.
  try { this.load.audio('bgMusic', 'Komiku - Bleu.mp3'); } catch(e) { /* ignore if missing */ }
  // load crystal sprite and SFX
  try { this.load.image('crystal', 'crystal.png'); } catch(e) { /* will generate procedural if missing */ }
  try { this.load.audio('crystalSFX', 'crystal-pickup.mp3'); } catch(e) { /* will use fallback tone */ }
}

function create() {
  const scene = this;
  scene.timeScale = 1.0;
  scene.history = [];
  scene.isRewinding = false;
  scene.energy = 120; // rewind energy
  scene.maxEnergy = 120;
  scene.moveCooldown = 0;
  scene.animDuration = 120;
  scene._won = false;
  scene.bgVolume = DEFAULT_VOLUME;
  scene.moveCount = 0; // track moves for current level
  scene.rewindUsed = false; // track if rewind was used
  scene.startTime = 0; // will be set when level loads
  // center offsets to place the grid in the middle of the canvas
  scene.gridOffsetX = Math.floor((CANVAS_WIDTH - COLS * TILE) / 2);
  scene.gridOffsetY = Math.floor((CANVAS_HEIGHT - ROWS * TILE) / 2);

  // black holes state (initialized in loadLevel)
  scene.blackHoles = [];
  // crystals state (initialized in loadLevel)
  scene.crystals = [];

  // groups/holders
  scene.mapSprites = [];
  scene.boxGroup = scene.add.group();

  // create simple textures
  makeTextures(scene);

  // ambient particles disabled: Phaser particle API changed in v3.60+, avoid createEmitter error
  // (left here in case we add a compatible particle implementation later)

  // input
  scene.cursors = scene.input.keyboard.createCursorKeys();
  scene.keyR = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
  scene.keyE = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  scene.keyPlus = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.EQUALS);
  scene.keyMinus = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS);
  scene.keyEsc = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

  // UI text and energy bar
  scene.statusText = scene.add.text(8, 8, '', { font:'16px monospace', fill:'#f5f5f5' }).setDepth(50);
  scene.timerText = scene.add.text(8, 56, '', { font:'16px monospace', fill:'#ffdfe0' }).setDepth(50);
  scene.moveText = scene.add.text(8, 80, '', { font:'16px monospace', fill:'#ffdfe0' }).setDepth(50);
  scene.energyBarBg = scene.add.rectangle(8, 36, 164, 14, 0x22333a).setOrigin(0,0).setDepth(50);
  scene.energyBar = scene.add.rectangle(10, 38, 160, 10, 0x66ffcc).setOrigin(0,0).setDepth(51);

  // WebAudio ambient (toggleable)
  scene.bgAudio = createAmbientAudio();
  scene.bgPlaying = false;

  // Title text at top
  scene.add.text(CANVAS_WIDTH/2, 30, "Adventurer's End", { font:'bold 32px sans-serif', fill:'#f5f5f5' }).setDepth(100).setOrigin(0.5, 0.5);
  scene.add.text(CANVAS_WIDTH/2, 65, 'Arrow keys: Move · R: Rewind · E: Restart · ESC: Menu', { font:'16px sans-serif', fill:'#aaa' }).setDepth(100).setOrigin(0.5, 0.5);

  // In-game UI: Level select and restart button
  const uiY = CANVAS_HEIGHT - 60;
  const levelText = scene.add.text(20, uiY, 'Level:', { font:'18px sans-serif', fill:'#f5f5f5' }).setDepth(100).setOrigin(0, 0.5);
  const levelLeftBtn = scene.add.text(100, uiY, '◀', { font:'24px sans-serif', fill:'#f5f5f5' }).setDepth(100).setOrigin(0.5, 0.5).setInteractive();
  const levelDisplay = scene.add.text(140, uiY, `${currentLevelIndex + 1}/${BASE_LEVEL_COUNT}`, { font:'18px sans-serif', fill:'#f5f5f5' }).setDepth(100).setOrigin(0.5, 0.5);
  const levelRightBtn = scene.add.text(200, uiY, '▶', { font:'24px sans-serif', fill:'#f5f5f5' }).setDepth(100).setOrigin(0.5, 0.5).setInteractive();
  const restartBtn = scene.add.text(280, uiY, 'Restart', { font:'18px sans-serif', fill:'#f5f5f5', backgroundColor:'#222', padding:{x:12,y:8} }).setDepth(100).setOrigin(0, 0.5).setInteractive();
  const editorBtn = scene.add.text(380, uiY, 'Level Editor', { font:'18px sans-serif', fill:'#ffd700', backgroundColor:'#333', padding:{x:12,y:8} }).setDepth(100).setOrigin(0, 0.5).setInteractive();
  const instructionsBtn = scene.add.text(540, uiY, 'Instructions', { font:'18px sans-serif', fill:'#f5f5f5', backgroundColor:'#114477', padding:{x:12,y:8} }).setDepth(100).setOrigin(0, 0.5).setInteractive();
  
  // Achievement book icon (black and white book)
  const bookBtn = scene.add.text(CANVAS_WIDTH - 80, uiY, '📖', { font:'32px sans-serif', fill:'#ffffff', backgroundColor:'#000', padding:{x:8,y:4} }).setDepth(100).setOrigin(0.5, 0.5).setInteractive();
  
  // Reset button
  const resetBtn = scene.add.text(CANVAS_WIDTH - 180, uiY, 'Reset', { font:'18px sans-serif', fill:'#fff', backgroundColor:'#cc2222', padding:{x:12,y:8} }).setDepth(100).setOrigin(0.5, 0.5).setInteractive();
  
  scene.levelDisplay = levelDisplay;
  levelLeftBtn.on('pointerdown', () => { 
    if (scene.menuVisible) return; 
    // Disable navigation in custom levels
    if (currentLevelIndex >= BASE_LEVEL_COUNT) return;
    if (currentLevelIndex > 0) { 
      currentLevelIndex--; 
      levelDisplay.setText(`${currentLevelIndex+1}/${BASE_LEVEL_COUNT}`); 
      transitionToLevel(scene, currentLevelIndex); 
    } 
  });
  levelRightBtn.on('pointerdown', () => { 
    if (scene.menuVisible) return; 
    // Disable navigation in custom levels
    if (currentLevelIndex >= BASE_LEVEL_COUNT) return;
    if (currentLevelIndex < BASE_LEVEL_COUNT - 1 && isLevelUnlocked(currentLevelIndex + 1)) { 
      currentLevelIndex++; 
      levelDisplay.setText(`${currentLevelIndex+1}/${BASE_LEVEL_COUNT}`); 
      transitionToLevel(scene, currentLevelIndex); 
    }
  });
  restartBtn.on('pointerdown', () => { if (scene.menuVisible) return; transitionToLevel(scene, currentLevelIndex); });
  editorBtn.on('pointerdown', () => { if (scene.menuVisible) return; openLevelEditor(scene); });
  instructionsBtn.on('pointerdown', () => { if (scene.menuVisible) return; openInstructions(scene); });
  bookBtn.on('pointerdown', () => { if (scene.menuVisible) return; openAchievementBook(scene); });
  resetBtn.on('pointerdown', () => { if (scene.menuVisible) return; showResetConfirmation(scene); });
  [levelLeftBtn, levelRightBtn, restartBtn, editorBtn, instructionsBtn, resetBtn].forEach(btn => {
    btn.on('pointerover', () => btn.setTint(0xaaffaa));
    btn.on('pointerout', () => btn.clearTint());
  });
  bookBtn.on('pointerover', () => bookBtn.setScale(1.1));
  bookBtn.on('pointerout', () => bookBtn.setScale(1));

  // DOM controls (just for pause menu)
  const levelSelect = null;
  const restartBtnDOM = null;
  const menuOverlay = document.getElementById('menu-overlay');
  const menuClose = document.getElementById('menu-close');
  const tipBtn = document.getElementById('tip-btn');
  const tipText = document.getElementById('tip-text');
  const volumeSlider = document.getElementById('volume-slider');


  const setTipText = (text) => { if (tipText) tipText.textContent = text || ''; };
  const showTip = () => { setTipText(LEVEL_TIPS[currentLevelIndex] || 'No tip yet.'); };
  const setMenuVisible = (show) => {
    const visible = (typeof show === 'boolean') ? show : (menuOverlay && menuOverlay.style.display !== 'flex');
    if (menuOverlay) menuOverlay.style.display = visible ? 'flex' : 'none';
    scene.menuVisible = visible;
    if (visible && volumeSlider) volumeSlider.value = Math.round(scene.bgVolume * 100);
    if (!visible && document.activeElement === volumeSlider) volumeSlider.blur();
  };

  if (menuOverlay) setMenuVisible(false);
  if (menuClose) menuClose.addEventListener('click', () => setMenuVisible(false));
  if (tipBtn) tipBtn.addEventListener('click', showTip);
  if (volumeSlider) {
    volumeSlider.value = Math.round(scene.bgVolume * 100);
    volumeSlider.addEventListener('input', (e) => {
      const v = Math.max(0, Math.min(1, parseInt(e.target.value,10) / 100));
      scene.bgVolume = v;
      if (scene.bgMusic) scene.bgMusic.setVolume(v);
      if (scene.bgAudio && typeof scene.bgAudio.setVolume === 'function') scene.bgAudio.setVolume(v);
    });
  }

  scene.showTip = showTip;
  scene.setMenuVisible = setMenuVisible;
  scene.setTipText = setTipText;

  // Start level with a brief loading screen, then autoplay music
  const overlay = scene.add.rectangle(0,0,CANVAS_WIDTH,CANVAS_HEIGHT,0x000000).setOrigin(0).setDepth(300).setAlpha(1);
  const loadingText = scene.add.text(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 'Loading...', { font:'28px sans-serif', fill:'#ffffff' }).setOrigin(0.5).setDepth(301).setAlpha(1);
  loadLevel(scene, currentLevelIndex);

  const startMusic = () => {
    if (scene.bgPlaying) return;
    scene.bgPlaying = true;
    if (scene.cache && scene.cache.audio && scene.cache.audio.exists('bgMusic')) {
      if (!scene.bgMusic) scene.bgMusic = scene.sound.add('bgMusic', { loop:true, volume:scene.bgVolume });
      scene.bgMusic.play();
    } else {
      scene.bgAudio.setVolume(scene.bgVolume);
      scene.bgAudio.play();
    }
  };

  scene.time.delayedCall(400, () => {
    scene.tweens.add({ targets: [overlay, loadingText], alpha: 0, duration: 700, ease: 'Cubic.easeInOut', onComplete: () => {
      try { overlay.destroy(); loadingText.destroy(); } catch(e){}
      startMusic();
    } });
  });
}

function update(time, delta) {
  const scene = this;
  // when menu is visible, pause all game time (but not music)
  const effectiveDelta = scene.menuVisible ? 0 : delta;
  const scaledDelta = effectiveDelta * scene.timeScale;

  // ESC toggles pause overlay
  if (Phaser.Input.Keyboard.JustDown(scene.keyEsc) && scene.setMenuVisible) scene.setMenuVisible();

  // E key for restart
  if (Phaser.Input.Keyboard.JustDown(scene.keyE) && !scene._won) {
    transitionToLevel(scene, currentLevelIndex);
  }

  // +/- to change timescale
  if (Phaser.Input.Keyboard.JustDown(scene.keyPlus)) scene.timeScale = Math.min(3, scene.timeScale + 0.25);
  if (Phaser.Input.Keyboard.JustDown(scene.keyMinus)) scene.timeScale = Math.max(0.25, scene.timeScale - 0.25);

  // (undo key removed) - use rewind (hold R) instead

  // rewind (hold R) - disabled when level is won
  if (scene.keyR.isDown && !scene._won) {
    scene.isRewinding = true;
    scene.rewindUsed = true; // track that rewind was used
    if (!scene._rewindTimer) scene._rewindTimer = 0;
    scene._rewindTimer += scaledDelta;
    // faster rewind cadence for better feel
    if (scene._rewindTimer > 60) {
      if (scene.energy > 0) {
        popSnapshot(scene, {consumeEnergy:true});
        scene.energy = Math.max(0, scene.energy - 3);
      }
      scene._rewindTimer = 0;
    }
  } else {
    scene.isRewinding = false;
    scene._rewindTimer = 0;
  }

  // movement input
  if (scene.moveCooldown <= 0 && !scene.isRewinding && !scene._won) {
    let dir = null;
    if (Phaser.Input.Keyboard.JustDown(scene.cursors.left)) dir = {dr:0, dc:-1};
    if (Phaser.Input.Keyboard.JustDown(scene.cursors.right)) dir = {dr:0, dc:1};
    if (Phaser.Input.Keyboard.JustDown(scene.cursors.up)) dir = {dr:-1, dc:0};
    if (Phaser.Input.Keyboard.JustDown(scene.cursors.down)) dir = {dr:1, dc:0};
    if (dir) { attemptMove(scene, dir.dr, dir.dc); scene.moveCooldown = scene.animDuration / 1000; }
  }
  if (scene.moveCooldown > 0) scene.moveCooldown -= (scaledDelta/1000);

  // snap sprites (centered using grid offsets)
  if (scene.playerSprite) {
    scene.playerSprite.x = scene.gridOffsetX + scene.player.c*TILE + TILE/2;
    scene.playerSprite.y = scene.gridOffsetY + scene.player.r*TILE + TILE/2;
  }

  // crystal collision check
  if (scene.crystals && scene.crystals.length && !scene._won) {
    const player = scene.player;
    for (let i = scene.crystals.length - 1; i >= 0; i--) {
      const crystal = scene.crystals[i];
      if (crystal.r === player.r && crystal.c === player.c) {
        // collect crystal
        scene.energy = Math.min(scene.maxEnergy, scene.energy + 30);
        try { if (crystal.sprite) crystal.sprite.destroy(); } catch(e){}
        scene.crystals.splice(i, 1);
        // play SFX
        if (scene.cache && scene.cache.audio && scene.cache.audio.exists('crystalSFX')) {
          scene.sound.play('crystalSFX', { volume: 0.4 });
        } else {
          playCrystalTone(scene);
        }
      }
    }
  }
  scene.boxes.forEach(b => { 
    if (b.sprite) { 
      b.sprite.x = scene.gridOffsetX + b.c*TILE + TILE/2; 
      b.sprite.y = scene.gridOffsetY + b.r*TILE + TILE/2; 
      // highlight box if it's on a goal
      const onGoal = scene.goals.some(g => g.r === b.r && g.c === b.c);
      if (onGoal && !b.sprite._glowing) {
        b.sprite.setTint(0x88ff88);
        b.sprite._glowing = true;
      } else if (!onGoal && b.sprite._glowing) {
        b.sprite.clearTint();
        b.sprite._glowing = false;
      }
    }
  });

  // energy no longer auto-recharges (only through crystal pickup)

  // update UI
  scene.moveText.setText(`moves: ${scene.moveCount}`);
  // timer countdown
  if (typeof scene.timeLeft === 'number') {
    scene.timeLeft -= (scaledDelta/1000);
    if (scene.timeLeft < 0) scene.timeLeft = 0;
    const m = Math.floor(scene.timeLeft);
    scene.timerText.setText(`time: ${m}s`);
    if (scene.timeLeft <= 0 && !scene._won) {
      // time up: restart same level after brief notice
      const msg = scene.add.text(16, 110, "Time's up! Restarting level...", { font:'18px sans-serif', fill:'#ff6666' }).setDepth(60);
      scene.time.delayedCall(1200, () => { try { msg.destroy(); } catch(e){}; transitionToLevel(scene, currentLevelIndex); });
      scene.timeLeft = null; // prevent repeated triggers
    }
  }
  const pct = Phaser.Math.Clamp(scene.energy / scene.maxEnergy, 0, 1);
  scene.energyBar.width = Math.max(2, 156 * pct);
  scene.energyBar.x = 10;
  scene.energyBar.y = 38;

  // black hole pull logic (paused when menu is open)
  if (scene.blackHoles && scene.blackHoles.length && !scene._won && !scene.menuVisible) {
    const player = scene.player;
    for (let bh of scene.blackHoles) {
      const dx = player.c - bh.c;
      const dy = player.r - bh.r;
      const dist = Math.hypot(dx, dy);
      // accumulate timer (milliseconds) - use scaledDelta so it respects pause
      bh.timer = (bh.timer || 0) + scaledDelta;
      // if player within effect radius (in tiles), pull every 2 seconds
      if (dist <= bh.radius) {
        if (bh.timer >= 2000) {
          // step one tile closer to black hole
          const stepC = dx === 0 ? 0 : (dx > 0 ? -1 : 1); // player moves towards bh -> decrease dx
          const stepR = dy === 0 ? 0 : (dy > 0 ? -1 : 1);
          // choose direction with larger absolute delta first
          let tr = player.r, tc = player.c;
          if (Math.abs(dx) > Math.abs(dy)) {
            tc = player.c + stepC;
            if (!inBounds(player.r, tc) || scene.grid[player.r][tc] === 'wall' || scene.boxes.some(b => b.r===player.r && b.c===tc)) {
              // try vertical move
              tr = player.r + stepR;
              tc = player.c;
            }
          } else {
            tr = player.r + stepR;
            tc = player.c;
            if (!inBounds(tr, player.c) || scene.grid[tr][player.c] === 'wall' || scene.boxes.some(b => b.r===tr && b.c===player.c)) {
              // try horizontal move
              tc = player.c + stepC;
              tr = player.r;
            }
          }
          // apply move if valid and not a wall/box
          if (inBounds(tr, tc) && scene.grid[tr][tc] !== 'wall' && !scene.boxes.some(b => b.r===tr && b.c===tc)) {
            scene.player.r = tr; scene.player.c = tc; pushSnapshot(scene);
            // update player sprite immediately
            if (scene.playerSprite) { scene.playerSprite.x = scene.gridOffsetX + scene.player.c*TILE + TILE/2; scene.playerSprite.y = scene.gridOffsetY + scene.player.r*TILE + TILE/2; }
          }
          // reset timer
          bh.timer = 0;
        }
      } else {
        // outside radius, slowly decay timer
        bh.timer = Math.max(0, (bh.timer || 0) - delta);
      }

      // if player is on black hole -> caught
      if (player.r === bh.r && player.c === bh.c) {
        scene._won = true;
        const caught = scene.add.text(16, 140, 'Sucked into the black hole!', { font:'28px sans-serif', fill:'#ff4444' }).setDepth(60);
        caught.setShadow(2,2,'#000',4);
        scene.time.delayedCall(1200, () => { try { caught.destroy(); } catch(e){}; transitionToLevel(scene, currentLevelIndex); });
        return;
      }

      // update bh sprite/aoe positions
      if (bh.sprite) { bh.sprite.x = scene.gridOffsetX + bh.c * TILE + TILE/2; bh.sprite.y = scene.gridOffsetY + bh.r * TILE + TILE/2; }
      if (bh.aoe) { bh.aoe.x = scene.gridOffsetX + bh.c * TILE + TILE/2; bh.aoe.y = scene.gridOffsetY + bh.r * TILE + TILE/2; }
    }
  }

  // win check
  if (!scene._won && checkWin(scene)) {
    scene._won = true;
    
    // Check if this is a custom level (beyond base levels)
    const isCustomLevel = currentLevelIndex >= BASE_LEVEL_COUNT;
    
    // calculate stats (only save for base levels)
    const timeUsed = Math.floor((Date.now() - scene.startTime) / 1000);
    const energyUsed = scene.maxEnergy - scene.energy;
    const stars = calculateStars(scene, timeUsed, scene.moveCount, energyUsed);
    
    // save best stats and check achievements only for base levels
    if (!isCustomLevel) {
      saveLevelStats(currentLevelIndex, timeUsed, scene.moveCount, stars, scene.rewindUsed);
      checkAchievements(scene, timeUsed, scene.moveCount, scene.rewindUsed);
    }
    
    const t = scene.add.text(16, 110, 'Puzzle Solved!', { font:'28px sans-serif', fill:'#ffd700' }).setDepth(60);
    t.setShadow(2,2,'#000',4);
    
    const statsText = scene.add.text(16, 145, `Time: ${timeUsed}s | Moves: ${scene.moveCount}`, { font:'16px sans-serif', fill:'#aaa' }).setDepth(60);

    // blink the message for ~3 seconds (3 blinks)
    for (let i = 0; i < 6; i++) {
      scene.time.delayedCall(i * 500, () => { try { t.setVisible(i % 2 === 0); } catch (e) {} });
    }

    scene.time.delayedCall(3000, () => {
      try { t.destroy(); statsText.destroy(); } catch (e) {}
      
      // If custom level, return to original level and remove the custom level
      if (isCustomLevel) {
        LEVELS.pop(); // Remove the custom level
        scene.customLevelData = null; // Clear saved custom level data
        currentLevelIndex = scene.originalLevelBeforeCustom || 0;
        if (scene.levelDisplay) scene.levelDisplay.setText(`${currentLevelIndex+1}/${BASE_LEVEL_COUNT}`);
        transitionToLevel(scene, currentLevelIndex);
      } else if (currentLevelIndex < BASE_LEVEL_COUNT - 1) {
        // Normal progression for base levels
        currentLevelIndex += 1;
        if (scene.levelDisplay) scene.levelDisplay.setText(`${currentLevelIndex+1}/${BASE_LEVEL_COUNT}`);
        transitionToLevel(scene, currentLevelIndex);
      } else {
        // Completed all base levels: show message then restart
        const done = scene.add.text(16, 140, 'All puzzles complete! Restarting...', { font:'18px sans-serif', fill:'#fff' }).setDepth(60);
        scene.time.delayedCall(1600, () => {
          try { done.destroy(); } catch (e) {}
          currentLevelIndex = 0;
          if (scene.levelDisplay) scene.levelDisplay.setText(`${currentLevelIndex+1}/${BASE_LEVEL_COUNT}`);
          transitionToLevel(scene, currentLevelIndex);
        });
      }
    });
  }
}

function attemptMove(scene, dr, dc) {
  const r = scene.player.r; const c = scene.player.c;
  const r1 = r + dr; const c1 = c + dc;
  if (!inBounds(r1,c1) || scene.grid[r1][c1] === 'wall') return;

  const boxIndex = scene.boxes.findIndex(b => b.r === r1 && b.c === c1);
  if (boxIndex === -1) {
    scene.player.r = r1; scene.player.c = c1; 
    scene.moveCount++; // count successful move
    pushSnapshot(scene); 
    return;
  }

  const r2 = r1 + dr; const c2 = c1 + dc;
  if (!inBounds(r2,c2) || scene.grid[r2][c2] === 'wall') return;
  const blockBox = scene.boxes.find(b => b.r === r2 && b.c === c2);
  if (blockBox) return;

  // push
  scene.boxes[boxIndex].r = r2; scene.boxes[boxIndex].c = c2;
  scene.player.r = r1; scene.player.c = c1;
  scene.moveCount++; // count successful push
  pushSnapshot(scene);
}

function pushSnapshot(scene) {
  const snap = { player: { r: scene.player.r, c: scene.player.c }, boxes: scene.boxes.map(b => ({ r: b.r, c: b.c })) };
  scene.history.push(snap);
  if (scene.history.length > 400) scene.history.shift();
}

function popSnapshot(scene, opts) {
  opts = opts || {};
  if (scene.history.length <= 1) return;
  scene.history.pop();
  const last = scene.history[scene.history.length-1];
  scene.player.r = last.player.r; scene.player.c = last.player.c;
  // ensure we don't mismatch box counts
  for (let i = 0; i < scene.boxes.length; i++) {
    if (last.boxes[i]) { scene.boxes[i].r = last.boxes[i].r; scene.boxes[i].c = last.boxes[i].c; }
  }
}

function loadLevel(scene, idx) {
  // clear map sprites and boxes
  scene.mapSprites.forEach(s => { try { s.destroy(); } catch(e){} });
  scene.mapSprites = [];
  scene.boxGroup.clear(true, true);
  scene.boxes = [];
  scene.goals = [];
  scene.grid = [];
  scene._won = false;
  scene.history = [];
  if (scene.setTipText) scene.setTipText('');
  if (scene.menuVisible && scene.setMenuVisible) scene.setMenuVisible(false);
  // clear black holes
  if (scene.blackHoles && scene.blackHoles.length) {
    scene.blackHoles.forEach(bh => { try { if (bh.sprite) bh.sprite.destroy(); } catch(e){}; try { if (bh.aoe) bh.aoe.destroy(); } catch(e){} });
  }
  scene.blackHoles = [];
  // clear crystals
  if (scene.crystals && scene.crystals.length) {
    scene.crystals.forEach(c => { try { if (c.sprite) c.sprite.destroy(); } catch(e){} });
  }
  scene.crystals = [];

  // Energy persists across levels - only reset on initial game load in create()
  // per-level timer (base + small increase per level)
  scene.timeLeft = BASE_TIME + idx * 10;
  
  // reset stats for new level
  scene.moveCount = 0;
  scene.rewindUsed = false;
  scene.startTime = Date.now();

  const level = LEVELS[idx];
  for (let r = 0; r < ROWS; r++) {
    scene.grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      const ch = (level[r] && level[r][c]) || ' ';
      const x = scene.gridOffsetX + c*TILE + TILE/2; const y = scene.gridOffsetY + r*TILE + TILE/2;

      // floor
      const floor = scene.add.image(x,y,'floor').setDisplaySize(TILE-2,TILE-2).setDepth(0);
      scene.mapSprites.push(floor);

      if (ch === '#') {
        const w = scene.add.image(x,y,'wall').setDisplaySize(TILE-2,TILE-2).setDepth(1);
        scene.mapSprites.push(w);
        scene.grid[r][c] = 'wall';
      } else if (ch === '@') {
        scene.grid[r][c] = 'empty';
        scene.player = { r, c };
      } else if (ch === '$') {
        scene.grid[r][c] = 'empty';
        const box = { r, c };
        box.sprite = scene.add.image(scene.gridOffsetX + c*TILE+TILE/2, scene.gridOffsetY + r*TILE+TILE/2, 'box').setDisplaySize(TILE-18,TILE-18).setDepth(5);
        scene.boxGroup.add(box.sprite);
        scene.boxes.push(box);
        scene.mapSprites.push(box.sprite);
      } else if (ch === '.') {
        scene.grid[r][c] = 'empty';
        const g = scene.add.image(x,y,'goal').setDisplaySize(22,22).setDepth(2);
        scene.goals.push({ r, c, sprite: g });
        scene.mapSprites.push(g);
      } else if (ch === 'M') {
        // black hole spawn point
        scene.grid[r][c] = 'empty';
        // radius in tiles and pull timer
        scene.blackHoles.push({ r, c, radius: 3, timer: 0, sprite: null, aoe: null });
      } else if (ch === 'C') {
        // crystal spawn point
        scene.grid[r][c] = 'empty';
        scene.crystals.push({ r, c, sprite: null });
      } else {
        scene.grid[r][c] = 'empty';
      }
    }
  }

  // player sprite
  if (scene.playerSprite) { try { scene.playerSprite.destroy(); } catch(e){} }
  scene.playerSprite = scene.add.image(scene.gridOffsetX + scene.player.c*TILE+TILE/2, scene.gridOffsetY + scene.player.r*TILE+TILE/2, 'player').setDisplaySize(TILE-30,TILE-30).setDepth(6);
  scene.mapSprites.push(scene.playerSprite);

  // black hole sprites (if present)
  if (scene.blackHoles && scene.blackHoles.length) {
    scene.blackHoles.forEach(bh => {
      const bx = scene.gridOffsetX + bh.c*TILE + TILE/2;
      const by = scene.gridOffsetY + bh.r*TILE + TILE/2;
      // AoE visual: semi-transparent circle
      try { bh.aoe = scene.add.circle(bx, by, bh.radius * TILE, 0x000011, 0.28).setDepth(1); scene.mapSprites.push(bh.aoe); } catch(e){}
      try { 
        bh.sprite = scene.add.image(bx, by, 'blackhole').setDisplaySize(TILE-8,TILE-8).setDepth(5); 
        scene.mapSprites.push(bh.sprite);
        // add subtle pulsing glow effect
        scene.tweens.add({
          targets: bh.sprite,
          scale: { from: 1, to: 1.08 },
          alpha: { from: 1, to: 0.85 },
          duration: 1400,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1
        });
      } catch(e){}
    });
  }

  // crystal sprites (if present)
  if (scene.crystals && scene.crystals.length) {
    scene.crystals.forEach(crystal => {
      const cx = scene.gridOffsetX + crystal.c*TILE + TILE/2;
      const cy = scene.gridOffsetY + crystal.r*TILE + TILE/2;
      try { 
        crystal.sprite = scene.add.image(cx, cy, 'crystal').setDisplaySize(TILE-32, TILE-32).setDepth(4); 
        scene.mapSprites.push(crystal.sprite);
        // gentle floating animation
        scene.tweens.add({
          targets: crystal.sprite,
          y: cy - 6,
          duration: 1000,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1
        });
      } catch(e){}
    });
  }

  // initial snapshot
  pushSnapshot(scene);
}

function checkWin(scene) {
  return scene.goals.every(g => scene.boxes.some(b => b.r === g.r && b.c === g.c));
}

function buildMinimap(scene) {
  // clear old minimap sprites
  scene.minimapSprites.forEach(s => { try { s.destroy(); } catch(e){} });
  scene.minimapSprites = [];
  
  const tileSize = 12;
  const offsetX = 10;
  const offsetY = 10;
  
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = offsetX + c * tileSize;
      const y = offsetY + r * tileSize;
      const cell = scene.grid[r][c];
      
      let color = 0x333333; // floor
      if (cell === 'wall') color = 0x888888;
      
      const rect = scene.add.rectangle(x, y, tileSize - 1, tileSize - 1, color, 0.8).setOrigin(0,0);
      scene.minimapContainer.add(rect);
      scene.minimapSprites.push(rect);
      
      // goals
      if (scene.goals.some(g => g.r === r && g.c === c)) {
        const goal = scene.add.circle(x + tileSize/2, y + tileSize/2, 3, 0x88cc88).setOrigin(0.5);
        scene.minimapContainer.add(goal);
        scene.minimapSprites.push(goal);
      }
      
      // boxes
      if (scene.boxes.some(b => b.r === r && b.c === c)) {
        const box = scene.add.rectangle(x + 2, y + 2, tileSize - 5, tileSize - 5, 0xcc9966).setOrigin(0,0);
        scene.minimapContainer.add(box);
        scene.minimapSprites.push(box);
      }
      
      // black holes
      if (scene.blackHoles.some(bh => bh.r === r && bh.c === c)) {
        const bh = scene.add.circle(x + tileSize/2, y + tileSize/2, 4, 0x000000).setOrigin(0.5);
        scene.minimapContainer.add(bh);
        scene.minimapSprites.push(bh);
      }
      
      // crystals
      if (scene.crystals.some(cr => cr.r === r && cr.c === c)) {
        const crystal = scene.add.circle(x + tileSize/2, y + tileSize/2, 3, 0x66ddff).setOrigin(0.5);
        scene.minimapContainer.add(crystal);
        scene.minimapSprites.push(crystal);
      }
    }
  }
  
  // player position marker
  const px = offsetX + scene.player.c * tileSize + tileSize/2;
  const py = offsetY + scene.player.r * tileSize + tileSize/2;
  scene.minimapPlayer = scene.add.circle(px, py, 4, 0x66aaff).setOrigin(0.5);
  scene.minimapContainer.add(scene.minimapPlayer);
  scene.minimapSprites.push(scene.minimapPlayer);
}

function transitionToLevel(scene, idx) {
  // simple fade-out, load, fade-in
  const overlay = scene.add.rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000).setOrigin(0).setDepth(100).setAlpha(0);
  scene.tweens.add({ targets: overlay, alpha: 1, duration: 300, ease: 'Cubic.easeIn', onComplete: () => {
    try { loadLevel(scene, idx); } catch(e) { console.error(e); }
    scene.tweens.add({ targets: overlay, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => { try { overlay.destroy(); } catch(e){} } });
  } });
}

function inBounds(r,c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

function makeTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // floor
  g.clear(); g.fillStyle(0x2b2f33,1); g.fillRoundedRect(0,0,64,64,6);
  g.lineStyle(2,0x1f2426,1); g.strokeRoundedRect(0,0,64,64,6);
  g.generateTexture('floor',64,64);

  // wall
  g.clear(); g.fillStyle(0x5b5b6a,1); g.fillRoundedRect(0,0,64,64,6);
  g.fillStyle(0x494956,1); g.fillRect(6,6,52,52);
  g.generateTexture('wall',64,64);

  // box
  g.clear(); g.fillStyle(0xcc9966,1); g.fillRoundedRect(0,0,48,48,6);
  g.lineStyle(2,0x8b5b3a,1); g.strokeRoundedRect(0,0,48,48,6);
  g.generateTexture('box',48,48);

  // player
  g.clear(); g.fillStyle(0x66aaff,1); g.fillCircle(24,24,20);
  g.lineStyle(2,0x224466,1); g.strokeCircle(24,24,20);
  g.generateTexture('player',48,48);

  // goal
  g.clear(); g.fillStyle(0x88cc88,1); g.fillCircle(10,10,10); g.generateTexture('goal',20,20);

  // spark particle
  g.clear(); g.fillStyle(0xfff2b5,1); g.fillCircle(4,4,4); g.generateTexture('spark',8,8);

  // black hole texture (dark circle)
  g.clear(); g.fillStyle(0x000000,1); g.fillCircle(32,32,28);
  g.lineStyle(2,0x111122,1); g.strokeCircle(32,32,28);
  g.fillStyle(0x223344,1); g.fillCircle(32,32,12);
  g.generateTexture('blackhole',64,64);

  // crystal texture (if not loaded from file)
  if (!scene.textures.exists('crystal')) {
    g.clear(); 
    g.fillStyle(0x66ddff,1); 
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = 16 + Math.cos(angle) * 10;
      const y = 16 + Math.sin(angle) * 10;
      g.fillCircle(x, y, 4);
    }
    g.fillStyle(0xaaffff,1); g.fillCircle(16,16,8);
    g.generateTexture('crystal',32,32);
  }
}

function createAmbientAudio() {
  // NOTE: To change the music/sound here, replace this function's implementation.
  // Option A: keep procedural audio here (modify oscillator params).
  // Option B (recommended for custom songs): load an audio file in Phaser `preload()`
  // and use `scene.sound.add('bgMusic')` then call `bgMusic.play()` from create().
  // See README or ask me and I can wire up an audio file example.
  let ctx = null; let osc = null; let gain = null; let volume = 1;
  return {
    play() {
      if (ctx) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      osc = ctx.createOscillator(); gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 220;
      // slow LFO on frequency
      const lfo = ctx.createOscillator(); const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.12; lfoGain.gain.value = 30;
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
      gain.gain.value = 0.02 * volume;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); lfo.start();
      this._lfo = lfo; this._lfoGain = lfoGain;
    },
    stop() {
      if (!ctx) return;
      try { osc.stop(); this._lfo.stop(); } catch(e){}
      try { osc.disconnect(); this._lfo.disconnect(); gain.disconnect(); ctx.close(); } catch(e){}
      ctx = null; osc = null; gain = null; this._lfo = null; this._lfoGain = null;
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      if (gain) gain.gain.value = 0.02 * volume;
    }
  };
}

function playCrystalTone(scene) {
  // simple pickup tone using WebAudio
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 800;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.stop(ctx.currentTime + 0.2);
    setTimeout(() => { try { ctx.close(); } catch(e){} }, 250);
  } catch(e) { /* ignore if audio fails */ }
}

// Star rating: 3 stars = excellent, 2 = good, 1 = completed
function calculateStars(scene, timeUsed, moves, energyUsed) {
  const level = currentLevelIndex;
  // Thresholds scale with level difficulty
  const timeThreshold = BASE_TIME + level * 5; // generous time
  const moveThreshold = 30 + level * 5; // reasonable moves
  const energyThreshold = 40; // low energy use
  
  let stars = 1; // completed
  if (timeUsed < timeThreshold && moves < moveThreshold) stars = 2;
  if (timeUsed < timeThreshold * 0.7 && moves < moveThreshold * 0.7 && energyUsed < energyThreshold) stars = 3;
  return stars;
}

// Save level stats to localStorage
function saveLevelStats(levelIdx, time, moves, stars, rewindUsed) {
  try {
    const key = `level_${levelIdx}`;
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    const updated = {
      bestTime: existing.bestTime ? Math.min(existing.bestTime, time) : time,
      bestMoves: existing.bestMoves ? Math.min(existing.bestMoves, moves) : moves,
      bestStars: existing.bestStars ? Math.max(existing.bestStars, stars) : stars,
      completed: true,
      noRewindComplete: existing.noRewindComplete || !rewindUsed
    };
    localStorage.setItem(key, JSON.stringify(updated));
  } catch(e) { /* ignore if localStorage unavailable */ }
}

function isLevelUnlocked(levelIdx) {
  // First level (index 0) is always unlocked
  if (levelIdx === 0) return true;
  
  // Check if previous level is completed
  try {
    const prevKey = `level_${levelIdx - 1}`;
    const prevData = JSON.parse(localStorage.getItem(prevKey) || '{}');
    return prevData.completed === true;
  } catch(e) {
    return false;
  }
}

// Check and save achievements
function checkAchievements(scene, timeUsed, moves, rewindUsed) {
  try {
    const achievements = JSON.parse(localStorage.getItem('achievements') || '{}');
    
    // 1. No rewind achievement
    if (!rewindUsed && !achievements.noRewind) {
      achievements.noRewind = true;
      showAchievement(scene, 'Achievement: Puzzle Master!', 'Completed without rewinding');
    }
    
    // 2. Speedrun achievement (complete any level under 20s)
    if (timeUsed < 20 && !achievements.speedrun) {
      achievements.speedrun = true;
      showAchievement(scene, 'Achievement: Lightning Fast!', 'Completed in under 20 seconds');
    }
    
    // 3. Efficiency achievement (under 15 moves)
    if (moves < 15 && !achievements.efficient) {
      achievements.efficient = true;
      showAchievement(scene, 'Achievement: Efficient!', 'Completed in under 15 moves');
    }
    
    // 4. Complete 5 levels (only count base levels)
    const completedCount = Array.from({ length: BASE_LEVEL_COUNT }, (_, idx) => {
      const stats = JSON.parse(localStorage.getItem(`level_${idx}`) || '{}');
      return stats.completed ? 1 : 0;
    }).reduce((a, b) => a + b, 0);
    if (completedCount >= 5 && !achievements.persistent) {
      achievements.persistent = true;
      showAchievement(scene, 'Achievement: Persistent!', 'Completed 5 levels');
    }
    
    // 4b. Level editor unlocked (complete level 6)
    const level6Stats = JSON.parse(localStorage.getItem('level_5') || '{}');
    if (level6Stats.completed && !achievements.editorUnlocked) {
      achievements.editorUnlocked = true;
      showAchievement(scene, 'Achievement: Level Editor Unlocked!', 'You can now create custom levels');
    }
    
    // 5. Complete all base levels (not custom)
    if (completedCount >= BASE_LEVEL_COUNT && !achievements.champion) {
      achievements.champion = true;
      showAchievement(scene, 'Achievement: Champion!', 'Completed all levels');
    }
    
    localStorage.setItem('achievements', JSON.stringify(achievements));
  } catch(e) { /* ignore */ }
}

function showAchievement(scene, title, desc) {
  // Initialize achievement queue if it doesn't exist
  if (!scene.activeAchievements) {
    scene.activeAchievements = [];
  }
  
  // Calculate Y position based on number of active achievements
  const baseY = 100;
  const spacing = 90; // height + gap between notifications
  const yPos = baseY + (scene.activeAchievements.length * spacing);
  
  const bg = scene.add.rectangle(CANVAS_WIDTH - 220, yPos, 400, 80, 0x222222, 0.95).setOrigin(0, 0).setDepth(200);
  const titleText = scene.add.text(CANVAS_WIDTH - 210, yPos + 10, title, { font:'bold 18px sans-serif', fill:'#ffd700' }).setDepth(201);
  const descText = scene.add.text(CANVAS_WIDTH - 210, yPos + 35, desc, { font:'14px sans-serif', fill:'#ccc' }).setDepth(201);
  
  // Track this notification
  const notification = { bg, titleText, descText, yPos };
  scene.activeAchievements.push(notification);
  
  scene.tweens.add({ targets: [bg, titleText, descText], x: '-=420', duration: 400, ease: 'Back.easeOut' });
  
  scene.time.delayedCall(3000, () => {
    scene.tweens.add({ targets: [bg, titleText, descText], alpha: 0, duration: 400, onComplete: () => {
      try { 
        bg.destroy(); 
        titleText.destroy(); 
        descText.destroy();
        
        // Remove from active list
        const index = scene.activeAchievements.indexOf(notification);
        if (index > -1) {
          scene.activeAchievements.splice(index, 1);
        }
        
        // Shift remaining notifications up
        scene.activeAchievements.forEach((notif, idx) => {
          const newY = baseY + (idx * spacing);
          scene.tweens.add({
            targets: [notif.bg, notif.titleText, notif.descText],
            y: `-=${notif.yPos - newY}`,
            duration: 300,
            ease: 'Sine.easeOut'
          });
          notif.yPos = newY;
        });
      } catch(e){}
    }});
  });
}

// Reset Confirmation Dialog
function showResetConfirmation(scene) {
  if (scene.resetDialogOpen) return;
  scene.resetDialogOpen = true;
  
  // Dark overlay
  const confirmBg = scene.add.rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000, 0.9).setOrigin(0).setDepth(600).setInteractive();
  const confirmPanel = scene.add.rectangle(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, Math.min(600, CANVAS_WIDTH - 100), Math.min(300, CANVAS_HEIGHT - 200), 0xffffff, 1).setOrigin(0.5).setDepth(601);
  confirmPanel.setStrokeStyle(4, 0xcc2222);
  
  const confirmTitle = scene.add.text(CANVAS_WIDTH/2, confirmPanel.y - confirmPanel.height/2 + 50, 'Reset Game Data?', { font:'bold 32px sans-serif', fill:'#cc2222' }).setOrigin(0.5).setDepth(602);
  
  const confirmMessage = scene.add.text(CANVAS_WIDTH/2, confirmPanel.y - 20, 'Are you sure you want to reset all your progress?\nAll achievements, completed levels, and saved data\nwill be permanently lost!', { 
    font:'18px sans-serif', 
    fill:'#333',
    align: 'center',
    wordWrap: { width: confirmPanel.width - 60 }
  }).setOrigin(0.5).setDepth(602);
  
  const yesBtn = scene.add.text(CANVAS_WIDTH/2 - 80, confirmPanel.y + confirmPanel.height/2 - 50, 'Yes, Reset', { font:'bold 18px sans-serif', fill:'#fff', backgroundColor:'#cc2222', padding:{x:20,y:12} }).setOrigin(0.5).setDepth(602).setInteractive();
  const noBtn = scene.add.text(CANVAS_WIDTH/2 + 80, confirmPanel.y + confirmPanel.height/2 - 50, 'Cancel', { font:'bold 18px sans-serif', fill:'#fff', backgroundColor:'#555', padding:{x:20,y:12} }).setOrigin(0.5).setDepth(602).setInteractive();
  
  const elements = [confirmBg, confirmPanel, confirmTitle, confirmMessage, yesBtn, noBtn];
  
  function closeDialog() {
    scene.resetDialogOpen = false;
    elements.forEach(el => { try { el.destroy(); } catch(e){} });
  }
  
  yesBtn.on('pointerdown', () => {
    // Clear all localStorage data
    try {
      localStorage.clear();
    } catch(e) {}
    
    // Reload the page to restart the game
    window.location.reload();
  });
  
  noBtn.on('pointerdown', () => {
    closeDialog();
  });
  
  yesBtn.on('pointerover', () => yesBtn.setScale(1.05));
  yesBtn.on('pointerout', () => yesBtn.setScale(1));
  noBtn.on('pointerover', () => noBtn.setScale(1.05));
  noBtn.on('pointerout', () => noBtn.setScale(1));
}

// Instructions UI
function openInstructions(scene) {
  if (scene.instructionsOpen) return;
  scene.instructionsOpen = true;
  
  // Dark overlay
  const instrBg = scene.add.rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000, 0.85).setOrigin(0).setDepth(500).setInteractive();
  const instrPanel = scene.add.rectangle(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, Math.min(700, CANVAS_WIDTH - 100), Math.min(750, CANVAS_HEIGHT - 60), 0xf0f8ff, 1).setOrigin(0.5).setDepth(501);
  instrPanel.setStrokeStyle(4, 0x114477);
  
  const instrTitle = scene.add.text(CANVAS_WIDTH/2, instrPanel.y - instrPanel.height/2 + 40, 'How to Play', { font:'bold 36px sans-serif', fill:'#114477' }).setOrigin(0.5).setDepth(502);
  
  // Scroll hint right below title
  const scrollHint = scene.add.text(CANVAS_WIDTH/2, instrTitle.y + 30, '↕ Scroll with mouse wheel', { font:'14px sans-serif', fill:'#777', style: 'italic' }).setOrigin(0.5).setDepth(502);
  
  const instructions = [
    '🎯 Goal: Push all boxes ($) onto goal tiles (.)',
    '⌨️ Controls:',
    '   • Arrow Keys - Move player (@)',
    '   • R (hold) - Rewind time (costs energy)',
    '   • E - Restart level',
    '   • ESC - Open menu (pauses the game)',
    '',
    '📦 Box Rules:',
    '   • You can only push ONE box at a time',
    '   • You cannot push 2 or more boxes together',
    '   • Separate boxes first, then push them individually',
    '',
    '🕳️ Black Holes:',
    '   • Every 2 seconds, they pull you 1 step closer',
    '   • They can only pull vertically or horizontally',
    '   • They CANNOT pull you diagonally',
    '   • Getting caught means instant game over!',
    '',
    '💎 Crystals:',
    '   • Restore energy for rewinding',
    '   • Energy does not auto-recharge',
    '',
    '💡 Tips:',
    '   • Each level has its own tip to help you',
    '   • Check the pause menu (ESC) to see the tip',
    '',
    '🛠️ Level Editor (unlocks at Level 6):',
    '   • Left Click - Cycle through pieces',
    '   • Right Click - Remove current piece',
    '   • Rotation: Floor → Wall → Goal → Box → Player → Black Hole → Crystal',
  ];
  
  const startY = instrTitle.y + 55;
  const lineHeight = 24;
  let scrollOffset = 0;
  const maxScroll = Math.max(0, (instructions.length * lineHeight) - (instrPanel.height - 150));
  
  const instructionTexts = instructions.map((line, idx) => {
    return scene.add.text(CANVAS_WIDTH/2 - instrPanel.width/2 + 40, startY + idx * lineHeight, line, { 
      font: line.startsWith('   •') ? '16px monospace' : (line.includes('🎯') || line.includes('⌨️') || line.includes('📦') || line.includes('🕳️') || line.includes('💎') || line.includes('💡') || line.includes('🛠️')) ? 'bold 18px sans-serif' : '16px sans-serif', 
      fill: '#222',
      wordWrap: { width: instrPanel.width - 80 }
    }).setOrigin(0, 0).setDepth(502);
  });
  
  // Create a mask for scrolling content
  const maskShape = scene.make.graphics();
  maskShape.fillStyle(0xffffff);
  maskShape.fillRect(
    instrPanel.x - instrPanel.width/2 + 20,
    startY - 10,
    instrPanel.width - 40,
    instrPanel.height - 150
  );
  const mask = maskShape.createGeometryMask();
  instructionTexts.forEach(text => text.setMask(mask));
  
  // Mouse wheel scrolling
  instrBg.on('wheel', (pointer, deltaX, deltaY) => {
    scrollOffset = Phaser.Math.Clamp(scrollOffset + deltaY * 0.5, 0, maxScroll);
    instructionTexts.forEach((text, idx) => {
      text.y = startY + idx * lineHeight - scrollOffset;
    });
  });
  
  const closeBtn = scene.add.text(CANVAS_WIDTH/2, instrPanel.y + instrPanel.height/2 - 35, 'Got It!', { font:'bold 20px sans-serif', fill:'#fff', backgroundColor:'#114477', padding:{x:24,y:12} }).setOrigin(0.5).setDepth(502).setInteractive();
  
  const elements = [instrBg, instrPanel, instrTitle, ...instructionTexts, closeBtn, scrollHint, maskShape];
  
  closeBtn.on('pointerdown', () => {
    scene.instructionsOpen = false;
    elements.forEach(el => { try { el.destroy(); } catch(e){} });
    mask.destroy();
  });
  closeBtn.on('pointerover', () => closeBtn.setScale(1.05));
  closeBtn.on('pointerout', () => closeBtn.setScale(1));
}

// Achievement Book UI
function openAchievementBook(scene) {
  if (scene.bookOpen) return;
  scene.bookOpen = true;
  
  const achievements = JSON.parse(localStorage.getItem('achievements') || '{}');
  const achievementList = [
    { key: 'noRewind', title: 'Puzzle Master', desc: 'Complete a level without rewinding', icon: '🧩' },
    { key: 'speedrun', title: 'Lightning Fast', desc: 'Complete a level in under 20 seconds', icon: '⚡' },
    { key: 'efficient', title: 'Efficient', desc: 'Complete a level in under 15 moves', icon: '🎯' },
    { key: 'persistent', title: 'Persistent', desc: 'Complete 5 levels', icon: '🏆' },
    { key: 'editorUnlocked', title: 'Level Editor Unlocked', desc: 'Unlocked the level editor', icon: '🛠️' },
    { key: 'champion', title: 'Champion', desc: 'Complete all levels', icon: '👑' }
  ];
  
  // Black and white book overlay
  const bookBg = scene.add.rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000, 0.85).setOrigin(0).setDepth(500).setInteractive();
  const bookPanel = scene.add.rectangle(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, Math.min(600, CANVAS_WIDTH - 100), Math.min(500, CANVAS_HEIGHT - 100), 0xf5f5f5, 1).setOrigin(0.5).setDepth(501);
  bookPanel.setStrokeStyle(4, 0x000000);
  
  const bookTitle = scene.add.text(CANVAS_WIDTH/2, bookPanel.y - bookPanel.height/2 + 40, 'Achievements', { font:'bold 32px serif', fill:'#000', stroke: '#000', strokeThickness: 1 }).setOrigin(0.5).setDepth(502);
  
  const startY = bookTitle.y + 50;
  const elements = [bookBg, bookPanel, bookTitle];
  
  achievementList.forEach((ach, idx) => {
    const unlocked = achievements[ach.key] || false;
    const y = startY + idx * 75;
    
    // Black/white achievement card
    const card = scene.add.rectangle(CANVAS_WIDTH/2, y, bookPanel.width - 60, 65, unlocked ? 0xffffff : 0xcccccc).setOrigin(0.5).setDepth(502);
    card.setStrokeStyle(2, 0x000000);
    
    const icon = scene.add.text(CANVAS_WIDTH/2 - bookPanel.width/2 + 60, y, unlocked ? ach.icon : '🔒', { font:'28px sans-serif' }).setOrigin(0.5).setDepth(503);
    const title = scene.add.text(CANVAS_WIDTH/2 - bookPanel.width/2 + 110, y - 12, ach.title, { font: unlocked ? 'bold 18px sans-serif' : '18px sans-serif', fill:'#000' }).setOrigin(0, 0.5).setDepth(503);
    const desc = scene.add.text(CANVAS_WIDTH/2 - bookPanel.width/2 + 110, y + 12, ach.desc, { font:'14px sans-serif', fill: unlocked ? '#333' : '#888' }).setOrigin(0, 0.5).setDepth(503);
    
    elements.push(card, icon, title, desc);
  });
  
  const closeBtn = scene.add.text(CANVAS_WIDTH/2, bookPanel.y + bookPanel.height/2 - 15, 'Close', { font:'bold 20px sans-serif', fill:'#fff', backgroundColor:'#000', padding:{x:20,y:10} }).setOrigin(0.5).setDepth(502).setInteractive();
  elements.push(closeBtn);
  
  closeBtn.on('pointerdown', () => {
    scene.bookOpen = false;
    elements.forEach(el => { try { el.destroy(); } catch(e){} });
  });
  closeBtn.on('pointerover', () => closeBtn.setScale(1.05));
  closeBtn.on('pointerout', () => closeBtn.setScale(1));
}

// Level Editor
function openLevelEditor(scene) {
  if (scene.editorOpen) return;
  
  // Check if level 6 (index 5) is completed
  const level6Stats = JSON.parse(localStorage.getItem('level_5') || '{}');
  if (!level6Stats.completed) {
    // Show locked message
    const lockBg = scene.add.rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000, 0.85).setOrigin(0).setDepth(600).setInteractive();
    const lockPanel = scene.add.rectangle(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, Math.min(500, CANVAS_WIDTH - 100), Math.min(200, CANVAS_HEIGHT - 200), 0xffffff, 1).setOrigin(0.5).setDepth(601);
    lockPanel.setStrokeStyle(4, 0xcc6600);
    
    const lockTitle = scene.add.text(CANVAS_WIDTH/2, lockPanel.y - 30, '🔒 Level Editor Locked', { font: 'bold 28px sans-serif', fill: '#cc6600' }).setOrigin(0.5).setDepth(602);
    const lockMsg = scene.add.text(CANVAS_WIDTH/2, lockPanel.y + 10, 'Complete Level 6 to unlock the Level Editor!', { font: '18px sans-serif', fill: '#333', align: 'center' }).setOrigin(0.5).setDepth(602);
    const okBtn = scene.add.text(CANVAS_WIDTH/2, lockPanel.y + lockPanel.height/2 - 30, 'OK', { font: 'bold 18px sans-serif', fill: '#fff', backgroundColor: '#555', padding: {x:24,y:10} }).setOrigin(0.5).setDepth(602).setInteractive();
    
    okBtn.on('pointerdown', () => {
      try { lockBg.destroy(); lockPanel.destroy(); lockTitle.destroy(); lockMsg.destroy(); okBtn.destroy(); } catch(e){}
    });
    okBtn.on('pointerover', () => okBtn.setScale(1.05));
    okBtn.on('pointerout', () => okBtn.setScale(1));
    return;
  }
  
  scene.editorOpen = true;
  
  // Create editor UI overlay
  const editorBg = scene.add.rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 0x000000, 0.9).setOrigin(0).setDepth(500).setInteractive();
  const editorPanel = scene.add.rectangle(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, Math.min(800, CANVAS_WIDTH - 100), Math.min(600, CANVAS_HEIGHT - 100), 0x1a1a1f, 1).setOrigin(0.5).setDepth(501);
  
  const title = scene.add.text(CANVAS_WIDTH/2, editorPanel.y - editorPanel.height/2 + 30, 'Level Editor', { font:'bold 28px sans-serif', fill:'#ffd700' }).setOrigin(0.5).setDepth(502);
  const instructions = scene.add.text(CANVAS_WIDTH/2, title.y + 35, 'Wall: #  Goal: .  Box: $  Player: @  Black Hole: M  Crystal: C', { font:'14px sans-serif', fill:'#aaa' }).setOrigin(0.5).setDepth(502);
  
  // Initialize grid - load from existing custom level data if available
  const editorGrid = [];
  for (let r = 0; r < ROWS; r++) {
    editorGrid[r] = [];
    for (let c = 0; c < COLS; c++) {
      // Load from saved custom level or default to borders
      if (scene.customLevelData && scene.customLevelData[r]) {
        editorGrid[r][c] = scene.customLevelData[r][c] || ' ';
      } else {
        editorGrid[r][c] = (r === 0 || r === ROWS-1 || c === 0 || c === COLS-1) ? '#' : ' ';
      }
    }
  }
  
  const tileSize = 50;
  const gridStartX = CANVAS_WIDTH/2 - (COLS * tileSize) / 2;
  const gridStartY = instructions.y + 40;
  const editorTiles = [];
  
  for (let r = 0; r < ROWS; r++) {
    editorTiles[r] = [];
    for (let c = 0; c < COLS; c++) {
      const x = gridStartX + c * tileSize;
      const y = gridStartY + r * tileSize;
      
      // Set initial color based on tile type
      const colors = { ' ': 0x333333, '#': 0x888888, '.': 0x88cc88, '$': 0xcc9966, '@': 0x66aaff, 'M': 0x000000, 'C': 0x66ddff };
      const initialColor = colors[editorGrid[r][c]] || 0x333333;
      
      const tile = scene.add.rectangle(x, y, tileSize - 2, tileSize - 2, initialColor).setOrigin(0).setDepth(502).setInteractive();
      const label = scene.add.text(x + tileSize/2, y + tileSize/2, editorGrid[r][c] === ' ' ? '' : editorGrid[r][c], { font:'20px monospace', fill:'#fff' }).setOrigin(0.5).setDepth(503);
      
      tile.on('pointerdown', (pointer) => {
        // Right click clears the tile (except borders)
        if (pointer.rightButtonDown()) {
          if (!(r === 0 || r === ROWS-1 || c === 0 || c === COLS-1)) {
            editorGrid[r][c] = ' ';
            label.setText('');
            tile.setFillStyle(0x333333);
          }
          return;
        }
        
        // Left click cycles through options
        const current = editorGrid[r][c];
        const cycle = [' ', '#', '.', '$', '@', 'M', 'C'];
        const idx = cycle.indexOf(current);
        editorGrid[r][c] = cycle[(idx + 1) % cycle.length];
        label.setText(editorGrid[r][c] === ' ' ? '' : editorGrid[r][c]);
        
        // Update tile color
        const colors = { ' ': 0x333333, '#': 0x888888, '.': 0x88cc88, '$': 0xcc9966, '@': 0x66aaff, 'M': 0x000000, 'C': 0x66ddff };
        tile.setFillStyle(colors[editorGrid[r][c]] || 0x333333);
      });
      
      editorTiles[r][c] = { tile, label };
    }
  }
  
  // Action buttons
  const btnY = gridStartY + ROWS * tileSize + 30;
  const testBtn = scene.add.text(CANVAS_WIDTH/2 - 160, btnY, 'Test Level', { font:'18px sans-serif', fill:'#fff', backgroundColor:'#227722', padding:{x:16,y:10} }).setOrigin(0.5).setDepth(502).setInteractive();
  const clearAllBtn = scene.add.text(CANVAS_WIDTH/2, btnY, 'Clear All', { font:'18px sans-serif', fill:'#fff', backgroundColor:'#666666', padding:{x:16,y:10} }).setOrigin(0.5).setDepth(502).setInteractive();
  const closeBtn = scene.add.text(CANVAS_WIDTH/2 + 160, btnY, 'Close', { font:'18px sans-serif', fill:'#fff', backgroundColor:'#992222', padding:{x:16,y:10} }).setOrigin(0.5).setDepth(502).setInteractive();
  
  const exportText = scene.add.text(CANVAS_WIDTH/2, btnY + 50, '', { font:'12px monospace', fill:'#aaa', wordWrap: { width: editorPanel.width - 40 } }).setOrigin(0.5).setDepth(502);
  
  testBtn.on('pointerdown', () => {
    const levelData = editorGrid.map(row => row.join(''));
    if (!validateLevel(levelData)) {
      exportText.setText('❌ Level must have exactly 1 player (@) and at least 1 goal (.) and 1 box ($)').setColor('#ff6666');
      return;
    }
    closeEditorUI();
    
    // Remove any existing custom levels before adding a new one
    while (LEVELS.length > BASE_LEVEL_COUNT) {
      LEVELS.pop();
    }
    
    // Store the original level index to return to after completing custom level
    // Only store if we're not already in a custom level
    if (currentLevelIndex < BASE_LEVEL_COUNT) {
      scene.originalLevelBeforeCustom = currentLevelIndex;
    }
    
    // Store the custom level data for re-editing
    scene.customLevelData = levelData;
    
    LEVELS.push(levelData);
    currentLevelIndex = LEVELS.length - 1;
    if (scene.levelDisplay) scene.levelDisplay.setText('1/1'); // Show custom level as 1/1
    transitionToLevel(scene, currentLevelIndex);
  });
  
  clearAllBtn.on('pointerdown', () => {
    // Reset grid to borders only
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (r === 0 || r === ROWS-1 || c === 0 || c === COLS-1) {
          editorGrid[r][c] = '#';
        } else {
          editorGrid[r][c] = ' ';
        }
        // Update visual tiles
        if (editorTiles[r] && editorTiles[r][c]) {
          editorTiles[r][c].label.setText(editorGrid[r][c] === ' ' ? '' : editorGrid[r][c]);
          const colors = { ' ': 0x333333, '#': 0x888888, '.': 0x88cc88, '$': 0xcc9966, '@': 0x66aaff, 'M': 0x000000, 'C': 0x66ddff };
          editorTiles[r][c].tile.setFillStyle(colors[editorGrid[r][c]] || 0x333333);
        }
      }
    }
    exportText.setText('');
  });
  
  closeBtn.on('pointerdown', closeEditorUI);
  
  [testBtn, clearAllBtn, closeBtn].forEach(btn => {
    btn.on('pointerover', () => btn.setScale(1.05));
    btn.on('pointerout', () => btn.setScale(1));
  });
  
  function closeEditorUI() {
    scene.editorOpen = false;
    [editorBg, editorPanel, title, instructions, testBtn, clearAllBtn, closeBtn, exportText].forEach(obj => { try { obj.destroy(); } catch(e){} });
    editorTiles.forEach(row => row.forEach(t => { try { t.tile.destroy(); t.label.destroy(); } catch(e){} }));
  }
}

function validateLevel(levelData) {
  const str = levelData.join('');
  const playerCount = (str.match(/@/g) || []).length;
  const goalCount = (str.match(/\./g) || []).length;
  const boxCount = (str.match(/\$/g) || []).length;
  return playerCount === 1 && goalCount >= 1 && boxCount >= 1 && goalCount === boxCount;
}
