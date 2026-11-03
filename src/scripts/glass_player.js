// ./scripts/glass_player.js
// ===============================================================
// Music player dentro de uma placa de vidro 3D
// ===============================================================
// Inspirado em https://canvas-ui.hyperplexed.io
//
// Como funciona (mesma ideia do projeto dele):
//  1. O player continua sendo HTML de verdade (botões, barra de progresso...).
//  2. O CSS3DRenderer do Three.js "pendura" esse HTML numa cena 3D e aplica a
//     MESMA câmera e o MESMO grupo de movimento da placa de vidro (WebGL).
//     Resultado: o card gira, flutua e balança colado na face da placa.
//  3. Unidade = 1 pixel CSS. Assim a placa é construída com o tamanho exato do
//     card e o card aparece em 1:1 (texto nítido) quando está de frente.
//  4. Arrastar em qualquer lugar do card gira a placa. Botões, barra de
//     progresso e links continuam funcionando normalmente.
//  5. Liga no desktop E no celular (ligarNoCelular: true), desde que haja WebGL.
//     Sem WebGL o player volta a ser o card fixo de sempre.
//     No celular o toque funciona como o mouse: arrastar sobre o card gira a placa.
// ===============================================================

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS3DRenderer, CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ---------------------------------------------------------------
// Ajustes (mexa aqui para calibrar)
// ---------------------------------------------------------------
const CONFIG = {
    // Elementos do seu HTML
    seletorPlayer: "#musicPlayer",
    seletorCard: ".music-player__card", // o "cartão" com fundo e cantos arredondados
    seletorMini: ".music-player__mini", // o disco que aparece quando o player está minimizado
    seletorAudio: "#mpAudio",

    // Em que canto da tela fica: "esquerda" ou "direita"
    lado: "direita",

    // Quando ligar
    mediaQueryDesktop: "(min-width: 641px)",
    mediaQueryCelular: "(max-width: 640px)",

    // true = a placa de vidro também aparece no celular.
    // false = no celular volta a ser o card fixo normal (como antes).
    ligarNoCelular: true,

    // Forma da placa (px). A face da placa fica colada no card.
    moldura: 6,    // vidro que aparece ao redor do card
    espessura: 14, // parede lateral reta
    chanfro: 5,    // arredondado da quina (quanto MENOR, mais "reto" e fino fica)
    raioPadrao: 22, // usado se não achar o raio de canto do card

    // Espaço extra do canvas em volta do card (1.6 = 60% maior). É a folga para a
    // placa girar sem ser cortada. Aumente se ainda cortar.
    sala: 1.6,
    salaMinima: 70, // folga mínima (px) de cada lado: vale para o disco minimizado, que é pequeno

    // Câmera: fov pequeno = pouca distorção de perspectiva ao girar
    fov: 30,

    // Movimento de repouso (flutuar e balançar)
    velocidade: 2,
    flutuar: 5,       // px para cima/baixo
    balancoX: 0.035,  // rad
    balancoY: 0.06,   // rad
    balancoZ: 0.012,  // rad

    // Vidro (mesmos valores da demo do Canvas UI)
    vidro: {
        ior: 1.75,
        roughness: 0.18,   // Frost (0 = espelho, 1 = fosco)
        dispersion: 1.5,
        clearcoat: 0.7,
        espessuraOptica: 3, // × espessura da placa (só afeta a refração)
    },
    realce: "#ff6b81",     // anel de luz: rosa quente em vez de rosa/azul frio
    // Degradê da borda de vidro: mesmas cores do card (_music_player.scss)
    borda: {
        topo: "#ffe4e9",   // rosa quase branco
        meio: "#ffc2d1",   // rosa pastel
        base: "#ff9eb5",   // rosa mais vivo
        forca: 0.7,
    },
    luz: 1,                // brilho do ambiente
    exposicao: 1,
    pixelRatioMax: 2,
    pixelRatioMaxCelular: 1.5, // vidro com transmissão é pesado: no celular rende menos pixels
};

// Elementos que NÃO devem iniciar o arrasto (continuam clicáveis)
const INTERATIVOS = "button, input, select, textarea, a, label, [data-sem-arrastar]";

