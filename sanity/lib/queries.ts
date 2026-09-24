import { defineQuery } from "next-sanity";

const previewImageFields = /* groq */ `
  _key,
  asset->{
    _id,
    url,
    metadata { lqip, dimensions }
  },
  hotspot,
  crop
`;

const previewVideoFields = /* groq */ `
  _key,
  asset->{
    _id,
    url,
    mimeType,
    originalFilename
  }
`;

export const PROJECTS_QUERY = defineQuery(/* groq */ `
  *[_type == "project"] | order(order asc, year desc) {
    _id,
    title,
    "slug": slug.current,
    year,
    category,
    "previewImage": select(
      defined(previewImage.asset) => [previewImage { ${previewImageFields} }],
      true => coalesce(previewImage[] { ${previewImageFields} }, [])
    ),
    "previewVideo": select(
      defined(previewVideo.asset) => [previewVideo { ${previewVideoFields} }],
      true => coalesce(previewVideo[] { ${previewVideoFields} }, [])
    ),
    shortDescription,
    description,
    role,
    tools,
    client,
    order
  }
`);

export type PreviewImage = {
  _key?: string;
  asset: {
    _id: string;
    url: string;
    metadata?: {
      lqip?: string | null;
      dimensions?: {
        width: number;
        height: number;
      } | null;
    } | null;
  } | null;
  hotspot?: unknown;
  crop?: unknown;
};

export type PreviewVideo = {
  _key?: string;
  asset: {
    _id: string;
    url: string;
    mimeType?: string | null;
    originalFilename?: string | null;
  } | null;
};

export type Project = {
  _id: string;
  title: string;
  slug: string | null;
  year: number | null;
  category: string | null;
  previewImage: PreviewImage[];
  previewVideo: PreviewVideo[];
  shortDescription: string | null;
  description: string | null;
  role: string | null;
  tools: string | null;
  client: string | null;
  order: number | null;
};
