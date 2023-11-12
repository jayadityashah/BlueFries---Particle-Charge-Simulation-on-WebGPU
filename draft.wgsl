struct Ball {
  radius: f32,
  charge: f32,
  mass: f32,
  position: vec2<f32>,
  velocity: vec2<f32>,
  acceleration: vec2<f32>,
}

@group(0) @binding(0)
var<storage, read> input: array<Ball>;

@group(0) @binding(1)
var<storage, read_write> output: array<Ball>;

struct Scene {
  width: f32,
  height: f32,
}

@group(0) @binding(2)
var<storage, read> scene: Scene;

const PI: f32 = 3.14159;
const TIME_STEP: f32 = 0.016;
const G: f32 = 1;
const K: f32 = 1000;
const EPS: f32 = 1;
const SPEED_LIMIT = 700;
const WALLS = true;

fn sign(x: f32) -> f32 {
    if (x > 0) {
        return 1;
    }
    if (x < 0) {
        return -1;
    }
    return 0;
}

fn cropVelocity(v: f32) -> f32 {
    if (abs(v) > SPEED_LIMIT) {
        return sign(v) * SPEED_LIMIT;
    }
    return v;
}

@compute @workgroup_size(64)
fn main(
  @builtin(global_invocation_id)
  global_id : vec3<u32>,
) {
  let num_balls = arrayLength(&output);
  if(global_id.x >= num_balls) {
    return;
  }
  var src_ball = input[global_id.x];
  let dst_ball = &output[global_id.x];

  (*dst_ball) = src_ball;

  if (global_id.x == 0) {
    return;
  }
  // Ball/Ball collision
  for(var i = 0u; i < num_balls; i = i + 1u) {
    if(i == global_id.x) {
      continue;
    }
    var other_ball = input[i];
    let n = src_ball.position - other_ball.position;
    var distance = length(n);


    if (distance < EPS) {
        distance = EPS;
    }

    let src_mass = src_ball.mass;
    let other_mass = other_ball.mass;

    let force = normalize(n) * ((other_mass * G + -src_ball.charge * other_ball.charge * K/src_mass) / pow(distance, 1));
    (*dst_ball).acceleration = (*dst_ball).acceleration-force;
  }

  // Apply acceleration
  (*dst_ball).velocity = (*dst_ball).velocity + (*dst_ball).acceleration * TIME_STEP;
  (*dst_ball).velocity.x = cropVelocity((*dst_ball).velocity.x);
  (*dst_ball).velocity.y = cropVelocity((*dst_ball).velocity.y);

  // Apply velocity
  (*dst_ball).position = (*dst_ball).position + (*dst_ball).velocity * TIME_STEP;
  (*dst_ball).acceleration.x = 0;
  (*dst_ball).acceleration.y = 0;

  // Ball/Wall collision
  if (WALLS) {
      if((*dst_ball).position.x - (*dst_ball).radius < 0.) {
        (*dst_ball).position.x = (*dst_ball).radius;
        (*dst_ball).velocity.x = -(*dst_ball).velocity.x;
      }
      if((*dst_ball).position.y - (*dst_ball).radius < 0.) {
        (*dst_ball).position.y = (*dst_ball).radius;
        (*dst_ball).velocity.y = -(*dst_ball).velocity.y;
      }
      if((*dst_ball).position.x + (*dst_ball).radius >= scene.width) {
        (*dst_ball).position.x = scene.width - (*dst_ball).radius;
        (*dst_ball).velocity.x = -(*dst_ball).velocity.x;
      }
      if((*dst_ball).position.y + (*dst_ball).radius >= scene.height) {
        (*dst_ball).position.y = scene.height - (*dst_ball).radius;
        (*dst_ball).velocity.y = -(*dst_ball).velocity.y;
      }
  }
}
