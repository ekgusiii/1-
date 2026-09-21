"use client";

import {usePathname} from "next/navigation";

import {CRTBase} from "@/components/CRTBase";
import {GhostText} from "@/components/GhostText";
import {MoireCursor} from "@/components/MoireCursor";

export function MainFx() {
  const pathname = usePathname();
  if (pathname !== "/") {
    return null;
  }

  return (
    <>
      <GhostText />
      <CRTBase />
      <MoireCursor />
    </>
  );
}
