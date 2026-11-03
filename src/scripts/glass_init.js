// ./scripts/glass_init.js
// ===============================================================
// Glass Object fixo no canto inferior esquerdo
// (mesmo tamanho do music player)
// ===============================================================
import { createGlassObject } from "./glass_object.js";

const OPCOES = {
    // O Parcel só copia arquivos referenciados no código, por isso o new URL(...)
    src: new URL("../assets/3d/logo-icon.svg", import.meta.url).href,

    ior: 1.75,                 // Refraction
    thickness: 4,              // Thickness
    roughness: 0.25,           // Frost
    dispersion: 1.5,           // Dispersion
    clearcoat: 0.5,            // Clearcoat
    tint: "",                  // sem cor = vidro transparente
    tintDensity: 2,            // Tint density
    depth: 0.1,                // Depth
    bevel: 1,                  // Bevel
    environmentIntensity: 1,   // Lighting
    highlight: "#066aff",      // brilho azul da borda

    // Câmera: fov menor + mais distante = menos distorção de perspectiva ao girar
    fov: 30,
    cameraDistance: 7.8,

    // O canvas é 1.6× maior que o player, então o objeto fica menor em unidades 3D
    // para continuar do tamanho do player na tela.
    scale: 2.55,
    yOffset: -0.3, // centraliza (a biblioteca levanta o objeto 0.3 por padrão)

    orbit: true,               // arrastar para girar
    zoom: false,               // não rouba o scroll da página
    autoRotate: false,

    onError: (erro) =>
        console.warn("[glass] não foi possível carregar o objeto:", erro),
};

// Altura usada enquanto o card do player estiver escondido (minimizado)
const ALTURA_FALLBACK_PX = 445;

function iniciar() {
    const caixa = document.getElementById("glassObject");
    const canvas = document.getElementById("glassCanvas");
    if (!caixa || !canvas) return;

    // O arrastar fica na caixa (tamanho do player), não no canvas maior
    const glass = createGlassObject({ canvas }, { ...OPCOES, controlsElement: caixa });

    // Sem WebGL: remove tudo e a página segue normal
    if (!glass) {
        caixa.remove();
        return;
    }

    // Deixa a altura da caixa igual à do card do music player.
    // Se o player estiver minimizado (altura 0), mantém a última medida.
    const card = document.querySelector(".music-player__card");
    if (card) {
        const sincronizar = () => {
            const altura = card.offsetHeight;
            caixa.style.setProperty("--glass-h", `${altura || ALTURA_FALLBACK_PX}px`);
        };
        sincronizar();
        new ResizeObserver(() => {
            if (card.offsetHeight > 0) sincronizar();
        }).observe(card);
    }
}

// Espera a página carregar para não competir com o pré-loader, vídeos e imagens
if (document.readyState === "complete") {
    iniciar();
} else {
    window.addEventListener("load", iniciar, { once: true });
}