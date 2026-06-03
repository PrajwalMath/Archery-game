// --- Audio Synthesis Setup ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        if (type === 'shoot') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start(); osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'hit') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            osc.start(); osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'stretch') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(400, audioCtx.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.1);
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
            osc.start(); osc.stop(audioCtx.currentTime + 0.2);
        }
    } catch (e) { console.warn('Audio failed', e); }
}

// --- Matter.js Setup ---
const { Engine, Render, Runner, Events, Constraint, MouseConstraint, Mouse, Body, Composite, Vector, Bodies } = Matter;

const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 0.5;

const render = Render.create({
    element: document.body,
    engine: engine,
    options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: 'transparent',
        pixelRatio: 1
    }
});
Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// Pause engine until player clicks Play
engine.enabled = false;
render.canvas.style.display = 'none';

const homeScreen = document.getElementById('home-screen');
const playBtn = document.getElementById('play-btn');
const modeNormalBtn = document.getElementById('mode-normal');
const modeWindBtn = document.getElementById('mode-wind');
const modeUnlimitedBtn = document.getElementById('mode-unlimited');
const windIndicator = document.getElementById('wind-indicator');
const toggleWindBtn = document.getElementById('toggle-wind-btn');

let selectedMode = 'normal'; // 'normal', 'wind', 'unlimited'

modeNormalBtn.addEventListener('click', () => {
    selectedMode = 'normal';
    modeNormalBtn.classList.add('active');
    modeWindBtn.classList.remove('active');
    modeUnlimitedBtn.classList.remove('active');
});

modeWindBtn.addEventListener('click', () => {
    selectedMode = 'wind';
    modeWindBtn.classList.add('active');
    modeNormalBtn.classList.remove('active');
    modeUnlimitedBtn.classList.remove('active');
});

modeUnlimitedBtn.addEventListener('click', () => {
    selectedMode = 'unlimited';
    modeUnlimitedBtn.classList.add('active');
    modeNormalBtn.classList.remove('active');
    modeWindBtn.classList.remove('active');
});

toggleWindBtn.addEventListener('click', () => {
    windMode = !windMode;
    toggleWindBtn.innerText = windMode ? "Wind: ON" : "Wind: OFF";
    toggleWindBtn.classList.toggle('active', windMode);
    
    if (windMode) {
        windIndicator.style.display = '';
        updateWind();
    } else {
        windIndicator.style.display = 'none';
        windSpeed = 0;
    }
});

let isUnlimited = false;

function startGame(mode) {
    if (mode === 'normal') {
        windMode = false;
        isUnlimited = false;
    } else if (mode === 'wind') {
        windMode = true;
        isUnlimited = false;
    } else if (mode === 'unlimited') {
        windMode = false;
        isUnlimited = true;
    }

    homeScreen.classList.add('hidden');
    render.canvas.style.display = 'block';
    engine.enabled = true;
    document.getElementById('ui-layer').classList.remove('hidden');
    
    if (windMode && windIndicator) {
        windIndicator.style.display = '';
        updateWind();
    }
    if (isUnlimited) {
        arrowsEl.innerText = "∞";
        toggleWindBtn.style.display = 'inline-block';
        toggleWindBtn.innerText = "Wind: OFF";
        toggleWindBtn.classList.remove('active');
    } else {
        toggleWindBtn.style.display = 'none';
    }
    
    setTimeout(() => { homeScreen.style.display = 'none'; }, 600);
}

playBtn.addEventListener('click', function() {
    startGame(selectedMode);
});

// --- Game State ---
let score = 0;
let arrowsLeft = 10;
const scoreEl = document.getElementById('score');
const arrowsEl = document.getElementById('arrows');
const gameOverEl = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const instructionsEl = document.getElementById('instructions');

// --- New Features State ---
let windSpeed = 0;
const windSpeedEl = document.getElementById('wind-speed');
const windDirEl = document.getElementById('wind-dir');

