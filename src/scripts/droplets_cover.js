// ./scripts/droplets_cover.js
// ===============================================================
// Chuva na capa do music player
// ===============================================================
// Origem do shader: https://canvasui.dev/docs/components/droplets
//
// Diferenças do original:
//  - O original usa a API experimental "html-in-canvas" (só Chrome) para capturar
//    um pedaço de HTML. Aqui o conteúdo é só a imagem da capa, então ela é usada
//    direto como textura WebGL. Funciona em qualquer navegador com WebGL2.
//  - Sem React, sem TypeScript, sem rolagem interna (uOffset) e sem o modo "sem conteúdo".
//
// Como funciona:
//  1. O JS cria um <canvas> por cima do <img> da capa (o HTML não precisa mudar).
//  2. A imagem vira textura; o shader desenha as gotas e refrata a capa através delas.
//  3. Passar o mouse sobre a capa "limpa" o vidro (como passar o dedo numa janela).
//  4. Se não houver WebGL2 (ou a imagem não puder ser lida), o canvas é removido
//     e a capa continua como imagem normal. Nada quebra.
//  5. Funciona dentro da placa de vidro 3D (glass_player.js): o canvas viaja junto com o card.
// ===============================================================

// ---------------------------------------------------------------
// Ajustes (mexa aqui para calibrar)
// ---------------------------------------------------------------
const CONFIG = {
    seletorCapa: ".music-player__cover", // a caixa quadrada que contém o <img> da capa
    classeAtiva: "music-player__cover--chuva",
    pixelRatioMax: 2,

    // Os nomes abaixo são os mesmos da documentação do Canvas UI.
    gotas: {
        intensity: 0.55,            // quantidade de chuva (0 garoa → 1.25 temporal)
        speed: 1,                   // velocidade geral da animação
        scale: 1.6,                 // tamanho do padrão: MAIOR = gotas MENORES.
                                    // (o padrão do site é 0.4, pensado para a página inteira;
                                    //  numa capa pequena precisa ser bem maior)
        dropWidth: 1,               // largura das gotas e dos rastros
        dropLength: 1,              // quão alongadas ficam as gotas
        refraction: 0.25,           // quanto a gota distorce a capa
        blur: 1.2,                  // desfoque do fundo, como vidro embaçado (0 = nítido)
        vignette: 0,                // escurece as bordas (0 a 1)
        fallSpeed: 1,               // velocidade das gotas escorrendo
        wiggle: 1,                  // quanto as gotas "balançam" para os lados
        staticDrops: 0.5,           // gotinhas paradas (padrão do site: 0.2)
        interactive: true,          // passar o mouse limpa o vidro
        interactionRadius: 0.22,    // raio da limpeza (relativo à altura da capa)
        interactionStrength: 0.6,   // força da limpeza (0 a 1)
        interactionDistortion: 3,   // distorção em volta do dedo/mouse
        tint: [1, 1, 1],            // cor sobreposta [r, g, b] de 0 a 1
        tintStrength: 0,            // força da cor (0 a 1)
    },
};

// ---------------------------------------------------------------
// Shaders (iguais aos do Canvas UI, só sem o que não usamos)
// ---------------------------------------------------------------
const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main () {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uContent;
uniform sampler2D uTrail;
uniform vec2 uResolution;
uniform vec2 uCover;        // escala para a imagem "cobrir" o quadrado (object-fit: cover)
uniform float uTime;
uniform float uIntensity;
uniform float uScale;
uniform float uDropWidth;
uniform float uDropLength;
uniform float uRefraction;
uniform float uBlur;
uniform float uVignette;
uniform float uFallSpeed;
uniform float uWiggle;
uniform float uStaticDrops;
uniform float uWipe;
uniform float uWipeDistort;
uniform vec3 uTint;
uniform float uTintStrength;

#define S(a, b, t) smoothstep(a, b, t)

vec3 N13 (float p) {
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.11369, 0.13787));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract(vec3(
        (p3.x + p3.y) * p3.z,
        (p3.x + p3.z) * p3.y,
        (p3.y + p3.z) * p3.x
    ));
}

float N (float t) {
    return fract(sin(t * 12345.564) * 7658.76);
}

float Saw (float b, float t) {
    return S(0.0, b, t) * S(1.0, b, t);
}

float sdEgg (vec2 p, float ra, float rb) {
    const float k = 1.7320508;
    p.x = abs(p.x);
    float r = ra - rb;
    return ((p.y < 0.0) ? length(vec2(p.x, p.y)) - r
          : (k * (p.x + r) < p.y) ? length(vec2(p.x, p.y - k * r))
          : length(vec2(p.x + r, p.y)) - 2.0 * r) - rb;
}

