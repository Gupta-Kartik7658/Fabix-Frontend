"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { LOADER_COLORS as C, MarkGlyph, WORDMARK_SRC, prefersReducedMotion } from "@/components/loaders/fabix-mark";
import { PLATFORM_INTRO_KEY } from "@/components/loaders/platform-intro";

const MESSAGES = ["Initializing gateway", "Connecting agents", "Discovering tools", "Ready to execute"];
const CENTER = 200;

const round2 = (value: number) => Math.round(value * 100) / 100;

const polar = (radius: number, degrees: number) => {
  const angle = (degrees * Math.PI) / 180;
  return {
    x: round2(CENTER + radius * Math.cos(angle)),
    y: round2(CENTER + radius * Math.sin(angle)),
    angle: degrees,
  };
};

const OUTER = Array.from({ length: 8 }, (_, index) => polar(150, index * 45 - 67.5));
const INNER = Array.from({ length: 4 }, (_, index) => polar(80, index * 90 - 45));
const CORNERS = INNER.map((node) => polar(46, node.angle));

const OUTER_LINKS = OUTER.map((node, index) => {
  const inner = INNER[Math.floor(index / 2)];
  const control = polar(128, node.angle + (index % 2 ? -18 : 18));
  return `M ${node.x} ${node.y} Q ${control.x} ${control.y} ${inner.x} ${inner.y}`;
});
const INNER_LINKS = INNER.map((node, index) => `M ${node.x} ${node.y} L ${CORNERS[index].x} ${CORNERS[index].y}`);
const ROUTES = OUTER_LINKS.map((link, index) => {
  const corner = CORNERS[Math.floor(index / 2)];
  return `${link} L ${corner.x} ${corner.y}`;
});

type FullScreenLoaderProps = {
  minDuration?: number;
};

