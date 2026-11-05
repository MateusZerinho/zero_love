// ./scripts/hero_intro.js
// ===============================================================
// Animação de entrada da hero: logo + texto letra por letra
// + troca de texto animada (usada na virada do dia 5 → 6)
// ===============================================================
// Como funciona:
//  1. O SplitText (GSAP) quebra o texto em linhas, palavras e letras.
//     Cada LINHA vira uma "máscara" (recorta o que passar da altura dela).
//  2. As letras começam abaixo da máscara (invisíveis) e SOBEM uma depois da
//     outra, com um easing forte no final (expo.out).
//  3. A logo aparece antes, "subindo" junto com uma cortina que abre de baixo
//     para cima (clip-path).
//  4. Tudo espera DOIS sinais: a fonte Pacifico carregada e o pré-loader
//     começando a sumir.
//  5. autoSplit: se a janela mudar de tamanho, o texto é dividido de novo sozinho.
//  6. window.heroTrocarTexto(html): troca o texto e toca a animação de novo
//     (o main.js usa isso na virada do dia).
//  7. prefers-reduced-motion: sem animação, a hero aparece normal.
//
// Usa o GSAP e o SplitText já carregados pelo index.html (scripts globais).
// ===============================================================

(function () {
    "use strict";

    const { gsap, SplitText } = window;
    const logo = document.querySelector(".hero__logo");
    const texto = document.getElementById("heroText");

    if (!gsap || !SplitText || !logo || !texto) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(SplitText);

    // ---------------------------------------------------------------
    // Ajustes (mexa aqui para calibrar)
    // ---------------------------------------------------------------
    const CONFIG = {
        logo: {
            duracao: 1.5,
            ease: "expo.out",
            sobe: 44,            // px: de quanto abaixo ela começa
            escalaInicial: 1.14, // começa maior e "assenta" até 1
        },

        texto: {
            atraso: 0.45,     // s depois da logo começar (só na entrada da página)
            atrasoTroca: 0.1, // s de espera quando o texto é TROCADO (virada do dia)
            duracao: 1.1,     // s que CADA letra leva para subir
            ease: "expo.out",
            intervalo: 0.022, // s entre uma letra e a próxima (menor = mais rápido)
            sobe: 160,        // % da altura da letra: precisa passar da folga da máscara (veja _hero.scss)
        },

        // Se o pré-loader demorar a avisar (ou a fonte não carregar), não trava a hero
        esperaMaximaFonte: 3000, // ms
    };

    // ---------------------------------------------------------------
    // Estado inicial: esconde ANTES de qualquer coisa aparecer
    // ---------------------------------------------------------------
    gsap.set(logo, {
        clipPath: "inset(100% 0% 0% 0%)", // totalmente recortada (cortina fechada)
        y: CONFIG.logo.sobe,
        scale: CONFIG.logo.escalaInicial,
        transformOrigin: "50% 100%",
    });
    gsap.set(texto, { autoAlpha: 0 }); // volta a aparecer quando o SplitText terminar

    // ---------------------------------------------------------------
    // Sinais de "pode começar"
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

    // O main.js põe a classe "preloader--hidden" quando o pré-loader começa o fade-out
    function esperarPreloader() {
        return new Promise((resolve) => {
            const pre = document.getElementById("preloader");
            if (!pre || pre.classList.contains("preloader--hidden")) return resolve();

            const obs = new MutationObserver(() => {
                if (pre.classList.contains("preloader--hidden")) {
                    obs.disconnect();
                    resolve();
                }
            });
            obs.observe(pre, { attributes: true, attributeFilter: ["class"] });
        });
    }

    // ---------------------------------------------------------------
    // Texto: letra por letra
    // ---------------------------------------------------------------
    let liberado = false;   // o pré-loader já saiu?
    let animTexto = null;
    let split = null;       // instância atual do SplitText
    let atrasoAtual = CONFIG.texto.atraso;

    function montarTexto() {
        split = SplitText.create(texto, {
            type: "lines,words,chars",
            mask: "lines",            // cada linha recorta as letras que ainda estão "embaixo"
            linesClass: "hero__line", // a máscara fica com a classe "hero__line-mask" (veja _hero.scss)
            autoSplit: true,

            // Chamado agora e de novo sempre que o texto for re-dividido (resize).
            // A animação devolvida é revertida e retomada do mesmo ponto automaticamente.
            onSplit(self) {
                gsap.set(texto, { autoAlpha: 1 });

                animTexto = gsap.timeline({ paused: !liberado }).from(
                    self.chars,
                    {
                        yPercent: CONFIG.texto.sobe,
                        duration: CONFIG.texto.duracao,
                        ease: CONFIG.texto.ease,
                        stagger: CONFIG.texto.intervalo,
                    },
                    atrasoAtual
                );
                return animTexto;
            },
        });
    }

    // Troca o texto da hero e toca a animação letra por letra de novo.
    // Chamada pelo main.js na virada do dia.
    window.heroTrocarTexto = function (html) {
        // Sem a divisão pronta ainda (página acabou de abrir): o montarTexto
        // vai pegar o texto novo sozinho.
        if (!split) {
            texto.innerHTML = html;
            return;
        }

        // 1) desfaz a divisão atual (e a animação dela)
        if (animTexto) animTexto.kill();
        split.revert();
        split = null;

        // 2) troca o conteúdo
        texto.innerHTML = html;

        // 3) divide de novo e toca (com pouca espera: a página já está aberta)
        atrasoAtual = CONFIG.texto.atrasoTroca;
        liberado = true;
        montarTexto();
    };

    // ---------------------------------------------------------------
    // Logo: cortina que abre de baixo para cima + sobe e assenta
    // ---------------------------------------------------------------
    function animarLogo() {
        gsap.to(logo, {
            clipPath: "inset(0% 0% 0% 0%)",
            y: 0,
            scale: 1,
            duration: CONFIG.logo.duracao,
            ease: CONFIG.logo.ease,
            onComplete: () => gsap.set(logo, { clearProps: "clipPath" }),
        });
    }

    function liberar() {
        liberado = true;
        animarLogo();
        if (animTexto) animTexto.play(); // se o texto ainda não foi dividido, ele já nasce tocando
    }

    // ---------------------------------------------------------------
    // Início
    // ---------------------------------------------------------------
    function falhar(erro) {
        // Qualquer falha: mostra a hero normal em vez de deixá-la escondida
        console.warn("[hero intro] não foi possível iniciar:", erro);
        gsap.killTweensOf([logo, texto]);
        gsap.set([logo, texto], { clearProps: "all" });
    }

    try {
        esperarFonte().then(montarTexto).catch(falhar);
        esperarPreloader().then(liberar).catch(falhar);
    } catch (erro) {
        falhar(erro);
    }
})();