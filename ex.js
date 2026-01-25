/**
 * 6-DOF ROBOT ARM SIMULATION v5.0 - HIGH FIDELITY PHYSICS & COLLISION
 * Features:
 * - 6 Degrees of Freedom
 * - Impulse-based Physics Engine (Mass, Inertia, Friction)
 * - True Mesh-based Collision for Grippers
 * - Mouse Interaction
 * - Lidar/Vision System
 * - UI: Tabbed Control, Calibration, Spawner
 */

let robot;
let physicsWorld;
let scanner;
let gui;
let visionGui;
let topHud;
let cam;
let mouseHandler;

// Configuration
const CONFIG = {
  floorY: 200,
  gravity: 0.4,
  friction: 0.96,
  restitution: 0.2, // Low bounce for heavy feel
  baseHeight: 60,
  seg1Len: 180,
  seg2Len: 180,
  handLen: 72,
  maxReach: 380,
  scanResolution: 8,
  scanArea: 260
};

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  setAttributes('antialias', true);

  injectStyles();

  cam = createCamera();
  cam.setPosition(800, -700, 800);
  cam.lookAt(0, 0, 0);

  physicsWorld = new PhysicsWorld();
  physicsWorld.initEnvironment();

  scanner = new LidarScanner();

  robot = new Robot(physicsWorld);

  mouseHandler = new MouseInteraction(cam, physicsWorld);

  // UI Systems
  gui = new ControlPanel(robot);
  visionGui = new VisionGUI(scanner);
  topHud = new TopHUD(robot, physicsWorld);

  textFont('Courier New');
}

