"use client";

import {usePathname} from "next/navigation";

import {CrtScreen} from "@/components/crt/CrtScreen";
import type {Project} from "@/sanity/lib/queries";

export function ArchiveRoot({projects}: {projects: Project[]}) {
  const pathname = usePathname();
  const slug = pathname.startsWith("/work/")
    ? decodeURIComponent(pathname.slice("/work/".length).replace(/\/$/, ""))
    : null;

  return <CrtScreen projects={projects} routeSlug={slug} />;
}
