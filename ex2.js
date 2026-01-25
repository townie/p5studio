/**
 * ROBO-RALLY: KINEMATIC CATCH & RETURN v2.0
 *
 * Instructions:
 * - Drag the glowing orb on the left to aim and shoot.
 * - The Robot AI will intercept the projectile.
 * - NEW: The Robot will calculate a trajectory and THROW it back to you.
 * - Catch the returned ball in the landing zone to score and keep the rally going!
 *
 * Features:
 * - Bidirectional Physics (Launch & Return)
 * - Inverse Kinematics Throwing Logic
 * - Dynamic Camera Tracking
 * - Rally Scoring System
 */

let simulation;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('Courier New');
  simulation = new GameSimulation();
}

function draw() {
  background(10, 12, 18);
  simulation.update();
  simulation.draw();
}

function mousePressed() {
  if (simulation) simulation.handlePress(mouseX, mouseY);
}

function mouseDragged() {
  if (simulation) simulation.handleDrag(mouseX, mouseY);
}

function mouseReleased() {
  if (simulation) simulation.handleRelease();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (simulation) simulation.resize();
}

// ---------------- MATH KERNEL ----------------

class Mat3 {
  constructor() { this.reset(); }
  reset() { this.val = [1, 0, 0, 0, 1, 0, 0, 0, 1]; }
  copy() {
    let m = new Mat3();
    m.val = this.val.slice();
    return m;
  }
  mult(m) {
    let a = this.val, b = m.val;
    let r00 = a[0]*b[0] + a[1]*b[3];
    let r01 = a[0]*b[1] + a[1]*b[4];
    let tx  = a[0]*b[2] + a[1]*b[5] + a[2];
    let r10 = a[3]*b[0] + a[4]*b[3];
    let r11 = a[3]*b[1] + a[4]*b[4];
    let ty  = a[3]*b[2] + a[4]*b[5] + a[5];
    this.val[0] = r00; this.val[1] = r01; this.val[2] = tx;
    this.val[3] = r10; this.val[4] = r11; this.val[5] = ty;
    return this;
  }
  translate(x, y) {
    let m = new Mat3(); m.val[2] = x; m.val[5] = y;
    return this.mult(m);
  }
  rotate(theta) {
    let m = new Mat3();
    let c = cos(theta), s = sin(theta);
    m.val[0] = c; m.val[1] = -s; m.val[3] = s; m.val[4] = c;
    return this.mult(m);
  }
  getPos() { return createVector(this.val[2], this.val[5]); }
}

// ---------------- PARTICLES & EFFECTS ----------------

class ParticleSystem {
  constructor() { this.particles = []; }

  emit(x, y, color, count = 10, speed = 2) {
    for(let i=0; i<count; i++) {
      this.particles.push({
        pos: createVector(x, y),
        vel: p5.Vector.random2D().mult(random(0.5, speed)),
        life: 1.0,
        color: color
      });
    }
  }

  update() {
    for(let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.pos.add(p.vel);
      p.life -= 0.02;
      if(p.life <= 0) this.particles.splice(i, 1);
    }
  }

  draw() {
    noStroke();
    for(let p of this.particles) {
      fill(red(p.color), green(p.color), blue(p.color), p.life * 255);
      circle(p.pos.x, p.pos.y, 4);
    }
  }
}

// ---------------- GAME SIMULATION ----------------

class GameSimulation {
  constructor() {
    this.floorY = height - 80;
    this.gravity = createVector(0, 0.4);
    this.particles = new ParticleSystem();

    // Game State
    this.score = 0;
    this.rally = 0;
    this.bestRally = 0;
    this.message = "READY";
    this.messageTimer = 0;

    // Entities
    this.robot = new KinematicRobot(0, this.floorY);

    // Setup Play Area
    this.anchor = createVector(150, height - 200);
    this.dragPos = this.anchor.copy();
    this.isDragging = false;
    this.maxDrag = 180;

    this.projectile = new Projectile(this.anchor.x, this.anchor.y);
    this.landingPad = { x: 0, y: 0, r: 80 };

    this.camShake = 0;
    this.resize();
  }

  resize() {
    this.floorY = height - 80;
    // Widen the field of view by pushing elements to edges
    this.anchor.set(150, height - 200);
    this.landingPad = { x: 150, y: height - 200, r: 100 };

    let robotX = width - 200;
    this.robot.origin.set(robotX, this.floorY);

    if (!this.projectile.launched && !this.projectile.returning) {
      this.projectile.pos = this.anchor.copy();
      this.dragPos = this.anchor.copy();
    }
  }

