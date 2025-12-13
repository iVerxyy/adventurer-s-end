/* Phaser 3 Puzzle Prototype — The Changing of Time
	 - Grid-based Sokoban-like puzzle
	 - Undo (Z) and rewind (hold R) using a snapshot history
	 - Adjustable timeScale with + / - keys
*/

const TILE = 64;
const ROWS = 8;
const COLS = 10;

const LEVEL = [
	'##########',
	'#   .    #',
	'#  $$    #',
	'#  @     #',
	'#        #',
	'#   .    #',
	'#        #',
	'##########'
];

const config = {
	type: Phaser.AUTO,
	width: COLS * TILE,
	height: ROWS * TILE,
	parent: 'game-container',
	backgroundColor: '#222',
	scene: { preload, create, update }
};

const game = new Phaser.Game(config);

function preload() {}

function create() {
	const scene = this;
	scene.timeScale = 1.0;
	scene.history = [];
	scene.isRewinding = false;

	// internal representation
	scene.grid = [];
	scene.boxes = [];
	scene.goals = [];
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
			'#   $    #',
			'#   .    #',
			'#        #',
			'##########'
		]
	];

	let currentLevelIndex = 0;

	const config = {
		type: Phaser.AUTO,
		width: COLS * TILE,
		height: ROWS * TILE,
		parent: 'game-container',
		backgroundColor: '#17202a',
		scene: { preload, create, update }
	};

	const game = new Phaser.Game(config);

	function preload() {
		// nothing to load from network — textures generated in create
	}

	function create() {
		const scene = this;
		scene.timeScale = 1.0;
		scene.history = [];
		scene.isRewinding = false;
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
				'#   $    #',
				'#   .    #',
				'#        #',
				'##########'
			]
		];

		let currentLevelIndex = 0;

		const config = {
			type: Phaser.AUTO,
			width: COLS * TILE,
			height: ROWS * TILE,
			parent: 'game-container',
			backgroundColor: '#17202a',
			scene: { preload, create, update }
		};

		const game = new Phaser.Game(config);

		function preload() {
			// nothing to load from network — textures generated in create
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

			// groups/holders
			scene.mapSprites = [];
			scene.boxGroup = scene.add.group();

			// create simple textures
			makeTextures(scene);

			// ambient particles (soft floating dots)
			scene.particles = scene.add.particles('spark');
			scene.particles.createEmitter({ x: { min: 0, max: COLS*TILE }, y: { min: 0, max: ROWS*TILE }, lifespan: 4000, speed: 5, scale: { start: 0.4, end: 0 }, quantity: 1, blendMode: 'SCREEN' });

			// input
			scene.cursors = scene.input.keyboard.createCursorKeys();
			scene.keyZ = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
			scene.keyR = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
			scene.keyPlus = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.EQUALS);
			scene.keyMinus = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS);

			// UI text and energy bar
			scene.statusText = scene.add.text(8, 8, '', { font:'16px monospace', fill:'#f5f5f5' }).setDepth(50);
			scene.energyBarBg = scene.add.rectangle(8, 36, 164, 14, 0x22333a).setOrigin(0,0).setDepth(50);
			scene.energyBar = scene.add.rectangle(10, 38, 160, 10, 0x66ffcc).setOrigin(0,0).setDepth(51);

			// small vignette overlay to make it feel polished
			const vignette = scene.add.graphics().setDepth(60);
			vignette.fillStyle(0x000000, 0.22);
			vignette.fillRoundedRect(0, 0, COLS*TILE, ROWS*TILE, 8);

			// WebAudio ambient (toggleable)
			scene.bgAudio = createAmbientAudio();
			scene.bgPlaying = false;

			// DOM controls
			const levelSelect = document.getElementById('level-select');
			const restartBtn = document.getElementById('restart-btn');
			const musicToggle = document.getElementById('music-toggle');
			if (levelSelect) levelSelect.value = currentLevelIndex;
			if (levelSelect) levelSelect.addEventListener('change', (e)=>{ currentLevelIndex = parseInt(e.target.value,10); loadLevel(scene, currentLevelIndex); });
			if (restartBtn) restartBtn.addEventListener('click', ()=> loadLevel(scene, currentLevelIndex));
			if (musicToggle) musicToggle.addEventListener('click', ()=>{ scene.bgPlaying = !scene.bgPlaying; scene.bgPlaying ? scene.bgAudio.play() : scene.bgAudio.stop(); });

			// Start level
			loadLevel(scene, currentLevelIndex);
		}

		function update(time, delta) {
			const scene = this;
			const scaledDelta = delta * scene.timeScale;

			// +/- to change timescale
			if (Phaser.Input.Keyboard.JustDown(scene.keyPlus)) scene.timeScale = Math.min(3, scene.timeScale + 0.25);
			if (Phaser.Input.Keyboard.JustDown(scene.keyMinus)) scene.timeScale = Math.max(0.25, scene.timeScale - 0.25);

			// undo (Z)
			if (Phaser.Input.Keyboard.JustDown(scene.keyZ)) {
				popSnapshot(scene);
			}

			// rewind (hold R)
			if (scene.keyR.isDown) {
				scene.isRewinding = true;
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

			// snap sprites
			if (scene.playerSprite) {
				scene.playerSprite.x = scene.player.c*TILE + TILE/2;
				scene.playerSprite.y = scene.player.r*TILE + TILE/2;
			}
			scene.boxes.forEach(b => { if (b.sprite) { b.sprite.x = b.c*TILE + TILE/2; b.sprite.y = b.r*TILE + TILE/2; } });

			// energy regen when not rewinding
			if (!scene.isRewinding && scene.energy < scene.maxEnergy) {
				scene.energy = Math.min(scene.maxEnergy, scene.energy + (delta*0.02));
			}

			// update UI
			scene.statusText.setText(`timeScale: ${scene.timeScale.toFixed(2)}  history: ${scene.history.length}`);
			const pct = Phaser.Math.Clamp(scene.energy / scene.maxEnergy, 0, 1);
			scene.energyBar.width = Math.max(2, 156 * pct);
			scene.energyBar.x = 10;
			scene.energyBar.y = 38;

			// win check
			if (!scene._won && checkWin(scene)) {
				scene._won = true;
				const t = scene.add.text(16, 72, 'Puzzle Solved!', { font:'28px sans-serif', fill:'#ffd700' }).setDepth(60);
				t.setShadow(2,2,'#000',4);
			}
		}

		function attemptMove(scene, dr, dc) {
			const r = scene.player.r; const c = scene.player.c;
			const r1 = r + dr; const c1 = c + dc;
			if (!inBounds(r1,c1) || scene.grid[r1][c1] === 'wall') return;

			const boxIndex = scene.boxes.findIndex(b => b.r === r1 && b.c === c1);
			if (boxIndex === -1) {
				scene.player.r = r1; scene.player.c = c1; pushSnapshot(scene); return;
			}

			const r2 = r1 + dr; const c2 = c1 + dc;
			if (!inBounds(r2,c2) || scene.grid[r2][c2] === 'wall') return;
			const blockBox = scene.boxes.find(b => b.r === r2 && b.c === c2);
			if (blockBox) return;

			// push
			scene.boxes[boxIndex].r = r2; scene.boxes[boxIndex].c = c2;
			scene.player.r = r1; scene.player.c = c1;
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

			scene.energy = scene.maxEnergy;

			const level = LEVELS[idx];
			for (let r = 0; r < ROWS; r++) {
				scene.grid[r] = [];
				for (let c = 0; c < COLS; c++) {
					const ch = (level[r] && level[r][c]) || ' ';
					const x = c*TILE + TILE/2; const y = r*TILE + TILE/2;

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
						box.sprite = scene.add.image(c*TILE+TILE/2, r*TILE+TILE/2, 'box').setDisplaySize(TILE-18,TILE-18).setDepth(5);
						scene.boxGroup.add(box.sprite);
						scene.boxes.push(box);
						scene.mapSprites.push(box.sprite);
					} else if (ch === '.') {
						scene.grid[r][c] = 'empty';
						const g = scene.add.image(x,y,'goal').setDisplaySize(22,22).setDepth(2);
						scene.goals.push({ r, c, sprite: g });
						scene.mapSprites.push(g);
					} else {
						scene.grid[r][c] = 'empty';
					}
				}
			}

			// player sprite
			if (scene.playerSprite) { try { scene.playerSprite.destroy(); } catch(e){} }
			scene.playerSprite = scene.add.image(scene.player.c*TILE+TILE/2, scene.player.r*TILE+TILE/2, 'player').setDisplaySize(TILE-30,TILE-30).setDepth(6);
			scene.mapSprites.push(scene.playerSprite);

			// initial snapshot
			pushSnapshot(scene);
		}

		function checkWin(scene) {
			return scene.goals.every(g => scene.boxes.some(b => b.r === g.r && b.c === g.c));
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
		}

		function createAmbientAudio() {
			let ctx = null; let osc = null; let gain = null;
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
					gain.gain.value = 0.02;
					osc.connect(gain); gain.connect(ctx.destination);
					osc.start(); lfo.start();
					this._lfo = lfo; this._lfoGain = lfoGain;
				},
				stop() {
					if (!ctx) return;
					try { osc.stop(); this._lfo.stop(); } catch(e){}
					try { osc.disconnect(); this._lfo.disconnect(); gain.disconnect(); ctx.close(); } catch(e){}
					ctx = null; osc = null; gain = null; this._lfo = null; this._lfoGain = null;
				}
			};
		}

		// end of file

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
	}

	function createAmbientAudio() {
		let ctx = null; let osc = null; let gain = null;
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
				gain.gain.value = 0.02;
				osc.connect(gain); gain.connect(ctx.destination);
				osc.start(); lfo.start();
				this._lfo = lfo; this._lfoGain = lfoGain;
			},
			stop() {
				if (!ctx) return;
				try { osc.stop(); this._lfo.stop(); } catch(e){}
				try { osc.disconnect(); this._lfo.disconnect(); gain.disconnect(); ctx.close(); } catch(e){}
				ctx = null; osc = null; gain = null; this._lfo = null; this._lfoGain = null;
			}
		};
	}