let currentArrowType = 'normal';
let specialArrows = { bomb: 0, splitter: 0, freeze: 0 };
let specialQueue = [];
let targetFrozenUntil = 0;
let timeTick = 0;
let explosions = [];
let crateSpawnTimer = null;
let lastMissedReward = null;

let windMode = false;
let gameStarted = false;

function updateWind() {
    if (!windMode) {
        windSpeed = 0;
        return;
    }
    windSpeed = (Math.random() * 10 - 5).toFixed(1);
    if(windSpeedEl) windSpeedEl.innerText = Math.abs(windSpeed);
    if(windDirEl) windDirEl.innerText = windSpeed > 0 ? '➡️' : (windSpeed < 0 ? '⬅️' : '-');
}
updateWind();

// --- Crates Setup ---
function spawnCrate() {
    const yPos = window.innerHeight * 0.1 + Math.random() * (window.innerHeight * 0.2);
    const startLeft = Math.random() > 0.5;
    const xPos = startLeft ? -50 : window.innerWidth + 50;
    const speed = startLeft ? 1.5 : -1.5;

    const powerups = ['bomb', 'splitter', 'freeze'];
    let reward = powerups[Math.floor(Math.random() * powerups.length)];
    if (lastMissedReward && lastMissedReward === reward) {
        reward = powerups.find(p => p !== lastMissedReward);
    }

    const crate = Bodies.rectangle(xPos, yPos, 40, 40, {
        isStatic: true,
        isSensor: true, // Collision without bounce
        label: 'crate',
        rewardType: reward,
        render: { visible: false },
        driftSpeed: speed
    });
    Composite.add(world, crate);

    crateSpawnTimer = setTimeout(spawnCrate, 10000 + Math.random() * 10000);
}
let currentArrow = null;
let slingshotConstraint = null;
let isDragging = false;
let arrowFired = false;

// Boundaries (invisible)
const ground = Bodies.rectangle(window.innerWidth/2, window.innerHeight + 1000, window.innerWidth * 3, 50, { isStatic: true, render: { visible: false } });
const ceiling = Bodies.rectangle(window.innerWidth/2, -1000, window.innerWidth * 3, 50, { isStatic: true, render: { visible: false } });
const wallLeft = Bodies.rectangle(-1000, window.innerHeight/2, 50, window.innerHeight * 3, { isStatic: true, render: { visible: false } });
const wallRight = Bodies.rectangle(window.innerWidth + 25, window.innerHeight/2, 50, window.innerHeight * 3, { isStatic: true, render: { visible: false } });
Composite.add(world, [ground, ceiling, wallLeft, wallRight]);

const arrowGroup = Body.nextGroup(true); // Creates a unique negative group (e.g. -2) for all arrows

// --- Target Setup ---
const targetX = window.innerWidth * 0.8;
let targetDirection = 1;
const targetGroup = Body.nextGroup(true);

const bullseye = Bodies.rectangle(targetX, window.innerHeight/2, 10, 60, {
    isStatic: true, render: { visible: false }, label: 'target_bullseye', collisionFilter: { group: targetGroup }
});
const innerRingTop = Bodies.rectangle(targetX, window.innerHeight/2 - 40, 10, 20, {
    isStatic: true, render: { visible: false }, label: 'target_inner', collisionFilter: { group: targetGroup }
});
const innerRingBottom = Bodies.rectangle(targetX, window.innerHeight/2 + 40, 10, 20, {
    isStatic: true, render: { visible: false }, label: 'target_inner', collisionFilter: { group: targetGroup }
});
const outerRingTop = Bodies.rectangle(targetX, window.innerHeight/2 - 65, 10, 30, {
    isStatic: true, render: { visible: false }, label: 'target_outer', collisionFilter: { group: targetGroup }
});
const outerRingBottom = Bodies.rectangle(targetX, window.innerHeight/2 + 65, 10, 30, {
    isStatic: true, render: { visible: false }, label: 'target_outer', collisionFilter: { group: targetGroup }
});
const targetParts = [bullseye, innerRingTop, innerRingBottom, outerRingTop, outerRingBottom];
Composite.add(world, targetParts);