  addScore(points, msg) {
    this.score += points;
    this.message = msg;
    this.messageTimer = 60;
  }

  triggerShake(amount) {
    this.camShake = amount;
  }

  handlePress(mx, my) {
    // Only allow grab if ball is in the landing zone
    if (!this.projectile.launched && !this.projectile.returning &&
        dist(mx, my, this.projectile.pos.x, this.projectile.pos.y) < 60) {
      this.isDragging = true;
    }
  }

  handleDrag(mx, my) {
    if (this.isDragging) {
      this.dragPos.set(mx, my);
      let v = p5.Vector.sub(this.dragPos, this.anchor);
      if (v.mag() > this.maxDrag) {
        v.setMag(this.maxDrag);
        this.dragPos = p5.Vector.add(this.anchor, v);
      }
      this.projectile.pos = this.dragPos.copy();
    }
  }

  handleRelease() {
    if (this.isDragging) {
      this.isDragging = false;
      let force = p5.Vector.sub(this.anchor, this.dragPos);
      force.mult(0.20); // Power
      this.projectile.launch(force);
      this.message = "IN FLIGHT";
    }
  }

  update() {
    if (this.camShake > 0) this.camShake *= 0.9;
    if (this.messageTimer > 0) this.messageTimer--;

    this.particles.update();

    // Projectile Physics
    if ((this.projectile.launched || this.projectile.returning) && !this.projectile.caught) {
      this.projectile.vel.add(this.gravity);
      this.projectile.pos.add(this.projectile.vel);
      this.projectile.rot += this.projectile.vel.x * 0.05;

      // Floor bounce
      if (this.projectile.pos.y > this.floorY - 15) {
        this.projectile.pos.y = this.floorY - 15;
        this.projectile.vel.y *= -0.6;
        this.projectile.vel.x *= 0.8;

        // Ground friction
        if (abs(this.projectile.vel.x) < 0.1) this.projectile.vel.x = 0;

        // Reset rally if it hits the floor
        if (this.rally > 0 && abs(this.projectile.vel.y) > 1) {
           this.rally = 0;
           this.message = "DROPPED!";
           this.messageTimer = 60;
        }
      }

      // Wall bounce
      if (this.projectile.pos.x > width || this.projectile.pos.x < 0) {
        this.projectile.vel.x *= -0.8;
        this.projectile.pos.x = constrain(this.projectile.pos.x, 0, width);
      }

      // Check Landing Pad Return
      if (this.projectile.returning) {
        let d = dist(this.projectile.pos.x, this.projectile.pos.y, this.landingPad.x, this.landingPad.y);
        if (d < this.landingPad.r * 0.6) {
          // Success Return
          this.projectile.returning = false;
          this.projectile.launched = false;
          this.projectile.vel.mult(0);
          this.projectile.pos = this.anchor.copy(); // Snap
          this.rally++;
          if(this.rally > this.bestRally) this.bestRally = this.rally;
          this.addScore(100 * this.rally, "PERFECT RETURN!");
          this.particles.emit(this.anchor.x, this.anchor.y, color(0, 255, 255), 20, 5);
        }
      }
    }
    else if (this.projectile.caught) {
      // Sync with gripper
      let tcp = this.robot.frames.tcp.getPos();
      this.projectile.pos.set(tcp.x, tcp.y);
      this.projectile.rot = this.robot.getGlobalWristAngle();
    }

    this.robot.update(this.projectile, this);
  }

  draw() {
    push();
    if(this.camShake > 0.5) translate(random(-this.camShake, this.camShake), random(-this.camShake, this.camShake));

    this.drawEnvironment();
    this.robot.draw();
    this.drawSlingshot();
    this.projectile.draw();
    this.particles.draw();
    this.drawHUD();

    pop();
  }

  drawEnvironment() {
    // Background Grid
    stroke(255, 255, 255, 5); strokeWeight(1);
    for(let i=0; i<width; i+=80) line(i, 0, i, height);
    for(let i=0; i<height; i+=80) line(0, i, width, i);

    // Floor
    noStroke();
    fill(15, 18, 25); rect(0, this.floorY, width, height - this.floorY);
    stroke(0, 255, 255); strokeWeight(2); line(0, this.floorY, width, this.floorY);

    // Landing Pad (The Goal)
    push();
    translate(this.landingPad.x, this.landingPad.y);
    noFill();

    // Pulse effect
    let pulse = sin(millis() * 0.005) * 10;

    if (!this.projectile.launched && !this.projectile.returning) {
      stroke(0, 255, 0, 150);
      fill(0, 255, 0, 20);
    } else if (this.projectile.returning) {
      stroke(255, 200, 0, 150);
      fill(255, 200, 0, 20);
    } else {
      stroke(100);
      noFill();
    }

    strokeWeight(2);
    circle(0, 0, this.landingPad.r + pulse);
    circle(0, 0, this.landingPad.r * 0.7);

    textAlign(CENTER); noStroke(); fill(255, 150); textSize(10);
    text("LAUNCH / LAND", 0, 65);
    pop();
  }