function draw() {
  background(20, 22, 25);

  // Physics Sub-stepping for stability
  let subSteps = 8;
  for(let i=0; i<subSteps; i++) {
    physicsWorld.update(1/subSteps, robot);
  }

  // Robot Logic
  robot.update();
  gui.sync();
  topHud.update();

  // Mouse Interaction
  mouseHandler.update();
  if (!mouseHandler.isDragging) {
    orbitControl();
  }

  // Lighting
  ambientLight(80);
  pointLight(255, 240, 220, -600, -900, 600);
  pointLight(80, 120, 255, 600, -600, -600);
  directionalLight(180, 180, 180, 0.5, 1, -0.5);

  // Render Scene
  physicsWorld.display();
  scanner.display();
  robot.display();

  // 2D UI Overlay
  drawUI();
  visionGui.display();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function mousePressed() {
  if (mouseY > 60 && !gui.isOpen && !visionGui.isOpen) {
    mouseHandler.handlePress();
  }
}

function mouseReleased() {
  mouseHandler.handleRelease();
}

// ------------------------------------------------------------------
// MATH HELPERS (Quaternion & Transform)
// ------------------------------------------------------------------

class Quat {
  constructor(x=0, y=0, z=0, w=1) { this.x=x; this.y=y; this.z=z; this.w=w; }

  static fromAxisAngle(axis, angle) {
    let half = angle * 0.5;
    let s = Math.sin(half);
    return new Quat(axis.x * s, axis.y * s, axis.z * s, Math.cos(half));
  }

  rotateVector(v) {
    let ix = this.w * v.x + this.y * v.z - this.z * v.y;
    let iy = this.w * v.y + this.z * v.x - this.x * v.z;
    let iz = this.w * v.z + this.x * v.y - this.y * v.x;
    let iw = -this.x * v.x - this.y * v.y - this.z * v.z;
    return createVector(
      ix * this.w + iw * -this.x + iy * -this.z - iz * -this.y,
      iy * this.w + iw * -this.y + iz * -this.x - ix * -this.z,
      iz * this.w + iw * -this.z + ix * -this.y - iy * -this.x
    );
  }
}

class Transform {
  constructor() {
    this.pos = createVector(0,0,0);
    this.right = createVector(1,0,0);
    this.up = createVector(0,1,0);
    this.fwd = createVector(0,0,1);
  }

  copy() {
    let t = new Transform();
    t.pos = this.pos.copy();
    t.right = this.right.copy();
    t.up = this.up.copy();
    t.fwd = this.fwd.copy();
    return t;
  }

  translate(x, y, z) {
    this.pos.add(p5.Vector.mult(this.right, x));
    this.pos.add(p5.Vector.mult(this.up, y));
    this.pos.add(p5.Vector.mult(this.fwd, z));
  }

  // Rotate around local axis
  rotateLocal(axisStr, angle) {
    let axis = axisStr === 'X' ? this.right : (axisStr === 'Y' ? this.up : this.fwd);
    let q = Quat.fromAxisAngle(axis, angle);
    this.right = q.rotateVector(this.right);
    this.up = q.rotateVector(this.up);
    this.fwd = q.rotateVector(this.fwd);
  }

  // Transform a point from local space to world space
  transformPoint(localX, localY, localZ) {
    let p = this.pos.copy();
    p.add(p5.Vector.mult(this.right, localX));
    p.add(p5.Vector.mult(this.up, localY));
    p.add(p5.Vector.mult(this.fwd, localZ));
    return p;
  }
}

// ------------------------------------------------------------------
// MOUSE INTERACTION
// ------------------------------------------------------------------

class MouseInteraction {
  constructor(cam, world) {
    this.cam = cam;
    this.world = world;
    this.draggedItem = null;
    this.isDragging = false;
    this.dragPlaneY = 0;
  }

  getRay() {
    let mx = (mouseX / width) * 2 - 1;
    let my = (mouseY / height) * 2 - 1;
    let eye = createVector(this.cam.eyeX, this.cam.eyeY, this.cam.eyeZ);
    let center = createVector(this.cam.centerX, this.cam.centerY, this.cam.centerZ);
    let up = createVector(this.cam.upX, this.cam.upY, this.cam.upZ);
    let forward = p5.Vector.sub(center, eye).normalize();
    let right = p5.Vector.cross(forward, up).normalize();
    let localUp = p5.Vector.cross(right, forward).normalize();
    let fov = PI / 3;
    let aspect = width / height;
    let tanAlpha = Math.tan(fov / 2);
    let dir = p5.Vector.add(forward, p5.Vector.mult(right, mx * aspect * tanAlpha));
    dir.add(p5.Vector.mult(localUp, my * tanAlpha));
    dir.normalize();
    return { origin: eye, dir: dir };
  }

  handlePress() {
    let ray = this.getRay();
    let closest = null;
    let minT = 10000;

    for (let item of this.world.items) {
      if (item.grippedBy && item.grippedBy !== 'mouse') continue;
      let oc = p5.Vector.sub(ray.origin, item.pos);
      let b = p5.Vector.dot(oc, ray.dir);
      let c = p5.Vector.dot(oc, oc) - (item.size/2 + 10)**2;
      let delta = b*b - c;
      if (delta > 0) {
        let t = -b - Math.sqrt(delta);
        if (t > 0 && t < minT) {
          minT = t;
          closest = item;
        }
      }
    }

    if (closest) {
      this.draggedItem = closest;
      this.draggedItem.grippedBy = 'mouse';
      this.isDragging = true;
      this.dragPlaneY = closest.pos.y;
    }
  }

  handleRelease() {
    if (this.draggedItem) {
      this.draggedItem.grippedBy = null;
      this.draggedItem = null;
    }
    this.isDragging = false;
  }

  update() {
    if (this.isDragging && this.draggedItem) {
      let ray = this.getRay();
      if (Math.abs(ray.dir.y) > 0.001) {
        let t = (this.dragPlaneY - ray.origin.y) / ray.dir.y;
        if (t > 0) {
          let targetPos = p5.Vector.add(ray.origin, p5.Vector.mult(ray.dir, t));
          let force = p5.Vector.sub(targetPos, this.draggedItem.pos);
          this.draggedItem.vel = force.limit(15);
          this.draggedItem.pos = targetPos;
          this.draggedItem.vel.mult(0.5); // Damping while holding
        }
      }
    }
  }
}

// ------------------------------------------------------------------
// ROBOT CLASS
// ------------------------------------------------------------------

class Waypoint {
  constructor(joints, gripWidth, duration = 1000, targetPos, action = null) {
    this.joints = joints;
    this.gripWidth = gripWidth;
    this.duration = duration;
    this.targetPos = targetPos;
    this.action = action;
  }
}

class Robot {
  constructor(world) {
    this.world = world;
    this.joints = {
      base: 0, shoulder: -PI/4, elbow: PI/2, forearmRoll: 0, wristPitch: HALF_PI, wristRoll: 0
    };
    this.offsets = {
      base: 0.1, shoulder: 0.05, elbow: -0.05, forearmRoll: 0.2, wristPitch: 0, wristRoll: 0
    };

    this.effector = createVector(0, 0, 0);
    this.gripWidth = 40;
    this.prevGripWidth = 40;
    this.heldItem = null;
    this.isGripped = false;
    this.isManual = false;
    this.emergencyStop = false;
    this.isCalibrated = false;
    this.hasIKSolution = true;

    this.waypointQueue = [];
    this.currentStartJoints = null;
    this.currentStartGrip = 0;
    this.moveStartTime = 0;
    this.moveDuration = 0;

    this.state = "IDLE";
    this.scanTimer = 0;
    this.dropTarget = createVector(350, CONFIG.floorY - 100, 0);
    this.activeTarget = null;
    this.currentTargetBase = null;
    this.gripFailCount = 0;
    this.maxGripFailures = 10;

    // Physics Bodies for Collision
    this.wristTransform = new Transform();
    this.gripperParts = []; // Array of OBBs

    this.solveFK();
  }

  triggerStop() {
    this.emergencyStop = true;
    this.waypointQueue = [];
    this.state = "ESTOP";
  }

  enterCalibrationMode() {
    if(this.emergencyStop) return;
    this.waypointQueue = [];
    this.state = "CALIBRATING_MOVE";
    this.isCalibrated = false;
    let zeroPose = { base: 0, shoulder: 0, elbow: 0, forearmRoll: 0, wristPitch: 0, wristRoll: 0 };
    this.waypointQueue.push(new Waypoint(zeroPose, 40, 2000, null));
  }

  finalizeCalibration() {
    this.isCalibrated = true;
    this.state = "IDLE";
  }

  startAlignmentCheck() {
    if(this.emergencyStop) return;
    this.waypointQueue = [];
    this.state = "ALIGNING";
    let center = createVector(0, CONFIG.floorY - 200, 200);
    this.addWaypoint(center, 40, 1000, 0);
    this.addWaypoint(center, 40, 800, PI);
    this.addWaypoint(center, 40, 800, -PI);
    this.addWaypoint(center, 40, 800, 0);
  }

  setAutoMode() {
    if(!this.isCalibrated) return;
    this.isManual = false;
    this.emergencyStop = false;
    this.state = "IDLE";
  }

  solveIK(target, targetWristRoll = 0) {
    let wc = createVector(target.x, target.y - CONFIG.handLen, target.z);
    let baseAngle = atan2(wc.x, wc.z);

    let r = sqrt(wc.x*wc.x + wc.z*wc.z);
    let y = wc.y - (CONFIG.floorY - CONFIG.baseHeight);

    let distToWC = sqrt(r*r + y*y);
    let maxArm = CONFIG.seg1Len + CONFIG.seg2Len;
    let valid = true;

    if (distToWC > maxArm - 0.1) {
      let ratio = (maxArm - 0.1) / distToWC;
      r *= ratio;
      y *= ratio;
      distToWC = maxArm - 0.1;
      valid = false;
    }

    let a = CONFIG.seg1Len;
    let b = CONFIG.seg2Len;
    let c = distToWC;

    let cosAlpha = (a*a + c*c - b*b) / (2*a*c);
    let alpha = acos(constrain(cosAlpha, -1, 1));
    let theta = atan2(y, r);

    let shoulderAngle = theta + alpha;

    let cosBeta = (a*a + b*b - c*c) / (2*a*b);
    let beta = acos(constrain(cosBeta, -1, 1));
    let elbowAngle = beta;

    let wristPitch = shoulderAngle + elbowAngle - PI;
    let computedWristRoll = targetWristRoll - baseAngle;

    while (computedWristRoll > PI) computedWristRoll -= TWO_PI;
    while (computedWristRoll < -PI) computedWristRoll += TWO_PI;

    this.hasIKSolution = valid;

    return {
      base: baseAngle,
      shoulder: shoulderAngle,
      elbow: elbowAngle,
      forearmRoll: 0,
      wristPitch: wristPitch,
      wristRoll: computedWristRoll
    };
  }

  solveFK() {
    // Reconstruct the kinematic chain using Transform class for collision detection
    let t = new Transform();
    let j = this.joints;
    let o = this.offsets;

    // Base Frame (Floor)
    t.translate(0, CONFIG.floorY, 0);

    // J1: Base
    t.rotateLocal('Y', j.base + o.base);
    t.translate(0, -CONFIG.baseHeight, 0);

    // J2: Shoulder
    t.translate(0, 0, 0); // Pivot
    t.rotateLocal('X', -(j.shoulder + o.shoulder));

    // Link 1
    t.translate(0, 0, CONFIG.seg1Len);

    // J3: Elbow
    t.rotateLocal('X', PI - (j.elbow + o.elbow));

    // Link 2
    t.translate(0, 0, CONFIG.seg2Len);

    // J4: Forearm Roll
    t.rotateLocal('Z', j.forearmRoll + o.forearmRoll);

    // Wrist Pitch (J5)
    t.rotateLocal('X', j.wristPitch + o.wristPitch);

    // Wrist Link
    t.translate(0, 0, 15);

    // J6: Wrist Roll
    t.rotateLocal('Y', j.wristRoll + o.wristRoll);

    // Store Wrist Frame for collision
    this.wristTransform = t.copy();

    // Calculate Gripper Parts OBBs in World Space
    // 1. Base Plate
    let baseT = t.copy();
    baseT.translate(0, 10, 0);

    // 2. Left Finger
    let leftT = baseT.copy();
    leftT.translate(-this.gripWidth/2 - 4, 25, 0);

    // 3. Right Finger
    let rightT = baseT.copy();
    rightT.translate(this.gripWidth/2 + 4, 25, 0);

    // Define OBBs: { transform, size }
    this.gripperParts = [
      { t: baseT, size: createVector(90, 10, 30) },
      { t: leftT, size: createVector(8, 50, 25) },
      { t: rightT, size: createVector(8, 50, 25) }
    ];

    // Update Effector Vis Position
    let endPos = t.transformPoint(0, 72, 0); // Approx tip
    this.effector.set(endPos.x, endPos.y, endPos.z);
  }

  addWaypoint(pos, grip, time, roll = 0, action = null) {
    let targetJoints = this.solveIK(pos, roll);
    this.waypointQueue.push(new Waypoint(targetJoints, grip, time, pos, action));
  }

  update() {
    this.isGripped = !!this.heldItem;
    this.prevEffector = this.effector.copy();
    this.prevGripWidth = this.gripWidth;

    if (this.emergencyStop) return;

    if (this.isManual) {
      this.solveFK();
      return;
    }

    switch(this.state) {
      case "CALIBRATING_MOVE":
        this.processMotion();
        if (this.waypointQueue.length === 0) this.state = "CALIBRATING_ADJUST";
        break;
      case "CALIBRATING_ADJUST":
        this.solveFK();
        break;
      case "ALIGNING":
        this.processMotion();
        if (this.waypointQueue.length === 0) this.state = "IDLE";
        break;
      case "IDLE":
        if (!this.isCalibrated) return;
        if (this.waypointQueue.length === 0) {
          let targets = this.world.items.filter(i =>
            i.pos.x < -150 && !i.grippedBy && i.vel.mag() < 0.2
          );
          if (targets.length > 0) {
            this.state = "SCANNING";
            this.scanTimer = millis();
          } else {
            let home = createVector(0, CONFIG.floorY - 300, 200);
            if (p5.Vector.dist(this.effector, home) > 10) {
              this.addWaypoint(home, 40, 1500, 0);
              this.state = "MOVING";
            }
          }
        }
        break;
      case "SCANNING":
        if (millis() - this.scanTimer > 600) {
          let targetData = scanner.performScan(this.world.items);
          if (targetData) {
            this.planPickSequence(targetData);
            this.state = "MOVING";
          } else {
            this.state = "IDLE";
          }
        }
        break;
      case "MOVING":
        this.processMotion();
        if (this.waypointQueue.length === 0) {
          this.state = "IDLE";
          this.activeTarget = null;
        }
        break;
    }
  }

  processMotion() {
    if (this.waypointQueue.length > 0) {
      let wp = this.waypointQueue[0];

      if (!this.currentStartJoints) {
        this.currentStartJoints = {...this.joints};
        this.currentStartGrip = this.gripWidth;
        this.moveStartTime = millis();
        this.moveDuration = wp.duration;
      }

      let elapsed = millis() - this.moveStartTime;
      let t = constrain(elapsed / this.moveDuration, 0, 1);
      let ease = t * t * (3 - 2 * t);

      this.joints.base = lerp(this.currentStartJoints.base, wp.joints.base, ease);
      this.joints.shoulder = lerp(this.currentStartJoints.shoulder, wp.joints.shoulder, ease);
      this.joints.elbow = lerp(this.currentStartJoints.elbow, wp.joints.elbow, ease);
      this.joints.forearmRoll = lerp(this.currentStartJoints.forearmRoll, wp.joints.forearmRoll, ease);
      this.joints.wristPitch = lerp(this.currentStartJoints.wristPitch, wp.joints.wristPitch, ease);
      this.joints.wristRoll = lerp(this.currentStartJoints.wristRoll, wp.joints.wristRoll, ease);
      this.gripWidth = lerp(this.currentStartGrip, wp.gripWidth, ease);

      this.solveFK();

      if (t >= 1.0) {
        let finishedWp = this.waypointQueue.shift();
        this.currentStartJoints = null;
        if (finishedWp.action === "GRIP_CHECK") {
          if (this.isGripped) {
            this.gripFailCount = 0;
          } else {
            this.handleGripFailure();
            return;
          }
        }
      }
    }
  }

  getRetryOffset() {
    let range = 40;
    return createVector(random(-range, range), 0, random(-range, range));
  }

  handleGripFailure() {
    this.gripFailCount += 1;
    if (this.gripFailCount >= this.maxGripFailures) {
      this.resetAfterGripFailures();
      return;
    }
    if (!this.currentTargetBase) {
      this.state = "IDLE";
      return;
    }
    this.waypointQueue = [];
    this.currentStartJoints = null;
    this.currentStartGrip = this.gripWidth;
    let retryOffset = this.getRetryOffset();
    this.planPickSequence(
      { pos: this.currentTargetBase.pos.copy(), rot: this.currentTargetBase.rot },
      retryOffset
    );
    this.state = "MOVING";
  }

  resetAfterGripFailures() {
    if (this.heldItem) {
      this.heldItem.grippedBy = null;
      this.heldItem = null;
    }
    this.world.resetBlocks(4);
    this.waypointQueue = [];
    this.currentStartJoints = null;
    this.currentStartGrip = this.gripWidth;
    this.activeTarget = null;
    this.currentTargetBase = null;
    this.gripFailCount = 0;
    this.state = "IDLE";
  }

  planPickSequence(targetData, offset = null) {
    let basePos = targetData.pos.copy();
    let offsetVec = offset ?? createVector(0, 0, 0);
    let p = p5.Vector.add(basePos, offsetVec);
    let orientation = targetData.rot;
    this.activeTarget = p.copy();
    this.currentTargetBase = { pos: basePos.copy(), rot: orientation };
    let approachH = CONFIG.floorY - 250;
    let drop = this.dropTarget.copy();
    drop.x += random(-30, 30);
    drop.z += random(-30, 30);
    let dropRot = random(-PI, PI);

    let preGraspPos = createVector(p.x, p.y - 60, p.z);

    this.addWaypoint(createVector(p.x, approachH, p.z), 40, 1000, orientation);
    this.addWaypoint(preGraspPos, 40, 800, orientation);
    this.addWaypoint(createVector(p.x, p.y, p.z), 40, 500, orientation);
    this.addWaypoint(createVector(p.x, p.y, p.z), 25, 400, orientation); // Grip
    this.addWaypoint(createVector(p.x, p.y, p.z), 25, 200, orientation, "GRIP_CHECK"); // Verify
    this.addWaypoint(createVector(p.x, approachH, p.z), 25, 600, orientation);
    this.addWaypoint(createVector(drop.x, approachH, drop.z), 25, 1200, dropRot);
    this.addWaypoint(createVector(drop.x, CONFIG.floorY - 140, drop.z), 25, 600, dropRot);
    this.addWaypoint(createVector(drop.x, CONFIG.floorY - 140, drop.z), 40, 300, dropRot); // Release
    this.addWaypoint(createVector(drop.x, approachH, drop.z), 40, 500, dropRot);
  }

  display() {
    push();
    translate(0, CONFIG.floorY, 0);
    if (this.state === "CALIBRATING_ADJUST") {
      push();
      noFill(); stroke(0, 255, 0, 100); strokeWeight(1);
      this.drawRobotModel(true);
      pop();
    }
    this.drawRobotModel(false);
    pop();

    // Draw Path
    if (this.waypointQueue.length > 0) {
      noFill(); stroke(0, 255, 200, 50); strokeWeight(1);
      beginShape();
      vertex(this.effector.x, this.effector.y, this.effector.z);
      for(let wp of this.waypointQueue) {
        if(wp.targetPos) vertex(wp.targetPos.x, wp.targetPos.y, wp.targetPos.z);
      }
      endShape();
    }
  }

  drawRobotModel(isGhost) {
    let j = isGhost ? { base:0, shoulder:0, elbow:0, forearmRoll:0, wristPitch:0, wristRoll:0 } : this.joints;
    let o = isGhost ? { base:0, shoulder:0, elbow:0, forearmRoll:0, wristPitch:0, wristRoll:0 } : this.offsets;

    if(isGhost) { stroke(0, 255, 0, 80); noFill(); } else { noStroke(); }

    // Base
    if(!isGhost) fill(40);
    cylinder(50, 20);
    translate(0, -CONFIG.baseHeight/2, 0);

    // J1
    rotateY(j.base + o.base);
    if(!isGhost) fill(255, 120, 0);
    cylinder(40, CONFIG.baseHeight);
    translate(0, -CONFIG.baseHeight/2, 0);

    // J2
    push(); translate(0, -15, 0); if(!isGhost) fill(60); box(70, 30, 70); pop();
    translate(0, -25, 0); if(!isGhost) fill(80); sphere(36);
    rotateX(-(j.shoulder + o.shoulder));

    // Link 1
    translate(0, 0, CONFIG.seg1Len/2);
    if(!isGhost) fill(220); box(28, 28, CONFIG.seg1Len);
    translate(0, 0, CONFIG.seg1Len/2);

    // J3
    if(!isGhost) fill(80); sphere(32);
    rotateX(PI - (j.elbow + o.elbow));

    // Link 2
    let foreArmLen = CONFIG.seg2Len;
    translate(0, 0, foreArmLen/2);
    if(!isGhost) fill(220); box(24, 24, foreArmLen);
    translate(0, 0, foreArmLen/2);

    // J4
    if(!isGhost) fill(50); cylinder(22, 10);
    rotateZ(j.forearmRoll + o.forearmRoll);

    // Wrist
    translate(0, 0, 15); if(!isGhost) fill(70); box(30, 30, 30);

    // J5
    rotateX(j.wristPitch + o.wristPitch);
    if(!isGhost) fill(60); cylinder(15, 25);

    // J6
    translate(0, 15, 0); rotateY(j.wristRoll + o.wristRoll);

    // Gripper Base
    translate(0, 10, 0);
    if(!isGhost) fill(30); box(90, 10, 30);

    let gw = this.gripWidth / 2;
    if(!isGhost) fill(180);
    push(); translate(-gw - 4, 25, 0); box(8, 50, 25); pop(); // Left Finger
    push(); translate(gw + 4, 25, 0); box(8, 50, 25); pop(); // Right Finger
  }
}

// ------------------------------------------------------------------
// PHYSICS & ENVIRONMENT
// ------------------------------------------------------------------

class PhysicsWorld {
  constructor() {
    this.items = [];
    this.bins = [];
  }

  initEnvironment() {
    this.bins.push(new Bin(-300, CONFIG.floorY, 0, 200, color(70, 75, 80)));
    this.bins.push(new Bin(350, CONFIG.floorY, 0, 200, color(50, 70, 90)));

    for(let i=0; i<4; i++) {
      this.items.push(new Item(
        -300 + random(-25, 25),
        CONFIG.floorY - 100 - i*50,
        random(-25, 25)
      ));
    }
  }

  spawnBlock() {
    let x = -300 + random(-40, 40);
    let z = random(-40, 40);
    this.items.push(new Item(x, -200, z));
  }

  resetBlocks(count = 4) {
    this.items = [];
    for (let i = 0; i < count; i++) {
      this.spawnBlock();
    }
  }

  update(dt, robot) {
    for (let item of this.items) {
      if (item.grippedBy) continue;

      // dt is "fraction of a frame" when using sub-steps.
      // Using dt here makes the simulation stable/consistent across sub-stepping.
      const dtStep = dt ?? 1;

      // Gravity
      item.vel.y += CONFIG.gravity * dtStep;
      item.pos.x += item.vel.x * dtStep;
      item.pos.y += item.vel.y * dtStep;
      item.pos.z += item.vel.z * dtStep;

      // Angular rotation
      item.rot += item.angVel * dtStep;
      item.angVel *= Math.pow(0.98, dtStep); // Air resistance

      // Floor Collision
      if (item.pos.y + item.size/2 > CONFIG.floorY) {
        item.pos.y = CONFIG.floorY - item.size/2;
        item.vel.y *= -CONFIG.restitution;
        const floorFriction = Math.pow(CONFIG.friction, dtStep);
        item.vel.x *= floorFriction;
        item.vel.z *= floorFriction;
        item.angVel *= Math.pow(0.8, dtStep);
        if(Math.abs(item.vel.y) < 0.5) item.vel.y = 0;
      }

      for (let bin of this.bins) bin.constrain(item);
    }

    this.applyRobotCollisions(robot);

    // Item-Item Collision (Impulse-based)
    for (let i=0; i<this.items.length; i++) {
      for (let j=i+1; j<this.items.length; j++) {
        this.resolveItemCollision(this.items[i], this.items[j]);
      }
    }
  }

  applyRobotCollisions(robot) {
    if (!robot) return;

    // Check collisions between gripper parts (Kinematic) and items (Dynamic)
    for (let item of this.items) {
      if (item.grippedBy === 'mouse') continue;

      let contactCount = 0;
      let contacts = [];

      for (let part of robot.gripperParts) {
        // Sphere-OBB Intersection
        // 1. Transform item center to OBB local space
        let relPos = p5.Vector.sub(item.pos, part.t.pos);
        let localX = p5.Vector.dot(relPos, part.t.right);
        let localY = p5.Vector.dot(relPos, part.t.up);
        let localZ = p5.Vector.dot(relPos, part.t.fwd);

        // 2. Clamp to box extents
        let halfSize = p5.Vector.mult(part.size, 0.5);
        let cx = constrain(localX, -halfSize.x, halfSize.x);
        let cy = constrain(localY, -halfSize.y, halfSize.y);
        let cz = constrain(localZ, -halfSize.z, halfSize.z);

        // 3. Distance check
        let distSq = (localX-cx)**2 + (localY-cy)**2 + (localZ-cz)**2;

        if (distSq < (item.size/2)**2) {
          // Collision!
          let dist = Math.sqrt(distSq);
          let pen = (item.size/2) - dist;

          // Normal in world space
          let normalLocal = createVector(localX-cx, localY-cy, localZ-cz).normalize();
          if (dist < 0.0001) normalLocal = createVector(0,1,0); // Fallback

          let normalWorld = createVector(0,0,0);
          normalWorld.add(p5.Vector.mult(part.t.right, normalLocal.x));
          normalWorld.add(p5.Vector.mult(part.t.up, normalLocal.y));
          normalWorld.add(p5.Vector.mult(part.t.fwd, normalLocal.z));
          normalWorld.normalize();

          // Position Correction (Push item out)
          item.pos.add(p5.Vector.mult(normalWorld, pen));

          // Velocity Impulse
          // Robot is kinematic (infinite mass).
          // Relative velocity = V_item - V_robot_at_point
          // Approx robot part velocity from changes in joints (simplified: use 0 or small push)
          // Better: Transfer closing speed.

          let closingSpeed = 0;
          if (robot.gripWidth !== robot.prevGripWidth) {
             let closing = (robot.prevGripWidth - robot.gripWidth) * 2; // Speed
             // If part is finger, add closing velocity direction
             // Left finger moves +X local, Right -X local
             // This logic is complex, simplified:
             // Just reflect item velocity with restitution + friction
          }

          let vn = p5.Vector.dot(item.vel, normalWorld);
          if (vn < 0) {
            let j = -(1 + CONFIG.restitution) * vn;
            item.vel.add(p5.Vector.mult(normalWorld, j));

            // Apply friction
            let tangent = p5.Vector.sub(item.vel, p5.Vector.mult(normalWorld, p5.Vector.dot(item.vel, normalWorld)));
            tangent.normalize();
            let vt = p5.Vector.dot(item.vel, tangent);
            let frictionImpulse = -vt * 0.5; // Friction coeff
            item.vel.add(p5.Vector.mult(tangent, frictionImpulse));
          }

          contactCount++;
          contacts.push({normal: normalWorld, part: part});
        }
      }

      // Gripping Logic: If squeezed between two opposing normals (Left/Right fingers)
      if (contactCount >= 2 && !item.grippedBy) {
        // Check if normals are opposing
        let n1 = contacts[0].normal;
        let n2 = contacts[1].normal;
        if (p5.Vector.dot(n1, n2) < -0.8) {
           item.grippedBy = 'robot';
           robot.heldItem = item;
           // Compute offset from wrist for "sticking"
           item.gripOffset = p5.Vector.sub(item.pos, robot.wristTransform.pos);
           // Store local rotation relative to wrist
           // Simplified: Just lock position relative to wrist frame
           // We need to project item pos into wrist frame
           let rel = p5.Vector.sub(item.pos, robot.wristTransform.pos);
           item.gripLocalPos = createVector(
             p5.Vector.dot(rel, robot.wristTransform.right),
             p5.Vector.dot(rel, robot.wristTransform.up),
             p5.Vector.dot(rel, robot.wristTransform.fwd)
           );
        }
      }
    }

    // Handle Held Item (Stick to gripper)
    if (robot.heldItem) {
      if (robot.gripWidth > robot.heldItem.size + 2) {
        // Release if opened
        robot.heldItem.grippedBy = null;
        robot.heldItem.vel.add(p5.Vector.sub(robot.effector, robot.prevEffector).mult(0.5)); // Fling
        robot.heldItem = null;
      } else {
        // Update position based on wrist transform
        let t = robot.wristTransform;
        let local = robot.heldItem.gripLocalPos;
        let newPos = t.pos.copy();
        newPos.add(p5.Vector.mult(t.right, local.x));
        newPos.add(p5.Vector.mult(t.up, local.y));
        newPos.add(p5.Vector.mult(t.fwd, local.z));
        robot.heldItem.pos = newPos;
        robot.heldItem.vel.set(0,0,0);
        robot.heldItem.angVel = 0;

        // Match rotation (simplified, just keep relative Y rotation)
        // Ideally we rotate the item by the delta rotation of the wrist
      }
    }
  }

  resolveItemCollision(a, b) {
    if (a.grippedBy && b.grippedBy) return;

    let n = p5.Vector.sub(b.pos, a.pos);
    let distSq = n.magSq();
    let minD = (a.size + b.size) / 2;

    if (distSq < minD * minD && distSq > 0.0001) {
      let dist = Math.sqrt(distSq);
      n.div(dist); // Normalize
      let overlap = minD - dist;

      // Position Correction
      let correction = p5.Vector.mult(n, overlap * 0.5);
      if (!a.grippedBy) a.pos.sub(correction);
      if (!b.grippedBy) b.pos.add(correction);

      // Relative Velocity
      let rv = p5.Vector.sub(b.vel, a.vel);
      let velAlongNormal = p5.Vector.dot(rv, n);

      if (velAlongNormal > 0) return; // Separating

      let e = CONFIG.restitution;
      let j = -(1 + e) * velAlongNormal;
      j /= (a.invMass + b.invMass);

      let impulse = p5.Vector.mult(n, j);
      if (!a.grippedBy) a.vel.sub(p5.Vector.mult(impulse, a.invMass));
      if (!b.grippedBy) b.vel.add(p5.Vector.mult(impulse, b.invMass));

      // Angular effect (fake friction torque)
      let tangent = p5.Vector.sub(rv, p5.Vector.mult(n, velAlongNormal));
      tangent.normalize();
      let jt = -p5.Vector.dot(rv, tangent) * 0.5; // Friction
      if(!a.grippedBy) a.angVel -= jt * 0.01;
      if(!b.grippedBy) b.angVel += jt * 0.01;
    }
  }

  display() {
    push();
    translate(0, CONFIG.floorY, 0);
    rotateX(HALF_PI);
    fill(20); noStroke(); plane(3000, 3000);
    stroke(35); strokeWeight(2);
    let gSz = 1200;
    for(let i=-gSz; i<=gSz; i+=100) { line(i, -gSz, i, gSz); line(-gSz, i, gSz, i); }
    noFill(); stroke(255, 100, 0, 50); strokeWeight(4); circle(0, 0, CONFIG.maxReach * 2);
    pop();
    for(let b of this.bins) b.display();
    for(let i of this.items) i.display();
  }
}

class Item {
  constructor(x, y, z) {
    this.pos = createVector(x, y, z);
    this.vel = createVector(0,0,0);
    this.size = 36;
    this.mass = 2.0;
    this.invMass = 0.5;
    this.rot = random(TWO_PI);
    this.angVel = 0;
    this.grippedBy = null;
    this.gripOffset = createVector(0,0,0);
    this.gripLocalPos = createVector(0,0,0);
    let r = random();
    this.col = r < 0.33 ? color(220, 60, 60) : (r < 0.66 ? color(220, 180, 40) : color(60, 100, 220));
  }

  display() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    if (this.grippedBy) { noFill(); stroke(255); strokeWeight(2); box(this.size + 4); }
    rotateY(this.rot);
    if (!this.grippedBy && this.pos.y < CONFIG.floorY - this.size) {
      push();
      translate(0, CONFIG.floorY - this.pos.y - 1, 0);
      rotateX(HALF_PI);
      fill(0, 100); noStroke(); circle(0, 0, this.size * 1.2);
      pop();
    }
    fill(this.col); noStroke(); specularMaterial(this.col); shininess(50); box(this.size);
    stroke(255, 50); noFill(); strokeWeight(2); box(this.size);
    pop();
  }
}