vec2 DropLayer (vec2 uv, float t) {
    vec2 UV = uv;
    vec2 a = vec2(6.0, 1.0);
    vec2 grid = a * 2.0;
    vec2 id = floor(uv * grid);

    float gridFall = N(id.x) / 3.0 + 0.5;
    uv.y += t * gridFall / a.y;
    id = floor(uv * grid);

    uv.y += N(id.x);
    id = floor(uv * grid);

    vec2 st = fract(uv * grid) - vec2(0.5, 0.0);
    vec3 n = N13(id.x * 35.2 + id.y * 2376.1);

    float x = n.x - 0.5;
    float lambda = UV.y * 20.0;
    float wiggle = sin(lambda + sin(lambda));
    x += wiggle * (0.5 - abs(x)) * (n.z - 0.5) * uWiggle;
    x *= 0.6;

    float slowStart = 0.85;
    float ti = fract(t * (gridFall + 0.1) + n.z);
    float y = (Saw(slowStart, ti) - 0.5) * 0.9 + 0.5;
    vec2 p = vec2(x, y);

    float dropShape = (ti > slowStart)
        ? -sin(6.2831853 * ti / (1.0 - slowStart)) * 0.5 - 0.5
        : 0.0;
    float d = sdEgg((st - p) * a.yx / vec2(uDropWidth, uDropLength), 0.0, dropShape);

    float diameter = N(id.x + id.y) / 7.0 + 0.2;
    float mainDrop = S(diameter / 1.5, 0.0, d);

    float r2 = S(1.0, y, st.y);
    float r = sqrt(r2);
    float cd = abs(st.x - x);
    float thickness = diameter * 0.95 * uDropWidth;
    float trail = S(thickness * r, 0.0, cd);
    float trailFront = S(-0.02, 0.02, st.y - y);
    trail *= r2 * trailFront * 0.5;

    y = UV.y;
    float trail2 = S((thickness - 0.15) * r, 0.0, cd);
    trail2 *= trailFront * n.z;

    float rndX = N(id.x) / 1.5 + 0.5;
    float rndY = N(st.y) / 40.0 + 0.05;
    y = fract(y * 11.0 * rndX) + (st.y - 0.5);
    float dd = length(st - vec2(x, y));
    float droplets = S(trail2 + rndY, 0.0, dd);

    float m = mainDrop + droplets * r * trailFront;
    return vec2(m, trail);
}

float StaticDrops (vec2 uv, float t) {
    uv *= 40.0;
    vec2 id = floor(uv);
    vec3 n = N13(id.x * 107.45 + id.y * 3543.654);
    vec2 p = (n.xy - 0.5) * 0.6;
    uv = fract(uv) - 0.5;
    float d = length(uv - p);
    float drop = S(0.3 * clamp(uDropWidth, 0.4, 1.4), 0.0, d);
    float fade = Saw(0.1, fract(t + n.y));
    float intensity = fract(n.x * 27.0);
    return drop * fade * intensity;
}

vec2 Drops (vec2 uv, float t, float tFall, float l0, float l1, float l2, float wipe) {
    float s = StaticDrops(uv, t) * l0 * (1.0 - wipe);
    vec2 m1 = DropLayer(uv, tFall) * (l1 * (1.0 - wipe * 0.8));
    vec2 m2 = DropLayer(uv * 1.85, tFall) * (l2 * (1.0 - wipe * 0.8));
    float c = s + m1.x + m2.x;
    c = S(0.3, 1.0, c);
    return vec2(c, m1.y + m2.y);
}