// ---------------------------------------------------------------
// Ambiente de estúdio (o mesmo "quarto" virtual da demo do Canvas UI)
// ---------------------------------------------------------------
const BLOCOS = [
    { p: [-10.906, -1, 1.846], r: -0.195, s: [2.328, 7.905, 4.651] },
    { p: [-5.607, -0.754, -0.758], r: 0.994, s: [1.97, 1.534, 3.955] },
    { p: [6.167, -0.16, 7.803], r: 0.561, s: [3.927, 6.285, 3.687] },
    { p: [-2.017, 0.018, 6.124], r: 0.333, s: [2.002, 4.566, 2.064] },
    { p: [2.291, -0.756, -2.621], r: -0.286, s: [1.546, 1.552, 1.496] },
    { p: [-2.193, -0.369, -5.547], r: 0.516, s: [3.875, 3.487, 2.986] },
];

const LUZES = [
    { anel: true, i: 15, p: [2, 3, -2], s: [10, 10, 10] },
    { i: 80, p: [-14, 10, 8], s: [0.1, 2.5, 2.5] },
    { i: 80, p: [-14, 14, -4], s: [0.1, 2.5, 2.5], luz: true },
    { i: 23, p: [14, 12, 0], s: [0.1, 5, 5], luz: true },
    { i: 16, p: [0, 9, 14], s: [5, 5, 0.1], luz: true },
    { i: 80, p: [7, 8, -14], s: [2.5, 2.5, 0.1], luz: true },
    { i: 80, p: [-7, 16, -14], s: [2.5, 2.5, 0.1], luz: true },
    { i: 1, p: [0, 20, 0], s: [0.1, 0.1, 0.1], luz: true },
    { i: 20, p: [0, 15, 0], s: [10, 1, 10], luz: true },
];

function criarAmbiente(renderer, realce) {
    const sala = new THREE.Scene();
    const grupo = new THREE.Group();
    grupo.position.set(0, -0.5, 0);
    sala.add(grupo);

    for (const [x, z] of [[-15, 15], [15, 15], [15, -15], [-15, -15]]) {
        const spot = new THREE.SpotLight(0xffffff, 2, 0, 0.2, 1, 0);
        spot.position.set(x, 20, z);
        grupo.add(spot, spot.target);
    }
    const centro = new THREE.PointLight(0xffffff, 100, 28, 2);
    centro.position.set(0.5, 14, 0.5);
    grupo.add(centro);

    const caixa = new THREE.BoxGeometry();
    const casca = new THREE.Mesh(caixa, new THREE.MeshStandardMaterial({ color: "gray", side: THREE.BackSide }));
    casca.position.set(0, 13.2, 0);
    casca.scale.set(31.5, 28.5, 31.5);
    grupo.add(casca);

    const branco = new THREE.MeshStandardMaterial({ color: 0xffffff });
    for (const b of BLOCOS) {
        const m = new THREE.Mesh(caixa, branco);
        m.position.set(...b.p);
        m.rotation.set(0, b.r, 0);
        m.scale.set(...b.s);
        grupo.add(m);
    }

    for (const l of LUZES) {
        const geo = l.anel ? new THREE.RingGeometry(0.5, 1, 64) : new THREE.BoxGeometry();
        const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
        mat.color.set(l.anel ? realce : "#ffffff").multiplyScalar(l.i);
        const m = new THREE.Mesh(geo, mat);
        m.position.set(...l.p);
        m.scale.set(...l.s);
        if (l.anel) m.lookAt(0, 0, 0);
        grupo.add(m);
        if (l.luz) {
            const luz = new THREE.PointLight(0xffffff, 100, 28, 2);
            luz.position.set(...l.p);
            grupo.add(luz);
        }
    }

    const pmrem = new THREE.PMREMGenerator(renderer);
    const alvo = pmrem.fromScene(sala, 0.6, 0.1, 1000);
    pmrem.dispose();
    sala.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) o.material.dispose();
    });
    return alvo;
}

// ---------------------------------------------------------------
// Geometria da placa
// ---------------------------------------------------------------
function retanguloArredondado(w, h, r) {
    const x = -w / 2;
    const y = -h / 2;
    r = Math.max(0.01, Math.min(r, w / 2, h / 2));
    const s = new THREE.Shape();
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r);
    s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h);
    s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r);
    s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
}

