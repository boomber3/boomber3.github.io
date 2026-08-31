/**
 * 首页 Banner WebGL 动画：像素风蒸汽小火车穿过晚霞云层
 * 原作: "up in the cloud sea" by mdb
 *   https://www.shadertoy.com/view/Ndc3zl  (作者主页: https://www.shadertoy.com/user/mdb)
 * 原作许可: CC BY-NC-SA 3.0 (Shadertoy 默认许可, 未另行声明)
 * 本文件为改编版本, 依同一许可 CC BY-NC-SA 3.0 发布
 * 说明：
 *  - 原作是双 pass（Buffer A 计算场景 -> Image 加暗角），此处合并为单 pass
 *  - 原作 iChannel0 使用 Shadertoy 内置 RGBA 噪声纹理，此处运行时随机生成等效纹理
 *  - 原作末尾 iChannel1 的 30% 质感纹理混合暂未移植（不影响主体画面）
 */
(function () {
  'use strict';

  var CANVAS_ID = 'banner-shader-canvas';

  var VERT = [
    'attribute vec2 aPos;',
    'void main() { gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    '#define texture texture2D',
    'uniform vec2 iResolution;',
    'uniform float iTime;',
    'uniform sampler2D iChannel0;',
    '',
    'float noise(vec2 x){',
    '    vec2 f = fract(x);',
    '    vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);',
    '    vec2 du = 30.0*f*f*(f*(f-2.0)+1.0);',
    '    ',
    '    vec2 p = floor(x);',
    '\tfloat a = texture(iChannel0, (p+vec2(0.0, 0.0))/1024.0).x;',
    '\tfloat b = texture(iChannel0, (p+vec2(1.0,0.0))/1024.0).x;',
    '\tfloat c = texture(iChannel0, (p+vec2(0.0,1.0))/1024.0).x;',
    '\tfloat d = texture(iChannel0, (p+vec2(1.0,1.0))/1024.0).x;',
    '',
    '\treturn a+(b-a)*u.x+(c-a)*u.y+(a-b-c+d)*u.x*u.y;',
    '}',
    '',
    '// 原作 fbm(x, detail) / fbm2(x, detail) 所有调用处 detail 均为 8，',
    '// 固化为常量循环以兼容 WebGL1 (GLSL ES 1.00) 的循环限制',
    'float fbm(vec2 x){',
    '    float a = 0.0;',
    '    float b = 1.0;',
    '    float t = 0.0;',
    '    for(int i = 0; i < 8; i++){',
    '        float n = noise(x);',
    '        a += b*n;',
    '        t += b;',
    '        b *= 0.7;',
    '        x *= 2.0; ',
    '    }',
    '    return a/t;',
    '}',
    '',
    'float fbm2(vec2 x){',
    '    float a = 0.0;',
    '    float b = 1.0;',
    '    float t = 0.0;',
    '    for(int i = 0; i < 8; i++){',
    '        float n = noise(x);',
    '        a += b*n;',
    '        t += b;',
    '        b *= 0.9;',
    '        x *= 2.0; ',
    '    }',
    '    return a/t;',
    '}',
    '',
    'float box(vec2 uv, float x1, float x2, float y1, float y2){',
    '    return (uv.x > x1 && uv.x < x2 && uv.y > y1 && uv.y < y2)?1.0:0.0;',
    '}',
    '',
    '#define dot2(v) dot(v, v)',
    '#define layer(dh, v)  if (uv.y < h + midlevel - (dh) ) return vec4(v, 1.);',
    '',
    'vec4 foreground(vec2 uv, float t){',
    '    float midlevel;',
    '    float h;',
    '    float disp;',
    '    float dist;',
    '    vec2 uv2;',
    '    ',
    '    uv.y -= 0.2;',
    '    // clouds foreground //////////////////////////////////////////////////////////////',
    '    ',
    '    // c14',
    '    midlevel = -0.1;',
    '    disp = 1.7;',
    '    dist = 1.0;',
    '    uv2 = uv + vec2(t/dist + 40.0, 0.0);',
    '    h = (fbm(uv2) - 0.5)*disp;',
    '    layer(0.12, vec3(0.43, 0.32, 0.31));',
    '    layer(0.08, vec3(0.55, 0.42, 0.41));',
    '    layer(0.04, vec3(0.66, 0.42, 0.40));',
    '    layer(0., vec3(0.77, 0.48, 0.46));',
    '    ',
    '    // c13',
    '    ',
    '    midlevel = 0.05;',
    '    disp = 1.7;',
    '    dist = 2.0;',
    '    uv2 = uv + vec2(t/dist + 38.0, 0.0);',
    '    h = (fbm(uv2) - 0.5)*disp;',
    '    layer(0.1, vec3(0.95, 0.66, 0.48));',
    '    layer(0.04, vec3(0.98, 0.76, 0.64));',
    '    layer(0., vec3(0.95, 0.80, 0.77));',
    '    ',
    '    return vec4(0.95, 0.80, 0.77, 0.);',
    '}',
    '',
    'vec4 background(vec2 uv, float t){',
    '    float midlevel;',
    '    float h;',
    '    float disp;',
    '    float dist;',
    '    vec2 uv2;',
    '    ',
    '    // clouds ///////////////////////////////////////////////////////',
    '    ',
    '    // c12',
    '    midlevel = 0.3;',
    '    disp = 0.9;',
    '    dist = 10.0;',
    '    uv2 = uv + vec2(t/dist + 32.5, 0.0);',
    '    h = (fbm(uv2) - 0.5)*disp;',
    '    layer(0.14, vec3(0.48, 0.19, 0.20));',
    '    layer(0.1, vec3(0.68, 0.28, 0.19));',
    '    layer(0.07, vec3(0.88, 0.38, 0.24));',
    '    layer(0., vec3(0.95, 0.45, 0.30));',
    '    ',
    '    // c11',
    '    midlevel = 0.35;',
    '    disp = 1.0;',
    '    dist = 15.0;',
    '    uv2 = uv + vec2(t/dist + 30.0, 0.0);',
    '    h = (fbm(uv2) - 0.5)*disp;',
    '    layer(0.04, vec3(0.98, 0.76, 0.64));',
    '    layer(0., vec3(0.95, 0.80, 0.77));',
    '    ',
    '    // c10',
    '    midlevel = 0.35;',
    '    disp = 3.5;',
    '    dist = 20.0;',
    '    uv2 = uv + vec2(t/dist + 27.5, 0.0);',
    '    h = (fbm(uv2) - 0.5)*disp;',
    '    layer(0.12, vec3(0.43, 0.32, 0.31));',
    '    layer(0.08, vec3(0.55, 0.42, 0.41));',
    '    layer(0.04, vec3(0.66, 0.42, 0.40));',
    '    layer(0., vec3(0.77, 0.48, 0.46));',
    '    ',
    '    // c9',
    '    midlevel = 0.45;',
    '    disp = 2.0;',
    '    dist = 25.0;',
    '    uv2 = uv + vec2(t/dist + 23.0, 0.0);',
    '    h = (fbm(uv2) - 0.5)*disp;',
    '    layer(0.04, vec3(0.98, 0.57, 0.36));',
    '    layer(0., vec3(1.0, 0.62, 0.44));',
    '    ',
    '    // c8',
    '    midlevel = 0.5;',
    '    disp = 2.3;',
    '    dist = 30.0;',
    '    uv2 = uv + vec2(t/dist + 20.5, 0.0);',
    '    h = (fbm(uv2) - 0.5)*disp;',
    '    layer(0.12, vec3(0.41, 0.27, 0.27));',
    '    layer(0.08, vec3(0.53, 0.35, 0.32));',
    '    layer(0.04, vec3(0.80, 0.24, 0.17));',
    '    layer(0., vec3(0.99, 0.29, 0.20));',
    '    ',
    '    // c7',
    '    midlevel = 0.5;',
    '    disp = 2.5;',
    '    dist = 35.0;',
    '    uv2 = uv + vec2(t/dist + 18.0, 0.0);',
    '    h = (fbm(uv2) - 0.5)*disp;',
    '    layer(0.1, vec3(0.88, 0.38, 0.24));',
    '    layer(0.05, vec3(0.98, 0.42, 0.28));',
    '    layer(0., vec3(1.0, 0.48, 0.35));',
    '    ',
    '    // c6',
    '    midlevel = 0.6;',
    '    disp = 2.0;',
    '    dist = 40.0;',
    '    uv2 = uv + vec2(t/dist + 18.0, 0.0);',
    '    h = (fbm(uv2) - 0.5)*disp;',
    '    layer(0.1, vec3(0.95, 0.66, 0.48));',
    '    layer(0., vec3(1.0, 0.76, 0.60));',
    '    ',
    '    // c5',
    '    midlevel = 0.75;',
    '    disp = 3.5;',
    '    dist = 45.0;',
    '    uv2 = uv + vec2(t/dist + 15.5, 0.0);',
    '    h = (fbm(uv2) - 0.5)*disp;',
    '    layer(0.2, vec3(1.0, 0.55, 0.33));',
    '    layer(0.15, vec3(0.98, 0.50, 0.24));',
    '    layer(0.1, vec3(0.90, 0.55, 0.40));',
    '    layer(0., vec3(1.0, 0.62, 0.44));',
    '    ',
    '    // c4',
    '    midlevel = 0.7;',
    '    disp = 2.7;',
    '    dist = 50.0;',
    '    uv2 = uv + vec2(t/dist + 12.0, 0.0);',
    '    h = (fbm(uv2) - 0.5)*disp;',
    '    layer(0.04, vec3(0.73, 0.36, 0.30));',
    '    layer(0., vec3(0.80, 0.40, 0.34));',
    '    ',
    '    // c3',
    '    midlevel = 0.8;',
    '    disp = 2.7;',
    '    dist = 60.0;',
    '    uv2 = uv + vec2(t/dist + 9.5, 0.0);',
    '    h = (fbm(uv2) - 0.5)*disp;',
    '    layer(0.1, vec3(0.93, 0.58, 0.35));',
    '    layer(0., vec3(1.0, 0.76, 0.60));',
    '    ',
    '    // c2',
    '    midlevel = 0.9;',
    '    disp = 3.0;',
    '    dist = 70.0;',
    '    uv2 = uv + vec2(t/dist + 7.0, 0.0);',
    '    h = (fbm(uv2) - 0.5)*disp;',
    '    layer(0.1, vec3(0.56, 0.25, 0.22));',
    '    layer(0.05, vec3(0.60, 0.30, 0.27));',
    '    layer(0., vec3(0.74, 0.35, 0.30));',
    '    ',
    '    // c1',
    '    midlevel = 1.0;',
    '    disp = 5.0;',
    '    dist = 100.0;',
    '    uv2 = uv + vec2(t/dist + 3.5, 0.0);',
    '    h = (fbm(uv2) - 0.5)*disp;',
    '    layer(0.1, vec3(0.92, 0.85, 0.82));',
    '    layer(0., vec3(1.0, 0.94, 0.91));',
    '    ',
    '    return vec4(0.58, 0.7, 1.0, 1.);',
    '}',
    '',
    'void mainImage( out vec4 fragColor, in vec2 fragCoord )',
    '{',
    '    vec2 uv = fragCoord/iResolution.y;',
    '    //uv.x += iTime;',
    '    float t = iTime*4.0;',
    '    vec4 bg = background(uv, t);',
    '    ',
    '    vec4 fg = vec4(0.);',
    '    int n = 5;',
    '    if (uv.y < 0.5)',
    '    for (int i = 0; i < 5; i++){',
    '        fg += foreground(uv, t+4.*float(i)/5./60.) / (5.);',
    '    }',
    '    ',
    '    vec3 col = bg.rgb;',
    '    // train /////////////////////////////////////////////////////////////////////',
    '    float k;',
    '    float midlevel;',
    '    float h;',
    '    float disp;',
    '    float dist;',
    '    vec2 uv2;',
    '    uv.y -= 0.2;',
    '    // choo choo',
    '    k = 1.0;',
    '    uv2 = fract(uv*9.0);',
    '    float wagon = 1.0;',
    '    wagon *= 1.0 - step(0.45, uv.x);',
    '    wagon *= 1.0 - step(0.115, uv.y);',
    '    wagon *= step(0.103, uv.y);',
    '    wagon *= step(0.05, 1.0 - abs(uv2.x*2.0 - 1.0));',
    '    ',
    '    float join = 1.0; ',
    '    join *= 1.0 - step(0.45, uv.x);',
    '    join *= 1.0 - step(0.11, uv.y);',
    '    join *= step(0.107, uv.y);',
    '    ',
    '    ',
    '    float roof = 1.0;',
    '    roof *= 1.0 - step(0.45, uv.x);',
    '    roof *= 1.0 - step(0.117, uv.y);',
    '    roof *= step(0.11, uv.y);',
    '    roof *= step(0.15, 1.0 - abs(uv2.x*2.0 - 1.0));',
    '    ',
    '    float loco = box(uv, 0.45, 0.5, 0.103, 0.112);',
    '    float chem1 = box(uv, 0.49, 0.495, 0.103, 0.12);',
    '    float chem2 = box(uv, 0.488, 0.496, 0.12, 0.123);',
    '    float locoRoof = box(uv, 0.443, 0.47, 0.11, 0.117);',
    '    ',
    '    float wheel = 1.0 - step(0.00004, dot2(uv - vec2(0.457, 0.106)));',
    '    wheel += 1.0 - step(0.00002, dot2(uv - vec2(0.487, 0.105)));',
    '    wheel += 1.0 - step(0.00002, dot2(uv - vec2(0.497, 0.105)));',
    '    ',
    '    if (uv.x < 0.45 && uv.y > 0.025 && uv.y < 0.2){',
    '        wheel += 1.0 - step(0.002, dot2(uv2 - vec2(0.2, 0.95)));',
    '        wheel += 1.0 - step(0.002, dot2(uv2 - vec2(0.8, 0.95)));',
    '    }',
    '    col = mix(col, vec3(0.18, 0.12, 0.15), join);',
    '    col =  mix(col, vec3(0.48, 0.19, 0.20), wagon);',
    '    col = mix(col, vec3(0.18, 0.12, 0.15), roof);',
    '    ',
    '    col = mix(col, vec3(0.38, 0.19, 0.20), loco);',
    '    col = mix(col, vec3(0.38, 0.19, 0.20), chem1);',
    '    col = mix(col, vec3(0.18, 0.12, 0.15), locoRoof);',
    '    col = mix(col, vec3(0.18, 0.12, 0.15), chem2 + wheel);',
    '    // loco smoke //////',
    '    ',
    '    dist = 5.0;',
    '    uv2 = uv + vec2(t/dist + 3.5, 0.0);',
    '    uv2.x -= t/dist*0.2;',
    '    h = fbm2(uv2) - 0.55;',
    '    ',
    '    if(uv.x < 0.49){',
    '        float x = -uv.x + 0.49;',
    '        float y = abs(uv.y + h*0.4 - 0.16*sqrt(x) - 0.12) - 0.8*x*exp(-x*10.0);',
    '        if(y < 0.0) col = vec3(1.0, 0.94, 0.91);',
    '        if(y < - 0.02) col = vec3(0.92, 0.85, 0.82);',
    '    }',
    '    ',
    '    //bridge ///////',
    '    dist = 5.0;',
    '    uv2 = uv + vec2(t/dist + 32.5, 0.0);',
    '    uv2.x = fract(uv2.x*3.0);',
    '    k = 1.0;',
    '    k *= smoothstep(0.001, 0.003, abs(uv2.y - pow(uv2.x - 0.5, 2.0)*0.15 - 0.12));',
    '    k *= min(step(0.05, 1.0 - abs(uv2.x*2.0 - 1.0))',
    '         +   step(0.17, uv2.y), 1.0);',
    '    k *= min(smoothstep(0.02, 0.05, 1.0 - abs(uv2.x*2.0 - 1.0))',
    '         +   step(0.177, uv2.y), 1.0);',
    '         ',
    '    k *= min(step(0.1, uv2.y)',
    '           + smoothstep(-0.09, -0.085, -uv2.y - 0.001/(1.0 - abs(uv2.x*2.0 - 1.0))), 1.0);',
    '           ',
    '    k *= min(smoothstep(0.05, 0.2, 1.0 - abs(fract(uv2.x*16.0)*2.0 - 1.0))',
    '         +   step(0.12, uv2.y - pow(uv2.x - 0.5, 2.0)*0.15)',
    '         +   step(-0.1, -uv2.y), 1.0);',
    '    col = mix(vec3(0.29, 0.09, 0.08)*smoothstep(-0.08, 0.08, uv.y), col, k);',
    '    ',
    '    ',
    '    ',
    '    col = mix(col, fg.rgb, fg.a);',
    '',
    '    // 原作 Image pass 的暗角效果（已合并进本 pass）',
    '    uv = fragCoord/iResolution.xy;',
    '    col *= 0.5 + 0.5*pow( 16.0*uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y), 0.2 );',
    '    fragColor = vec4(col, 1.0);',
    '}',
    '',
    'void main() {',
    '    mainImage(gl_FragColor, gl_FragCoord.xy);',
    '}'
  ].join('\n');

  // ---------- 工具函数 ----------

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('[banner-shader] shader 编译失败:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  // 生成等效于 Shadertoy 内置 RGBA Noise 的随机纹理 (1024x1024)
  function createNoiseTexture(gl) {
    var SIZE = 1024;
    var data = new Uint8Array(SIZE * SIZE * 4);
    // crypto.getRandomValues 单次上限 65536 字节，分块填充
    var CHUNK = 65536;
    for (var off = 0; off < data.length; off += CHUNK) {
      var view = data.subarray(off, Math.min(off + CHUNK, data.length));
      if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(view);
      } else {
        for (var i = 0; i < view.length; i++) view[i] = (Math.random() * 256) | 0;
      }
    }
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SIZE, SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  // ---------- 主逻辑 ----------

  function init() {
    // 厂牌主页 hero 优先，其次博客主题的首页 banner
    var header = document.querySelector('#studio-hero') || document.querySelector('#page-header.full_page');
    if (!header || document.getElementById(CANVAS_ID)) return;

    var canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' })
          || canvas.getContext('experimental-webgl', { antialias: false, alpha: false });
    if (!gl) return; // 不支持 WebGL 时保持原样

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return; // 编译失败回退为原纯色 banner

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[banner-shader] program link 失败:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    // 全屏三角形
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1i(gl.getUniformLocation(prog, 'iChannel0'), 0);
    var uRes = gl.getUniformLocation(prog, 'iResolution');
    var uTime = gl.getUniformLocation(prog, 'iTime');

    gl.activeTexture(gl.TEXTURE0);
    createNoiseTexture(gl);

    // 注入样式：canvas 铺满 banner，底部渐变过渡到页面背景色，文字保持在最上层
    var style = document.createElement('style');
    style.textContent =
      '#' + CANVAS_ID + '{position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;pointer-events:none;}' +
      '#banner-shader-fade{position:absolute;left:0;right:0;bottom:0;height:160px;z-index:1;pointer-events:none;' +
      'background:linear-gradient(to bottom, rgba(255,255,255,0), var(--global-bg, #f7f9fe));}' +
      '#page-header.full_page #site-info,#page-header.full_page #scroll-down{position:relative;z-index:2;}';
    document.head.appendChild(style);
    header.insertBefore(canvas, header.firstChild);
    var fade = document.createElement('div');
    fade.id = 'banner-shader-fade';
    header.insertBefore(fade, canvas.nextSibling);

    // 渲染分辨率：横幅面积大、shader 较重，限制到 1x，移动端进一步降低
    var isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    var scale = isMobile ? 0.6 : Math.min(window.devicePixelRatio || 1, 1);

    function resize() {
      var w = Math.max(1, Math.round(header.clientWidth * scale));
      var h = Math.max(1, Math.round(header.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }
    resize();
    window.addEventListener('resize', resize);

    var reducedMotion = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var start = performance.now();
    var rafId = 0;

    function frame() {
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      rafId = requestAnimationFrame(frame);
    }

    if (reducedMotion) {
      // 用户偏好减少动态：只渲染一帧静态画面
      frame();
      cancelAnimationFrame(rafId);
    } else {
      frame();
    }

    // 页面不可见时暂停，省电省性能
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
      } else if (!reducedMotion) {
        rafId = requestAnimationFrame(frame);
      }
    });

    // Butterfly pjax 切页后 banner 可能被重建，重新挂载
    document.addEventListener('pjax:complete', function () {
      setTimeout(function () {
        if (!document.getElementById(CANVAS_ID)) init();
      }, 0);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
