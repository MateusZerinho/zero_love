// ./scripts/bouquet.js
// ===============================================================
// Buquê 3D da linha do tempo (Three.js + GSAP ScrollTrigger)
// ===============================================================
// Como funciona:
//  1. O <canvas id="bouquetCanvas"> fica FIXO e ATRÁS do conteúdo da página.
//  2. Com o buquê ativo, a .timeline fica transparente (veja _bouquet.scss).
//     Assim o canvas aparece por trás dos cards (brancos e opacos): o buquê
//     "passa por trás" deles e só aparece nos espaços vazios.
//  3. Um ScrollTrigger acompanha a .timeline__list e informa qual ponto da
//     lista está no centro da tela. A cada frame o buquê é colocado numa
//     curva em S: fica no lado VAZIO de cada card e atravessa a linha central
//     entre um card e o próximo, girando e inclinando durante a travessia.
//  4. Só liga no desktop (> 640px). No celular o Three.js nem é baixado.
// ===============================================================

// GSAP e ScrollTrigger já são carregados pelo index.html (scripts clássicos, globais)
const { gsap, ScrollTrigger } = window;

// ---------------------------------------------------------------
// Ajustes (mexa aqui para calibrar)
// ---------------------------------------------------------------
const CONFIG = {
    // Caminho do modelo (relativo a este arquivo: scripts/ → assets/3d/)
    modelo: new URL("../assets/3d/bouquet.glb", import.meta.url).href,

    // Tamanho do buquê na tela: vale o MENOR entre os três limites
    alturaMaxPx: 440,        // nunca passa disso
    alturaRelativaVh: 0.56,  // nem de 56% da altura da janela
    larguraRelativaSlot: 0.88, // nem de 88% da largura do espaço vazio ao lado do card

    // Curva em S
    pausaNoLado: 0.2,                 // 0 a 0.4: parte do trajeto em que ele fica parado ao lado do card
    giroNaTravessia: Math.PI * 2,     // volta completa ao atravessar (0 = não gira)
    inclinacaoNaTravessia: 0.32,      // quanto "deita" na direção do movimento (radianos)
    profundidadeNaTravessia: 1.4,     // afasta da câmera ao atravessar (dá sensação de profundidade)
    viradaParaOCard: 0.32,            // quanto o buquê olha para o centro quando está de lado (radianos)

    // Movimento quando está parado ao lado do card
    flutuarAmplitude: 0.03,           // proporção da altura do buquê
    flutuarVelocidade: 1.1,
    balancoYaw: 0.16,
    velocidadeAnimacaoModelo: 0.7,    // animação que já vem no .glb (corações e pétalas girando)

    // Suavização do movimento (maior = acompanha o scroll mais de perto)
    suavizacao: 6,

    // Câmera
    fov: 30,
    distanciaCamera: 10,

    // Iluminação
    luz: {
        exposicao: 1.05,      // brilho geral da imagem
        ambiente: 0.55,       // reflexos/ambiente (mapa de ambiente "RoomEnvironment")
        hemisferio: 0.45,     // luz de preenchimento suave (céu rosado / chão coral)
        principal: 2.2,       // luz principal, quente, vinda de cima à direita
        preenchimento: 0.8,   // luz rosada do lado oposto, suaviza as sombras
        contraluz: 1.6,       // luz de trás, desenha o contorno das pétalas
    },

    // Quando ligar e qualidade
    mediaQueryDesktop: "(min-width: 641px)",
    pixelRatioMax: 1.75,
};

// ---------------------------------------------------------------
// Funções matemáticas puras (sem DOM)
// ---------------------------------------------------------------
const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

function smoothstep(inicio, fim, v) {
    if (fim === inicio) return v >= fim ? 1 : 0;
    const t = clamp((v - inicio) / (fim - inicio));
    return t * t * (3 - 2 * t);
}

