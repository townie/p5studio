
export const DEFAULT_SKETCH_CODE = `function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
}

function draw() {
  background(10, 10, 10, 20);
  fill(255, 100);
  ellipse(mouseX, mouseY, 50, 50);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}`;

export const SYSTEM_PROMPT = `You are an expert creative coder specializing in p5.js. 
When asked to generate or modify code, provide a COMPLETE, WORKING, and SELF-CONTAINED p5.js sketch. 
Do not include any explanations outside the code block. 
Use modern ES6 syntax. 
Ensure the code is performant and visually striking.
Always include windowResized() to keep the canvas responsive.`;