  drawSlingshot() {
    if (this.isDragging) {
      stroke(255, 0, 100); strokeWeight(3);
      line(this.anchor.x - 20, this.anchor.y, this.projectile.pos.x, this.projectile.pos.y);
      line(this.anchor.x + 20, this.anchor.y, this.projectile.pos.x, this.projectile.pos.y);
      this.drawTrajectory();
    } else if (!this.projectile.launched && !this.projectile.returning) {
       stroke(100); strokeWeight(1);
       line(this.anchor.x - 20, this.anchor.y, this.projectile.pos.x, this.projectile.pos.y);
       line(this.anchor.x + 20, this.anchor.y, this.projectile.pos.x, this.projectile.pos.y);
    }

    // Base
    stroke(80); strokeWeight(4);
    line(this.anchor.x - 20, this.anchor.y, this.anchor.x - 30, this.floorY);
    line(this.anchor.x + 20, this.anchor.y, this.anchor.x + 30, this.floorY);
  }

  drawTrajectory() {
    let force = p5.Vector.sub(this.anchor, this.dragPos).mult(0.20);
    let simPos = this.projectile.pos.copy();
    let simVel = force.copy();
    let g = this.gravity;

    noFill(); stroke(255, 255, 255, 50); strokeWeight(2);
    beginShape();
    for(let i=0; i<30; i++) {
      vertex(simPos.x, simPos.y);
      simVel.add(g);
      simPos.add(simVel);
    }
    endShape();
  }

  drawHUD() {
    // Top Score Bar
    fill(20, 25, 35, 200); stroke(50);
    rect(width/2 - 150, 10, 300, 50, 10);

    textAlign(CENTER, CENTER);
    fill(255); textSize(12); noStroke();
    text("RALLY", width/2 - 80, 25);
    text("SCORE", width/2 + 80, 25);

    textSize(24); fill(0, 255, 255);
    text(this.rally, width/2 - 80, 45);
    fill(255, 200, 0);
    text(this.score, width/2 + 80, 45);

    // Dynamic Message
    if (this.messageTimer > 0) {
      fill(255); textSize(30); stroke(0); strokeWeight(4);
      text(this.message, width/2, height/2 - 50);
    }
  }
}

// ---------------- KINEMATIC ROBOT ----------------

class KinematicRobot {
  constructor(x, y) {
    this.origin = createVector(x, y);
    // Extended range for the wide view
    this.links = { base: 120, humerus: 240, ulna: 220, hand: 90 };
    this.theta = { j1: -HALF_PI, j2: HALF_PI, j3: 0 };
    this.frames = {
      base: new Mat3(), shoulder: new Mat3(), elbow: new Mat3(), wrist: new Mat3(), tcp: new Mat3()
    };

    this.state = "IDLE";
    this.timer = 0;

    this.gripper = {
      width: 70, targetWidth: 70,
      close: () => { this.gripper.targetWidth = 28; },
      release: () => { this.gripper.targetWidth = 70; },
      isClosed: () => { return abs(this.gripper.width - 28) < 5; }
    };

    this.targetPos = createVector(x - 150, y - 300);
    this.currentPos = createVector(x - 150, y - 300);
    this.targetOrient = PI;
    this.currentOrient = PI;
  }

  update(p, sim) {
    this.aiController(p, sim);

    // Movement Smoothing
    let speed = (this.state === "CATCH" || this.state === "THROW") ? 0.4 : 0.1;
    if (this.state === "INTERCEPT") speed = 0.5; // Fast intercept
    if (this.state === "WINDUP") speed = 0.2; // Slow precise windup

    this.currentPos.x = lerp(this.currentPos.x, this.targetPos.x, speed);
    this.currentPos.y = lerp(this.currentPos.y, this.targetPos.y, speed);

    let diff = this.targetOrient - this.currentOrient;
    this.currentOrient += diff * 0.15;

    this.solveIK(this.currentPos.x, this.currentPos.y, this.currentOrient);
    this.updateFK();

    // Gripper Anim
    this.gripper.width = lerp(this.gripper.width, this.gripper.targetWidth, 0.4);
  }