// Deixa as faces da frente/trás perfeitamente planas (o suavizado só vale para o chanfro)
function achatarTampas(geo) {
    const pos = geo.getAttribute("position");
    const nor = geo.getAttribute("normal");
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const n = new THREE.Vector3();
    const ab = new THREE.Vector3();
    for (const g of geo.groups) {
        if (g.materialIndex !== 0) continue;
        for (let i = g.start; i < g.start + g.count; i += 3) {
            a.fromBufferAttribute(pos, i);
            b.fromBufferAttribute(pos, i + 1);
            c.fromBufferAttribute(pos, i + 2);
            n.subVectors(c, b).cross(ab.subVectors(a, b)).normalize();
            for (let j = 0; j < 3; j++) nor.setXYZ(i + j, n.x, n.y, n.z);
        }
    }
    nor.needsUpdate = true;
}

// Pinta a placa com o mesmo degradê vertical do card (0% → 55% → 100%)
function pintarGradiente(geo) {
    const { topo, meio, base, forca } = CONFIG.borda;
    const cTopo = new THREE.Color(topo);
    const cMeio = new THREE.Color(meio);
    const cBase = new THREE.Color(base);
    const branco = new THREE.Color(1, 1, 1);
    const c = new THREE.Color();

    geo.computeBoundingBox();
    const { min, max } = geo.boundingBox;
    const pos = geo.getAttribute("position");
    const cores = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
        const t = 1 - (pos.getY(i) - min.y) / (max.y - min.y); // 0 = topo, 1 = base
        if (t < 0.55) c.lerpColors(cTopo, cMeio, t / 0.55);
        else c.lerpColors(cMeio, cBase, (t - 0.55) / 0.45);
        c.lerp(branco, 1 - forca); // controla o quanto o vidro é tingido
        cores[i * 3] = c.r;
        cores[i * 3 + 1] = c.g;
        cores[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cores, 3));
}

// Placa com contorno externo (larg × alt) e cantos de raio `raio`.
// O chanfro faz o contorno CRESCER `chanfro` px além da forma base; compensamos
// para o tamanho final bater exatamente com larg × alt.
function criarGeometriaPlaca(larg, alt, raio) {
    const { espessura, chanfro } = CONFIG;
    const forma = retanguloArredondado(larg - 2 * chanfro, alt - 2 * chanfro, raio - chanfro);
    let geo = new THREE.ExtrudeGeometry(forma, {
        depth: espessura,
        bevelEnabled: true,
        bevelThickness: chanfro,
        bevelSize: chanfro,
        bevelOffset: 0,
        bevelSegments: 6,
        curveSegments: 24,
    });
    geo = toCreasedNormals(geo, Math.PI / 7);
    achatarTampas(geo);
    geo.translate(0, 0, -espessura / 2); // centraliza: z vai de -(e/2 + chanfro) a +(e/2 + chanfro)
    return geo;

    achatarTampas(geo);
    geo.translate(0, 0, -espessura / 2);
    pintarGradiente(geo);   // ← nova linha
    return geo;
}

// ---------------------------------------------------------------
// Estado
// ---------------------------------------------------------------
let caixa, canvas, camadaHtml;
let renderer, cssRenderer, scene, camera, controls, grupo, placa, vidro, ambiente;
let player, objetoCss, observador;
let montado = false;
let habilitado = false;
let falhou = false;
let reduzirMovimento;
let distancia = 1000;
let calma = 0; // 0 = flutuando, 1 = parado (mouse em cima do card)
let calmaAlvo = 0;
let ultimoMs = 0;
let minimizadoAntes = null;

// Qualidade de renderização: menor no celular (economiza GPU e bateria)
function pixelRatioAtual() {
    const celular = window.matchMedia(CONFIG.mediaQueryCelular).matches;
    const max = celular ? CONFIG.pixelRatioMaxCelular : CONFIG.pixelRatioMax;
    return Math.min(window.devicePixelRatio || 1, max);
}

