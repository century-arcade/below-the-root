// a 1984 television over the frame: curvature, scanlines, phosphor stripes, colour bleed, vignette

const VERTEX = `
attribute vec2 corner;
varying vec2 uv;
void main() {
  uv = vec2(corner.x, -corner.y) * .5 + .5;
  gl_Position = vec4(corner, 0., 1.);
}`;

const FRAGMENT = `
precision mediump float;
uniform sampler2D frame;
uniform vec2 source;
uniform float pixelsPerColumn;
varying vec2 uv;

vec2 curve(vec2 p) {
  p = p * 2. - 1.;
  p *= 1. + vec2(p.y * p.y, p.x * p.x) * vec2(.035, .05);
  return p * .5 + .5;
}

vec3 tap(vec2 p, float dx) {
  return texture2D(frame, vec2(p.x + dx / source.x, p.y)).rgb;
}

void main() {
  vec2 p = curve(uv);
  vec2 edge = smoothstep(vec2(0.), vec2(.004), p) * smoothstep(vec2(0.), vec2(.004), 1. - p);
  float inside = edge.x * edge.y;
  vec2 snapped = vec2(p.x, (floor(p.y * source.y) + .5) / source.y);
  vec3 color = tap(snapped, 0.) * .56 + (tap(snapped, -.6) + tap(snapped, .6)) * .17
    + (tap(snapped, -1.6) + tap(snapped, 1.6)) * .05;
  float line = .5 + .5 * cos(6.2831853 * p.y * source.y);
  color *= 1. - .38 * line;
  if (pixelsPerColumn >= 3.) {
    float m = mod(gl_FragCoord.x, 3.);
    color *= vec3(m < 1. ? 1. : .86, m >= 1. && m < 2. ? 1. : .86, m >= 2. ? 1. : .86);
  }
  float vignette = pow(16. * p.x * p.y * (1. - p.x) * (1. - p.y), .12);
  color *= 1.32 * vignette * inside;
  gl_FragColor = vec4(color, 1.);
}`;

export class Crt {
  static create(canvas, width) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false });
    if (!gl) return null;
    try { return new Crt(canvas, gl, width); } catch { return null; }
  }

  constructor(canvas, gl, width) {
    this.canvas = canvas;
    this.gl = gl;
    this.width = width;
    this.rows = 0;
    const program = gl.createProgram();
    for (const [type, text] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const corner = gl.getAttribLocation(program, 'corner');
    gl.enableVertexAttribArray(corner);
    gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.source = gl.getUniformLocation(program, 'source');
    this.pixelsPerColumn = gl.getUniformLocation(program, 'pixelsPerColumn');
  }

  // css size of the picture; the backing store follows the device pixels
  resize(cssWidth, cssHeight) {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(cssWidth * ratio));
    const h = Math.max(1, Math.round(cssHeight * ratio));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    this.gl.uniform1f(this.pixelsPerColumn, w / this.width);
  }

  draw(imageData) {
    const gl = this.gl;
    if (this.rows !== imageData.height) {
      this.rows = imageData.height;
      gl.uniform2f(this.source, imageData.width, imageData.height);
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