// --- Bow Anchor ---
const bowX = window.innerWidth * 0.15;
const bowY = window.innerHeight * 0.6;
const anchor = { x: bowX, y: bowY };

// --- Fade and Remove ---
function fadeAndRemove(arrow) {
    if (arrow.isFading) return;
    arrow.isFading = true;
    arrow.fadeOpacity = 1;
    const fadeInterval = setInterval(() => {
        arrow.fadeOpacity -= 0.03;
        if (arrow.render) arrow.render.opacity = Math.max(0, arrow.fadeOpacity);
        if (arrow.fadeOpacity <= 0) {
            clearInterval(fadeInterval);
            const constraints = Composite.allConstraints(world);
            Composite.remove(world, constraints.filter(c => c.bodyB === arrow || c.bodyA === arrow));
            Composite.remove(world, arrow);
        }
    }, 30);
}

// --- Create Arrow (physics body is invisible, we draw custom) ---
function createArrow() {
    if (arrowsLeft <= 0) { endGame(); return; }

    if (specialQueue.length > 0) {
        currentArrowType = specialQueue.shift();
        specialArrows[currentArrowType]--;
    } else {
        currentArrowType = 'normal';
    }

    ['bomb', 'splitter', 'freeze'].forEach(type => {
        if(document.getElementById(`count-${type}`)) document.getElementById(`count-${type}`).innerText = specialArrows[type];
    });

    currentArrow = Bodies.rectangle(anchor.x, anchor.y, 80, 10, {
        restitution: 0.2, friction: 0.1, density: 0.05,
        label: 'arrow',
        arrowType: currentArrowType,
        hasSplit: false,
        collisionFilter: { group: arrowGroup }, // Arrows ignore each other but can hit the target
        render: { visible: false } // Hidden! We draw it ourselves
    });
    
    Body.setCentre(currentArrow, { x: 20, y: 0 }, true);
    
    // Set inertia to Infinity so the arrow stays stable and landscape while aiming
    Body.setInertia(currentArrow, Infinity);

    slingshotConstraint = Constraint.create({
        pointA: anchor,
        bodyB: currentArrow,
        pointB: { x: -30, y: 0 },
        stiffness: 0.05, damping: 0.1,
        render: { visible: false }
    });

    Composite.add(world, [currentArrow, slingshotConstraint]);
    arrowFired = false;
}
createArrow();

// --- Mouse ---
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: { stiffness: 0.2, render: { visible: false } }
});
Composite.add(world, mouseConstraint);
render.mouse = mouse;

// --- Drag Events ---
Events.on(mouseConstraint, 'startdrag', function(event) {
    if (event.body === currentArrow && !arrowFired) {
        if (!gameStarted) {
            gameStarted = true;
            crateSpawnTimer = setTimeout(spawnCrate, 5000);
        }
        isDragging = true;
        playSound('stretch');
        if (instructionsEl) instructionsEl.classList.add('hidden');
    }
});

Events.on(mouseConstraint, 'enddrag', function(event) {
    if (event.body === currentArrow && isDragging) {
        isDragging = false;
        const dragVector = Vector.sub(anchor, currentArrow.position);
        if (Vector.magnitude(dragVector) > 30) {
            arrowFired = true;
            currentArrow.fired = true;
            Composite.remove(world, slingshotConstraint);
            
            // Set the arrow's physical angle to the final aim angle upon release
            const releaseAngle = Math.atan2(dragVector.y, dragVector.x);
            Body.setAngle(currentArrow, releaseAngle);
            
            Body.setVelocity(currentArrow, {
                x: dragVector.x * 0.15,
                y: dragVector.y * 0.15
            });
            
            if (currentArrow.arrowType === 'splitter') {
                // Wait to split until midway
                currentArrow.hasSplit = false;
            }

            playSound('shoot');
            if (!isUnlimited) {
                arrowsLeft--;
                if (arrowsEl) arrowsEl.innerText = arrowsLeft;
            }
            updateWind();
            setTimeout(() => {
                if (arrowsLeft > 0 || isUnlimited) createArrow();
                else endGame();
            }, 2000);
        }
    }
});

