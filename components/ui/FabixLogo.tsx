import Image from 'next/image';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'full' | 'mark' | 'text';
type Tone = 'auto' | 'dark' | 'light';

const ASSETS: Record<Variant, { onDark: string; onLight: string; width: number; height: number }> = {
  full: { onDark: '/fabix-logo.png', onLight: '/fabix-logo-on-light.png', width: 529, height: 160 },
  mark: { onDark: '/fabix-mark.png', onLight: '/fabix-mark.png', width: 512, height: 512 },
  text: { onDark: '/fabix-text.png', onLight: '/fabix-text-on-light.png', width: 424, height: 120 },
};

type FabixLogoProps = {
  variant?: Variant;
  /**
   * `dark` / `light` name the surface the logo sits on. `auto` follows the
   * nearest `[data-theme="dark"]` ancestor and falls back to the light asset.
   */
  tone?: Tone;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
};

/** Fabix brand logo. Size it by height; width follows the asset's aspect ratio. */
export function FabixLogo({ variant = 'full', tone = 'auto', className, style, priority }: FabixLogoProps) {
  const asset = ASSETS[variant];
  const image = (src: string, visibility: string) => (
    <Image
      src={src}
      alt="Fabix"
      width={asset.width}
      height={asset.height}
      priority={priority}
      draggable={false}
      className={cn('h-full w-auto max-w-none select-none', visibility)}
    />
  );

  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center', className)} style={style}>
      {tone === 'dark' && image(asset.onDark, 'block')}
      {tone === 'light' && image(asset.onLight, 'block')}
      {tone === 'auto' && asset.onDark === asset.onLight && image(asset.onDark, 'block')}
      {tone === 'auto' && asset.onDark !== asset.onLight && (
        <>
          {image(asset.onLight, 'block [[data-theme=dark]_&]:hidden')}
          {image(asset.onDark, 'hidden [[data-theme=dark]_&]:block')}
        </>
      )}
    </span>
  );
}