export function FullScreenLoader({ minDuration = 2.6 }: FullScreenLoaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    try {
      if (window.sessionStorage.getItem(PLATFORM_INTRO_KEY) === "1") {
        setDone(true);
        return;
      }
    } catch {
      // Private mode can throw. Play the intro anyway.
    }

    const html = document.documentElement;
    html.style.overflow = "hidden";
    const unlock = () => {
      html.style.overflow = "";
    };

    const q = gsap.utils.selector(root);
    const svg = root.querySelector<SVGSVGElement>("[data-engine]")!;
    const markInner = q("[data-mark-inner]")[0];
    const word = q("[data-word]")[0] as HTMLElement;
    const message = q("[data-msg]")[0] as HTMLElement;
    const status = q("[data-status]")[0] as HTMLElement;
    const bar = q("[data-bar]")[0];
    const pulse = q("[data-pulse]")[0];
    const outerNodes = q("[data-node]");
    const innerNodes = q("[data-inner-node]");
    const links = q("[data-link]");
    const innerLinks = q("[data-link-inner]");
    const rings = q("[data-ring]");
    const particles = [...root.querySelectorAll<SVGRectElement>("[data-particle]")];
    const routes = [...root.querySelectorAll<SVGPathElement>("[data-route]")];

    let introDone = false;
    let exiting = false;
    const loops: gsap.core.Animation[] = [];

    const setMessage = (text: string) => {
      if (message.textContent === text) return;
      gsap
        .timeline()
        .to(message, { autoAlpha: 0, y: -4, duration: 0.18, ease: "power1.in" })
        .call(() => {
          message.textContent = text;
        })
        .fromTo(message, { autoAlpha: 0, y: 4 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: "power2.out" });
    };

    const finish = () => {
      try {
        window.sessionStorage.setItem(PLATFORM_INTRO_KEY, "1");
      } catch {
        // Ignore storage failures. The overlay still closes.
      }
      unlock();
      setDone(true);
    };

    const ctx = gsap.context(() => {
      if (prefersReducedMotion()) {
        gsap.set([markInner, ...outerNodes, ...innerNodes], { opacity: 1 });
        gsap.set([...links, ...innerLinks, ...rings], { strokeDashoffset: 0 });
        gsap.set(bar, { scaleX: 0.6 });
        return;
      }

      const startParticles = () => {
        particles.forEach((particle, index) => {
          const route = routes[index];
          const length = route.getTotalLength();
          const state = { p: 0 };
          const alpha = index % 3 === 0 ? 1 : 0.7;
          loops.push(
            gsap.to(state, {
              p: 1,
              duration: gsap.utils.random(1.5, 2.3),
              ease: "power1.in",
              repeat: -1,
              repeatDelay: gsap.utils.random(0.2, 0.9),
              delay: index * 0.14,
              onUpdate() {
                const point = route.getPointAtLength(state.p * length);
                particle.setAttribute("transform", `translate(${point.x - 1.5} ${point.y - 1.5}) rotate(45 1.5 1.5)`);
                particle.setAttribute("opacity", String(Math.sin(Math.PI * state.p) * alpha));
              },
            }),
          );
        });
      };

      const startPulse = () => {
        loops.push(
          gsap.fromTo(
            pulse,
            { scale: 1, opacity: 0.45 },
            { scale: 1.9, opacity: 0, duration: 1.8, ease: "power2.out", repeat: -1, transformOrigin: "50% 50%" },
          ),
        );
      };

      gsap
        .timeline({ defaults: { ease: "power2.out" } })
        .fromTo(markInner, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.6, ease: "power3.out", transformOrigin: "50% 50%" }, 0)
        .fromTo("[data-mark-f]", { opacity: 0, y: 2 }, { opacity: 1, y: 0, duration: 0.4 }, 0.25)
        .fromTo(outerNodes, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.35, stagger: 0.05, ease: "back.out(2)", transformOrigin: "50% 50%" }, 0.5)
        .to(rings, { strokeDashoffset: 0, duration: 1.2, ease: "power2.inOut" }, 0.6)
        .to(links, { strokeDashoffset: 0, duration: 0.7, stagger: 0.06 }, 0.9)
        .call(startParticles, [], 1.3)
        .call(() => setMessage(MESSAGES[1]), [], 1.3)
        .fromTo(innerNodes, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.3, stagger: 0.06, ease: "back.out(2)", transformOrigin: "50% 50%" }, 1.5)
        .to(innerLinks, { strokeDashoffset: 0, duration: 0.5, stagger: 0.08 }, 1.7)
        .call(() => {
          startPulse();
          setMessage(MESSAGES[2]);
        }, [], 2.1)
        .to(bar, { scaleX: 0.35, duration: minDuration, ease: "power1.out" }, 0)
        .call(() => {
          introDone = true;
          tryExit();
        }, [], minDuration);
    }, root);

    const exit = () =>
      ctx.add(() => {
        loops.forEach((loop) => loop.kill());

        if (prefersReducedMotion()) {
          gsap.to(root, { autoAlpha: 0, duration: 0.3, onStart: unlock, onComplete: finish });
          return;
        }

        const markWidth = markInner.getBoundingClientRect().width;
        const gap = markWidth * 0.18;
        const shift = -(gap + word.offsetWidth) / 2;

        gsap
          .timeline()
          .call(() => setMessage(MESSAGES[3]), [], 0)
          .to(bar, { scaleX: 1, duration: 0.4, ease: "power2.out" }, 0)
          .to(particles, { opacity: 0, duration: 0.25 }, 0)
          .to(links, { strokeDashoffset: -1, duration: 0.5, ease: "power2.in", stagger: 0.02 }, 0.05)
          .to(rings, { strokeDashoffset: -1, duration: 0.5, ease: "power2.in" }, 0.1)
          .to(
            outerNodes,
            {
              x: (_, el: Element) => Number((el as HTMLElement).dataset.dx) * 0.75,
              y: (_, el: Element) => Number((el as HTMLElement).dataset.dy) * 0.75,
              scale: 0,
              opacity: 0,
              duration: 0.6,
              ease: "power2.in",
              stagger: 0.02,
            },
            0.1,
          )
          .to(innerLinks, { strokeDashoffset: -1, duration: 0.35, ease: "power2.in" }, 0.45)
          .to(
            innerNodes,
            {
              x: (_, el: Element) => Number((el as HTMLElement).dataset.dx) * 0.8,
              y: (_, el: Element) => Number((el as HTMLElement).dataset.dy) * 0.8,
              scale: 0,
              opacity: 0,
              duration: 0.4,
              ease: "power2.in",
            },
            0.4,
          )
          .fromTo(pulse, { scale: 1, opacity: 0.6 }, { scale: 2.4, opacity: 0, duration: 0.8, ease: "power2.out", transformOrigin: "50% 50%" }, 0.75)
          .to(markInner, { scale: 1.08, duration: 0.22, ease: "power2.out" }, 0.75)
          .to(markInner, { scale: 1, duration: 0.3, ease: "power2.inOut" }, 0.97)
          .to(status, { autoAlpha: 0, y: 6, duration: 0.35, ease: "power2.in" }, 1.1)
          .to(svg, { x: shift, duration: 0.6, ease: "power3.inOut" }, 1.2)
          .fromTo(
            word,
            { opacity: 1, x: shift + markWidth / 2 + gap - 12, clipPath: "inset(0 100% 0 0)" },
            { x: shift + markWidth / 2 + gap, clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "power3.out" },
            1.35,
          )
          .to(root, { autoAlpha: 0, duration: 0.6, ease: "power2.inOut", onStart: unlock }, 2.4)
          .call(finish);
      });

    function tryExit() {
      if (exiting || !introDone) return false;
      exiting = true;
      exit();
      return true;
    }

    if (prefersReducedMotion()) {
      introDone = true;
      tryExit();
    }

    return () => {
      loops.forEach((loop) => loop.kill());
      ctx.revert();
      unlock();
    };
  }, [minDuration]);

  if (done) return null;

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      aria-label="Loading Fabix"
      data-platform-loader
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#080D0A]"
    >
      <div className="relative">
        <svg
          data-engine
          viewBox="0 0 400 400"
          aria-hidden="true"
          className="block h-[min(72vw,360px)] w-[min(72vw,360px)]"
        >
          <circle data-ring cx={CENTER} cy={CENTER} r="150" fill="none" stroke={C.emerald} strokeOpacity="0.1" pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: 1 }} />
          <circle data-ring cx={CENTER} cy={CENTER} r="80" fill="none" stroke={C.emerald} strokeOpacity="0.16" pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: 1 }} />
          {OUTER_LINKS.map((d) => (
            <path key={d} data-link d={d} fill="none" stroke={C.emerald} strokeOpacity="0.45" strokeWidth="1" pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: 1 }} />
          ))}
          {INNER_LINKS.map((d) => (
            <path key={d} data-link-inner d={d} fill="none" stroke={C.mint} strokeOpacity="0.5" strokeWidth="1" pathLength={1} strokeDasharray="1" style={{ strokeDashoffset: 1 }} />
          ))}
          {ROUTES.map((d) => (
            <path key={d} data-route d={d} fill="none" stroke="none" />
          ))}
          {OUTER.map((node) => (
            <g key={`${node.x}-${node.y}`} data-node data-dx={CENTER - node.x} data-dy={CENTER - node.y} style={{ opacity: 0 }}>
              <rect x={node.x - 3.5} y={node.y - 3.5} width="7" height="7" rx="1.2" fill={C.surface} stroke={C.emerald} strokeWidth="1" transform={`rotate(45 ${node.x} ${node.y})`} />
            </g>
          ))}
          {INNER.map((node) => (
            <g key={`${node.x}-${node.y}`} data-inner-node data-dx={CENTER - node.x} data-dy={CENTER - node.y} style={{ opacity: 0 }}>
              <circle cx={node.x} cy={node.y} r="4" fill={C.surface} stroke={C.mint} strokeWidth="1" />
            </g>
          ))}
          {ROUTES.map((d, index) => (
            <rect key={d} data-particle width="3" height="3" fill={index % 2 ? C.emerald : C.mint} opacity="0" />
          ))}
          <circle data-pulse cx={CENTER} cy={CENTER} r="44" fill="none" stroke={C.emerald} strokeWidth="1" style={{ opacity: 0 }} />
          <g transform="translate(168 168) scale(2)">
            <g data-mark-inner style={{ opacity: 0 }}>
              <MarkGlyph />
            </g>
          </g>
        </svg>
        <span
          data-word
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -translate-y-1/2"
          style={{ opacity: 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={WORDMARK_SRC} alt="" width={424} height={120} draggable={false} className="block h-[clamp(2.1rem,9.5vw,3.4rem)] w-auto max-w-none" />
        </span>
      </div>
      <div data-status className="-mt-6 flex flex-col items-center gap-3 sm:-mt-8">
        <p data-msg className="text-sm tracking-wide text-[#98A69C]">
          {MESSAGES[0]}
        </p>
        <div className="h-px w-28 overflow-hidden bg-[#25312A]">
          <div data-bar className="h-full w-full origin-left bg-[#27A875]" style={{ transform: "scaleX(0)" }} />
        </div>
      </div>
    </div>
  );
}
