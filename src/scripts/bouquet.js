// ./scripts/bouquet.js
// ===============================================================
// Buquê 3D fixo na última section ("Cada segundo importa")
// ===============================================================
// Como funciona:
//  1. O <canvas id="bouquetCanvas"> é colocado DENTRO da .love-counter, no lado
//     esquerdo (o CSS está em _bouquet.scss). Como ele faz parte da section,
//     rola junto com ela, sem nenhum cálculo de scroll.
//  2. O buquê fica parado no centro desse canvas e só gira no próprio eixo
//     vertical. Não flutua, não balança, não anda: só gira.
//  3. Só renderiza enquanto a section está visível na tela (economiza GPU).
//  4. Só liga no desktop (> 1024px). No celular o Three.js nem é baixado.
//     Se não houver WebGL ou o .glb não existir, a section continua normal.
// ===============================================================

// GSAP já é carregado pelo index.html (script clássico, global)
const { gsap } = window;

// ---------------------------------------------------------------
// Ajustes (mexa aqui para calibrar)
// ---------------------------------------------------------------
const CONFIG = {
    // Caminho do modelo (relativo a este arquivo: scripts/ → assets/3d/)
    modelo: new URL("../assets/3d/bouquet.glb", import.meta.url).href,

    // Remove os enfeites soltos (folhas, corações e pétalas voando em volta).
    // Fica só o buquê. Quem decide é a distância até o centro do buquê.
    removerEnfeites: true,
    raioNucleo: 0.22,   // distância máxima (× tamanho total do modelo) para uma peça ficar.
                        // Ainda sobra enfeite? Diminua (0.18). Sumiu parte do buquê? Aumente (0.28).
    esconder: [],       // opcional: pedaços de nomes para remover à força. Ex.: ["heart", "leaf"]
    manter: [],         // opcional: pedaços de nomes que NUNCA são removidos

    // Tamanho: quanto do canvas o buquê ocupa (1 = encosta nas bordas do canvas).
    // O tamanho do canvas em si é controlado no _bouquet.scss.
    preenchimento: 0.92,

    // Movimento: SÓ gira no próprio eixo
    velocidadeGiro: 0.6,    // radianos por segundo (0.6 ≈ uma volta a cada 10,5 s). Negativo gira ao contrário.
    inclinacao: -0.2,       // inclinação fixa de lado, em radianos (negativo = topo inclinado para o centro da página). 0 = reto.
    olharDeCima: 0.18,      // inclinação fixa para a câmera ver as flores de cima. 0 = de frente.

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
    // (abaixo disso os contadores ocupam o centro e não sobra espaço ao lado)
    mediaQueryDesktop: "(min-width: 1025px)",
    pixelRatioMax: 1.75,
};

// ---------------------------------------------------------------
// Estado
// ---------------------------------------------------------------
let THREE = null;
let canvas, secao, html;
let renderer, scene, camera, pivo;
let reduzirMovimento;
let maiorDimensao = 1;

let montagem = null;       // promessa do carregamento (Three.js + modelo)
let montado = false;
let habilitado = false;    // desktop + modelo carregado
let visivel = false;       // a section está visível na janela (vem do IntersectionObserver)
let naTela = false;        // o loop de render está ligado
let loopLigado = false;
let giro = 0;              // ângulo atual do buquê (radianos)

// ---------------------------------------------------------------
// Tamanho do canvas e do buquê
// ---------------------------------------------------------------
function ajustarTamanho() {
    if (!montado) return;
    const largura = canvas.clientWidth;
    const altura = canvas.clientHeight;
    if (!largura || !altura) return;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.pixelRatioMax));
    renderer.setSize(largura, altura, false);
    camera.aspect = largura / altura;
    camera.updateProjectionMatrix();

    // Escala: o maior lado do buquê ocupa `preenchimento` do MENOR lado do canvas
    const alturaVisivelMundo = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const mundoPorPx = alturaVisivelMundo / altura;
    const alvoMundo = Math.min(largura, altura) * CONFIG.preenchimento * mundoPorPx;
    pivo.scale.setScalar(alvoMundo / maiorDimensao);

    if (naTela) renderer.render(scene, camera); // setSize limpa o canvas: redesenha já
}