// --- Physics Update ---
Events.on(engine, 'beforeUpdate', function() {
    if (!gameStarted) return;
    timeTick += 0.05;
    let dx = 0, dy = 0;
    
    if (Date.now() > targetFrozenUntil) {
        let speed = 2 + Math.sin(timeTick) * 1.5;
        if (bullseye.position.y < window.innerHeight * 0.2) targetDirection = 1;
        if (bullseye.position.y > window.innerHeight * 0.8) targetDirection = -1;
        
        dy = speed * targetDirection;
        dx = 0;
        
        if (windMode) {
            dx = Math.cos(timeTick) * 2 + (windSpeed * 0.3); // Wave + Wind push
        }
        
        if (bullseye.position.x + dx < window.innerWidth * 0.6 || bullseye.position.x + dx > window.innerWidth * 0.95) dx = 0;
        
        targetParts.forEach(part => Body.translate(part, { x: dx, y: dy }));
    }

    const bodies = Composite.allBodies(world);
    for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        
        if (b.label === 'crate') {
            Body.translate(b, { x: b.driftSpeed, y: Math.sin(timeTick * 2) * 0.5 }); // Drift + slight bob
            if ((b.driftSpeed > 0 && b.position.x > window.innerWidth + 100) ||
                (b.driftSpeed < 0 && b.position.x < -100)) {
                lastMissedReward = b.rewardType;
                Composite.remove(world, b);
            }
        }
        
        if (b.label === 'arrow' && b.hitTarget && b.isStatic) {
            Body.translate(b, { x: dx, y: dy });
        }
        if (b.label === 'arrow' && !b.isStatic && b.fired && !b.hitTarget && !b.hitWall) {
            Body.applyForce(b, b.position, { x: windSpeed * 0.00005, y: 0 });
            if (Vector.magnitude(b.velocity) > 1) {
                Body.setAngle(b, Math.atan2(b.velocity.y, b.velocity.x));
            }
            
            // Mid-air Split logic
            if (b.arrowType === 'splitter' && !b.hasSplit && b.position.x > window.innerWidth * 0.45) {
                b.hasSplit = true;
                const releaseAngle = Math.atan2(b.velocity.y, b.velocity.x);
                [-1, 1].forEach(dir => {
                    let splitArrow = Bodies.rectangle(b.position.x, b.position.y, 80, 10, {
                        restitution: 0.2, friction: 0.1, density: 0.05,
                        label: 'arrow', arrowType: 'normal', collisionFilter: { group: arrowGroup }, render: { visible: false }
                    });
                    Body.setCentre(splitArrow, { x: 20, y: 0 }, true);
                    Body.setAngle(splitArrow, releaseAngle + dir * 0.1);
                    Body.setVelocity(splitArrow, { 
                        x: b.velocity.x, 
                        y: b.velocity.y + dir * 5 // spread out vertically
                    });
                    splitArrow.fired = true;
                    Composite.add(world, splitArrow);
                });
            }
        }
    }
});