void main () {
    vec2 uv = vUv;
    vec2 aspectUv = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

    float t = uTime * 0.2;
    float dropScale = clamp(min(uResolution.x, uResolution.y) / 900.0, 0.75, 1.35) * uScale;
    vec2 scaledUv = aspectUv * dropScale;

    float rainAmount = clamp(uIntensity, 0.0, 1.25);
    float staticDrops = S(-0.5, 1.0, rainAmount) * 2.0 * uStaticDrops;
    float layer1 = S(0.25, 0.75, rainAmount);
    float layer2 = S(0.0, 0.5, rainAmount);
    float tFall = t * uFallSpeed;

    float wipeMask = texture(uTrail, uv).r;
    float wipe = wipeMask * clamp(uWipe, 0.0, 1.0);

    vec2 c = Drops(scaledUv, t, tFall, staticDrops, layer1, layer2, wipe);
    vec2 e = vec2(0.001, 0.0);
    float cx = Drops(scaledUv + e, t, tFall, staticDrops, layer1, layer2, wipe).x;
    float cy = Drops(scaledUv + e.yx, t, tFall, staticDrops, layer1, layer2, wipe).x;
    vec2 normal = vec2(cx - c.x, cy - c.x);

    vec2 e2 = vec2(0.012, 0.0);
    float wx = texture(uTrail, uv + e2).r;
    float wy = texture(uTrail, uv + e2.yx).r;
    normal += vec2(wipeMask - wx, wipeMask - wy) * 0.05 * uWipeDistort * clamp(uWipe, 0.0, 1.0);

    vec2 refractedUv = clamp(uv + normal * uRefraction, vec2(0.001), vec2(0.996, 0.999));

    float fog = clamp(uBlur, 0.0, 8.0) * mix(0.7, 1.0, rainAmount);
    float back = fog * (1.0 - clamp(c.y * 2.0, 0.0, 1.0)) * (1.0 - wipe);
    float focus = mix(back, 0.0, S(0.1, 0.2, c.x));

    // y invertido (a textura da imagem começa pelo topo) + ajuste de "cover"
    vec2 texUv = (vec2(refractedUv.x, 1.0 - refractedUv.y) - 0.5) * uCover + 0.5;
    vec3 col = textureLod(uContent, texUv, focus).rgb;

    col = mix(col, uTint, clamp(uTintStrength, 0.0, 1.0) * 0.35);

    vec2 vignetteUv = uv - 0.5;
    col *= 1.0 - dot(vignetteUv, vignetteUv) * clamp(uVignette, 0.0, 1.0) * 2.0;

    outColor = vec4(col, 1.0);
}`;

// Passo que guarda por onde o mouse "limpou" o vidro (e vai secando aos poucos)
const TRAIL_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uPrev;
uniform vec2 uFrom;
uniform vec2 uTo;
uniform float uAspect;
uniform float uRadius;
uniform float uDecay;
uniform float uDrain;
uniform float uSplat;

float capsule (vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
}

void main () {
    float prev = max(texture(uPrev, vUv).r * uDecay - uDrain, 0.0);
    vec2 p = vec2(vUv.x * uAspect, vUv.y);
    vec2 a = vec2(uFrom.x * uAspect, uFrom.y);
    vec2 b = vec2(uTo.x * uAspect, uTo.y);
    float d = capsule(p, a, b);
    float m = smoothstep(uRadius, uRadius * 0.5, d) * uSplat;
    outColor = vec4(max(prev, m), 0.0, 0.0, 1.0);
}`;

