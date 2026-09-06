/* ============================================================================
   Govind Pradeep — interactive fluid cursor
   A GPU (WebGL) stable-fluid solver: the pointer injects velocity + dye, which
   then advects, swirls (vorticity confinement), is made divergence-free by a
   Jacobi pressure solve, and dissipates. Same technique as the AsimovX site,
   but the dye is sampled from this site's terminal mint/prompt band, with a
   rare amber accent flare.
   Self-contained, no dependencies. Reacts to touch as well as mouse. Bails
   out safely on unsupported hardware and prefers-reduced-motion.
   ========================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    SIM_RESOLUTION:       128,
    DYE_RESOLUTION:       1024,
    DENSITY_DISSIPATION:  3.0,   // how fast the colour fades
    VELOCITY_DISSIPATION: 2.0,   // how fast the motion dies down
    PRESSURE:             0.1,
    PRESSURE_ITERATIONS:  20,
    CURL:                 3.0,   // swirliness
    SPLAT_RADIUS:         0.19,
    SPLAT_FORCE:          6000,
    SHADING:              true,
    COLOR_UPDATE_SPEED:   7,
    DYE_INTENSITY:        0.22,
    MAX_DPR:              1.5
  };

  /* ---- bail-outs ---------------------------------------------------------- */
  function bail(reason) { window.GPFluidStatus = reason; return true; }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return bail('reduced-motion');

  var canvas = document.createElement('canvas');
  canvas.id = 'fluid';
  canvas.setAttribute('aria-hidden', 'true');

  var gl, ext;
  try { var ctx = getWebGLContext(canvas); gl = ctx.gl; ext = ctx.ext; }
  catch (e) { return bail('context-threw: ' + e.message); }
  if (!gl) return bail(window.GPFluidStatus || 'no-webgl-context');

  document.body.appendChild(canvas);
  document.documentElement.classList.add('has-fluid');

  /* ---- context ------------------------------------------------------------ */
  function getWebGLContext(c) {
    var params = { alpha: true, depth: false, stencil: false,
                   antialias: false, preserveDrawingBuffer: false };
    var g = c.getContext('webgl2', params);
    var isWebGL2 = !!g;
    if (!isWebGL2) g = c.getContext('webgl', params) || c.getContext('experimental-webgl', params);
    if (!g) { bail('no-webgl'); return { gl: null }; }

    var halfFloat, supportLinearFiltering;
    if (isWebGL2) {
      g.getExtension('EXT_color_buffer_float');
      supportLinearFiltering = g.getExtension('OES_texture_float_linear');
    } else {
      halfFloat = g.getExtension('OES_texture_half_float');
      supportLinearFiltering = g.getExtension('OES_texture_half_float_linear');
      if (!halfFloat) { bail('no-half-float'); return { gl: null }; }
    }
    g.clearColor(0, 0, 0, 1);

    var halfFloatTexType = isWebGL2 ? g.HALF_FLOAT : halfFloat.HALF_FLOAT_OES;
    var formatRGBA, formatRG, formatR;
    if (isWebGL2) {
      formatRGBA = getSupportedFormat(g, g.RGBA16F, g.RGBA, halfFloatTexType);
      formatRG   = getSupportedFormat(g, g.RG16F,   g.RG,   halfFloatTexType);
      formatR    = getSupportedFormat(g, g.R16F,    g.RED,  halfFloatTexType);
    } else {
      formatRGBA = getSupportedFormat(g, g.RGBA, g.RGBA, halfFloatTexType);
      formatRG   = formatRGBA;
      formatR    = formatRGBA;
    }
    if (!formatRGBA) { bail('no-float-render-target'); return { gl: null }; }

    return { gl: g, ext: {
      formatRGBA: formatRGBA, formatRG: formatRG, formatR: formatR,
      halfFloatTexType: halfFloatTexType,
      supportLinearFiltering: supportLinearFiltering,
      isWebGL2: isWebGL2
    }};
  }

  function getSupportedFormat(g, internalFormat, format, type) {
    if (!supportRenderTextureFormat(g, internalFormat, format, type)) {
      switch (internalFormat) {
        case g.R16F:  return getSupportedFormat(g, g.RG16F, g.RG, type);
        case g.RG16F: return getSupportedFormat(g, g.RGBA16F, g.RGBA, type);
        default:      return null;
      }
    }
    return { internalFormat: internalFormat, format: format };
  }

  function supportRenderTextureFormat(g, internalFormat, format, type) {
    var tex = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, tex);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.texImage2D(g.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
    var fbo = g.createFramebuffer();
    g.bindFramebuffer(g.FRAMEBUFFER, fbo);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
    var ok = g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE;
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.deleteFramebuffer(fbo); g.deleteTexture(tex);
    return ok;
  }

  /* ---- shader plumbing ---------------------------------------------------- */
  function compile(type, source, keywords) {
    if (keywords) {
      var prefix = '';
      keywords.forEach(function (k) { prefix += '#define ' + k + '\n'; });
      source = prefix + source;
    }
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  function program(vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p));
    var uniforms = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var name = gl.getActiveUniform(p, i).name;
      uniforms[name] = gl.getUniformLocation(p, name);
    }
    return { program: p, uniforms: uniforms, bind: function () { gl.useProgram(p); } };
  }

  var baseVertex = [
    'precision highp float;',
    'attribute vec2 aPosition;',
    'varying vec2 vUv, vL, vR, vT, vB;',
    'uniform vec2 texelSize;',
    'void main () {',
    '  vUv = aPosition * 0.5 + 0.5;',
    '  vL = vUv - vec2(texelSize.x, 0.0);',
    '  vR = vUv + vec2(texelSize.x, 0.0);',
    '  vT = vUv + vec2(0.0, texelSize.y);',
    '  vB = vUv - vec2(0.0, texelSize.y);',
    '  gl_Position = vec4(aPosition, 0.0, 1.0);',
    '}'].join('\n');

  var copyFrag = [
    'precision mediump float; precision mediump sampler2D;',
    'varying highp vec2 vUv; uniform sampler2D uTexture;',
    'void main () { gl_FragColor = texture2D(uTexture, vUv); }'].join('\n');

  var clearFrag = [
    'precision mediump float; precision mediump sampler2D;',
    'varying highp vec2 vUv; uniform sampler2D uTexture; uniform float value;',
    'void main () { gl_FragColor = value * texture2D(uTexture, vUv); }'].join('\n');

  var displayFrag = [
    'precision highp float; precision highp sampler2D;',
    'varying vec2 vUv, vL, vR, vT, vB;',
    'uniform sampler2D uTexture; uniform vec2 texelSize;',
    'void main () {',
    '  vec3 c = texture2D(uTexture, vUv).rgb;',
    '#ifdef SHADING',
    '  vec3 lc = texture2D(uTexture, vL).rgb;',
    '  vec3 rc = texture2D(uTexture, vR).rgb;',
    '  vec3 tc = texture2D(uTexture, vT).rgb;',
    '  vec3 bc = texture2D(uTexture, vB).rgb;',
    '  float dx = length(rc) - length(lc);',
    '  float dy = length(tc) - length(bc);',
    '  vec3 n = normalize(vec3(dx, dy, length(texelSize)));',
    '  float diffuse = clamp(dot(n, vec3(0.0, 0.0, 1.0)) + 0.7, 0.7, 1.0);',
    '  c *= diffuse;',
    '#endif',
    '  float a = max(c.r, max(c.g, c.b));',
    '  gl_FragColor = vec4(c, a);',
    '}'].join('\n');

  var splatFrag = [
    'precision highp float; precision highp sampler2D;',
    'varying vec2 vUv;',
    'uniform sampler2D uTarget; uniform float aspectRatio;',
    'uniform vec3 color; uniform vec2 point; uniform float radius;',
    'void main () {',
    '  vec2 p = vUv - point.xy; p.x *= aspectRatio;',
    '  vec3 splat = exp(-dot(p, p) / radius) * color;',
    '  vec3 base = texture2D(uTarget, vUv).xyz;',
    '  gl_FragColor = vec4(base + splat, 1.0);',
    '}'].join('\n');

  var advectionFrag = [
    'precision highp float; precision highp sampler2D;',
    'varying vec2 vUv;',
    'uniform sampler2D uVelocity; uniform sampler2D uSource;',
    'uniform vec2 texelSize; uniform vec2 dyeTexelSize;',
    'uniform float dt; uniform float dissipation;',
    'vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {',
    '  vec2 st = uv / tsize - 0.5;',
    '  vec2 iuv = floor(st); vec2 fuv = fract(st);',
    '  vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);',
    '  vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);',
    '  vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);',
    '  vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);',
    '  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);',
    '}',
    'void main () {',
    '#ifdef MANUAL_FILTERING',
    '  vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;',
    '  vec4 result = bilerp(uSource, coord, dyeTexelSize);',
    '#else',
    '  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;',
    '  vec4 result = texture2D(uSource, coord);',
    '#endif',
    '  gl_FragColor = result / (1.0 + dissipation * dt);',
    '}'].join('\n');

  var divergenceFrag = [
    'precision mediump float; precision mediump sampler2D;',
    'varying highp vec2 vUv, vL, vR, vT, vB;',
    'uniform sampler2D uVelocity;',
    'void main () {',
    '  float L = texture2D(uVelocity, vL).x;',
    '  float R = texture2D(uVelocity, vR).x;',
    '  float T = texture2D(uVelocity, vT).y;',
    '  float B = texture2D(uVelocity, vB).y;',
    '  vec2 C = texture2D(uVelocity, vUv).xy;',
    '  if (vL.x < 0.0) { L = -C.x; }',
    '  if (vR.x > 1.0) { R = -C.x; }',
    '  if (vT.y > 1.0) { T = -C.y; }',
    '  if (vB.y < 0.0) { B = -C.y; }',
    '  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);',
    '}'].join('\n');

  var curlFrag = [
    'precision mediump float; precision mediump sampler2D;',
    'varying highp vec2 vUv, vL, vR, vT, vB;',
    'uniform sampler2D uVelocity;',
    'void main () {',
    '  float L = texture2D(uVelocity, vL).y;',
    '  float R = texture2D(uVelocity, vR).y;',
    '  float T = texture2D(uVelocity, vT).x;',
    '  float B = texture2D(uVelocity, vB).x;',
    '  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);',
    '}'].join('\n');

  var vorticityFrag = [
    'precision highp float; precision highp sampler2D;',
    'varying vec2 vUv, vL, vR, vT, vB;',
    'uniform sampler2D uVelocity; uniform sampler2D uCurl;',
    'uniform float curl; uniform float dt;',
    'void main () {',
    '  float L = texture2D(uCurl, vL).x;',
    '  float R = texture2D(uCurl, vR).x;',
    '  float T = texture2D(uCurl, vT).x;',
    '  float B = texture2D(uCurl, vB).x;',
    '  float C = texture2D(uCurl, vUv).x;',
    '  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));',
    '  force /= length(force) + 0.0001;',
    '  force *= curl * C;  force.y *= -1.0;',
    '  vec2 velocity = texture2D(uVelocity, vUv).xy + force * dt;',
    '  velocity = min(max(velocity, -1000.0), 1000.0);',
    '  gl_FragColor = vec4(velocity, 0.0, 1.0);',
    '}'].join('\n');

  var pressureFrag = [
    'precision mediump float; precision mediump sampler2D;',
    'varying highp vec2 vUv, vL, vR, vT, vB;',
    'uniform sampler2D uPressure; uniform sampler2D uDivergence;',
    'void main () {',
    '  float L = texture2D(uPressure, vL).x;',
    '  float R = texture2D(uPressure, vR).x;',
    '  float T = texture2D(uPressure, vT).x;',
    '  float B = texture2D(uPressure, vB).x;',
    '  float divergence = texture2D(uDivergence, vUv).x;',
    '  gl_FragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);',
    '}'].join('\n');

  var gradientSubtractFrag = [
    'precision mediump float; precision mediump sampler2D;',
    'varying highp vec2 vUv, vL, vR, vT, vB;',
    'uniform sampler2D uPressure; uniform sampler2D uVelocity;',
    'void main () {',
    '  float L = texture2D(uPressure, vL).x;',
    '  float R = texture2D(uPressure, vR).x;',
    '  float T = texture2D(uPressure, vT).x;',
    '  float B = texture2D(uPressure, vB).x;',
    '  vec2 velocity = texture2D(uVelocity, vUv).xy;',
    '  velocity.xy -= vec2(R - L, T - B);',
    '  gl_FragColor = vec4(velocity, 0.0, 1.0);',
    '}'].join('\n');

  var P = {};
  try {
    var vs = compile(gl.VERTEX_SHADER, baseVertex);
    P.copy       = program(vs, compile(gl.FRAGMENT_SHADER, copyFrag));
    P.clear      = program(vs, compile(gl.FRAGMENT_SHADER, clearFrag));
    P.splat      = program(vs, compile(gl.FRAGMENT_SHADER, splatFrag));
    P.divergence = program(vs, compile(gl.FRAGMENT_SHADER, divergenceFrag));
    P.curl       = program(vs, compile(gl.FRAGMENT_SHADER, curlFrag));
    P.vorticity  = program(vs, compile(gl.FRAGMENT_SHADER, vorticityFrag));
    P.pressure   = program(vs, compile(gl.FRAGMENT_SHADER, pressureFrag));
    P.gradient   = program(vs, compile(gl.FRAGMENT_SHADER, gradientSubtractFrag));
    P.display    = program(vs, compile(gl.FRAGMENT_SHADER, displayFrag,
                     CONFIG.SHADING ? ['SHADING'] : null));
    P.advection  = program(vs, compile(gl.FRAGMENT_SHADER, advectionFrag,
                     ext.supportLinearFiltering ? null : ['MANUAL_FILTERING']));
  } catch (err) {
    if (window.console) console.warn('[fluid] shader error — effect disabled', err);
    bail('shader-error: ' + err.message);
    canvas.remove();
    document.documentElement.classList.remove('has-fluid');
    return;
  }

  /* ---- fullscreen quad ---------------------------------------------------- */
  var blit = (function () {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    return function (target, clear) {
      if (!target) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      if (clear) { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };
  })();

  /* ---- framebuffers ------------------------------------------------------- */
  var dye, velocity, divergenceFBO, curlFBO, pressure;

  function createFBO(w, h, internalFormat, format, type, param) {
    gl.activeTexture(gl.TEXTURE0);
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return {
      texture: texture, fbo: fbo, width: w, height: h,
      texelSizeX: 1 / w, texelSizeY: 1 / h,
      attach: function (id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      }
    };
  }

  function createDoubleFBO(w, h, internalFormat, format, type, param) {
    var fbo1 = createFBO(w, h, internalFormat, format, type, param);
    var fbo2 = createFBO(w, h, internalFormat, format, type, param);
    return {
      width: w, height: h, texelSizeX: fbo1.texelSizeX, texelSizeY: fbo1.texelSizeY,
      get read()  { return fbo1; },  set read(v)  { fbo1 = v; },
      get write() { return fbo2; },  set write(v) { fbo2 = v; },
      swap: function () { var t = fbo1; fbo1 = fbo2; fbo2 = t; }
    };
  }

  function resizeFBO(target, w, h, internalFormat, format, type, param) {
    var newFBO = createFBO(w, h, internalFormat, format, type, param);
    P.copy.bind();
    gl.uniform1i(P.copy.uniforms.uTexture, target.attach(0));
    blit(newFBO);
    return newFBO;
  }

  function resizeDoubleFBO(target, w, h, internalFormat, format, type, param) {
    if (target.width === w && target.height === h) return target;
    target.read = resizeFBO(target.read, w, h, internalFormat, format, type, param);
    target.write = createFBO(w, h, internalFormat, format, type, param);
    target.width = w; target.height = h;
    target.texelSizeX = 1 / w; target.texelSizeY = 1 / h;
    return target;
  }

  function getResolution(resolution) {
    var aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspect < 1) aspect = 1 / aspect;
    var min = Math.round(resolution), max = Math.round(resolution * aspect);
    return gl.drawingBufferWidth > gl.drawingBufferHeight
      ? { width: max, height: min } : { width: min, height: max };
  }

  function initFramebuffers() {
    var simRes = getResolution(CONFIG.SIM_RESOLUTION);
    var dyeRes = getResolution(CONFIG.DYE_RESOLUTION);
    var type = ext.halfFloatTexType;
    var rgba = ext.formatRGBA, rg = ext.formatRG, r = ext.formatR;
    var filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
    gl.disable(gl.BLEND);

    dye = dye
      ? resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, type, filtering)
      : createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, type, filtering);

    velocity = velocity
      ? resizeDoubleFBO(velocity, simRes.width, simRes.height, rg.internalFormat, rg.format, type, filtering)
      : createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, type, filtering);

    divergenceFBO = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, type, gl.NEAREST);
    curlFBO       = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, type, gl.NEAREST);
    pressure      = createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, type, gl.NEAREST);
  }

  /* ---- canvas sizing ------------------------------------------------------ */
  function scaleByPixelRatio(input) {
    var pr = Math.min(window.devicePixelRatio || 1, CONFIG.MAX_DPR);
    return Math.floor(input * pr);
  }

  function resizeCanvas() {
    var w = scaleByPixelRatio(canvas.clientWidth);
    var h = scaleByPixelRatio(canvas.clientHeight);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      return true;
    }
    return false;
  }

  resizeCanvas();
  initFramebuffers();

  /* ---- brand-tinted dye --------------------------------------------------- */
  // Hue bands sampled from this site's terminal palette: the mint prompt
  // color in a few neighboring shades, with a rare amber accent flare
  // (matches the [ok] status tag and the accent color used sparingly
  // across the page).
  var HUE_BANDS = [
    [0.360, 0.400],  // green-yellow edge ~130-144 deg
    [0.400, 0.440],  // core mint         ~144-158 deg
    [0.440, 0.490],  // teal-mint         ~158-176 deg
    [0.530, 0.580],  // blue accent       ~191-209 deg
    [0.080, 0.110]   // amber accent (used sparingly)
  ];

  function generateColor() {
    var i = Math.random() < 0.09 ? 4 : Math.floor(Math.random() * 4);
    var band = HUE_BANDS[i];
    var h = band[0] + Math.random() * (band[1] - band[0]);
    var c = HSVtoRGB(h, 0.85 + Math.random() * 0.15, 1.0);
    c.r *= CONFIG.DYE_INTENSITY; c.g *= CONFIG.DYE_INTENSITY; c.b *= CONFIG.DYE_INTENSITY;
    return c;
  }

  function HSVtoRGB(h, s, v) {
    var i = Math.floor(h * 6), f = h * 6 - i;
    var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: return { r: v, g: t, b: p };
      case 1: return { r: q, g: v, b: p };
      case 2: return { r: p, g: v, b: t };
      case 3: return { r: p, g: q, b: v };
      case 4: return { r: t, g: p, b: v };
      default: return { r: v, g: p, b: q };
    }
  }

  /* ---- pointer ------------------------------------------------------------ */
  function Pointer() {
    this.down = false; this.moved = false;
    this.texcoordX = 0; this.texcoordY = 0;
    this.prevTexcoordX = 0; this.prevTexcoordY = 0;
    this.deltaX = 0; this.deltaY = 0;
    this.color = generateColor();
  }
  var pointer = new Pointer();

  function updatePointerMoveData(p, x, y) {
    p.prevTexcoordX = p.texcoordX;
    p.prevTexcoordY = p.texcoordY;
    p.texcoordX = x / canvas.width;
    p.texcoordY = 1 - y / canvas.height;
    p.deltaX = correctDeltaX(p.texcoordX - p.prevTexcoordX);
    p.deltaY = correctDeltaY(p.texcoordY - p.prevTexcoordY);
    p.moved = Math.abs(p.deltaX) > 0 || Math.abs(p.deltaY) > 0;
  }

  function correctDeltaX(delta) {
    var aspectRatio = canvas.width / canvas.height;
    if (aspectRatio < 1) delta *= aspectRatio;
    return delta;
  }
  function correctDeltaY(delta) {
    var aspectRatio = canvas.width / canvas.height;
    if (aspectRatio > 1) delta /= aspectRatio;
    return delta;
  }

  var firstMove = true;
  window.addEventListener('mousemove', function (e) {
    var x = scaleByPixelRatio(e.clientX), y = scaleByPixelRatio(e.clientY);
    if (firstMove) {          // seed position so the first splat isn't a jump
      firstMove = false;
      pointer.texcoordX = pointer.prevTexcoordX = x / canvas.width;
      pointer.texcoordY = pointer.prevTexcoordY = 1 - y / canvas.height;
      pointer.color = generateColor();
      return;
    }
    updatePointerMoveData(pointer, x, y);
  }, { passive: true });

  window.addEventListener('mousedown', function (e) {
    var x = scaleByPixelRatio(e.clientX), y = scaleByPixelRatio(e.clientY);
    pointer.color = generateColor();
    splat(x / canvas.width, 1 - y / canvas.height, 0, 0, pointer.color, 1.7);
  }, { passive: true });

  window.addEventListener('mouseleave', function () { pointer.moved = false; });
  window.addEventListener('resize', function () { resizeRequested = true; });

  var touchFirstMove = true;
  window.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    var x = scaleByPixelRatio(t.clientX), y = scaleByPixelRatio(t.clientY);
    touchFirstMove = false;
    pointer.texcoordX = pointer.prevTexcoordX = x / canvas.width;
    pointer.texcoordY = pointer.prevTexcoordY = 1 - y / canvas.height;
    pointer.color = generateColor();
    splat(x / canvas.width, 1 - y / canvas.height, 0, 0, pointer.color, 1.7);
  }, { passive: true });

  window.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    var x = scaleByPixelRatio(t.clientX), y = scaleByPixelRatio(t.clientY);
    if (touchFirstMove) {
      touchFirstMove = false;
      pointer.texcoordX = pointer.prevTexcoordX = x / canvas.width;
      pointer.texcoordY = pointer.prevTexcoordY = 1 - y / canvas.height;
      pointer.color = generateColor();
      return;
    }
    updatePointerMoveData(pointer, x, y);
  }, { passive: true });

  window.addEventListener('touchend', function () { pointer.moved = false; touchFirstMove = true; });

  var resizeRequested = false;

  /* ---- splats ------------------------------------------------------------- */
  function splat(x, y, dx, dy, color, radiusMul) {
    P.splat.bind();
    gl.uniform1i(P.splat.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform1f(P.splat.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(P.splat.uniforms.point, x, y);
    gl.uniform3f(P.splat.uniforms.color, dx, dy, 0);
    gl.uniform1f(P.splat.uniforms.radius, correctRadius(CONFIG.SPLAT_RADIUS / 100) * (radiusMul || 1));
    blit(velocity.write);
    velocity.swap();

    gl.uniform1i(P.splat.uniforms.uTarget, dye.read.attach(0));
    gl.uniform3f(P.splat.uniforms.color, color.r, color.g, color.b);
    blit(dye.write);
    dye.swap();
  }

  function correctRadius(radius) {
    var aspectRatio = canvas.width / canvas.height;
    return aspectRatio > 1 ? radius * aspectRatio : radius;
  }

  function applyInputs() {
    if (!pointer.moved) return;
    pointer.moved = false;
    splat(pointer.texcoordX, pointer.texcoordY,
          pointer.deltaX * CONFIG.SPLAT_FORCE, pointer.deltaY * CONFIG.SPLAT_FORCE,
          pointer.color);
  }

  /* ---- solver ------------------------------------------------------------- */
  function step(dt) {
    gl.disable(gl.BLEND);

    P.curl.bind();
    gl.uniform2f(P.curl.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(P.curl.uniforms.uVelocity, velocity.read.attach(0));
    blit(curlFBO);

    P.vorticity.bind();
    gl.uniform2f(P.vorticity.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(P.vorticity.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(P.vorticity.uniforms.uCurl, curlFBO.attach(1));
    gl.uniform1f(P.vorticity.uniforms.curl, CONFIG.CURL);
    gl.uniform1f(P.vorticity.uniforms.dt, dt);
    blit(velocity.write);
    velocity.swap();

    P.divergence.bind();
    gl.uniform2f(P.divergence.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(P.divergence.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergenceFBO);

    P.clear.bind();
    gl.uniform1i(P.clear.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(P.clear.uniforms.value, CONFIG.PRESSURE);
    blit(pressure.write);
    pressure.swap();

    P.pressure.bind();
    gl.uniform2f(P.pressure.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(P.pressure.uniforms.uDivergence, divergenceFBO.attach(0));
    for (var i = 0; i < CONFIG.PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(P.pressure.uniforms.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    P.gradient.bind();
    gl.uniform2f(P.gradient.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(P.gradient.uniforms.uPressure, pressure.read.attach(0));
    gl.uniform1i(P.gradient.uniforms.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    P.advection.bind();
    gl.uniform2f(P.advection.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!ext.supportLinearFiltering)
      gl.uniform2f(P.advection.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    var velocityId = velocity.read.attach(0);
    gl.uniform1i(P.advection.uniforms.uVelocity, velocityId);
    gl.uniform1i(P.advection.uniforms.uSource, velocityId);
    gl.uniform1f(P.advection.uniforms.dt, dt);
    gl.uniform1f(P.advection.uniforms.dissipation, CONFIG.VELOCITY_DISSIPATION);
    blit(velocity.write);
    velocity.swap();

    if (!ext.supportLinearFiltering)
      gl.uniform2f(P.advection.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    gl.uniform1i(P.advection.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(P.advection.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(P.advection.uniforms.dissipation, CONFIG.DENSITY_DISSIPATION);
    blit(dye.write);
    dye.swap();
  }

  function render() {
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    P.display.bind();
    gl.uniform2f(P.display.uniforms.texelSize, 1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight);
    gl.uniform1i(P.display.uniforms.uTexture, dye.read.attach(0));
    blit(null);
  }

  /* ---- loop --------------------------------------------------------------- */
  var lastTime = performance.now();
  var colorTimer = 0;
  var visible = true;

  document.addEventListener('visibilitychange', function () {
    visible = !document.hidden;
    lastTime = performance.now();
  });

  function frame() {
    var now = performance.now();
    var dt = Math.min((now - lastTime) / 1000, 1 / 60);
    lastTime = now;

    if (visible) {
      if (resizeRequested) { resizeRequested = false; if (resizeCanvas()) initFramebuffers(); }
      colorTimer += dt * CONFIG.COLOR_UPDATE_SPEED;
      if (colorTimer >= 1) { colorTimer = 0; pointer.color = generateColor(); }
      applyInputs();
      step(dt);
      render();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---- gentle intro flourish --------------------------------------------- */
  // A short brand-coloured sweep so the effect announces itself on load.
  (function intro() {
    var pts = [[0.62, 0.68], [0.70, 0.55], [0.58, 0.44], [0.68, 0.34]];
    pts.forEach(function (pt, i) {
      setTimeout(function () {
        var c = generateColor();
        c.r *= 1.6; c.g *= 1.6; c.b *= 1.6;
        splat(pt[0], pt[1], (Math.random() - 0.5) * 2200, 1400, c, 1.35);
      }, 420 + i * 130);
    });
  })();

  /* expose for debugging / tuning */
  window.GPFluidStatus = 'running';
  window.GPFluid = { config: CONFIG, splat: splat, generateColor: generateColor };
})();
