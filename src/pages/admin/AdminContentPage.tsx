import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  Cloud,
  ExternalLink,
  FileText,
  FolderOpen,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function AdminContentPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <header className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.06]">
        <Link to="/admin" className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-400">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Content Management</h1>
          <p className="text-sm text-slate-400">
            Content is now managed via S3/CDN
          </p>
        </div>
      </header>

      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card variant="neumorph">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-cyan-400" />
                CDN-Based Content System
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-slate-300">
                    <p className="font-medium text-white mb-2">Content Architecture Update</p>
                    <p>
                      Learning content (tracks, modules, lessons, and quizzes) is now loaded
                      directly from S3/CloudFront CDN instead of DynamoDB. This provides:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-slate-400">
                      <li>Faster content delivery via edge caching</li>
                      <li>Better support for rich MDX content</li>
                      <li>Version control through Git workflows</li>
                      <li>Lower database costs</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-3 mb-3">
                    <FolderOpen className="w-6 h-6 text-yellow-400" />
                    <h3 className="font-medium text-white">Content Location</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    Content files are stored in the <code className="px-1.5 py-0.5 rounded bg-neumorph-base text-cyan-400">app_content/</code> directory
                    and synced to S3.
                  </p>
                  <div className="text-xs font-mono text-slate-500 bg-neumorph-base p-3 rounded-lg">
                    <div>app_content/</div>
                    <div className="ml-4">lessons/</div>
                    <div className="ml-8">index.json</div>
                    <div className="ml-8">track-id/</div>
                    <div className="ml-12">module-id/</div>
                    <div className="ml-16">lesson-id/</div>
                    <div className="ml-20">meta.json</div>
                    <div className="ml-20">content.mdx</div>
                    <div className="ml-20">quiz.json</div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-3 mb-3">
                    <FileText className="w-6 h-6 text-cyan-400" />
                    <h3 className="font-medium text-white">Content Service</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    The content is loaded via <code className="px-1.5 py-0.5 rounded bg-neumorph-base text-cyan-400">src/services/content.ts</code>
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400"></span>
                      <span className="text-slate-300">getAllTracks()</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400"></span>
                      <span className="text-slate-300">getTrack(trackId)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400"></span>
                      <span className="text-slate-300">getLessonContent(trackId, moduleId, lessonId)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-400"></span>
                      <span className="text-slate-300">getLessonQuiz(...)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.06]">
                <h3 className="font-medium text-white mb-3">How to Update Content</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-400">
                  <li>Edit files in <code className="px-1.5 py-0.5 rounded bg-neumorph-base text-cyan-400">app_content/lessons/</code></li>
                  <li>Run <code className="px-1.5 py-0.5 rounded bg-neumorph-base text-cyan-400">npm run sync-content</code> or deploy to sync to S3</li>
                  <li>CDN cache will automatically invalidate for updated files</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card variant="neumorph">
            <CardHeader>
              <CardTitle>User Progress Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 mb-4">
                While content is loaded from CDN, user progress is still tracked in DynamoDB:
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <h4 className="font-medium text-white text-sm">LearningProgress</h4>
                  <p className="text-xs text-slate-500 mt-1">Per-lesson completion, quiz scores, time spent</p>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                  <h4 className="font-medium text-white text-sm">TrackProgress</h4>
                  <p className="text-xs text-slate-500 mt-1">Overall track completion, certificates</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            <Link to="/admin">
              <Button variant="neumorph">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back to Admin Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