// ---------------------------------------------------------------
// Cena: luzes, ambiente e modelo
// ---------------------------------------------------------------
function criarLuzes() {
    const L = CONFIG.luz;

    // Luz suave de todos os lados: céu rosado (cor do fundo da section) e chão coral
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

function removerEnfeitesSoltos(modelo) {
    modelo.updateMatrixWorld(true);

    const pecas = [];
    modelo.traverse((obj) => {
        if (!obj.isMesh) return;
        const caixa = new THREE.Box3().setFromObject(obj, true);
        if (caixa.isEmpty()) return;
        const tam = caixa.getSize(new THREE.Vector3());
        pecas.push({
            obj,
            nome: obj.name || "(sem nome)",
            caixa,
            centro: caixa.getCenter(new THREE.Vector3()),
            peso: tam.lengthSq() || 1e-9, // peças grandes (o buquê) pesam mais que as pequenas (enfeites)
        });
    });
    if (!pecas.length) return;

    // Centro do buquê = média dos centros das peças, ponderada pelo tamanho
    const nucleo = new THREE.Vector3();
    let somaPesos = 0;
    pecas.forEach((p) => {
        nucleo.addScaledVector(p.centro, p.peso);
        somaPesos += p.peso;
    });
    nucleo.divideScalar(somaPesos);

    const total = new THREE.Box3();
    pecas.forEach((p) => total.union(p.caixa));
    const limite = CONFIG.raioNucleo * Math.max(...total.getSize(new THREE.Vector3()).toArray());

    const tem = (lista, nome) => lista.some((t) => nome.toLowerCase().includes(t.toLowerCase()));
    const mantidas = [];
    const removidas = [];

    pecas.forEach((p) => {
        const longe = p.centro.distanceTo(nucleo) > limite;
        const remover = tem(CONFIG.esconder, p.nome) || (longe && !tem(CONFIG.manter, p.nome));
        (remover ? removidas : mantidas).push(p);
    });

    // Segurança: se a regra apagaria tudo, não mexe em nada
    if (!mantidas.length) {
        console.warn("[buquê 3D] a limpeza removeria o modelo inteiro; ignorada. Aumente raioNucleo.");
        return;
    }

    removidas.forEach((p) => p.obj.removeFromParent());
    console.log("[buquê 3D] peças mantidas:", mantidas.map((p) => p.nome));
    console.log("[buquê 3D] peças removidas:", removidas.map((p) => p.nome));
}

function prepararModelo(gltf) {
    const modelo = gltf.scene;
    if (CONFIG.removerEnfeites) removerEnfeitesSoltos(modelo);
    const anisotropia = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    modelo.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.frustumCulled = false;

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

    // "Pivô": inclinação fixa por fora, giro no próprio eixo por dentro.
    // Ordem ZXY = primeiro gira o buquê em Y (o eixo dele), depois aplica a inclinação.
    pivo = new THREE.Group();
    pivo.rotation.order = "ZXY";
    pivo.add(modelo);
    pivo.rotation.set(CONFIG.olharDeCima, 0, CONFIG.inclinacao);
    scene.add(pivo);

    // Obs.: a animação que vem dentro do .glb (corações/pétalas girando) NÃO é tocada
    // de propósito: o buquê só gira no próprio eixo.
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
        alpha: true, // o fundo rosa é o da própria section
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

    // O canvas muda de tamanho com a janela (CSS): acompanha
    new ResizeObserver(() => habilitado && ajustarTamanho()).observe(canvas);

    montado = true;
}

// ---------------------------------------------------------------
// Loop de animação (usa o ticker do GSAP, o mesmo do ScrollSmoother)
// ---------------------------------------------------------------
function quadro(tempo, deltaMs) {
    if (!habilitado || !naTela) return;

    const dt = Math.min(deltaMs, 50) / 1000;

    // Único movimento: giro no próprio eixo (parado se o sistema pede menos movimento)
    if (!reduzirMovimento.matches) giro += CONFIG.velocidadeGiro * dt;

    pivo.rotation.set(CONFIG.olharDeCima, giro, CONFIG.inclinacao);
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
    ligarLoop();
}

function sairDaTela() {
    naTela = false;
    desligarLoop();
}

// ---------------------------------------------------------------
// Liga / desliga (breakpoint)
// ---------------------------------------------------------------
function habilitar() {
    if (habilitado) return;
    habilitado = true;

    // Mostra o canvas (veja _bouquet.scss) e mede o tamanho que o CSS deu a ele
    html.classList.add("buque-ativo");
    ajustarTamanho();
    canvas.classList.add("buque-pronto"); // fade-in suave

    if (visivel) entrarNaTela();
}

function desabilitar() {
    if (!habilitado) return;
    sairDaTela();
    habilitado = false;
    canvas.classList.remove("buque-pronto");
    html.classList.remove("buque-ativo");
}

async function iniciar() {
    canvas = document.getElementById("bouquetCanvas");
    secao = document.getElementById("loveCounter");
    html = document.documentElement;

    if (!canvas || !secao || !window.gsap) return;

    // O canvas precisa ficar DENTRO da section para rolar junto com ela.
    // (Se você já moveu a tag no HTML, este passo não faz nada.)
    if (canvas.parentElement !== secao) secao.appendChild(canvas);

    reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia(CONFIG.mediaQueryDesktop);

    // Só gasta GPU enquanto a section está aparecendo
    new IntersectionObserver((entradas) => {
        visivel = entradas[entradas.length - 1].isIntersecting;
        if (visivel) entrarNaTela();
        else sairDaTela();
    }).observe(secao);

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
            // Sem WebGL ou modelo não encontrado: a section continua normal, só sem o buquê
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