import { CrtScreen } from "@/components/crt/CrtScreen";
import { client } from "@/sanity/lib/client";
import { PROJECTS_QUERY, type Project } from "@/sanity/lib/queries";

export default async function Home() {
  const projects = (await client.fetch<Project[]>(PROJECTS_QUERY)) ?? [];

  return <CrtScreen projects={projects} />;
}
