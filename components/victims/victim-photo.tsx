"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { colorFor, initials } from "@/lib/photos/utils"

// El desvanecido está en app/globals.css (.victim-photo-fade / .victim-photo-hero):
// en celular el encabezado sólo se desvanece hacia abajo.

interface Props {
  name: string
  url?: string | null
  variant: "card" | "hero" | "avatar"
  /** Sólo avatar: lado en px. */
  size?: number
  className?: string
}

/**
 * Foto de perfil de una víctima, o sus iniciales sobre un tono fijo si no hay
 * foto (o si la imagen no carga).
 */
export function VictimPhoto({ name, url, variant, size = 40, className }: Props) {
  const [failed, setFailed] = useState(false)
  // Un link nuevo (p.ej. renovado) merece otro intento.
  useEffect(() => setFailed(false), [url])
  const showImage = !!url && !failed
  const tone = colorFor(name)
  const label = initials(name)

  if (variant === "avatar") {
    return showImage ? (
      <img
        src={url!}
        alt={`Foto de ${name}`}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    ) : (
      <span
        role="img"
        aria-label={`${name}: sin foto`}
        className={cn("flex shrink-0 items-center justify-center rounded-full font-heading font-bold", className)}
        style={{ width: size, height: size, background: tone.bg, color: tone.fg, fontSize: Math.round(size * 0.38) }}
      >
        {label}
      </span>
    )
  }

  const isHero = variant === "hero"
  const box = isHero
    ? "victim-photo-hero h-[300px] w-full rounded-t-[18px] sm:h-[320px] sm:w-[300px] sm:rounded-tr-none"
    : "victim-photo-fade h-[300px] w-full rounded-t-2xl"

  return showImage ? (
    <img
      src={url!}
      alt={`Foto de ${name}`}
      loading={isHero ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("block shrink-0 object-cover", box, className)}
    />
  ) : (
    <div
      role="img"
      aria-label={`${name}: sin foto`}
      className={cn("flex shrink-0 items-center justify-center", box, className)}
      style={{ background: tone.bg }}
    >
      <span
        className={cn("font-heading font-bold", isHero && "sm:pr-20")}
        style={{ color: tone.fg, fontSize: isHero ? 96 : 88, letterSpacing: -2, paddingBottom: isHero ? 70 : 60 }}
      >
        {label}
      </span>
    </div>
  )
}
