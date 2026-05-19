"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getAvatarColor, getInitials } from "@/lib/format/avatar";

export function Avatar({
  src,
  name,
  seed,
  size = 48,
  className,
}: {
  src?: string | null;
  name?: string | null;
  seed?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <div
      style={{ width: size, height: size }}
      className={cn(
        "relative rounded-full overflow-hidden flex items-center justify-center text-white font-semibold shrink-0",
        !showImage && getAvatarColor(seed ?? name),
        className
      )}
    >
      {showImage ? (
        <Image
          src={src!}
          alt={name ?? "Avatar"}
          width={size}
          height={size}
          unoptimized
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span style={{ fontSize: size * 0.4 }}>{getInitials(name)}</span>
      )}
    </div>
  );
}