class Bin {
  constructor(x, y, z, w, c) {
    this.x = x; this.y = y; this.z = z; this.w = w; this.col = c;
    this.h = 80; this.thick = 10;
  }

  constrain(item) {
    let hw = this.w/2; let t = this.thick; let s2 = item.size/2;
    if (item.pos.y > this.y - this.h && item.pos.y < this.y + 50 &&
        item.pos.x > this.x - hw && item.pos.x < this.x + hw &&
        item.pos.z > this.z - hw && item.pos.z < this.z + hw) {
      let minX = this.x - hw + t + s2; let maxX = this.x + hw - t - s2;
      let minZ = this.z - hw + t + s2; let maxZ = this.z + hw - t - s2;
      if (item.pos.x < minX) { item.pos.x = minX; item.vel.x *= -0.5; }
      if (item.pos.x > maxX) { item.pos.x = maxX; item.vel.x *= -0.5; }
      if (item.pos.z < minZ) { item.pos.z = minZ; item.vel.z *= -0.5; }
      if (item.pos.z > maxZ) { item.pos.z = maxZ; item.vel.z *= -0.5; }
    }
  }

  display() {
    push();
    translate(this.x, this.y - this.h/2, this.z);
    fill(this.col); noStroke(); specularMaterial(this.col);
    let hw = this.w/2; let t = this.thick;
    push(); translate(0, this.h/2 - 2, 0); box(this.w, 4, this.w); pop();
    push(); translate(-hw + t/2, 0, 0); box(t, this.h, this.w); pop();
    push(); translate(hw - t/2, 0, 0); box(t, this.h, this.w); pop();
    push(); translate(0, 0, -hw + t/2); box(this.w - 2*t, this.h, t); pop();
    push(); translate(0, 0, hw - t/2); box(this.w - 2*t, this.h, t); pop();
    pop();
  }
}