// --- Collision ---
Events.on(engine, 'collisionStart', function(event) {
    event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        let arrow = null, targetPart = null, crate = null;

        if (bodyA.label === 'arrow' && bodyB.label.startsWith('target_')) { arrow = bodyA; targetPart = bodyB; }
        else if (bodyB.label === 'arrow' && bodyA.label.startsWith('target_')) { arrow = bodyB; targetPart = bodyA; }
        else if (bodyA.label === 'arrow' && bodyB.label === 'crate') { arrow = bodyA; crate = bodyB; }
        else if (bodyB.label === 'arrow' && bodyA.label === 'crate') { arrow = bodyB; crate = bodyA; }

        if (arrow && crate && !arrow.isStatic && arrow.fired) {
            playSound('hit');
            const reward = crate.rewardType;
            lastMissedReward = null; // reset because they hit it
            
            specialQueue.push(reward);
            specialArrows[reward]++;
            document.getElementById(`count-${reward}`).innerText = specialArrows[reward];
            
            const notificationEl = document.getElementById('reward-notification');
            if (notificationEl) {
                notificationEl.innerText = `Got ${reward.toUpperCase()} Arrow!`;
                notificationEl.classList.add('show');
                clearTimeout(notificationEl.timeoutId);
                notificationEl.timeoutId = setTimeout(() => {
                    notificationEl.classList.remove('show');
                }, 2000);
            }
            
            explosions.push({ x: crate.position.x, y: crate.position.y, radius: 0, maxRadius: 60, color: '255, 215, 0' }); 
            Composite.remove(world, crate);
            
            arrow.hitTarget = true;
            Matter.Body.setStatic(arrow, true);
            fadeAndRemove(arrow);
            return;
        }

        if (arrow && targetPart && !arrow.isStatic && arrow.fired && !arrow.hitTarget) {
            // Replaced complex vertical miss logic because high velocity arrows tunneling caused false positives on seams.
            // Any collision with the target is now counted as a hit!
            arrow.hitTarget = true;
            Matter.Body.setStatic(arrow, true);
            playSound('hit');
            
            let pts = 0;
            let hitText = "";
            let hitColor = "";
            
            if (targetPart.label === 'target_bullseye') {
                pts = 100;
                hitText = "BULLSEYE!";
                hitColor = "#ef4444";
            } else if (targetPart.label === 'target_inner') {
                pts = 50;
                hitText = "GREAT!";
                hitColor = "#eab308";
            } else if (targetPart.label === 'target_outer') {
                pts = 10;
                hitText = "NICE!";
                hitColor = "#3b82f6";
            }

            if (arrow.arrowType === 'bomb') {
                playSound('shoot');
                explosions.push({ x: targetPart.position.x, y: arrow.position.y, radius: 0, maxRadius: 150, color: '255, 100, 0' });
                pts += 50;
            } else if (arrow.arrowType === 'freeze') {
                targetFrozenUntil = Date.now() + 3000;
            }

            const hitNotificationEl = document.getElementById('hit-notification');
            if (hitNotificationEl && hitText) {
                hitNotificationEl.innerText = hitText;
                hitNotificationEl.style.color = hitColor;
                hitNotificationEl.style.textShadow = `0 3px 8px ${hitColor}`;
                hitNotificationEl.classList.add('show');
                clearTimeout(hitNotificationEl.timeoutId);
                hitNotificationEl.timeoutId = setTimeout(() => {
                    hitNotificationEl.classList.remove('show');
                }, 1500);
            }

            const floatPt = document.createElement('div');
            floatPt.className = 'floating-points';
            floatPt.innerText = `+${pts}`;
            floatPt.style.left = `${bullseye.position.x + 30}px`;
            floatPt.style.top = `${arrow.position.y - 20}px`;
            floatPt.style.color = hitColor;
            document.body.appendChild(floatPt);
            setTimeout(() => floatPt.remove(), 1000);

            score += pts;
            scoreEl.innerText = score;
            arrow.collisionFilter.mask = 0;
            fadeAndRemove(arrow);
        }

        if ((bodyA.label === 'arrow' || bodyB.label === 'arrow') && !arrow) {
            const arr = bodyA.label === 'arrow' ? bodyA : bodyB;
            if (arr.isStatic || !arr.fired || arr.hitTarget || arr.hitWall) return;
            arr.hitWall = true;
            Matter.Body.setStatic(arr, true);
            if(arr.arrowType === 'bomb') {
                playSound('shoot');
                explosions.push({ x: arr.position.x, y: arr.position.y, radius: 0, maxRadius: 100, color: '255, 100, 0' });
            }
            fadeAndRemove(arr);
        }
    });
});