// ---------------------------------------------------------------
// Efeito
// ---------------------------------------------------------------
// criarGotas(canvas, imagem, opções, aoPerderContexto) → { setOptions, resize, destroy } | null
function criarGotas(canvas, imagem, opcoes, aoPerderContexto) {
    const cfg = { ...opcoes };

    const gl = canvas.getContext("webgl2", {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
    });
    if (!gl || gl.isContextLost()) return null;

    function compilar(tipo, texto) {
        const shader = gl.createShader(tipo);
        gl.shaderSource(shader, texto);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error("shader: " + gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    function ligarPrograma(fragmento) {
        const programa = gl.createProgram();
        gl.attachShader(programa, vertice);
        gl.attachShader(programa, fragmento);
        gl.linkProgram(programa);
        if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
            throw new Error("programa: " + gl.getProgramInfoLog(programa));
        }
        const u = {};
        const total = gl.getProgramParameter(programa, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < total; i++) {
            const info = gl.getActiveUniform(programa, i);
            u[info.name] = gl.getUniformLocation(programa, info.name);
        }
        return { programa, u };
    }

    const vertice = compilar(gl.VERTEX_SHADER, VERT);
    const fragChuva = compilar(gl.FRAGMENT_SHADER, FRAG);
    const fragRastro = compilar(gl.FRAGMENT_SHADER, TRAIL_FRAG);
    const { programa, u } = ligarPrograma(fragChuva);
    const { programa: programaRastro, u: uRastro } = ligarPrograma(fragRastro);

    // Quadrado que cobre a tela toda
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Textura = a capa do disco
    const texConteudo = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texConteudo);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Pode lançar SecurityError (página aberta como file://) ou falhar se a imagem for enorme.
    // Quem chamou captura o erro e deixa a capa como imagem normal.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imagem);
    gl.generateMipmap(gl.TEXTURE_2D);

    const proporcaoImagem = (imagem.naturalWidth || 1) / (imagem.naturalHeight || 1);
    const cobrir = [1, 1];

    // ----- Tamanho -----
    function sincronizarTamanho() {
        const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1.5), CONFIG.pixelRatioMax);
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        // "object-fit: cover": corta o lado que sobra da imagem
        const proporcaoCanvas = w / h;
        cobrir[0] = Math.min(1, proporcaoCanvas / proporcaoImagem);
        cobrir[1] = Math.min(1, proporcaoImagem / proporcaoCanvas);
    }
    sincronizarTamanho();

    // ----- Rastro do mouse (dois buffers que se alternam) -----
    let rastroW = 0;
    let rastroH = 0;
    const rastroTex = [];
    const rastroFbo = [];
    let rastroIdx = 0;

    function prepararRastro() {
        const w = Math.max(1, Math.round(canvas.width / 4));
        const h = Math.max(1, Math.round(canvas.height / 4));
        if (w === rastroW && h === rastroH && rastroTex.length) return;
        rastroW = w;
        rastroH = h;
        rastroTex.forEach((t) => gl.deleteTexture(t));
        rastroFbo.forEach((f) => gl.deleteFramebuffer(f));
        rastroTex.length = 0;
        rastroFbo.length = 0;

        for (let i = 0; i < 2; i++) {
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            const fbo = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            rastroTex.push(tex);
            rastroFbo.push(fbo);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    const ponteiro = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, visto: false, moveu: false };

    function atualizarRastro(delta) {
        prepararRastro();
        gl.useProgram(programaRastro);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, rastroTex[rastroIdx]);
        gl.uniform1i(uRastro.uPrev, 0);
        gl.uniform1f(uRastro.uDecay, Math.exp(-delta * 0.5));
        gl.uniform1f(uRastro.uDrain, delta * 0.3);
        gl.uniform1f(uRastro.uAspect, canvas.width / Math.max(canvas.height, 1));
        gl.uniform2f(uRastro.uFrom, ponteiro.px, ponteiro.py);
        gl.uniform2f(uRastro.uTo, ponteiro.x, ponteiro.y);
        gl.uniform1f(uRastro.uRadius, Math.max(cfg.interactionRadius, 0.01));
        gl.uniform1f(uRastro.uSplat, cfg.interactive && ponteiro.moveu ? 1 : 0);

        gl.bindFramebuffer(gl.FRAMEBUFFER, rastroFbo[1 - rastroIdx]);
        gl.viewport(0, 0, rastroW, rastroH);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        rastroIdx = 1 - rastroIdx;
        ponteiro.px = ponteiro.x;
        ponteiro.py = ponteiro.y;
        ponteiro.moveu = false;
    }

    // ----- Desenho -----
    function desenhar(tempoSeg) {
        gl.useProgram(programa);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texConteudo);
        gl.uniform1i(u.uContent, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, rastroTex[rastroIdx]);
        gl.uniform1i(u.uTrail, 1);

        gl.uniform2f(u.uResolution, canvas.width, canvas.height);
        gl.uniform2f(u.uCover, cobrir[0], cobrir[1]);
        gl.uniform1f(u.uTime, tempoSeg);
        gl.uniform1f(u.uIntensity, cfg.intensity);
        gl.uniform1f(u.uScale, Math.max(cfg.scale, 0.01));
        gl.uniform1f(u.uDropWidth, Math.max(cfg.dropWidth, 0.05));
        gl.uniform1f(u.uDropLength, Math.max(cfg.dropLength, 0.05));
        gl.uniform1f(u.uRefraction, cfg.refraction);
        gl.uniform1f(u.uBlur, Math.max(cfg.blur, 0));
        gl.uniform1f(u.uVignette, cfg.vignette);
        gl.uniform1f(u.uFallSpeed, cfg.fallSpeed);
        gl.uniform1f(u.uWiggle, cfg.wiggle);
        gl.uniform1f(u.uStaticDrops, cfg.staticDrops);
        gl.uniform1f(u.uWipe, cfg.interactive ? Math.min(Math.max(cfg.interactionStrength, 0), 1) : 0);
        gl.uniform1f(u.uWipeDistort, Math.max(cfg.interactionDistortion, 0));
        gl.uniform3f(u.uTint, cfg.tint[0], cfg.tint[1], cfg.tint[2]);
        gl.uniform1f(u.uTintStrength, cfg.tintStrength);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // ----- Loop -----
    const movimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let ultimo = 0;
    // Começa "adiantado" para a capa já nascer com gotas escorrendo (e não vazia)
    let tempo = 20 + Math.random() * 50;
    let rodando = false;
    let visivel = true;
    let destruido = false;

    function quadro(agora) {
        if (destruido) return;
        // Player minimizado (display: none) ou fora da tela: para de gastar GPU
        if (!visivel || canvas.clientWidth === 0) {
            rodando = false;
            return;
        }
        const delta = Math.min((agora - ultimo) / 1000, 1 / 30);
        ultimo = agora;
        tempo += delta * cfg.speed;

        atualizarRastro(delta);
        desenhar(tempo);

        // Quem pediu menos movimento recebe um quadro parado
        if (movimentoReduzido.matches) {
            rodando = false;
            return;
        }
        raf = requestAnimationFrame(quadro);
    }

    function ligar() {
        if (destruido || rodando || !visivel) return;
        rodando = true;
        ultimo = performance.now();
        raf = requestAnimationFrame(quadro);
    }

    // ----- Observadores -----
    const observadorTamanho = new ResizeObserver(() => {
        sincronizarTamanho();
        ligar();
    });
    observadorTamanho.observe(canvas);

    const observadorVisao = new IntersectionObserver((entradas) => {
        visivel = entradas[entradas.length - 1]?.isIntersecting ?? true;
        if (visivel) ligar();
    });
    observadorVisao.observe(canvas);

    // ----- Mouse -----
    // offsetX/offsetY já vêm no sistema de coordenadas do próprio canvas, então continuam
    // certos mesmo com a placa de vidro girando em 3D (getBoundingClientRect erraria).
    function aoMover(e) {
        if (!cfg.interactive || movimentoReduzido.matches) return;
        const x = e.offsetX / Math.max(canvas.offsetWidth, 1);
        const y = 1 - e.offsetY / Math.max(canvas.offsetHeight, 1);
        if (!ponteiro.visto) {
            ponteiro.visto = true;
            ponteiro.px = x;
            ponteiro.py = y;
        }
        ponteiro.x = x;
        ponteiro.y = y;
        ponteiro.moveu = true;
        ligar();
    }
    const aoSair = () => (ponteiro.visto = false);
    canvas.addEventListener("pointermove", aoMover, { passive: true });
    canvas.addEventListener("pointerleave", aoSair, { passive: true });

    // Se o navegador derrubar o contexto WebGL, volta a mostrar a imagem normal
    canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        destruir();
        aoPerderContexto?.();
    });

    function destruir() {
        destruido = true;
        cancelAnimationFrame(raf);
        observadorTamanho.disconnect();
        observadorVisao.disconnect();
        canvas.removeEventListener("pointermove", aoMover);
        canvas.removeEventListener("pointerleave", aoSair);
    }

    ligar();

    return {
        setOptions(proximas) {
            Object.assign(cfg, proximas);
            ligar();
        },
        resize() {
            sincronizarTamanho();
            ligar();
        },
        destroy() {
            destruir();
            gl.getExtension("WEBGL_lose_context")?.loseContext();
        },
    };
}

