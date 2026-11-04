// ./scripts/titulos_reveal.js
// ===============================================================
// Títulos das seções: texto letra por letra ao entrar na tela
// ===============================================================
// É a mesma animação da hero (hero_intro.js), mas aqui ela dispara quando o título
// aparece na janela, enquanto a pessoa rola a página.
//
// Como funciona:
//  1. Cada título é dividido em linhas / palavras / letras (SplitText) e cada linha
//     vira uma máscara. As letras começam abaixo da máscara e SOBEM uma depois da outra.
//  2. Um ScrollTrigger espera o título chegar na altura combinada (campo "inicio")
//     e toca a animação UMA vez (once: true). Rolar de volta não repete.
//  3. Antes disso o título fica escondido, para não aparecer inteiro e depois "piscar".
//  4. autoSplit: se a janela mudar de tamanho e as linhas quebrarem de outro jeito,
//     o texto é dividido de novo sozinho, sem reiniciar a animação.
//  5. prefers-reduced-motion: sem animação, os títulos aparecem normais.
//
// Usa GSAP, ScrollTrigger e SplitText já carregados pelo index.html (scripts globais).
// Carregue DEPOIS do main.js (que cria o ScrollSmoother e o pin da seção "Anos na escola").
// ===============================================================

(function () {
    "use strict";

    const { gsap, ScrollTrigger, SplitText } = window;
    if (!gsap || !ScrollTrigger || !SplitText) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger, SplitText);

    // ---------------------------------------------------------------
    // Ajustes (mexa aqui para calibrar)
    // ---------------------------------------------------------------
    const CONFIG = {
        // Mesmos valores da hero (hero_intro.js), para a animação ser igual em todo o site
        duracao: 1.1,       // s que CADA letra leva para subir
        ease: "expo.out",
        intervalo: 0.022,   // s entre uma letra e a próxima (menor = mais rápido)
        sobe: 160,          // % da altura da letra: precisa passar da folga da máscara (veja _texto_reveal.scss)

        esperaMaximaFonte: 3000, // ms: se a fonte não carregar, não trava os títulos
    };

    // Títulos que recebem a animação.
    //   seletor  → o título
    //   inicio   → "posição-do-título posição-da-janela". "top 85%" = quando o topo do
    //              título chega a 85% da altura da janela (ou seja, entrou um pouquinho).
    //   gatilho  → (opcional) outro elemento que decide o momento, no lugar do título.
    const ALVOS = [
        // Esta seção é PINADA (main.js): o título fica dentro de um elemento que o ScrollTrigger
        // prende e move, o que bagunça a medida. Usar a SEÇÃO como gatilho é mais seguro.
        // "top 45%" = a seção já está na metade de cima da janela, com o título à vista.
        { seletor: ".sectionPai h1", gatilho: ".sectionPai", inicio: "top 45%" },

        { seletor: ".timeline__title", inicio: "top 85%" },
        { seletor: ".love-counter__title", inicio: "top 85%" },
    ];

    // ---------------------------------------------------------------
    // Fonte: espera a Pacifico (senão as linhas seriam medidas com a fonte errada)
    // ---------------------------------------------------------------
    function esperarFonte() {
        if (!document.fonts) return Promise.resolve();

        const carregou = Promise.all([
            document.fonts.load('40px "Pacifico"'),
            document.fonts.ready,
        ]).catch(() => {});

        const limite = new Promise((resolve) => setTimeout(resolve, CONFIG.esperaMaximaFonte));
        return Promise.race([carregou, limite]);
    }

    // ---------------------------------------------------------------
    // Um título: divide, anima e espera o gatilho
    // ---------------------------------------------------------------
    function montar(alvo) {
        let liberado = false; // o título já chegou na altura do gatilho?
        let anim = null;

        SplitText.create(alvo.el, {
            type: "lines,words,chars",
            mask: "lines",             // cada linha recorta as letras que ainda estão "embaixo"
            linesClass: "reveal__line", // a máscara fica com a classe "reveal__line-mask" (veja _texto_reveal.scss)
            autoSplit: true,

            // Chamado agora e de novo sempre que o texto for re-dividido (resize).
            // A animação devolvida é revertida e retomada do mesmo ponto automaticamente.
            onSplit(self) {
                gsap.set(alvo.el, { autoAlpha: 1 });

                anim = gsap.timeline({ paused: !liberado }).from(self.chars, {
                    yPercent: CONFIG.sobe,
                    duration: CONFIG.duracao,
                    ease: CONFIG.ease,
                    stagger: CONFIG.intervalo,
                });
                return anim;
            },
        });

        ScrollTrigger.create({
            trigger: alvo.gatilho || alvo.el,
            start: alvo.inicio,
            once: true,
            onEnter() {
                liberado = true;
                if (anim) anim.play(); // se o texto ainda não foi dividido, ele já nasce tocando
            },
        });
    }

    // ---------------------------------------------------------------
    // Início
    // ---------------------------------------------------------------
    const alvos = ALVOS.map((a) => ({
        ...a,
        el: document.querySelector(a.seletor),
        gatilho: a.gatilho ? document.querySelector(a.gatilho) : null,
    })).filter((a) => a.el);

    if (!alvos.length) return;

    // Esconde ANTES de qualquer coisa aparecer (volta quando o SplitText terminar)
    alvos.forEach((a) => {
        a.el.classList.add("texto-reveal");
        gsap.set(a.el, { autoAlpha: 0 });
    });

    function falhar(erro) {
        // Qualquer falha: mostra os títulos normais em vez de deixá-los escondidos
        console.warn("[títulos reveal] não foi possível iniciar:", erro);
        alvos.forEach((a) => {
            gsap.killTweensOf(a.el);
            gsap.set(a.el, { clearProps: "all" });
        });
    }

    try {
        esperarFonte()
            .then(() => alvos.forEach(montar))
            .catch(falhar);
    } catch (erro) {
        falhar(erro);
    }
})();