// ------------------------------------------------------------------
// UI & CONTROL PANEL
// ------------------------------------------------------------------

class TopHUD {
  constructor(robotRef, worldRef) {
    this.robot = robotRef;
    this.world = worldRef;
    this.bar = createDiv('').class('top-bar');
    let leftGroup = createDiv('').class('top-group').parent(this.bar);
    this.statusInd = createDiv('● SYSTEM ONLINE').class('status-ind').parent(leftGroup);
    let centerGroup = createDiv('').class('top-group center').parent(this.bar);
    this.btnSpawn = createButton('✚ SPAWN CUBE').class('top-btn').parent(centerGroup).mousePressed(() => this.spawnBlock());
    this.btnCalibrate = createButton('⌖ CALIBRATE').class('top-btn').parent(centerGroup).mousePressed(() => {
        this.robot.enterCalibrationMode();
        gui.switchTab('calibration');
        gui.openPanel();
      });
    this.btnAlign = createButton('⟳ ALIGN CHECK').class('top-btn').parent(centerGroup).mousePressed(() => this.robot.startAlignmentCheck());
  }

  spawnBlock() {
    this.world.spawnBlock();
  }

  update() {
    if (this.robot.state.startsWith("CALIB")) {
      this.statusInd.html("● CALIBRATION MODE").style('color', '#ffaa00');
    } else if (this.robot.emergencyStop) {
      this.statusInd.html("● E-STOP ACTIVE").style('color', '#ff3333');
    } else if (!this.robot.isCalibrated) {
      this.statusInd.html("● UNCALIBRATED").style('color', '#ff3333');
    } else {
      this.statusInd.html("● SYSTEM READY").style('color', '#00ffc8');
    }
  }
}