// Dado o ponto da lista que está no centro da tela (y), devolve onde o buquê
// deve estar. lado: -1 = esquerda, +1 = direita, valores intermediários = atravessando.
function estadoNaPosicao(y, g, cfg) {
    const n = g.centros.length;
    let lado = g.lados[0];
    let e = 0;
    let direcao = 0;

    if (n > 1 && y > g.centros[0]) {
        if (y >= g.centros[n - 1]) {
            lado = g.lados[n - 1];
        } else {
            // descobre entre quais dois cards a tela está
            let i = 0;
            while (i < n - 2 && y > g.centros[i + 1]) i++;

            const t = (y - g.centros[i]) / (g.centros[i + 1] - g.centros[i]); // 0 a 1 entre os centros
            const p = clamp((t - cfg.pausaNoLado) / (1 - 2 * cfg.pausaNoLado));
            e = easeInOutSine(p);
            lado = lerp(g.lados[i], g.lados[i + 1], e);
            direcao = Math.sign(g.lados[i + 1] - g.lados[i]);
        }
    } else if (n === 1) {
        lado = g.lados[0];
    }

    // "Presença": o buquê cresce do zero quando a lista começa e encolhe até sumir no fim
    const entrada = smoothstep(0.05 * g.alturaPx, 0.42 * g.alturaPx, y);
    const iniSaida = g.centros[n - 1] + 0.2 * g.alturaUltimo;
    const fimSaida = Math.max(iniSaida + 40, g.bordaFinal - 0.55 * g.alturaPx);
    const saida = 1 - smoothstep(iniSaida, fimSaida, y);

    return { lado, e, direcao, presenca: entrada * saida };
}

// ---------------------------------------------------------------
// Estado
// ---------------------------------------------------------------
let THREE = null;
let canvas, secao, lista, itens, html;
let renderer, scene, camera, pivo, mixer;
let reduzirMovimento;
let maiorDimensao = 1;

let montagem = null;       // promessa do carregamento (Three.js + modelo)
let montado = false;
let habilitado = false;    // desktop + modelo carregado
let naTela = false;        // a lista está visível na janela
let loopLigado = false;
let gatilho = null;
let progresso = 0;         // 0 a 1 do ScrollTrigger
let yAtual = 0;
let primeiroQuadro = true;

// Medidas do layout (recalculadas a cada refresh do ScrollTrigger)
const geo = {
    vw: 0,
    vh: 0,
    centroX: 0,
    alturaLista: 0,
    bordaFinal: 0,        // onde a .timeline termina, em coordenadas da lista
    centros: [],          // y do centro de cada card, em coordenadas da lista
    lados: [],            // lado onde o BUQUÊ fica em cada card (o lado vazio)
    alturaUltimo: 0,
    deslocamentoPx: 0,    // distância da linha central até o centro do espaço vazio
    larguraSlot: 0,
    alturaPx: 0,          // altura do buquê na tela
    mundoPorPx: 0,        // quantas unidades 3D cabem em 1px (no plano do buquê)
};

// ---------------------------------------------------------------
// Medidas e tamanho do canvas
// ---------------------------------------------------------------
function medir() {
    geo.vw = canvas.clientWidth;
    geo.vh = canvas.clientHeight;
    if (!geo.vw || !geo.vh || !camera) return;

    const retLista = lista.getBoundingClientRect();
    geo.centroX = retLista.left + retLista.width / 2;
    geo.alturaLista = lista.offsetHeight;
    geo.bordaFinal = geo.alturaLista + (parseFloat(getComputedStyle(secao).paddingBottom) || 0);

    // offsetTop/offsetLeft ignoram transform (AOS e ScrollSmoother), então são seguros
    geo.centros = itens.map((item) => item.offsetTop + item.offsetHeight / 2);
    geo.lados = itens.map((item) => (item.offsetLeft + item.offsetWidth / 2 > lista.offsetWidth / 2 ? -1 : 1));
    geo.alturaUltimo = itens[itens.length - 1].offsetHeight;

    // centro do espaço vazio = mesma distância da linha central que o centro do card
    const card = itens[0].querySelector(".timeline__card") || itens[0];
    const centroCard = itens[0].offsetLeft + card.offsetLeft + card.offsetWidth / 2;
    geo.deslocamentoPx = Math.abs(centroCard - lista.offsetWidth / 2);
    geo.larguraSlot = card.offsetWidth;

    geo.alturaPx = Math.min(
        CONFIG.alturaMaxPx,
        geo.vh * CONFIG.alturaRelativaVh,
        geo.larguraSlot * CONFIG.larguraRelativaSlot
    );

    const alturaVisivelMundo = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    geo.mundoPorPx = alturaVisivelMundo / geo.vh;
}

function ajustarTamanho() {
    const largura = canvas.clientWidth;
    const altura = canvas.clientHeight;
    if (!largura || !altura) return;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.pixelRatioMax));
    renderer.setSize(largura, altura, false);
    camera.aspect = largura / altura;
    camera.updateProjectionMatrix();
    medir();
}