// ---------------------------------------------------------------
// Montagem (acontece uma vez)
// ---------------------------------------------------------------
function montar() {
    caixa = document.createElement("div");
    caixa.className = "glass-player" + (CONFIG.lado === "direita" ? " glass-player--direita" : "");

    canvas = document.createElement("canvas");
    canvas.className = "glass-player__canvas";
    canvas.setAttribute("aria-hidden", "true");

    camadaHtml = document.createElement("div");
    camadaHtml.className = "glass-player__html";

    caixa.append(canvas, camadaHtml);
    document.body.appendChild(caixa);

    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
        });
    } catch (erro) {
        caixa.remove();
        throw erro;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = CONFIG.exposicao;
    renderer.setPixelRatio(pixelRatioAtual());

    cssRenderer = new CSS3DRenderer({ element: camadaHtml });

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(CONFIG.fov, 1, 1, 10000);
    camera.position.set(0, 0, 1000);

    // Tudo que se move junto (vidro + card) fica neste grupo
    grupo = new THREE.Group();
    scene.add(grupo);

    const v = CONFIG.vidro;
    vidro = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        vertexColors: true,   // ← nova linha
        metalness: 0,
        roughness: v.roughness,
        transmission: 1,
        ior: v.ior,
        dispersion: v.dispersion,
        clearcoat: v.clearcoat,
        clearcoatRoughness: 0.06,
        specularIntensity: 1,
    });
    placa = new THREE.Mesh(new THREE.BufferGeometry(), vidro);
    grupo.add(placa);

    ambiente = criarAmbiente(renderer, CONFIG.realce);
    scene.environment = ambiente.texture;
    scene.environmentIntensity = CONFIG.luz;

    controls = new OrbitControls(camera, caixa);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;

    // Botões e barra de progresso não iniciam o arrasto
    caixa.addEventListener(
        "pointerdown",
        (e) => {
            if (!e.target.closest(INTERATIVOS)) return;
            controls.enabled = false;
            const religar = () => {
                controls.enabled = true;
                window.removeEventListener("pointerup", religar);
                window.removeEventListener("pointercancel", religar);
            };
            window.addEventListener("pointerup", religar);
            window.addEventListener("pointercancel", religar);
        },
        true
    );

    observador = new ResizeObserver(() => habilitado && medir());
    montado = true;
}

// ---------------------------------------------------------------
// Medidas: o card manda; placa, camera e camadas se ajustam a ele
// ---------------------------------------------------------------
function raioDoCard() {
    // Minimizado: a placa acompanha o disco (círculo). Aberto: acompanha o card.
    const minimizado = player.classList.contains("is-collapsed");
    const el = (minimizado ? player.querySelector(CONFIG.seletorMini) : player.querySelector(CONFIG.seletorCard)) || player;
    const bruto = getComputedStyle(el).borderTopLeftRadius;
    const valor = parseFloat(bruto);
    if (!(valor > 0)) return CONFIG.raioPadrao;
    // "50%" vira metade do menor lado (a geometria limita ao máximo possível: círculo perfeito)
    return bruto.includes("%") ? (valor / 100) * Math.min(el.offsetWidth, el.offsetHeight) : valor;
}

const aquietar = () => (calmaAlvo = 1);
const soltar = () => (calmaAlvo = 0);

const par = (n) => Math.max(2, Math.round(n / 2) * 2);

function medir() {
    const w = player.offsetWidth;
    const h = player.offsetHeight;
    if (!w || !h) return;

    const { moldura, espessura, chanfro, sala, salaMinima, fov } = CONFIG;

    renderer.setPixelRatio(pixelRatioAtual());

    // Placa
    placa.geometry.dispose();
    placa.geometry = criarGeometriaPlaca(w + 2 * moldura, h + 2 * moldura, raioDoCard() + moldura);
    vidro.thickness = (espessura + 2 * chanfro) * CONFIG.vidro.espessuraOptica;

    // O card fica colado na face da frente da placa
    objetoCss.position.z = espessura / 2 + chanfro;

    // Caixa fixa do tamanho do card (o SCSS usa para posicionar)
    caixa.style.setProperty("--glass-w", `${w}px`);
    caixa.style.setProperty("--glass-h", `${h}px`);

    // Camadas (canvas + HTML) maiores que o card: folga para girar sem cortar
    const largura = par(Math.max(w * sala, w + 2 * salaMinima));
    const altura = par(Math.max(h * sala, h + 2 * salaMinima));
    canvas.style.width = `${largura}px`;
    canvas.style.height = `${altura}px`;
    renderer.setSize(largura, altura, false);
    cssRenderer.setSize(largura, altura);

    // Câmera: distância em que 1 unidade 3D = 1 pixel CSS no plano do card
    distancia = altura / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    camera.aspect = largura / altura;
    camera.fov = fov;
    camera.near = 1;
    camera.far = distancia * 4;

    // Ao minimizar/abrir, a placa volta de frente (senão o disco poderia ficar de costas)
    const minimizado = player.classList.contains("is-collapsed");
    if (minimizadoAntes !== null && minimizado !== minimizadoAntes) camera.position.set(0, 0, 1);
    minimizadoAntes = minimizado;

    // Minimizado: só o disco, sem a placa de vidro em volta
    placa.visible = !minimizado;

    // Minimizado: o disco fica sempre de frente (sem arrastar para girar)
    controls.enableRotate = !minimizado;
    caixa.classList.toggle("glass-player--fixo", minimizado);

    camera.position.setLength(distancia);
    camera.updateProjectionMatrix();
    controls.update();
}

