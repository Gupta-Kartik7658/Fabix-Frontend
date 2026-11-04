'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { cn } from '@/lib/utils';

/** Same palettes and SVG as the landing page companions (Landing_Page/src/components/companion). */
const PALETTES = {
  white: {
    shell: '#F4F6F3',
    stroke: '#D5DBD6',
    limb: '#E6EAE6',
    joint: '#C9D1CB',
    accent: '#006039',
    glow: '#75D6A4',
  },
  pink: {
    shell: '#FBE3EC',
    stroke: '#EDC2D3',
    limb: '#F5D0DE',
    joint: '#E4B3C6',
    accent: '#C2457A',
    glow: '#FF9CC4',
  },
} as const;

export type RobotVariant = keyof typeof PALETTES;
export type RobotPose = 'idle' | 'point-left' | 'point-right' | 'point-up' | 'point-down' | 'cheer';

export function FabixRobot({
  variant = 'white',
  pose = 'idle',
  talking = false,
  cue = 0,
  enterDelay = 0,
  reduced = false,
  className,
}: {
  variant?: RobotVariant;
  pose?: RobotPose;
  talking?: boolean;
  /** Bump to make the robot react (small hop) when the step changes. */
  cue?: number;
  enterDelay?: number;
  reduced?: boolean;
  className?: string;
}) {
  const palette = PALETTES[variant];
  const svgRef = useRef<SVGSVGElement>(null);

  const part = (name: string) => svgRef.current?.querySelector<SVGGElement>(`[data-r="${name}"]`) ?? null;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || reduced) return;
    const q = (name: string) => svg.querySelector<SVGGElement>(`[data-r="${name}"]`)!;
    const body = q('body');
    const head = q('head');
    const eyes = q('eyes');
    const antenna = q('antenna');
    const chest = q('chest');
    const shadow = q('shadow');
    const legs = [q('leg-l'), q('leg-r')];
    const arms = [q('arm-l'), q('arm-r')];

    const ctx = gsap.context(() => {
      gsap.set(legs, { transformOrigin: '50% 0%' });
      gsap.set(arms, { transformOrigin: '50% 8%' });
      gsap.set(head, { transformOrigin: '50% 100%' });
      gsap.set(antenna, { transformOrigin: '50% 100%' });
      gsap.set([eyes, shadow, q('tip'), q('hearts'), q('cheeks')], { transformOrigin: '50% 50%' });

      gsap
        .timeline({ delay: enterDelay })
        .fromTo(svg, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 })
        .fromTo(body, { y: -18 }, { y: 0, duration: 0.6, ease: 'bounce.out' }, '<')
        .fromTo(shadow, { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 0.28, duration: 0.6 }, '<')
        .to(arms[1], { rotation: -150, duration: 0.25, ease: 'power2.out' })
        .to(arms[1], { rotation: -122, duration: 0.16, yoyo: true, repeat: 3, ease: 'sine.inOut' })
        .to(arms[1], { rotation: 0, duration: 0.3, ease: 'power2.inOut' });

      gsap.fromTo(antenna, { rotation: -5 }, { rotation: 5, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      gsap.to(chest, { opacity: 0.45, duration: 1.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      gsap.to(svg, { y: -3, duration: 1.9 + Math.random() * 0.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });

      const blink = () => {
        gsap
          .timeline()
          .to(eyes, { scaleY: 0.1, duration: 0.07, ease: 'power1.in' })
          .to(eyes, { scaleY: 1, duration: 0.09, ease: 'power1.out' });
        gsap.delayedCall(2.4 + Math.random() * 3, blink);
      };
      gsap.delayedCall(1.5 + Math.random() * 2, blink);
    }, svg);

    return () => ctx.revert();
  }, [reduced, enterDelay]);

  useEffect(() => {
    if (reduced || cue === 0) return;
    const body = part('body');
    const shadow = part('shadow');
    const eyes = part('eyes');
    if (!body || !shadow || !eyes) return;
    const tl = gsap
      .timeline()
      .to(body, { y: -7, duration: 0.16, ease: 'power2.out' })
      .to(shadow, { scale: 0.7, duration: 0.16 }, '<')
      .to(eyes, { scaleY: 0.45, duration: 0.12 }, '<')
      .to(body, { y: 0, duration: 0.32, ease: 'bounce.out' })
      .to(shadow, { scale: 1, duration: 0.32 }, '<')
      .to(eyes, { scaleY: 1, duration: 0.15 }, '<0.1');
    return () => {
      tl.kill();
    };
     
  }, [cue, reduced]);

  useEffect(() => {
    const armL = part('arm-l');
    const armR = part('arm-r');
    const head = part('head');
    const eyes = part('eyes');
    const hearts = part('hearts');
    const cheeks = part('cheeks');
    const body = part('body');
    if (!armL || !armR || !head || !eyes || !hearts || !cheeks || !body) return;

    const target = {
      idle: { l: 0, r: 0, head: 0, ex: 0, ey: 0 },
      'point-left': { l: 100, r: 0, head: -6, ex: -1.6, ey: 0 },
      'point-right': { l: 0, r: -100, head: 6, ex: 1.6, ey: 0 },
      'point-up': { l: 0, r: -160, head: -4, ex: 0.6, ey: -1.2 },
      'point-down': { l: 0, r: -35, head: 8, ex: 0.4, ey: 1.2 },
      cheer: { l: 150, r: -150, head: 0, ex: 0, ey: 0 },
    }[pose];

    const duration = reduced ? 0 : 0.4;
    const tl = gsap.timeline();
    tl.to(armL, { rotation: target.l, duration, ease: 'back.out(1.8)' }, 0)
      .to(armR, { rotation: target.r, duration, ease: 'back.out(1.8)' }, 0)
      .to(head, { rotation: target.head, duration, ease: 'power2.out' }, 0)
      .to(eyes, { x: target.ex, y: target.ey, duration, ease: 'power2.out' }, 0);

    if (pose === 'cheer') {
      tl.to(eyes, { opacity: 0, duration: 0.1 }, 0)
        .fromTo(hearts, { opacity: 1, scale: 0.3 }, { opacity: 1, scale: 1, duration: reduced ? 0 : 0.35, ease: 'back.out(3)' }, 0)
        .to(cheeks, { opacity: 1, duration: 0.2 }, 0);
      if (!reduced) {
        tl.to(body, { y: -7, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 5 }, 0.2).to(
          hearts,
          { scale: 1.15, duration: 0.25, yoyo: true, repeat: -1, ease: 'sine.inOut' },
          0.4,
        );
      }
    } else {
      tl.to(hearts, { opacity: 0, duration: 0.15 }, 0)
        .to(cheeks, { opacity: 0, duration: 0.2 }, 0)
        .to(eyes, { opacity: 1, duration: 0.15 }, 0);
      if (!reduced && pose !== 'idle') {
        const arm = pose === 'point-left' ? armL : armR;
        const base = pose === 'point-left' ? target.l : target.r;
        tl.to(arm, { rotation: base + (pose === 'point-left' ? 12 : -12), duration: 0.5, yoyo: true, repeat: -1, ease: 'sine.inOut' }, duration);
      }
    }
    return () => {
      tl.kill();
    };
     
  }, [pose, reduced]);

  useEffect(() => {
    if (reduced || !talking) return;
    const head = part('head');
    const tip = part('tip');
    const cheeks = part('cheeks');
    if (!head || !tip || !cheeks) return;
    const tl = gsap
      .timeline({ repeat: -1, yoyo: true })
      .to(head, { rotation: '+=4', duration: 0.22, ease: 'sine.inOut' })
      .to(tip, { scale: 1.4, duration: 0.22, ease: 'sine.inOut' }, '<');
    const glow = gsap.to(cheeks, { opacity: 0.8, duration: 0.25 });
    return () => {
      tl.revert();
      glow.kill();
      gsap.to(cheeks, { opacity: 0, duration: 0.2 });
    };
     
  }, [talking, reduced]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 48 60"
      aria-hidden
      className={cn('block shrink-0 overflow-visible', className ?? 'h-[64px] w-[51px]')}
    >
      <ellipse data-r="shadow" cx="24" cy="57.5" rx="11" ry="1.8" fill="#000" opacity="0.28" />
      <g data-r="face">
        <g data-r="body">
          <g data-r="leg-l">
            <rect x="17" y="43" width="5" height="10.5" rx="2.5" fill={palette.limb} />
            <rect x="15.5" y="52" width="7.5" height="3.6" rx="1.8" fill={palette.accent} />
          </g>
          <g data-r="leg-r">
            <rect x="26" y="43" width="5" height="10.5" rx="2.5" fill={palette.limb} />
            <rect x="25.5" y="52" width="7.5" height="3.6" rx="1.8" fill={palette.accent} />
          </g>
          <g data-r="arm-l">
            <rect x="8.6" y="29" width="4.2" height="10.5" rx="2.1" fill={palette.limb} />
            <circle cx="10.7" cy="40" r="2.3" fill={palette.accent} />
          </g>
          <g data-r="arm-r">
            <rect x="35.2" y="29" width="4.2" height="10.5" rx="2.1" fill={palette.limb} />
            <circle cx="37.3" cy="40" r="2.3" fill={palette.accent} />
          </g>
          <rect x="12" y="27" width="24" height="18.5" rx="7" fill={palette.shell} stroke={palette.stroke} strokeWidth="0.75" />
          <rect x="18.5" y="32" width="11" height="6.5" rx="2.2" fill={palette.accent} />
          <circle data-r="chest" cx="24" cy="35.25" r="1.3" fill={palette.glow} />
          <rect x="21" y="24.5" width="6" height="3.2" rx="1" fill={palette.joint} />
          <g data-r="head">
            <g data-r="antenna">
              <line x1="24" y1="8.5" x2="24" y2="3" stroke={palette.joint} strokeWidth="1.3" strokeLinecap="round" />
              <circle data-r="tip" cx="24" cy="2.6" r="1.9" fill={palette.accent} />
            </g>
            <rect x="7.8" y="13.5" width="2.8" height="7" rx="1.4" fill={palette.accent} />
            <rect x="37.4" y="13.5" width="2.8" height="7" rx="1.4" fill={palette.accent} />
            <rect x="10" y="8" width="28" height="18" rx="8" fill={palette.shell} stroke={palette.stroke} strokeWidth="0.75" />
            <rect x="13.5" y="11.5" width="21" height="11" rx="5" fill="#0E1712" />
            <g data-r="eyes">
              <rect x="18.8" y="14.5" width="3.6" height="5" rx="1.8" fill={palette.glow} />
              <rect x="27.2" y="14.5" width="3.6" height="5" rx="1.8" fill={palette.glow} />
            </g>
            <g data-r="hearts" opacity="0">
              <path d="M20.6 19.2 C17.4 17.1, 18.8 14.4, 20.6 16 C22.4 14.4, 23.8 17.1, 20.6 19.2 Z" fill={palette.glow} />
              <path d="M29 19.2 C25.8 17.1, 27.2 14.4, 29 16 C30.8 14.4, 32.2 17.1, 29 19.2 Z" fill={palette.glow} />
            </g>
            <g data-r="cheeks" opacity="0">
              <ellipse cx="16.4" cy="20.6" rx="1.7" ry="0.9" fill={palette.glow} opacity="0.55" />
              <ellipse cx="33.2" cy="20.6" rx="1.7" ry="0.9" fill={palette.glow} opacity="0.55" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