// ---------------------------------------------------------------
// Cena: luzes, ambiente e modelo
// ---------------------------------------------------------------
function criarLuzes() {
    const L = CONFIG.luz;

    // Luz suave de todos os lados: céu rosado (cor do fundo da timeline) e chão coral
    const hemisferio = new THREE.HemisphereLight(0xfff1f3, 0xf77062, L.hemisferio);

    // Luz principal: quente, de cima e da direita, um pouco à frente
    const principal = new THREE.DirectionalLight(0xfff4e6, L.principal);
    principal.position.set(3.5, 5, 6);

    // Preenchimento: rosada, do lado oposto, para as sombras não ficarem pesadas
    const preenchimento = new THREE.DirectionalLight(0xffc2d1, L.preenchimento);
    preenchimento.position.set(-6, 1.5, 4);

    // Contraluz: vem de trás e de cima, desenha o contorno das pétalas
    const contraluz = new THREE.DirectionalLight(0xff9eb5, L.contraluz);
    contraluz.position.set(-2, 4, -6);

    scene.add(hemisferio, principal, preenchimento, contraluz);
}

function criarAmbiente(RoomEnvironment) {
    // Um "estúdio" virtual que gera reflexos realistas nos materiais (sem precisar de imagem HDR)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const textura = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = textura;
}

function prepararModelo(gltf) {
    const modelo = gltf.scene;
    const anisotropia = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    modelo.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.frustumCulled = false; // as partes animadas saem do volume original

        const materiais = Array.isArray(obj.material) ? obj.material : [obj.material];
        materiais.forEach((m) => {
            if (m.map) m.map.anisotropy = anisotropia;
            if (m.normalMap) m.normalMap.anisotropy = anisotropia;

            // As pétalas vêm como "BLEND", mas a textura é recorte puro (64% opaco, 36% vazio).
            // Trocar por recorte (alphaTest) evita pétalas aparecendo na ordem errada.
            if (m.transparent) {
                m.transparent = false;
                m.depthWrite = true;
                m.alphaTest = 0.5;
            }

            m.envMapIntensity = CONFIG.luz.ambiente;
            m.needsUpdate = true;
        });
    });

    // Centraliza o modelo e guarda o tamanho para escalar depois
    const caixa = new THREE.Box3().setFromObject(modelo, true);
    const centro = caixa.getCenter(new THREE.Vector3());
    const tamanho = caixa.getSize(new THREE.Vector3());
    modelo.position.sub(centro);
    maiorDimensao = Math.max(tamanho.x, tamanho.y, tamanho.z) || 1;

    // "Pivô": é ele que se move, gira e muda de escala. Ordem ZXY = inclina (Z) por fora,
    // gira o buquê no próprio eixo (Y) por dentro.
    pivo = new THREE.Group();
    pivo.rotation.order = "ZXY";
    pivo.visible = false;
    pivo.add(modelo);
    scene.add(pivo);

    // Animação que já vem no arquivo (corações e pétalas girando devagar)
    if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(modelo);
        gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
    }
}

// ---------------------------------------------------------------
// Carregamento (só acontece no desktop)
// ---------------------------------------------------------------
async function montar() {
    const [tres, gltfMod, envMod] = await Promise.all([
        import("three"),
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/environments/RoomEnvironment.js"),
    ]);
    THREE = tres;

    renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true, // o fundo rosa vem do CSS (_bouquet.scss)
        antialias: true,
        powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = CONFIG.luz.exposicao;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(CONFIG.fov, 1, 0.1, 100);
    camera.position.set(0, 0, CONFIG.distanciaCamera);

    criarLuzes();
    criarAmbiente(envMod.RoomEnvironment);

    const gltf = await new gltfMod.GLTFLoader().loadAsync(CONFIG.modelo);
    prepararModelo(gltf);

    window.addEventListener("resize", () => habilitado && ajustarTamanho());
    ScrollTrigger.addEventListener("refresh", () => habilitado && ajustarTamanho());

    montado = true;
}