// ======================================================
// CUSTOM CANVAS DRAWING: Recurve Bow, Arrow, Circular Target, Bowstring
// ======================================================
Events.on(render, 'afterRender', function() {
    const ctx = render.context;

    // --- Draw Target (Bullseye Board - Restored Original Flat Style) ---
    const tCenterX = bullseye.position.x;
    const tCenterY = bullseye.position.y;

    // Board backing
    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(tCenterX - 12, tCenterY - 82, 24, 164, 4);
    ctx.fill();
    ctx.stroke();

    // Rings (draw as colored bands)
    // Outer blue
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(tCenterX - 8, tCenterY - 80, 16, 30);
    ctx.fillRect(tCenterX - 8, tCenterY + 50, 16, 30);
    // Inner yellow
    ctx.fillStyle = '#eab308';
    ctx.fillRect(tCenterX - 8, tCenterY - 50, 16, 20);
    ctx.fillRect(tCenterX - 8, tCenterY + 30, 16, 20);
    // Bullseye red
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(tCenterX - 8, tCenterY - 30, 16, 60);
    // Bullseye center dot
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(tCenterX, tCenterY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Glow effect
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(tCenterX, tCenterY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // --- Draw Recurve Bow (With dynamic rotation matching aiming angle) ---
    ctx.save();
    const bx = anchor.x;
    const by = anchor.y;
    const bowHalfHeight = 70;

    let bowAngle = 0;
    if (currentArrow && !arrowFired) {
        if (isDragging) {
            // Visually calculate the bow rotation while dragging (with a 33px threshold to clear the resting offset and allow full 360 rotation)
            const dragVector = Vector.sub(anchor, currentArrow.position);
            bowAngle = Vector.magnitude(dragVector) > 33 ? Math.atan2(dragVector.y, dragVector.x) : 0;
        } else {
            bowAngle = currentArrow.angle;
        }
    }

    // Translate and rotate canvas to draw bow relative to the current aiming angle
    ctx.translate(bx, by);
    ctx.rotate(bowAngle);

    // Draw the recurve limbs
    ctx.strokeStyle = '#78350f'; // Rich mahogany wood
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    
    // Top Limb: Start at grip (0,0), curve back, then curve forward at tip
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-20, -25, -30, -50, 10, -bowHalfHeight);
    
    // Bottom Limb: Start at grip (0,0), curve back, then curve forward at tip
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-20, 25, -30, 50, 10, bowHalfHeight);
    ctx.stroke();

    // Inner limb accent highlights (fiberglass layer)
    ctx.strokeStyle = '#d97706'; // Golden amber highlight
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.bezierCurveTo(-23, -25, -33, -50, 7, -bowHalfHeight);
    ctx.moveTo(-3, 0);
    ctx.bezierCurveTo(-23, 25, -33, 50, 7, bowHalfHeight);
    ctx.stroke();

    // Leather Grip wrap in the center
    ctx.strokeStyle = '#1e293b'; // Charcoal leather
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-4, -12);
    ctx.lineTo(-4, 12);
    ctx.stroke();
    
    // Grip gold wraps
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -10);
    ctx.lineTo(-3, -10);
    ctx.moveTo(-5, 10);
    ctx.lineTo(-3, 10);
    ctx.stroke();
    ctx.restore();

    // --- Dynamic Bowstring ---
    ctx.save();
    // Convert local string tip coordinates to global coordinates based on bow rotation
    const cosA = Math.cos(bowAngle);
    const sinA = Math.sin(bowAngle);
    
    const tipTopGlobalX = bx + (9 * cosA - (-bowHalfHeight) * sinA);
    const tipTopGlobalY = by + (9 * sinA + (-bowHalfHeight) * cosA);
    
    const tipBotGlobalX = bx + (9 * cosA - bowHalfHeight * sinA);
    const tipBotGlobalY = by + (9 * sinA + bowHalfHeight * cosA);

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tipTopGlobalX, tipTopGlobalY);

    if (currentArrow && !arrowFired) {
        // String dynamically bends to the exact tail of the arrow
        let renderAngle = currentArrow.angle;
        if (isDragging) {
            const dragVector = Vector.sub(anchor, currentArrow.position);
            renderAngle = Vector.magnitude(dragVector) > 33 ? Math.atan2(dragVector.y, dragVector.x) : 0;
        }
        const tailX = currentArrow.position.x - 30 * Math.cos(renderAngle);
        const tailY = currentArrow.position.y - 30 * Math.sin(renderAngle);
        ctx.lineTo(tailX, tailY);
    } else {
        // String is straight (resting)
        const centerRestGlobalX = bx + 9 * cosA;
        const centerRestGlobalY = by + 9 * sinA;
        ctx.lineTo(centerRestGlobalX, centerRestGlobalY);
    }
    ctx.lineTo(tipBotGlobalX, tipBotGlobalY);
    ctx.stroke();
    ctx.restore();
    
    // --- Draw Explosions ---
    for(let i = explosions.length - 1; i >= 0; i--) {
        let exp = explosions[i];
        exp.radius += 5;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
        let baseColor = exp.color || '255, 100, 0';
        ctx.fillStyle = `rgba(${baseColor}, ${1 - exp.radius/exp.maxRadius})`;
        ctx.fill();
        if(exp.radius >= exp.maxRadius) explosions.splice(i, 1);
    }

    // --- Draw Crates ---
    const allBodies = Composite.allBodies(world);
    for (let i = 0; i < allBodies.length; i++) {
        const b = allBodies[i];
        if (b.label === 'crate') {
            ctx.save();
            ctx.translate(b.position.x, b.position.y);
            
            // Parachute lines
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-15, -20); ctx.lineTo(-25, -50);
            ctx.moveTo(15, -20); ctx.lineTo(25, -50);
            ctx.moveTo(0, -20); ctx.lineTo(0, -55);
            ctx.stroke();

            // Parachute canopy
            ctx.fillStyle = '#f43f5e';
            ctx.beginPath();
            ctx.arc(0, -50, 30, Math.PI, 0);
            ctx.fill();

            // Crate Box
            ctx.fillStyle = '#b45309'; // wood
            ctx.fillRect(-20, -20, 40, 40);
            ctx.strokeStyle = '#78350f'; // dark wood borders
            ctx.lineWidth = 3;
            ctx.strokeRect(-20, -20, 40, 40);
            
            // ? symbol
            ctx.fillStyle = '#fde047';
            ctx.font = 'bold 24px Outfit';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', 0, 0);
            
            ctx.restore();
        }
    }

    // --- Draw ALL Arrows (with highly detailed broadhead and feathers) ---
    for (let i = 0; i < allBodies.length; i++) {
        const b = allBodies[i];
        if (b.label !== 'arrow') continue;

        const opacity = (b.fadeOpacity !== undefined) ? b.fadeOpacity : 1;
        if (opacity <= 0) continue;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(b.position.x, b.position.y);
        
        // Render rotation calculation: if dragging the active arrow, compute visually
        let renderAngle = b.angle;
        if (b === currentArrow && isDragging && !arrowFired) {
            const dragVector = Vector.sub(anchor, currentArrow.position);
            renderAngle = Vector.magnitude(dragVector) > 33 ? Math.atan2(dragVector.y, dragVector.x) : 0;
        }
        ctx.rotate(renderAngle);

        // Relative coordinate mapping based on shifted center of mass
        // Center of mass is shifted +20 towards tip. 
        // Shaft length is 80, meaning it goes from -60 (tail) to +20 (tip)
        const tailX = -60;
        const tipX = 20;

        // 1. Sleek Carbon Arrow Shaft
        let shaftColor = '#334155';
        if (b.arrowType === 'bomb') shaftColor = '#ef4444';
        else if (b.arrowType === 'freeze') shaftColor = '#0ea5e9';
        else if (b.arrowType === 'splitter') shaftColor = '#a855f7';

        ctx.strokeStyle = shaftColor; // Dark carbon color
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(tailX, 0);
        ctx.lineTo(tipX, 0);
        ctx.stroke();

        // 2. Metallic Broadhead (Arrowhead)
        ctx.fillStyle = '#94a3b8'; // Polished silver steel
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tipX + 15, 0);       // Ultra sharp point
        ctx.lineTo(tipX, -7);           // Top edge
        ctx.lineTo(tipX + 3, -2);        // Core inset top
        ctx.lineTo(tipX + 3, 2);         // Core inset bottom
        ctx.lineTo(tipX, 7);            // Bottom edge
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 3. Realistic Fletching Feathers (Dual-color Neon sport design)
        let featherPrimary = '#f97316';
        let featherSecondary = '#eab308';
        if (b.arrowType === 'bomb') { featherPrimary = '#b91c1c'; featherSecondary = '#ef4444'; }
        else if (b.arrowType === 'freeze') { featherPrimary = '#0284c7'; featherSecondary = '#38bdf8'; }
        else if (b.arrowType === 'splitter') { featherPrimary = '#7e22ce'; featherSecondary = '#c084fc'; }

        // Primary feathers (Neon Red/Orange)
        ctx.fillStyle = featherPrimary;
        ctx.beginPath();
        ctx.moveTo(tailX + 5, 0);
        ctx.lineTo(tailX - 10, -6);
        ctx.lineTo(tailX - 3, -6);
        ctx.lineTo(tailX + 8, 0);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(tailX + 5, 0);
        ctx.lineTo(tailX - 10, 6);
        ctx.lineTo(tailX - 3, 6);
        ctx.lineTo(tailX + 8, 0);
        ctx.closePath();
        ctx.fill();

        // Secondary inner feather accent (Neon Yellow)
        ctx.fillStyle = featherSecondary;
        ctx.beginPath();
        ctx.moveTo(tailX + 15, 0);
        ctx.lineTo(tailX + 5, -4);
        ctx.lineTo(tailX + 10, -4);
        ctx.lineTo(tailX + 18, 0);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(tailX + 15, 0);
        ctx.lineTo(tailX + 5, 4);
        ctx.lineTo(tailX + 10, 4);
        ctx.lineTo(tailX + 18, 0);
        ctx.closePath();
        ctx.fill();

        // Nock (Arrow tail slot)
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(tailX - 2, -1.5, 4, 3);

        ctx.restore();
    }
});

