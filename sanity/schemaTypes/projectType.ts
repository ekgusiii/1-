import {ProjectsIcon} from '@sanity/icons/Projects'
import {defineArrayMember, defineField, defineType} from 'sanity'

export const projectType = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  icon: ProjectsIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: '프로젝트 제목',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description: 'title을 기준으로 자동 생성됩니다',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'year',
      title: 'Year',
      type: 'number',
      description: '제작 연도',
      validation: (rule) => rule.integer().min(1900).max(2100),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      description: '프로젝트 카테고리',
    }),
    defineField({
      name: 'previewImage',
      title: 'Preview Images',
      type: 'array',
      description: '메인 화면에서 프로젝트를 보여줄 대표 이미지. + 버튼으로 여러 장을 추가할 수 있습니다.',
      of: [
        defineArrayMember({
          type: 'image',
          options: {
            hotspot: true,
          },
        }),
      ],
      options: {
        layout: 'grid',
      },
    }),
    defineField({
      name: 'previewVideo',
      title: 'Preview Videos',
      type: 'array',
      description: '메인 화면에서 사용할 프로젝트 프리뷰 영상. + 버튼으로 여러 개를 추가할 수 있습니다.',
      of: [
        defineArrayMember({
          type: 'file',
          title: 'Video',
          options: {
            accept: 'video/*',
          },
          fields: [
            defineField({
              name: 'info',
              title: 'Info',
              type: 'array',
              description: '2차 확대 화면에서 제목 아래에 표시할 라벨/값. 비워 두면 표시하지 않습니다.',
              of: [
                defineArrayMember({
                  type: 'object',
                  name: 'videoInfoLine',
                  title: 'Line',
                  fields: [
                    defineField({
                      name: 'label',
                      title: 'Label',
                      type: 'string',
                      validation: (rule) => rule.required(),
                    }),
                    defineField({
                      name: 'value',
                      title: 'Value',
                      type: 'text',
                      rows: 3,
                      validation: (rule) => rule.required(),
                    }),
                  ],
                  preview: {
                    select: {
                      title: 'label',
                      subtitle: 'value',
                    },
                  },
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'shortDescription',
      title: 'Short Description',
      type: 'text',
      description: '프로젝트에 대한 짧은 설명',
      rows: 3,
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      description: '서브 페이지 창 설명 패널에 표시할 본문',
      rows: 6,
    }),
    defineField({
      name: 'role',
      title: 'Role',
      type: 'string',
      description: '역할 (선택)',
    }),
    defineField({
      name: 'tools',
      title: 'Tools',
      type: 'string',
      description: '사용한 툴 (선택)',
    }),
    defineField({
      name: 'client',
      title: 'Client',
      type: 'string',
      description: '클라이언트 (선택)',
    }),
    defineField({
      name: 'order',
      title: 'Order',
      type: 'number',
      description: '프로젝트 노출 순서',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      year: 'year',
      category: 'category',
      media: 'previewImage.0',
    },
    prepare({title, year, category, media}) {
      return {
        title,
        subtitle: [year, category].filter(Boolean).join(' · '),
        media,
      }
    },
  },
  orderings: [
    {
      title: 'Order',
      name: 'orderAsc',
      by: [{field: 'order', direction: 'asc'}],
    },
    {
      title: 'Year, Newest',
      name: 'yearDesc',
      by: [{field: 'year', direction: 'desc'}],
    },
  ],
})