// ---------------------------------------------------------------
// Loop de animação (usa o ticker do GSAP, o mesmo do ScrollSmoother)
// ---------------------------------------------------------------
function quadro(tempo, deltaMs) {
    if (!habilitado || !naTela || !geo.mundoPorPx) return;

    const dt = Math.min(deltaMs, 50) / 1000;
    const reduzir = reduzirMovimento.matches;

    // Ponto da lista que está no centro da tela (0 = topo da lista)
    const yAlvo = -geo.vh / 2 + progresso * (geo.alturaLista + geo.vh);
    if (primeiroQuadro) {
        yAtual = yAlvo;
        primeiroQuadro = false;
    } else {
        yAtual += (yAlvo - yAtual) * (1 - Math.exp(-CONFIG.suavizacao * dt));
    }

    const s = estadoNaPosicao(yAtual, geo, CONFIG);
    pivo.visible = s.presenca > 0.002;

    if (pivo.visible) {
        const dip = Math.sin(Math.PI * s.e); // 0 nos lados, 1 no meio da travessia
        const alturaMundo = geo.alturaPx * geo.mundoPorPx;

        // Posição: x na curva em S, y no centro da tela (+ flutuação), z afasta ao atravessar
        const xPx = geo.centroX + s.lado * geo.deslocamentoPx;
        const flutuar = reduzir ? 0 : Math.sin(tempo * CONFIG.flutuarVelocidade) * CONFIG.flutuarAmplitude * alturaMundo;
        pivo.position.set((xPx - geo.vw / 2) * geo.mundoPorPx, flutuar, -dip * CONFIG.profundidadeNaTravessia);

        // Tamanho: cresce do zero ao entrar e encolhe ao sair
        pivo.scale.setScalar((alturaMundo * s.presenca) / maiorDimensao);

        // Rotação
        const giro = reduzir ? 0 : CONFIG.giroNaTravessia;
        const balanco = reduzir ? 0 : Math.sin(tempo * 0.6) * CONFIG.balancoYaw;
        const yaw = -s.lado * CONFIG.viradaParaOCard + s.direcao * s.e * giro + balanco;
        const roll = reduzir ? 0 : -s.direcao * dip * CONFIG.inclinacaoNaTravessia + Math.sin(tempo * 0.9) * 0.03;
        const pitch = 0.16 + (reduzir ? 0 : Math.sin(tempo * 0.7) * 0.02);
        pivo.rotation.set(pitch, yaw, roll);

        if (mixer && !reduzir) mixer.update(dt * CONFIG.velocidadeAnimacaoModelo);
    }

    renderer.render(scene, camera);
}

function ligarLoop() {
    if (loopLigado) return;
    gsap.ticker.add(quadro);
    loopLigado = true;
}

function desligarLoop() {
    if (!loopLigado) return;
    gsap.ticker.remove(quadro);
    loopLigado = false;
}

function entrarNaTela() {
    if (!habilitado || naTela) return;
    naTela = true;
    primeiroQuadro = true; // evita o buquê "voar" desde a última posição
    ligarLoop();
}

function sairDaTela() {
    naTela = false;
    desligarLoop();
    if (montado) {
        pivo.visible = false;
        renderer.render(scene, camera); // limpa o último frame
    }
}

// ---------------------------------------------------------------
// Liga / desliga (breakpoint) e ScrollTrigger
// ---------------------------------------------------------------
function criarGatilho() {
    if (gatilho) return;
    gatilho = ScrollTrigger.create({
        trigger: lista,
        start: "top bottom", // lista começa a entrar na janela
        end: "bottom top",   // lista terminou de sair da janela
        invalidateOnRefresh: true,
        onUpdate: (self) => {
            progresso = self.progress;
        },
        onToggle: (self) => (self.isActive ? entrarNaTela() : sairDaTela()),
    });
}

function habilitar() {
    if (habilitado) return;
    habilitado = true;

    // Deixa a timeline transparente e mostra o canvas (veja _bouquet.scss)
    html.classList.add("buque-ativo");
    criarGatilho();
    ScrollTrigger.refresh(); // o padding da .timeline mudou, então recalcula as posições
    ajustarTamanho();

    progresso = gatilho.progress;
    if (gatilho.isActive) entrarNaTela();
}

function desabilitar() {
    if (!habilitado) return;
    sairDaTela();
    habilitado = false;
    html.classList.remove("buque-ativo");
    ScrollTrigger.refresh();
}

async function iniciar() {
    canvas = document.getElementById("bouquetCanvas");
    secao = document.querySelector(".timeline");
    lista = document.querySelector(".timeline__list");
    itens = Array.from(document.querySelectorAll(".timeline__item"));
    html = document.documentElement;

    if (!canvas || !secao || !lista || !itens.length || !window.gsap || !window.ScrollTrigger) return;

    reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia(CONFIG.mediaQueryDesktop);

    const sincronizar = async () => {
        try {
            if (desktop.matches) {
                if (!montagem) montagem = montar();
                await montagem;
                if (desktop.matches) habilitar();
            } else {
                desabilitar();
            }
        } catch (erro) {
            // Sem WebGL ou modelo não encontrado: a timeline continua normal, só sem o buquê
            console.warn("[buquê 3D] não foi possível iniciar:", erro);
        }
    };

    desktop.addEventListener("change", sincronizar);
    sincronizar();
}

// Espera a página carregar para não competir com imagens e vídeos do início
if (document.readyState === "complete") {
    iniciar();
} else {
    window.addEventListener("load", iniciar, { once: true });
}