class VisionGUI {
  constructor(scannerRef) {
    this.scanner = scannerRef;
    this.isOpen = false;
    this.pg = createGraphics(240, 240);
    this.btnOpen = createButton('👁 VISION FEED').class('btn-vision-toggle').mousePressed(() => this.open());
    this.panel = createDiv('').class('vision-modal');
    let header = createDiv('').class('vision-header').parent(this.panel);
    createSpan('LIDAR DEPTH MAP').parent(header);
    createSpan('✖').class('close-icon').parent(header).mousePressed(() => this.close());
    this.content = createDiv('').class('vision-content').parent(this.panel);
  }
  open() { this.isOpen = true; this.panel.addClass('active'); this.btnOpen.style('display', 'none'); }
  close() { this.isOpen = false; this.panel.removeClass('active'); this.btnOpen.style('display', 'block'); }
  renderBuffer() {
    this.pg.background(10);
    let center = this.scanner.center;
    let size = CONFIG.scanArea;
    let half = size / 2;
    this.pg.stroke(30); this.pg.strokeWeight(1);
    for(let i=0; i<=this.pg.width; i+=40) { this.pg.line(i, 0, i, this.pg.height); this.pg.line(0, i, this.pg.width, i); }
    this.pg.noStroke();
    let cellW = (this.pg.width / (size / CONFIG.scanResolution));
    if (this.scanner.points.length > 0) {
      for (let p of this.scanner.points) {
        let bx = map(p.pos.x, center.x - half, center.x + half, 0, this.pg.width);
        let by = map(p.pos.z, center.z - half, center.z + half, 0, this.pg.height);
        let brightness = map(p.pos.y, CONFIG.floorY, CONFIG.floorY - 80, 20, 255);
        if (p.type === 'object') { this.pg.fill(0, brightness, brightness * 0.9); } else { this.pg.fill(brightness * 0.5); }
        this.pg.rectMode(CENTER); this.pg.rect(bx, by, cellW + 1, cellW + 1);
      }
    } else {
      this.pg.fill(50); this.pg.textAlign(CENTER, CENTER); this.pg.textSize(12);
      this.pg.text("NO SIGNAL - INITIATE SCAN", this.pg.width/2, this.pg.height/2);
    }
    if (this.scanner.detectedTarget) {
      let t = this.scanner.detectedTarget.pos;
      let tx = map(t.x, center.x - half, center.x + half, 0, this.pg.width);
      let ty = map(t.z, center.z - half, center.z + half, 0, this.pg.height);
      this.pg.stroke(255, 50, 50); this.pg.strokeWeight(2); this.pg.noFill(); this.pg.circle(tx, ty, 30);
      let ang = this.scanner.detectedTarget.rot;
      this.pg.line(tx, ty, tx + cos(ang)*20, ty + sin(ang)*20);
    }
  }
  display() {
    this.renderBuffer();
    if (this.isOpen) {
      push(); resetMatrix(); translate(-width/2, -height/2); noFill(); stroke(0, 255, 200);
      rect(30, 142, 240, 240); image(this.pg, 30, 142); pop();
    }
  }
}

