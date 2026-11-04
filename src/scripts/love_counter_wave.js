// ./scripts/love_counter_wave.js
// ===============================================================
// Onda nos contadores da última section ("Cada segundo importa")
// ===============================================================
// Uma "posição" (pos) vai da primeira à última caixa e volta (yoyo), sem pausa
// e sem sair do grid: ao chegar na ponta, a onda já inverte a direção, então a
// caixa da ponta não chega a descer antes de a onda voltar.
// Cada caixa sobe conforme a proximidade dela com essa posição (curva em sino),
// então a onda é contínua e suave. O CSS lê as variáveis --onda e --onda-t
// (veja _love_counter.scss).
//
// - Só anima enquanto o grid está na tela.
// - prefers-reduced-motion: sem animação.
// ===============================================================

(function () {
    "use strict";

    const { gsap } = window;
    const grid = document.querySelector(".love-counter__grid");
    if (!gsap || !grid) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const caixas = gsap.utils.toArray(".love-counter__box", grid);
    if (!caixas.length) return;

    // ---------------------------------------------------------------
    // Ajustes (mexa aqui para calibrar)
    // ---------------------------------------------------------------
    const CONFIG = {
        altura: -6,      // px que a caixa sobe no pico da onda (o hover usa -4)
        largura: 0.9,    // largura da onda, em "caixas": maior = mais caixas sobem juntas
        duracao: 1.8,    // s para a onda ir da primeira à última caixa (mesma velocidade de antes)
        ease: "sine.inOut",
    };

    // A onda começa na primeira caixa e vai até a última (sem folga fora do grid)
    const onda = { pos: 0 };

    function aplicar() {
        const dobro = 2 * CONFIG.largura * CONFIG.largura;
        caixas.forEach((caixa, i) => {
            const d = i - onda.pos;
            const forca = Math.exp(-(d * d) / dobro); // 0 a 1
            caixa.style.setProperty("--onda", (CONFIG.altura * forca).toFixed(2) + "px");
            caixa.style.setProperty("--onda-t", forca.toFixed(3));
        });
    }

    const anim = gsap.to(onda, {
        pos: caixas.length - 1,
        duration: CONFIG.duracao,
        ease: CONFIG.ease,
        repeat: -1,
        yoyo: true,
        onUpdate: aplicar,
        paused: true,
    });

    aplicar();

    // Só gasta processamento enquanto o grid aparece na tela
    new IntersectionObserver((entradas) => {
        const visivel = entradas[entradas.length - 1].isIntersecting;
        if (visivel) anim.play();
        else anim.pause();
    }).observe(grid);
})();