// --- Resize ---
window.addEventListener('resize', () => {
    render.canvas.width = window.innerWidth;
    render.canvas.height = window.innerHeight;
    render.options.width = window.innerWidth;
    render.options.height = window.innerHeight;
});

function endGame() {
    gameOverEl.classList.remove('hidden');
    finalScoreEl.innerText = score;
}

restartBtn.addEventListener('click', () => {
    score = 0;
    arrowsLeft = 10;
    specialArrows = { bomb: 0, splitter: 0, freeze: 0 };
    specialQueue = [];
    ['bomb', 'splitter', 'freeze'].forEach(type => {
        if(document.getElementById(`count-${type}`)) document.getElementById(`count-${type}`).innerText = 0;
    });
    currentArrowType = 'normal';
    targetFrozenUntil = 0;
    explosions = [];
    clearTimeout(crateSpawnTimer);
    lastMissedReward = null;
    gameStarted = false;
    updateWind();
    
    scoreEl.innerText = score;
    if (arrowsEl) arrowsEl.innerText = isUnlimited ? "∞" : arrowsLeft;
    gameOverEl.classList.add('hidden');
    const bodies = Composite.allBodies(world);
    Composite.remove(world, bodies.filter(b => b.label === 'arrow' || b.label === 'crate'));
    const constraints = Composite.allConstraints(world);
    Composite.remove(world, constraints.filter(c => c !== mouseConstraint.constraint && c !== slingshotConstraint));
    createArrow();
});