class LidarScanner {
  constructor() {
    this.center = createVector(-300, CONFIG.floorY, 0);
    this.points = [];
    this.detectedTarget = null;
  }
  performScan(items) {
    this.points = []; this.detectedTarget = null;
    let res = CONFIG.scanResolution; let halfSize = CONFIG.scanArea / 2;
    let startX = this.center.x - halfSize; let startZ = this.center.z - halfSize;
    for (let x = startX; x <= startX + CONFIG.scanArea; x += res) {
      for (let z = startZ; z <= startZ + CONFIG.scanArea; z += res) {
        let highestY = CONFIG.floorY; let hitType = 'floor';
        for (let item of items) {
          let halfS = item.size / 2;
          if (x >= item.pos.x - halfS && x <= item.pos.x + halfS &&
              z >= item.pos.z - halfS && z <= item.pos.z + halfS) {
            let topSurface = item.pos.y - halfS;
            if (topSurface < highestY) { highestY = topSurface; hitType = 'object'; }
          }
        }
        this.points.push({ pos: createVector(x, highestY, z), type: hitType });
      }
    }
    return this.processPointCloud(items);
  }
  processPointCloud(items) {
    let objectPoints = this.points.filter(p => p.type === 'object');
    if (objectPoints.length === 0) return null;
    objectPoints.sort((a, b) => a.pos.y - b.pos.y);
    let highestPoint = objectPoints[0];
    let surfacePoints = objectPoints.filter(p => Math.abs(p.pos.y - highestPoint.pos.y) < 5 && p.pos.dist(highestPoint.pos) < 60);
    let sumX = 0, sumZ = 0, sumY = 0;
    for (let p of surfacePoints) { sumX += p.pos.x; sumZ += p.pos.z; sumY += p.pos.y; }
    let centroid = createVector(sumX / surfacePoints.length, sumY / surfacePoints.length, sumZ / surfacePoints.length);
    let bestRot = 0; let minDist = 999;
    for(let item of items) {
      let d = p5.Vector.dist(centroid, item.pos);
      if(d < minDist) { minDist = d; bestRot = item.rot; }
    }
    this.detectedTarget = { pos: centroid, rot: bestRot };
    return this.detectedTarget;
  }
  display() {
    if (this.points.length === 0) return;
    push(); noStroke(); beginShape(POINTS);
    for (let p of this.points) {
      if (p.type === 'object') { stroke(0, 255, 100); strokeWeight(3); } else { stroke(255, 50, 50, 20); strokeWeight(1); }
      vertex(p.pos.x, p.pos.y, p.pos.z);
    }
    endShape();
    if (this.detectedTarget) {
      let t = this.detectedTarget.pos;
      translate(t.x, t.y, t.z); noFill(); stroke(0, 255, 255); strokeWeight(2); circle(0, 0, 40);
      rotateY(this.detectedTarget.rot); stroke(255, 255, 0); line(-25, 0, 0, 25, 0, 0);
    }
    pop();
  }
}