// ---------------------------------------------------------------
// Ligação com o music player
// ---------------------------------------------------------------
function iniciar() {
    const capa = document.querySelector(CONFIG.seletorCapa);
    const img = capa?.querySelector("img");
    if (!capa || !img) return;

    const subir = () => {
        const canvas = document.createElement("canvas");
        canvas.className = "music-player__cover-canvas";
        canvas.setAttribute("aria-hidden", "true");
        capa.appendChild(canvas);

        const voltarParaImagem = () => {
            capa.classList.remove(CONFIG.classeAtiva);
            canvas.remove();
        };

        let gotas = null;
        try {
            gotas = criarGotas(canvas, img, CONFIG.gotas, voltarParaImagem);
        } catch (erro) {
            // Sem WebGL2, imagem bloqueada, shader recusado...: a capa segue como imagem normal
            console.warn("[chuva na capa] não foi possível iniciar:", erro);
        }

        if (!gotas) {
            voltarParaImagem();
            return;
        }

        capa.classList.add(CONFIG.classeAtiva); // o CSS faz o canvas aparecer por cima da imagem

        // Para calibrar pelo console:  gotasCapa.setOptions({ intensity: 0.9, scale: 2 })
        window.gotasCapa = gotas;
    };

    if (img.complete && img.naturalWidth) subir();
    else img.addEventListener("load", subir, { once: true });
}

// Espera a página carregar para não competir com o pré-loader, vídeos e imagens
if (document.readyState === "complete") {
    iniciar();
} else {
    window.addEventListener("load", iniciar, { once: true });
}