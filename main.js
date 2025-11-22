/**
 * Maze Escape RPG
 * A simple top-down maze exploration game using Phaser 3.
 */

// --- Configuration Constants ---
const TILE_SIZE = 40;
const COLS = 20; // 800 / 40
const ROWS = 15; // 600 / 40
const WALL_COLOR = 0x555555;
const FLOOR_COLOR = 0x222222;
const PLAYER_COLOR = 0x00ff00;

/**
 * BootScene
 * Preloads assets and generates textures programmatically.
 */
class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // No external assets to load for this demo.
        // We will generate textures in create().
    }

    create() {
        // Generate Wall Texture
        const wallGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        wallGraphics.fillStyle(WALL_COLOR);
        wallGraphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        wallGraphics.lineStyle(2, 0x000000);
        wallGraphics.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
        wallGraphics.generateTexture('wall', TILE_SIZE, TILE_SIZE);

        // Generate Floor Texture
        const floorGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        floorGraphics.fillStyle(FLOOR_COLOR);
        floorGraphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        floorGraphics.generateTexture('floor', TILE_SIZE, TILE_SIZE);

        // Generate Player Texture
        const playerGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        playerGraphics.fillStyle(PLAYER_COLOR);
        playerGraphics.fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2 - 4);
        playerGraphics.generateTexture('player', TILE_SIZE, TILE_SIZE);

        // Generate Monster Texture
        const monsterGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        monsterGraphics.fillStyle(0xff0000);
        monsterGraphics.fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2 - 6);
        monsterGraphics.generateTexture('monster', TILE_SIZE, TILE_SIZE);

        // Generate Boss Texture
        const bossGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        bossGraphics.fillStyle(0x800080); // Purple
        bossGraphics.fillRect(4, 4, TILE_SIZE - 8, TILE_SIZE - 8);
        bossGraphics.generateTexture('boss', TILE_SIZE, TILE_SIZE);

        console.log('Assets generated. Starting ExploreScene...');
        this.scene.start('ExploreScene');
    }
}

/**
 * ExploreScene
 * Handles maze generation, player movement, and battle triggers.
 */
class ExploreScene extends Phaser.Scene {
    constructor() {
        super('ExploreScene');
    }

