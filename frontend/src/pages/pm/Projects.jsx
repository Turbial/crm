import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import { get } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'

export default function Projects() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => get('/projects'),
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="page-header">
        <div><h1>Projects</h1><p>{projects.length} projects</p></div>
      </div>

      {projects.length === 0
        ? <EmptyState icon={FolderOpen} title="No projects yet" description="Projects are created via the Messenger AI or API." />
        : (
          <div className="grid-auto">
            {projects.map(p => (
              <Link key={p.id} to={`/pm/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                <div className="card" style={{ cursor: 'pointer', transition: 'box-shadow .15s' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}>
                  <div className="flex items-center justify-between mb-4">
                    <FolderOpen size={18} color="var(--accent)" />
                    <Badge label={p.status || 'active'} />
                  </div>
                  <h3 className="font-semibold" style={{ fontSize: 15, marginBottom: 6 }}>{p.name}</h3>
                  {p.description && <p className="text-sm text-muted truncate">{p.description}</p>}
                  <div className="flex gap-3 mt-4" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {p.start_date && <span>Start {new Date(p.start_date).toLocaleDateString()}</span>}
                    {p.end_date && <span>End {new Date(p.end_date).toLocaleDateString()}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
    </div>
  )
}
