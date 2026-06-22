import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post, patch, del } from '../../api'
import Spinner from '../../components/Spinner'
import Badge from '../../components/Badge'
import EmptyState from '../../components/EmptyState'
import Modal from '../../components/Modal'

const fmtCurrency = (n) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(n)

const TYPE_COLORS = { product: 'blue', service: 'purple' }

const EMPTY_FORM = {
  name: '',
  description: '',
  type: 'product',
  price: '',
  currency: 'USD',
  is_active: true,
}

export default function Products() {
  const qc = useQueryClient()
  const [typeFilter, setTypeFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['products-services'],
    queryFn: () => get('/products-services?limit=100'),
  })

  const createMutation = useMutation({
    mutationFn: (body) => post('/products-services', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products-services'] }); closeModal() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => patch(`/products-services/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products-services'] }); closeModal() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => del(`/products-services/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products-services'] }); closeModal() },
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(item) {
    setEditing(item)
    setForm({
      name: item.name || '',
      description: item.description || '',
      type: item.type || 'product',
      price: item.price ?? '',
      currency: item.currency || 'USD',
      is_active: item.is_active ?? true,
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const body = {
      name: form.name,
      description: form.description || undefined,
      type: form.type,
      price: form.price !== '' ? Number(form.price) : undefined,
      currency: form.currency || 'USD',
      is_active: form.is_active,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, body })
    } else {
      createMutation.mutate(body)
    }
  }

  const filtered = typeFilter
    ? items.filter((i) => i.type === typeFilter)
    : items

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <div className="page-header">
        <h1>Products &amp; Services</h1>
        <div className="flex gap-2 items-center">
          <select
            className="form-input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="product">Product</option>
            <option value="service">Service</option>
          </select>
          <button className="btn btn-primary" onClick={openCreate}>
            New Item
          </button>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState message="No products or services found." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Price</th>
                <th>Active</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => openEdit(item)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="font-medium">{item.name}</td>
                  <td>
                    <Badge color={TYPE_COLORS[item.type] || 'gray'}>
                      {item.type || '—'}
                    </Badge>
                  </td>
                  <td className="td-muted text-sm">{fmtCurrency(item.price)}</td>
                  <td>
                    <Badge color={item.is_active ? 'green' : 'gray'}>
                      {item.is_active ? 'Yes' : 'No'}
                    </Badge>
                  </td>
                  <td className="td-muted text-sm">
                    {item.description
                      ? item.description.length > 60
                        ? item.description.slice(0, 60) + '…'
                        : item.description
                      : '—'}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2 items-center">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteMutation.mutate(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Item' : 'New Product / Service'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              className="form-input"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={3}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select
              className="form-input"
              name="type"
              value={form.type}
              onChange={handleChange}
            >
              <option value="product">Product</option>
              <option value="service">Service</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Price</label>
            <input
              className="form-input"
              type="number"
              name="price"
              value={form.price}
              onChange={handleChange}
              min={0}
              step="0.01"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Currency</label>
            <input
              className="form-input"
              name="currency"
              value={form.currency}
              onChange={handleChange}
            />
          </div>
          <div className="form-group flex gap-2 items-center">
            <input
              type="checkbox"
              name="is_active"
              id="is_active"
              checked={form.is_active}
              onChange={handleChange}
            />
            <label className="form-label" htmlFor="is_active" style={{ marginBottom: 0 }}>
              Active
            </label>
          </div>
          <div className="flex gap-2 items-center">
            <button className="btn btn-primary" type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
            </button>
            {editing && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => deleteMutation.mutate(editing.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={closeModal}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