class ControlPanel {
  constructor(robotRef) {
    this.robot = robotRef;
    this.isOpen = false;
    this.activeTab = 'control';
    this.toggleBtn = createDiv('☰').class('hamburger').mousePressed(() => this.toggle());
    this.panel = createDiv('').class('side-panel');
    let tabHeader = createDiv('').class('tab-header').parent(this.panel);
    this.tabBtnControl = createButton('CONTROL').class('tab-btn active').parent(tabHeader).mousePressed(() => this.switchTab('control'));
    this.tabBtnCalib = createButton('CALIBRATION').class('tab-btn').parent(tabHeader).mousePressed(() => this.switchTab('calibration'));

    this.contentControl = createDiv('').class('tab-content active').parent(this.panel);
    createDiv('MANUAL OVERRIDE').class('panel-header').parent(this.contentControl);
    this.sliders = {
      base: this.addSlider(this.contentControl, "J1: BASE YAW", -PI, PI, 0),
      shoulder: this.addSlider(this.contentControl, "J2: SHOULDER", -PI/2, PI/2, -PI/4),
      elbow: this.addSlider(this.contentControl, "J3: ELBOW", 0, PI, PI/2),
      forearmRoll: this.addSlider(this.contentControl, "J4: FOREARM ROLL", -PI, PI, 0),
      wristPitch: this.addSlider(this.contentControl, "J5: WRIST PITCH", -PI, PI, 1.57),
      wristRoll: this.addSlider(this.contentControl, "J6: WRIST ROLL", -PI, PI, 0),
      grip: this.addSlider(this.contentControl, "GRIPPER", 0, 60, 40)
    };
    let btnGroup = createDiv('').class('control-group').parent(this.contentControl);
    createButton('EMERGENCY STOP').class('btn btn-stop').parent(btnGroup).mousePressed(() => this.robot.triggerStop());
    this.btnAuto = createButton('AUTO SEQUENCE').class('btn btn-auto active').parent(btnGroup).mousePressed(() => this.robot.setAutoMode());

    this.contentCalib = createDiv('').class('tab-content').parent(this.panel);
    createDiv('OFFSET TUNING').class('panel-header').parent(this.contentCalib);
    this.offsetSliders = {
      base: this.addSlider(this.contentCalib, "OFFSET: BASE", -0.5, 0.5, 0),
      shoulder: this.addSlider(this.contentCalib, "OFFSET: SHOULDER", -0.5, 0.5, 0),
      elbow: this.addSlider(this.contentCalib, "OFFSET: ELBOW", -0.5, 0.5, 0),
      forearmRoll: this.addSlider(this.contentCalib, "OFFSET: FOREARM", -0.5, 0.5, 0),
      wristPitch: this.addSlider(this.contentCalib, "OFFSET: W-PITCH", -0.5, 0.5, 0),
      wristRoll: this.addSlider(this.contentCalib, "OFFSET: W-ROLL", -0.5, 0.5, 0)
    };
    createButton('SAVE & FINISH').class('btn btn-save').parent(this.contentCalib).mousePressed(() => {
      this.robot.finalizeCalibration(); this.switchTab('control');
    });
  }
  addSlider(parent, label, min, max, val) {
    let g = createDiv('').class('control-group').parent(parent);
    createDiv(label).class('control-label').parent(g);
    let s = createSlider(min, max, val, 0.001).parent(g);
    if(parent === this.contentControl) { s.input(() => { this.robot.isManual = true; this.btnAuto.removeClass('active'); }); }
    return s;
  }
  switchTab(tabName) {
    this.activeTab = tabName;
    if(tabName === 'control') {
      this.tabBtnControl.addClass('active'); this.tabBtnCalib.removeClass('active');
      this.contentControl.addClass('active'); this.contentCalib.removeClass('active');
    } else {
      this.tabBtnControl.removeClass('active'); this.tabBtnCalib.addClass('active');
      this.contentControl.removeClass('active'); this.contentCalib.addClass('active');
    }
  }
  toggle() { this.isOpen = !this.isOpen; this.panel.elt.classList.toggle('open'); this.toggleBtn.html(this.isOpen ? '✕' : '☰'); }
  openPanel() { if(!this.isOpen) this.toggle(); }
  sync() {
    if (this.robot.isManual) {
      this.robot.joints.base = this.sliders.base.value();
      this.robot.joints.shoulder = this.sliders.shoulder.value();
      this.robot.joints.elbow = this.sliders.elbow.value();
      this.robot.joints.forearmRoll = this.sliders.forearmRoll.value();
      this.robot.joints.wristPitch = this.sliders.wristPitch.value();
      this.robot.joints.wristRoll = this.sliders.wristRoll.value();
      this.robot.gripWidth = this.sliders.grip.value();
      this.robot.solveFK();
    } else {
      this.sliders.base.value(this.robot.joints.base);
      this.sliders.shoulder.value(this.robot.joints.shoulder);
      this.sliders.elbow.value(this.robot.joints.elbow);
      this.sliders.forearmRoll.value(this.robot.joints.forearmRoll);
      this.sliders.wristPitch.value(this.robot.joints.wristPitch);
      this.sliders.wristRoll.value(this.robot.joints.wristRoll);
      this.sliders.grip.value(this.robot.gripWidth);
      if(!this.btnAuto.elt.classList.contains('active')) this.btnAuto.addClass('active');
    }
    if(this.activeTab === 'calibration') {
      this.robot.offsets.base = this.offsetSliders.base.value();
      this.robot.offsets.shoulder = this.offsetSliders.shoulder.value();
      this.robot.offsets.elbow = this.offsetSliders.elbow.value();
      this.robot.offsets.forearmRoll = this.offsetSliders.forearmRoll.value();
      this.robot.offsets.wristPitch = this.offsetSliders.wristPitch.value();
      this.robot.offsets.wristRoll = this.offsetSliders.wristRoll.value();
    }
  }
}

