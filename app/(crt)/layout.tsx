import {ArchiveRoot} from "@/components/archive/ArchiveRoot";
import {client} from "@/sanity/lib/client";
import {PROJECTS_QUERY, type Project} from "@/sanity/lib/queries";

export default async function CrtLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const projects = (await client.fetch<Project[]>(PROJECTS_QUERY)) ?? [];

  return (
    <>
      <ArchiveRoot projects={projects} />
      {children}
    </>
  );
}