    create(data) {
        this.level = data.level || 1;
        this.isBossDefeated = false;

        // Player Stats (Pass from previous level or init)
        this.playerStats = data.playerStats || {
            hp: 100,
            maxHp: 100,
            mp: 50,
            maxMp: 50,
            baseAttack: 15,
            baseDefense: 7,
            equipment: {
                weapon: { name: 'Basic Sword', value: 5, type: 'weapon' },
                armor: { name: 'Basic Armor', value: 3, type: 'armor' }
            },
            inventory: [
                { name: 'Basic Sword', value: 5, type: 'weapon' },
                { name: 'Iron Sword', value: 10, type: 'weapon' },
                { name: 'Basic Armor', value: 3, type: 'armor' },
                { name: 'Iron Armor', value: 6, type: 'armor' }
            ]
        };

        // 1. Generate Maze Data
        this.maze = this.generateMaze(COLS, ROWS);

        // 2. Render Maze
        this.physics.world.setBounds(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE);
        this.walls = this.physics.add.staticGroup();

        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const posX = x * TILE_SIZE + TILE_SIZE / 2;
                const posY = y * TILE_SIZE + TILE_SIZE / 2;

                if (this.maze[y][x] === 1) {
                    // Wall
                    this.walls.create(posX, posY, 'wall');
                } else {
                    // Floor (just an image, no physics needed)
                    this.add.image(posX, posY, 'floor');
                }
            }
        }

        // 3. Add Player
        // Find a valid starting position (first floor tile)
        let startX = 1;
        let startY = 1;
        // Ensure we start on a floor tile
        while (this.maze[startY][startX] === 1) {
            startX++;
            if (startX >= COLS - 1) {
                startX = 1;
                startY++;
            }
        }

        this.player = this.physics.add.sprite(
            startX * TILE_SIZE + TILE_SIZE / 2,
            startY * TILE_SIZE + TILE_SIZE / 2,
            'player'
        );
        this.player.setCollideWorldBounds(true);

        // 4. Monsters
        this.monsters = this.physics.add.group();
        let monsterCount = 0;
        while (monsterCount < 5) {
            const mx = Phaser.Math.Between(1, COLS - 2);
            const my = Phaser.Math.Between(1, ROWS - 2);

            if (this.maze[my][mx] === 0 && (mx !== startX || my !== startY)) {
                this.monsters.create(
                    mx * TILE_SIZE + TILE_SIZE / 2,
                    my * TILE_SIZE + TILE_SIZE / 2,
                    'monster'
                );
                monsterCount++;
            }
        }

        // 4b. Boss
        this.boss = this.physics.add.sprite(-100, -100, 'boss'); // Init off-screen
        let bossPlaced = false;
        while (!bossPlaced) {
            const bx = Phaser.Math.Between(1, COLS - 2);
            const by = Phaser.Math.Between(1, ROWS - 2);
            // Ensure empty floor and far enough from start (optional, but good)
            if (this.maze[by][bx] === 0 && (bx > 5 || by > 5)) {
                this.boss.setPosition(
                    bx * TILE_SIZE + TILE_SIZE / 2,
                    by * TILE_SIZE + TILE_SIZE / 2
                );
                bossPlaced = true;
            }
        }

        // 5. Collisions
        this.physics.add.collider(this.player, this.walls);
        this.physics.add.overlap(this.player, this.monsters, this.onMeetMonster, null, this);
        this.physics.add.overlap(this.player, this.boss, this.onMeetBoss, null, this);

        // 6. Input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            inventory: Phaser.Input.Keyboard.KeyCodes.I
        });

        // Track previous position for battle calculation
        this.lastGridX = startX;
        this.lastGridY = startY;

        // Camera setup (optional for this size, but good practice)
        this.cameras.main.setBounds(0, 0, COLS * TILE_SIZE, ROWS * TILE_SIZE);
        this.cameras.main.startFollow(this.player);

        // Fix: Reset keys on wake to prevent stuck movement
        this.events.on('wake', () => {
            this.cursors.left.reset();
            this.cursors.right.reset();
            this.cursors.up.reset();
            this.cursors.down.reset();
            Object.values(this.wasd).forEach(key => key.reset());

            if (this.isBossDefeated) {
                // Advance to next level
                this.scene.restart({
                    level: this.level + 1,
                    playerStats: this.playerStats
                });
            }
        });

        // UI: Level Indicator
        this.add.text(16, 16, `Level: ${this.level}`, {
            fontSize: '20px',
            fill: '#ffffff',
            backgroundColor: '#000000'
        }).setScrollFactor(0);

        // UI: Stats
        this.statsText = this.add.text(16, 40, '', {
            fontSize: '16px',
            fill: '#ffffff',
            backgroundColor: '#000000'
        }).setScrollFactor(0);
        this.updateStatsDisplay();
    }

    update() {
        // Update stats text
        this.updateStatsDisplay();

        const speed = 160;
        const body = this.player.body;

        // Reset velocity
        body.setVelocity(0);

        // Horizontal movement
        if (this.cursors.left.isDown || this.wasd.left.isDown) {
            body.setVelocityX(-speed);
        } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
            body.setVelocityX(speed);
        }

        // Vertical movement
        if (this.cursors.up.isDown || this.wasd.up.isDown) {
            body.setVelocityY(-speed);
        } else if (this.cursors.down.isDown || this.wasd.down.isDown) {
            body.setVelocityY(speed);
        }

        // Normalize and scale velocity so diagonal movement isn't faster
        body.velocity.normalize().scale(speed);

        // Inventory Toggle
        if (Phaser.Input.Keyboard.JustDown(this.wasd.inventory)) {
            this.scene.pause();
            this.scene.launch('InventoryScene', { playerStats: this.playerStats });
        }
    }


    updateStatsDisplay() {
        this.statsText.setText(`HP: ${this.playerStats.hp}/${this.playerStats.maxHp}  MP: ${this.playerStats.mp}/${this.playerStats.maxMp}`);
    }

    onMeetMonster(player, monster) {
        monster.destroy();
        this.triggerBattle('monster');
    }

    onMeetBoss(player, boss) {
        boss.destroy();
        this.isBossDefeated = true; // Will be checked on wake
        this.triggerBattle('boss');
    }

    triggerBattle(enemyType) {
        console.log('Battle Triggered with ' + enemyType);

        // Define enemy stats
        let enemyStats = {};
        if (enemyType === 'boss') {
            enemyStats = { name: 'Boss', hp: 150, maxHp: 150, attack: 25, defense: 12, color: 0x800080 };
        } else {
            enemyStats = { name: 'Monster', hp: 50, maxHp: 50, attack: 15, defense: 5, color: 0xff0000 };
        }

        // Switch to BattleScene passing stats
        // Switch to BattleScene passing stats
        this.scene.sleep('ExploreScene');
        this.scene.run('BattleScene', {
            playerStats: this.playerStats,
            enemyStats: enemyStats
        });
    }

    /**
     * Generates a maze using a randomized Prim's algorithm or DFS.
     * 1 = Wall, 0 = Floor
     */
    generateMaze(width, height) {
        // Initialize grid with walls (1)
        let maze = [];
        for (let y = 0; y < height; y++) {
            let row = [];
            for (let x = 0; x < width; x++) {
                row.push(1);
            }
            maze.push(row);
        }

        // Simple Recursive Backtracker (DFS)
        // We need odd dimensions for this algorithm to work best with walls between cells
        // But we can adapt. Let's treat cells as (x,y) where x,y are odd indices.

        const stack = [];
        const startX = 1;
        const startY = 1;

        maze[startY][startX] = 0;
        stack.push({ x: startX, y: startY });

        const directions = [
            { dx: 0, dy: -2 }, // Up
            { dx: 0, dy: 2 },  // Down
            { dx: -2, dy: 0 }, // Left
            { dx: 2, dy: 0 }   // Right
        ];

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const { x, y } = current;

            // Find unvisited neighbors
            const neighbors = [];
            for (let dir of directions) {
                const nx = x + dir.dx;
                const ny = y + dir.dy;

                if (nx > 0 && nx < width - 1 && ny > 0 && ny < height - 1) {
                    if (maze[ny][nx] === 1) {
                        neighbors.push({ nx, ny, dir });
                    }
                }
            }

            if (neighbors.length > 0) {
                // Choose random neighbor
                const chosen = neighbors[Math.floor(Math.random() * neighbors.length)];

                // Remove wall between
                maze[chosen.ny][chosen.nx] = 0;
                maze[y + chosen.dir.dy / 2][x + chosen.dir.dx / 2] = 0;

                stack.push({ x: chosen.nx, y: chosen.ny });
            } else {
                stack.pop();
            }
        }

        return maze;
    }
}