  aiController(p, sim) {
    let now = millis();
    let reach = this.links.humerus + this.links.ulna;

    switch (this.state) {
      case "IDLE":
        // Look at the ball even when idle
        let angleToBall = atan2(p.pos.y - this.origin.y + 300, p.pos.x - this.origin.x);
        this.targetOrient = PI + angleToBall * 0.5;
        this.targetPos.set(this.origin.x - 150, this.origin.y - 350 + sin(now * 0.002) * 20);
        this.gripper.release();

        if (p.launched && !p.caught && !p.returning) {
          // Ball is coming!
          if (p.pos.x > width * 0.3) { // Wait until it crosses midline
             this.state = "INTERCEPT";
          }
        }
        break;

      case "INTERCEPT":
        if (p.pos.y > this.origin.y || p.vel.x < 0) {
          this.state = "IDLE"; return; // Missed or moving wrong way
        }

        // Project trajectory to find intercept point
        let simP = p.pos.copy();
        let simV = p.vel.copy();
        let intercepted = false;

        for(let i=0; i<60; i++) {
          simV.add(sim.gravity);
          simP.add(simV);

          let d = dist(this.origin.x, this.origin.y, simP.x, simP.y);
          if (d < reach * 0.9 && simP.x < this.origin.x) {
             this.targetPos.set(simP.x, simP.y);
             let attackAngle = atan2(simV.y, simV.x);
             this.targetOrient = attackAngle + PI;

             // Trigger Catch
             let realDist = dist(this.frames.tcp.getPos().x, this.frames.tcp.getPos().y, p.pos.x, p.pos.y);
             if (realDist < 40) {
               this.state = "CATCH";
               sim.triggerShake(5);
               sim.particles.emit(p.pos.x, p.pos.y, color(255, 100, 0));
             }
             intercepted = true;
             break;
          }
        }

        if (!intercepted) {
          // If can't reach, look sad
          this.targetPos.set(this.origin.x - 100, this.origin.y - 200);
        }
        break;

      case "CATCH":
        this.targetPos.set(p.pos.x, p.pos.y);
        this.gripper.close();

        if (this.gripper.isClosed()) {
          p.caught = true;
          p.vel.mult(0);
          this.state = "WINDUP";
          this.timer = now + 400; // Windup time
        }
        break;

      case "WINDUP":
        // Cock arm back
        this.targetPos.set(this.origin.x + 50, this.origin.y - 450);
        this.targetOrient = PI - 0.5;

        if (now > this.timer) {
          this.state = "THROW";
          this.timer = now + 300;
        }
        break;

      case "THROW":
        // Fling forward towards player
        // Calculate throw vector
        let targetX = sim.anchor.x;
        let targetY = sim.anchor.y;

        // Aim point (Forward and down)
        this.targetPos.set(this.origin.x - 200, this.origin.y - 250);
        this.targetOrient = PI + 0.5;

        // Release point
        if (now > this.timer - 150) {
          if (p.caught) {
            // RELEASE!
            this.gripper.release();
            p.caught = false;
            p.returning = true;

            // Ballistic Calculation for return
            // We want to hit the anchor.
            // dx = vx * t
            // dy = vy * t + 0.5 * g * t^2
            // Let's assume a flight time based on distance
            let distX = targetX - p.pos.x;
            let flightTime = abs(distX) / 18; // Constant horizontal speed approx

            let vx = distX / flightTime;
            let dy = targetY - p.pos.y;
            let vy = (dy - 0.5 * sim.gravity.y * flightTime * flightTime) / flightTime;

            p.vel.set(vx, vy);

            sim.particles.emit(p.pos.x, p.pos.y, color(255));
            sim.message = "INCOMING!";
            sim.triggerShake(2);
          }
        }

        if (now > this.timer) {
          this.state = "IDLE";
        }
        break;
    }
  }

  updateFK() {
    this.frames.base.reset();
    this.frames.base.translate(this.origin.x, this.origin.y);
    this.frames.shoulder = this.frames.base.copy().rotate(0).translate(0, -this.links.base);
    this.frames.elbow = this.frames.shoulder.copy().rotate(this.theta.j1).translate(this.links.humerus, 0);
    this.frames.wrist = this.frames.elbow.copy().rotate(this.theta.j2).translate(this.links.ulna, 0);
    this.frames.tcp = this.frames.wrist.copy().rotate(this.theta.j3).translate(this.links.hand, 0);
  }