// ---------------------------------------------------------------
// Loop
// ---------------------------------------------------------------
function quadro(agoraMs) {
    const dt = Math.min((agoraMs - ultimoMs) / 1000 || 0.016, 0.1);
    ultimoMs = agoraMs;

    // Com o mouse sobre o card, ele para de flutuar/balançar (suavemente):
    // fica fácil acertar a barra de progresso e os botões.
    calma += (calmaAlvo - calma) * (1 - Math.exp(-dt * 6));
    const k = 1 - calma;

    controls.update();

    // Minimizado: o disco não balança de lado, fica de frente (só flutua para cima e para baixo)
    const girar = player.classList.contains("is-collapsed") ? 0 : 1;

    if (!reduzirMovimento.matches) {
        const t = (agoraMs / 1000) * CONFIG.velocidade;
        grupo.rotation.x = Math.cos(t / 4) * CONFIG.balancoX * k * girar;
        grupo.rotation.y = Math.sin(t / 4) * CONFIG.balancoY * k * girar;
        grupo.rotation.z = Math.sin(t / 4) * CONFIG.balancoZ * k * girar;
        grupo.position.y = Math.sin(t / 1.5) * CONFIG.flutuar * k;
    } else {
        grupo.rotation.set(0, 0, 0);
        grupo.position.y = 0;
    }

    renderer.render(scene, camera);
    cssRenderer.render(scene, camera);
}

// ---------------------------------------------------------------
// Liga / desliga
// ---------------------------------------------------------------
function protegerAudio() {
    // Mover um <audio> no DOM pode pausá-lo. Se ele estiver dentro do player,
    // tira de lá antes (o ideal é deixá-lo fora do <aside> já no HTML).
    const audio = document.querySelector(CONFIG.seletorAudio);
    if (audio && player.contains(audio)) {
        const tocava = !audio.paused;
        document.body.appendChild(audio);
        if (tocava && audio.paused) audio.play().catch(() => {});
    }
}

function habilitar() {
    if (habilitado || falhou) return;
    player = document.querySelector(CONFIG.seletorPlayer);
    if (!player) return;

    if (!montado) montar();
    protegerAudio();

    caixa.style.display = "";
    player.classList.add("music-player--glass");
    document.documentElement.classList.add("glass-player-ativo");

    objetoCss = new CSS3DObject(player);
    grupo.add(objetoCss);
    habilitado = true;

    medir();
    cssRenderer.render(scene, camera); // já move o player para dentro da camada 3D
    observador.observe(player);
    player.addEventListener("pointerenter", aquietar);
    player.addEventListener("pointerleave", soltar);
    renderer.setAnimationLoop(quadro);
}

function desabilitar() {
    if (!habilitado) return;
    renderer.setAnimationLoop(null);
    observador.disconnect();
    player.removeEventListener("pointerenter", aquietar);
    player.removeEventListener("pointerleave", soltar);
    calma = calmaAlvo = 0;
    minimizadoAntes = null;
    habilitado = false;

    // Remover o objeto tira o elemento do DOM; devolvemos o player ao <body>
    grupo.remove(objetoCss);
    objetoCss = null;
    document.body.appendChild(player);
    player.removeAttribute("style");
    player.removeAttribute("draggable");
    player.classList.remove("music-player--glass");
    document.documentElement.classList.remove("glass-player-ativo");
    if (window.matchMedia(CONFIG.mediaQueryCelular).matches) player.classList.add("is-collapsed");

    caixa.style.display = "none";
}

function iniciar() {
    reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia(CONFIG.mediaQueryDesktop);

    const sincronizar = () => {
        try {
            if (desktop.matches || CONFIG.ligarNoCelular) habilitar();
            else desabilitar();
        } catch (erro) {
            // Sem WebGL ou algo deu errado: o player continua como card fixo normal
            falhou = true;
            console.warn("[glass player] não foi possível iniciar:", erro);
            desabilitar();
        }
    };

    desktop.addEventListener("change", sincronizar);
    sincronizar();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
} else {
    iniciar();
}