/**
 * BattleScene
 * A simple placeholder for combat.
 */
class BattleScene extends Phaser.Scene {
    constructor() {
        super('BattleScene');
    }

    create(data) {
        // Fallback stats to prevent crash if data is missing
        this.playerStats = data && data.playerStats ? data.playerStats : {
            hp: 100, maxHp: 100, mp: 50, maxMp: 50,
            baseAttack: 15, baseDefense: 7,
            equipment: {
                weapon: { name: 'Basic Sword', value: 5 },
                armor: { name: 'Basic Armor', value: 3 }
            }
        };
        this.enemyStats = data && data.enemyStats ? data.enemyStats : { name: 'Unknown', hp: 50, maxHp: 50, attack: 10, defense: 0, color: 0xffffff };

        // Background
        this.add.rectangle(400, 300, 800, 600, 0x222222);

        // Enemy Visual
        this.enemyCircle = this.add.circle(400, 200, 60, this.enemyStats.color);
        this.enemyNameText = this.add.text(400, 120, this.enemyStats.name, { fontSize: '32px', fill: '#fff' }).setOrigin(0.5);

        // Enemy HP & Stats
        this.enemyHpText = this.add.text(400, 280, `HP: ${this.enemyStats.hp}/${this.enemyStats.maxHp}`, { fontSize: '24px', fill: '#ff0000' }).setOrigin(0.5);
        this.enemyStatsText = this.add.text(400, 310, `ATK: ${this.enemyStats.attack}  DEF: ${this.enemyStats.defense}`, { fontSize: '18px', fill: '#aaaaaa' }).setOrigin(0.5);

        // Player Stats UI
        this.add.text(50, 400, 'Player', { fontSize: '32px', fill: '#00ff00' });
        this.playerHpText = this.add.text(50, 440, `HP: ${this.playerStats.hp}/${this.playerStats.maxHp}`, { fontSize: '24px', fill: '#fff' });
        this.playerMpText = this.add.text(50, 470, `MP: ${this.playerStats.mp}/${this.playerStats.maxMp}`, { fontSize: '24px', fill: '#fff' });

        const totalAttack = this.playerStats.baseAttack + (this.playerStats.equipment ? this.playerStats.equipment.weapon.value : 0);
        const totalDefense = this.playerStats.baseDefense + (this.playerStats.equipment ? this.playerStats.equipment.armor.value : 0);

        // Detailed Stats Display
        this.playerStatsText = this.add.text(50, 500, '', { fontSize: '16px', fill: '#aaaaaa' });
        this.updateStatsText();

        // Equipment UI
        this.add.text(50, 550, `Wpn: ${this.playerStats.equipment.weapon.name} (+${this.playerStats.equipment.weapon.value})`, { fontSize: '16px', fill: '#888' });
        this.add.text(50, 570, `Arm: ${this.playerStats.equipment.armor.name} (+${this.playerStats.equipment.armor.value})`, { fontSize: '16px', fill: '#888' });

        // Action Menu
        this.add.text(400, 400, 'Actions:', { fontSize: '24px', fill: '#aaa' });

        const attackBtn = this.add.text(400, 440, '1. Attack', { fontSize: '28px', fill: '#fff', backgroundColor: '#444', padding: { x: 10, y: 5 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.playerAttack());

        const magicBtn = this.add.text(400, 490, '2. Magic (Heal)', { fontSize: '28px', fill: '#fff', backgroundColor: '#444', padding: { x: 10, y: 5 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.playerMagic());

        // Message Log
        this.messageLog = this.add.text(400, 550, 'Battle Start!', { fontSize: '20px', fill: '#ffff00' }).setOrigin(0.5);

        // Input Keys
        this.input.keyboard.on('keydown-ONE', () => this.playerAttack());
        this.input.keyboard.on('keydown-TWO', () => this.playerMagic());

        this.isPlayerTurn = true;
        this.gameOver = false;

        // Handle Wake event for subsequent battles
        this.events.on('wake', this.onWake, this);
    }

    onWake(sys, data) {
        if (data) {
            this.playerStats = data.playerStats;
            // Clone enemy stats to ensure we don't reference a modified object
            this.enemyStats = { ...data.enemyStats };
        }

        this.isPlayerTurn = true;
        this.gameOver = false;

        // Update Visuals
        this.enemyCircle.setFillStyle(this.enemyStats.color);
        this.enemyNameText.setText(this.enemyStats.name);

        this.updateUI();
        this.showMessage('Battle Start!');
    }

    playerAttack() {
        if (!this.isPlayerTurn || this.gameOver) return;

        // Damage = (Player Base Atk + Weapon) - Enemy Def
        const totalAttack = this.playerStats.baseAttack + (this.playerStats.equipment ? this.playerStats.equipment.weapon.value : 0);
        const damage = Math.max(0, totalAttack - this.enemyStats.defense);
        this.enemyStats.hp -= damage;
        this.updateUI();
        this.showMessage(`You attacked for ${damage} damage!`);

        this.checkWinCondition();
        if (!this.gameOver) {
            this.endPlayerTurn();
        }
    }

    playerMagic() {
        if (!this.isPlayerTurn || this.gameOver) return;

        const mpCost = 10;
        const healAmount = 30;

        if (this.playerStats.mp >= mpCost) {
            this.playerStats.mp -= mpCost;
            this.playerStats.hp = Math.min(this.playerStats.maxHp, this.playerStats.hp + healAmount);
            this.updateUI();
            this.showMessage(`You healed ${healAmount} HP!`);
            this.endPlayerTurn();
        } else {
            this.showMessage('Not enough MP!');
        }
    }

    endPlayerTurn() {
        this.isPlayerTurn = false;
        this.time.delayedCall(1000, () => this.enemyTurn());
    }

    enemyTurn() {
        if (this.gameOver) return;

        // Enemy Attack vs (Player Base Def + Armor)
        const totalDefense = this.playerStats.baseDefense + (this.playerStats.equipment ? this.playerStats.equipment.armor.value : 0);
        const damage = Math.max(0, this.enemyStats.attack - totalDefense);
        this.playerStats.hp -= damage;
        this.updateUI();
        this.showMessage(`${this.enemyStats.name} attacked you for ${damage} damage!`);

        if (this.playerStats.hp <= 0) {
            this.playerStats.hp = 0;
            this.updateUI();
            this.loseBattle();
        } else {
            this.isPlayerTurn = true;
        }
    }

    checkWinCondition() {
        if (this.enemyStats.hp <= 0) {
            this.enemyStats.hp = 0;
            this.updateUI();
            this.winBattle();
        }
    }

    winBattle() {
        this.gameOver = true;
        this.showMessage('You Won!');
        this.time.delayedCall(1500, () => {
            this.scene.sleep('BattleScene');
            this.scene.run('ExploreScene');
        });
    }

    loseBattle() {
        this.gameOver = true;
        this.showMessage('You Died...');
        this.time.delayedCall(2000, () => {
            // Restart the game from level 1
            this.scene.start('ExploreScene', { level: 1 });
        });
    }

    updateUI() {
        this.enemyHpText.setText(`HP: ${this.enemyStats.hp}/${this.enemyStats.maxHp}`);
        this.enemyStatsText.setText(`ATK: ${this.enemyStats.attack}  DEF: ${this.enemyStats.defense}`);

        this.playerHpText.setText(`HP: ${this.playerStats.hp}/${this.playerStats.maxHp}`);
        this.playerMpText.setText(`MP: ${this.playerStats.mp}/${this.playerStats.maxMp}`);

        this.updateStatsText();
    }

    updateStatsText() {
        const baseAtk = this.playerStats.baseAttack;
        const wpnVal = this.playerStats.equipment ? this.playerStats.equipment.weapon.value : 0;
        const totalAtk = baseAtk + wpnVal;

        const baseDef = this.playerStats.baseDefense;
        const armVal = this.playerStats.equipment ? this.playerStats.equipment.armor.value : 0;
        const totalDef = baseDef + armVal;

        this.playerStatsText.setText(
            `ATK: ${baseAtk} + ${wpnVal} = ${totalAtk}\n` +
            `DEF: ${baseDef} + ${armVal} = ${totalDef}`
        );
    }

    showMessage(msg) {
        this.messageLog.setText(msg);
    }
}

class InventoryScene extends Phaser.Scene {
    constructor() {
        super('InventoryScene');
    }

    create(data) {
        this.playerStats = data.playerStats;

        // Background
        this.add.rectangle(400, 300, 600, 500, 0x000000, 0.9).setStrokeStyle(2, 0xffffff);
        this.add.text(400, 80, 'Inventory', { fontSize: '32px', fill: '#fff' }).setOrigin(0.5);
        this.add.text(400, 520, 'Press I to Close', { fontSize: '16px', fill: '#aaa' }).setOrigin(0.5);

        // Current Equipment
        this.add.text(150, 130, 'Equipped:', { fontSize: '24px', fill: '#ffff00' });
        this.wpnText = this.add.text(150, 160, `Weapon: ${this.playerStats.equipment.weapon.name} (+${this.playerStats.equipment.weapon.value})`, { fontSize: '18px', fill: '#fff' });
        this.armText = this.add.text(150, 190, `Armor: ${this.playerStats.equipment.armor.name} (+${this.playerStats.equipment.armor.value})`, { fontSize: '18px', fill: '#fff' });

        // Inventory List
        this.add.text(150, 240, 'Items (Click to Equip):', { fontSize: '24px', fill: '#ffff00' });

        this.renderInventoryList();

        // Input to close
        this.input.keyboard.on('keydown-I', () => {
            this.scene.resume('ExploreScene');
            this.scene.stop();
        });
    }

    renderInventoryList() {
        if (this.listContainer) this.listContainer.destroy();
        this.listContainer = this.add.container(150, 280);

        this.playerStats.inventory.forEach((item, index) => {
            const y = index * 30;
            const text = this.add.text(0, y, `${item.name} (+${item.value} ${item.type === 'weapon' ? 'ATK' : 'DEF'})`, {
                fontSize: '18px',
                fill: '#fff',
                backgroundColor: '#333',
                padding: { x: 5, y: 2 }
            })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.equipItem(item));

            this.listContainer.add(text);
        });
    }

    equipItem(item) {
        if (item.type === 'weapon') {
            this.playerStats.equipment.weapon = item;
            this.wpnText.setText(`Weapon: ${item.name} (+${item.value})`);
        } else if (item.type === 'armor') {
            this.playerStats.equipment.armor = item;
            this.armText.setText(`Armor: ${item.name} (+${item.value})`);
        }
        // Re-render list (optional if we wanted to highlight equipped item)
    }
}

// --- Game Configuration ---
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#000000',
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }, // Top-down, so no gravity
            debug: false
        }
    },
    scene: [BootScene, ExploreScene, BattleScene, InventoryScene]
};

// Initialize Game
const game = new Phaser.Game(config);
