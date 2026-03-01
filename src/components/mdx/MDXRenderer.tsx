import React, { useEffect, useState } from 'react'
import * as runtime from 'react/jsx-runtime'
import { compile, run } from '@mdx-js/mdx'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import { mdxComponents } from './MDXComponents'

interface MDXRendererProps {
  content: string
}

type MDXContentComponent = React.ComponentType<{ components?: Record<string, React.ComponentType<any>> }>

export const MDXRenderer: React.FC<MDXRendererProps> = ({ content }) => {
  const [Content, setContent] = useState<MDXContentComponent | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function compileMDX() {
      try {
        const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n/, '')

        const compiled = await compile(contentWithoutFrontmatter, {
          outputFormat: 'function-body',
          remarkPlugins: [remarkMath, remarkGfm],
          rehypePlugins: [rehypeKatex, rehypeHighlight],
        })

        const { default: MDXContent } = await run(String(compiled), {
          ...runtime,
          baseUrl: import.meta.url,
        })

        setContent(() => MDXContent)
        setError(null)
      } catch (err) {
        console.error('MDX compilation error:', err)
        setError(err instanceof Error ? err.message : 'Failed to compile MDX')
      }
    }

    if (content) {
      compileMDX()
    }
  }, [content])

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <p className="text-red-400">Error rendering content: {error}</p>
        <pre className="mt-2 text-xs text-slate-400 overflow-auto">{content.slice(0, 500)}...</pre>
      </div>
    )
  }

  if (!Content) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-slate-700 rounded w-3/4"></div>
        <div className="h-4 bg-slate-700 rounded w-1/2"></div>
        <div className="h-4 bg-slate-700 rounded w-5/6"></div>
      </div>
    )
  }

  return <Content components={mdxComponents} />
}