function injectStyles() {
  let css = `
    body { margin: 0; overflow: hidden; background: #141619; }
    .gui-container { font-family: 'Courier New', monospace; }
    .top-bar {
      position: fixed; top: 0; left: 0; width: 100%; height: 60px;
      background: rgba(15, 17, 20, 0.9); border-bottom: 1px solid #333;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 20px; z-index: 1400; box-sizing: border-box; backdrop-filter: blur(5px);
    }
    .top-group { display: flex; align-items: center; gap: 15px; }
    .top-group.center { position: absolute; left: 50%; transform: translateX(-50%); }
    .status-ind { font-size: 14px; font-weight: bold; color: #00ffc8; letter-spacing: 1px; }
    .top-btn {
      background: transparent; border: 1px solid #444; color: #aaa;
      padding: 6px 16px; font-family: 'Courier New'; font-weight: bold;
      cursor: pointer; transition: 0.2s; border-radius: 2px;
    }
    .top-btn:hover { background: #333; color: #fff; border-color: #00ffc8; }
    .hamburger {
      position: fixed; top: 10px; right: 20px; width: 40px; height: 40px;
      background: #1a1a1a; border: 1px solid #00ffc8; border-radius: 4px;
      cursor: pointer; z-index: 2000; display: flex; align-items: center;
      justify-content: center; color: #00ffc8; font-size: 20px; transition: 0.2s;
    }
    .hamburger:hover { background: #00ffc8; color: #111; }
    .side-panel {
      position: fixed; top: 0; right: 0; width: 340px; height: 100vh;
      background: rgba(15, 17, 20, 0.95); border-left: 1px solid #333;
      backdrop-filter: blur(10px); transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      padding: 80px 25px; display: flex; flex-direction: column; gap: 15px;
      z-index: 1500; box-shadow: -10px 0 40px rgba(0,0,0,0.6); overflow-y: auto;
      box-sizing: border-box;
    }
    .side-panel.open { transform: translateX(0); }
    .tab-header { display: flex; border-bottom: 1px solid #333; margin-bottom: 20px; }
    .tab-btn {
      flex: 1; background: transparent; border: none; color: #666;
      padding: 10px; cursor: pointer; font-weight: bold; font-family: inherit;
      border-bottom: 2px solid transparent; transition: 0.2s;
    }
    .tab-btn.active { color: #00ffc8; border-bottom-color: #00ffc8; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .panel-header { color: #fff; border-bottom: 1px solid #333; padding-bottom: 15px; font-weight: bold; letter-spacing: 2px; margin-bottom: 10px; }
    .control-group { margin-bottom: 15px; }
    .control-label { color: #888; font-size: 11px; margin-bottom: 5px; display: flex; justify-content: space-between; }
    input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none; height: 14px; width: 14px; border-radius: 50%;
      background: #00ffc8; cursor: pointer; margin-top: -5px;
    }
    input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 4px; cursor: pointer; background: #333; border-radius: 2px; }
    .btn {
      width: 100%; padding: 12px; border: none; border-radius: 2px;
      font-family: inherit; font-weight: bold; cursor: pointer;
      text-transform: uppercase; letter-spacing: 1px; transition: 0.2s;
    }
    .btn-stop { background: #ff3333; color: white; margin-bottom: 10px; }
    .btn-stop:hover { background: #ff5555; box-shadow: 0 0 15px rgba(255,50,50,0.3); }
    .btn-auto { background: #333; color: #888; }
    .btn-auto.active { background: #00ffc8; color: #111; box-shadow: 0 0 15px rgba(0,255,200,0.3); }
    .btn-save { background: #00ffc8; color: #111; margin-top: 20px; }
    .vision-modal {
      position: fixed; top: 100px; left: 20px; width: 260px;
      background: rgba(10, 12, 15, 0.95); border: 1px solid #00ffc8;
      border-radius: 4px; padding: 0; display: none; z-index: 1500;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5); font-family: 'Courier New', monospace;
    }
    .vision-modal.active { display: block; }
    .vision-header {
      background: #1a1a1a; color: #00ffc8; padding: 10px 15px;
      border-bottom: 1px solid #333; display: flex; justify-content: space-between;
      align-items: center; font-weight: bold; font-size: 14px;
    }
    .close-icon { cursor: pointer; color: #fff; transition: 0.2s; font-size: 16px; }
    .close-icon:hover { color: #ff3333; }
    .vision-content { width: 240px; height: 240px; margin: 10px; border: 1px dashed #333; background: #000; }
    .btn-vision-toggle {
      position: fixed; top: 80px; left: 20px;
      background: rgba(0,0,0,0.8); border: 1px solid #00ffc8; color: #00ffc8;
      padding: 10px 20px; font-family: 'Courier New'; cursor: pointer;
      z-index: 1000; font-weight: bold; transition: 0.2s; border-radius: 4px;
    }
    .btn-vision-toggle:hover { background: #00ffc8; color: #000; }
  `;
  createElement('style', css);
}

function drawUI() {
  push(); resetMatrix(); translate(-width/2, -height/2);
  noStroke(); fill(10, 10, 12, 200); rect(width - 290, height - 190, 270, 170, 4);
  let statusColor = robot.isManual ? color(255, 150, 0) : (robot.emergencyStop ? color(255, 50, 50) : color(0, 255, 200));
  fill(statusColor); rect(width - 290, height - 190, 5, 170, 4, 0, 0, 4);
  fill(220); textSize(14); textAlign(LEFT, TOP); text("SYSTEM DIAGNOSTICS", width - 270, height - 175);
  textSize(11); fill(150);
  text("MODE: " + (robot.isManual ? "MANUAL OVERRIDE" : "AUTO PILOT"), width - 270, height - 150);
  text("STATE: " + robot.state, width - 270, height - 135);
  text("WAYPOINTS: " + robot.waypointQueue.length, width - 270, height - 120);
  if (robot.state === "SCANNING") { fill(0, 255, 100); text(">> LIDAR SCANNING...", width - 270, height - 100); }
  else if (robot.state.startsWith("CALIB")) { fill(255, 200, 0); text(">> CALIBRATION REQUIRED", width - 270, height - 100); }
  else if (scanner.detectedTarget) { fill(0, 255, 255); text(">> TARGET LOCKED", width - 270, height - 100); }
  else { fill(100); text(">> STANDBY", width - 270, height - 100); }
  fill(robot.hasIKSolution ? 100 : 255, robot.hasIKSolution ? 255 : 50, 100);
  text("IK SOLVER: " + (robot.hasIKSolution ? "OPTIMAL" : "UNREACHABLE"), width - 270, height - 60);
  pop();
}
