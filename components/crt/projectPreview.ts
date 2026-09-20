import type { PreviewImage, PreviewVideo, Project } from "@/sanity/lib/queries";

export type ProjectPreviewMedia = {
  kind: "video" | "image";
  url: string;
  posterUrl?: string;
  title: string;
};

function asList<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is T => item != null);
  }

  return value ? [value] : [];
}

function assetUrl(item: { asset?: { url?: string | null } | null } | null | undefined) {
  const url = item?.asset?.url;
  return url ? url : null;
}

function firstAssetUrl(items: Array<{ asset?: { url?: string | null } | null }>) {
  for (const item of items) {
    const url = assetUrl(item);
    if (url) {
      return url;
    }
  }

  return null;
}

export function getMediaForProject(
  project: Project | null | undefined,
): ProjectPreviewMedia | null {
  if (!project) {
    return null;
  }

  const videoUrl = firstAssetUrl(asList<PreviewVideo>(project.previewVideo));
  const imageUrl = firstAssetUrl(asList<PreviewImage>(project.previewImage));

  if (videoUrl) {
    return {
      kind: "video",
      url: videoUrl,
      posterUrl: imageUrl ?? undefined,
      title: project.title,
    };
  }

  if (imageUrl) {
    return {
      kind: "image",
      url: imageUrl,
      title: project.title,
    };
  }

  return null;
}

export function getProjectPreviewMedia(
  projects: Project[],
): ProjectPreviewMedia | null {
  for (const project of projects) {
    const media = getMediaForProject(project);
    if (media) {
      return media;
    }
  }

  return null;
}

export function projectsWithPreviewMedia(projects: Project[]) {
  return projects.filter((project) => getMediaForProject(project));
}

export type GuideProgram = {
  id: string;
  channel: string;
  title: string;
  time: string;
  url: string;
  projectTitle: string;
};

function programTitle(
  video: PreviewVideo,
  project: Project,
  index: number,
) {
  const filename = video.asset?.originalFilename?.replace(/\.[^.]+$/, "");
  if (filename) {
    return filename.replace(/[-_]+/g, " ").trim().toUpperCase();
  }

  if (project.title && index === 0) {
    return project.title.toUpperCase();
  }

  return `${project.title.toUpperCase()} ${index + 1}`;
}

function programTime(index: number) {
  const startMinutes = 8 * 60 + index * 30;
  const hours = Math.floor(startMinutes / 60) % 24;
  const minutes = startMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export function getGuidePrograms(projects: Project[]): GuideProgram[] {
  const programs: GuideProgram[] = [];

  projects.forEach((project, projectIndex) => {
    const videos = asList<PreviewVideo>(project.previewVideo).filter(
      (video) => assetUrl(video),
    );

    videos.forEach((video, videoIndex) => {
      const url = assetUrl(video);
      if (!url) {
        return;
      }

      programs.push({
        id: `${project._id}:${video._key ?? videoIndex}`,
        channel: String(projectIndex + 3).padStart(2, "0"),
        title: programTitle(video, project, videoIndex),
        time: programTime(videoIndex),
        url,
        projectTitle: project.title,
      });
    });
  });

  return programs;
}