  solveIK(tx, ty, goalAngle) {
    let wx = tx - cos(goalAngle) * this.links.hand;
    let wy = ty - sin(goalAngle) * this.links.hand;
    let dx = wx - this.frames.shoulder.getPos().x;
    let dy = wy - this.frames.shoulder.getPos().y;
    let distSQ = dx*dx + dy*dy;
    let distToWC = sqrt(distSQ);
    let a = this.links.humerus;
    let b = this.links.ulna;
    let maxReach = (a + b) * 0.99;

    if (distToWC > maxReach) {
       distToWC = maxReach;
       let angle = atan2(dy, dx);
       dx = cos(angle) * distToWC;
       dy = sin(angle) * distToWC;
    }

    let cosElbow = (a*a + b*b - distToWC*distToWC) / (2*a*b);
    let elbowAngle = acos(constrain(cosElbow, -1, 1));
    this.theta.j2 = PI - elbowAngle;

    let angleToWC = atan2(dy, dx);
    let cosShoulder = (a*a + distToWC*distToWC - b*b) / (2*a*distToWC);
    let shoulderOffset = acos(constrain(cosShoulder, -1, 1));
    this.theta.j1 = angleToWC - shoulderOffset;
    this.theta.j3 = goalAngle - this.theta.j1 - this.theta.j2;
  }

  getGlobalWristAngle() { return this.theta.j1 + this.theta.j2 + this.theta.j3; }

  draw() {
    // Robot Base
    fill(40); noStroke();
    rect(this.origin.x - 40, this.origin.y - this.links.base, 80, this.links.base);

    this.drawLinks();
    this.drawJoints();
    this.drawGripper();
  }

  drawLinks() {
    strokeCap(ROUND);
    let sh = this.frames.shoulder.getPos();
    let el = this.frames.elbow.getPos();
    let wr = this.frames.wrist.getPos();

    // Arm Styling
    stroke(80); strokeWeight(24); line(sh.x, sh.y, el.x, el.y);
    stroke(255, 100, 0); strokeWeight(20); line(sh.x, sh.y, el.x, el.y); // Orange Main

    stroke(80); strokeWeight(18); line(el.x, el.y, wr.x, wr.y);
    stroke(200); strokeWeight(14); line(el.x, el.y, wr.x, wr.y); // White Forearm

    // Pistons
    stroke(50); strokeWeight(6);
    line(sh.x, sh.y - 30, el.x, el.y - 30);
  }

  drawJoints() {
    let pts = [this.frames.shoulder, this.frames.elbow, this.frames.wrist];
    for(let f of pts) {
      let p = f.getPos();
      fill(30); stroke(0); strokeWeight(2); circle(p.x, p.y, 36);
      fill(0, 255, 255); noStroke(); circle(p.x, p.y, 10); // Neon Hub
    }
  }

  drawGripper() {
    let wr = this.frames.wrist.getPos();
    let angle = this.getGlobalWristAngle();
    let w = this.gripper.width;

    push();
    translate(wr.x, wr.y);
    rotate(angle);

    // Wrist block
    fill(40); noStroke(); rect(-10, -25, 40, 50, 4);

    // Fingers
    fill(200);
    // Top Finger
    beginShape();
    vertex(30, -w/2); vertex(90, -w/2 + 5); vertex(80, -w/2 - 10); vertex(30, -w/2 - 15);
    endShape(CLOSE);
    // Bottom Finger
    beginShape();
    vertex(30, w/2); vertex(90, w/2 - 5); vertex(80, w/2 + 10); vertex(30, w/2 + 15);
    endShape(CLOSE);

    pop();
  }
}

// ---------------- OBJECTS ----------------

class Projectile {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.w = 24;
    this.rot = 0;
    this.launched = false;
    this.caught = false;
    this.returning = false;
  }

  launch(force) {
    this.vel = force;
    this.launched = true;
    this.returning = false;
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.rot);

    // Glow
    noStroke();
    if (this.caught) fill(255, 100, 0, 100);
    else if (this.returning) fill(255, 0, 0, 100);
    else fill(0, 255, 255, 100);
    circle(0, 0, 40);

    // Core
    if (this.returning) fill(255, 50, 50);
    else fill(220);
    rectMode(CENTER);
    rect(0, 0, this.w, this.w, 4);

    // Details
    fill(0);
    rect(0, 0, 10, 10);

    // Trail
    if ((this.launched || this.returning) && !this.caught) {
      stroke(255, 100); strokeWeight(2);
      line(-this.vel.x*3, -this.vel.y*3, 0, 0);
    }

    pop();
  }
}
