import { useEffect, useMemo, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '◈' },
  { id: 'products', label: 'Products', icon: '▣' },
  { id: 'customers', label: 'Customers', icon: '◎' },
  { id: 'orders', label: 'Orders', icon: '◉' },
]

const emptyProduct = { name: '', sku: '', price: '', quantity_in_stock: '' }
const emptyCustomer = { full_name: '', email: '', phone: '' }
const emptyOrder = { customer_id: '', product_id: '', quantity: 1 }

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    const detail = payload?.detail
    throw new Error(Array.isArray(detail) ? detail.map((item) => item.msg).join(', ') : detail || 'Request failed')
  }

  return payload
}

function App() {
  const [tab, setTab] = useState('dashboard')
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [orders, setOrders] = useState([])
  const [productForm, setProductForm] = useState(emptyProduct)
  const [editingProductId, setEditingProductId] = useState(null)
  const [customerForm, setCustomerForm] = useState(emptyCustomer)
  const [orderForm, setOrderForm] = useState(emptyOrder)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const lowStockProducts = useMemo(
    () => products.filter((product) => Number(product.quantity_in_stock) <= 5),
    [products],
  )

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(orderForm.product_id)),
    [products, orderForm.product_id],
  )

  const orderQuantityError = useMemo(() => {
    if (!selectedProduct || !orderForm.quantity) return ''
    const qty = Number(orderForm.quantity)
    if (qty > Number(selectedProduct.quantity_in_stock)) {
      return `Only ${selectedProduct.quantity_in_stock} units available.`
    }
    return ''
  }, [selectedProduct, orderForm.quantity])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [nextProducts, nextCustomers, nextOrders] = await Promise.all([
        request('/products'),
        request('/customers'),
        request('/orders'),
      ])
      setProducts(nextProducts)
      setCustomers(nextCustomers)
      setOrders(nextOrders)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (!error) return undefined
    const timer = window.setTimeout(() => setError(''), 5000)
    return () => window.clearTimeout(timer)
  }, [error])

  function flashSuccess(text) {
    setMessage(text)
    setError('')
    window.setTimeout(() => setMessage(''), 3000)
  }

  async function handleProductSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    const payload = {
      ...productForm,
      price: Number(productForm.price),
      quantity_in_stock: Number(productForm.quantity_in_stock),
    }

    try {
      if (editingProductId) {
        await request(`/products/${editingProductId}`, { method: 'PUT', body: JSON.stringify(payload) })
        flashSuccess('Product updated successfully.')
      } else {
        await request('/products', { method: 'POST', body: JSON.stringify(payload) })
        flashSuccess('Product added successfully.')
      }
      setProductForm(emptyProduct)
      setEditingProductId(null)
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCustomerSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await request('/customers', { method: 'POST', body: JSON.stringify(customerForm) })
      setCustomerForm(emptyCustomer)
      flashSuccess('Customer added successfully.')
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleOrderSubmit(event) {
    event.preventDefault()
    if (orderQuantityError) {
      setError(orderQuantityError)
      return
    }
    setSubmitting(true)
    try {
      await request('/orders', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: Number(orderForm.customer_id),
          items: [{ product_id: Number(orderForm.product_id), quantity: Number(orderForm.quantity) }],
        }),
      })
      setOrderForm(emptyOrder)
      flashSuccess('Order placed — stock updated.')
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(path, successText) {
    try {
      await request(path, { method: 'DELETE' })
      flashSuccess(successText)
      if (selectedOrder) setSelectedOrder(null)
      await loadData()
    } catch (err) {
      setError(err.message)
    }
  }

  function editProduct(product) {
    setEditingProductId(product.id)
    setProductForm({
      name: product.name,
      sku: product.sku,
      price: product.price,
      quantity_in_stock: product.quantity_in_stock,
    })
    setTab('products')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingProductId(null)
    setProductForm(emptyProduct)
  }

  const tabMeta = {
    dashboard: { title: 'Dashboard', subtitle: 'Overview of your inventory and sales activity.' },
    products: { title: 'Products', subtitle: 'Manage catalog items, pricing, and stock levels.' },
    customers: { title: 'Customers', subtitle: 'Add and manage your customer directory.' },
    orders: { title: 'Orders', subtitle: 'Create orders and track fulfillment.' },
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <div className="brand-icon" aria-hidden="true">📦</div>
            <div>
              <h1>StockFlow</h1>
              <p>Inventory & Orders</p>
            </div>
          </div>
        </div>

        <nav className="nav" aria-label="Main navigation">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="main-content">
        <header className="page-header">
          <div>
            <h2>{tabMeta[tab].title}</h2>
            <p>{tabMeta[tab].subtitle}</p>
          </div>
        </header>

        {loading && products.length === 0 && customers.length === 0 ? (
          <div className="loading-screen">
            <div className="spinner" aria-hidden="true" />
            <p>Loading your data…</p>
          </div>
        ) : (
          <>
            {(tab === 'dashboard' || tab === 'products' || tab === 'customers' || tab === 'orders') && (
              <section className="stats-grid">
                <StatCard icon="📦" label="Total products" value={products.length} variant="products" />
                <StatCard icon="👥" label="Total customers" value={customers.length} variant="customers" />
                <StatCard icon="🧾" label="Total orders" value={orders.length} variant="orders" />
                <StatCard icon="⚠" label="Low stock items" value={lowStockProducts.length} variant="warning" />
              </section>
            )}

            {tab === 'dashboard' && (
              <>
                {lowStockProducts.length > 0 && (
                  <section className="alert-panel">
                    <h3>⚠ Low stock alert</h3>
                    <ul className="low-stock-list">
                      {lowStockProducts.map((product) => (
                        <li key={product.id}>
                          {product.name} — <strong>{product.quantity_in_stock} left</strong>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3>Recent orders</h3>
                      <p>Latest transactions across your store</p>
                    </div>
                    <button type="button" className="ghost icon-btn" onClick={() => setTab('orders')}>
                      View all →
                    </button>
                  </div>
                  <OrdersTable
                    orders={orders.slice(0, 5)}
                    onView={setSelectedOrder}
                    onCancel={(id) => remove(`/orders/${id}`, 'Order canceled and stock restored.')}
                    compact
                  />
                </div>
              </>
            )}

            {tab === 'products' && (
              <div className="content-split">
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3>{editingProductId ? 'Edit product' : 'Add product'}</h3>
                      <p>{editingProductId ? 'Update existing catalog entry' : 'Create a new inventory item'}</p>
                    </div>
                  </div>
                  <div className="card-body">
                    <form onSubmit={handleProductSubmit} className="form-grid">
                      <Field label="Product name">
                        <input required placeholder="e.g. Wireless Mouse" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} />
                      </Field>
                      <Field label="SKU / Code">
                        <input required placeholder="e.g. WM-001" value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} />
                      </Field>
                      <Field label="Price (₹)">
                        <input required min="0.01" step="0.01" type="number" placeholder="0.00" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
                      </Field>
                      <Field label="Quantity in stock">
                        <input required min="0" type="number" placeholder="0" value={productForm.quantity_in_stock} onChange={(e) => setProductForm({ ...productForm, quantity_in_stock: e.target.value })} />
                      </Field>
                      <div className="form-actions">
                        <button type="submit" disabled={submitting}>
                          {submitting ? 'Saving…' : editingProductId ? 'Save changes' : 'Add product'}
                        </button>
                        {editingProductId && (
                          <button type="button" className="secondary" onClick={cancelEdit}>Cancel</button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3>Product catalog</h3>
                      <p>{products.length} item{products.length !== 1 ? 's' : ''} in inventory</p>
                    </div>
                  </div>
                  <ProductsTable
                    products={products}
                    onEdit={editProduct}
                    onDelete={(id) => remove(`/products/${id}`, 'Product deleted.')}
                  />
                </div>
              </div>
            )}

            {tab === 'customers' && (
              <div className="content-split">
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3>Add customer</h3>
                      <p>Register a new customer account</p>
                    </div>
                  </div>
                  <div className="card-body">
                    <form onSubmit={handleCustomerSubmit} className="form-grid">
                      <Field label="Full name">
                        <input required placeholder="Jane Smith" value={customerForm.full_name} onChange={(e) => setCustomerForm({ ...customerForm, full_name: e.target.value })} />
                      </Field>
                      <Field label="Email address">
                        <input required type="email" placeholder="jane@example.com" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
                      </Field>
                      <Field label="Phone number">
                        <input required placeholder="+1 555 0100" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} />
                      </Field>
                      <button type="submit" disabled={submitting}>
                        {submitting ? 'Adding…' : 'Add customer'}
                      </button>
                    </form>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3>Customer directory</h3>
                      <p>{customers.length} registered customer{customers.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <CustomersTable
                    customers={customers}
                    onDelete={(id) => remove(`/customers/${id}`, 'Customer deleted.')}
                  />
                </div>
              </div>
            )}

            {tab === 'orders' && (
              <div className="content-split">
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3>Create order</h3>
                      <p>Stock is validated and reduced automatically</p>
                    </div>
                  </div>
                  <div className="card-body">
                    <form onSubmit={handleOrderSubmit} className="form-grid">
                      <Field label="Customer">
                        <select required value={orderForm.customer_id} onChange={(e) => setOrderForm({ ...orderForm, customer_id: e.target.value })}>
                          <option value="">Select a customer</option>
                          {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>{customer.full_name}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Product">
                        <select required value={orderForm.product_id} onChange={(e) => setOrderForm({ ...orderForm, product_id: e.target.value })}>
                          <option value="">Select a product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} — {product.quantity_in_stock} in stock
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Quantity" hint={orderQuantityError || (selectedProduct ? `${selectedProduct.quantity_in_stock} units available` : '')}>
                        <input
                          required
                          min="1"
                          type="number"
                          value={orderForm.quantity}
                          onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                          style={orderQuantityError ? { borderColor: 'var(--danger)' } : undefined}
                        />
                      </Field>
                      {selectedProduct && orderForm.quantity > 0 && !orderQuantityError && (
                        <p className="field-hint" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                          Estimated total: {money.format(Number(selectedProduct.price) * Number(orderForm.quantity))}
                        </p>
                      )}
                      <button type="submit" disabled={submitting || !!orderQuantityError}>
                        {submitting ? 'Placing order…' : 'Place order'}
                      </button>
                    </form>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3>Order history</h3>
                      <p>{orders.length} order{orders.length !== 1 ? 's' : ''} placed</p>
                    </div>
                  </div>
                  <OrdersTable
                    orders={orders}
                    onView={setSelectedOrder}
                    onCancel={(id) => remove(`/orders/${id}`, 'Order canceled and stock restored.')}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {message && <div className="toast success" role="status">{message}</div>}
      {error && <div className="toast error" role="alert">{error}</div>}

      {selectedOrder && (
        <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  )
}

function StatCard({ icon, label, value, variant }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${variant}`} aria-hidden="true">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <p className="field-hint" style={hint.includes('Only') ? { color: 'var(--danger)' } : undefined}>{hint}</p>}
    </div>
  )
}

function ProductsTable({ products, onEdit, onDelete }) {
  if (!products.length) {
    return <EmptyState icon="📦" message="No products yet. Add your first item to get started." />
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Price</th>
            <th>Stock</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>
                <span className="cell-primary">{product.name}</span>
                <span className="cell-sub">{product.sku}</span>
              </td>
              <td>{money.format(Number(product.price))}</td>
              <td>
                <span className={`pill ${product.quantity_in_stock <= 5 ? 'warn' : product.quantity_in_stock > 20 ? 'ok' : ''}`}>
                  {product.quantity_in_stock <= 5 && '⚠ '}
                  {product.quantity_in_stock}
                </span>
              </td>
              <td className="actions">
                <button type="button" className="secondary icon-btn" onClick={() => onEdit(product)}>Edit</button>
                <button type="button" className="danger icon-btn" onClick={() => onDelete(product.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CustomersTable({ customers, onDelete }) {
  if (!customers.length) {
    return <EmptyState icon="👥" message="No customers yet. Add someone to start placing orders." />
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Phone</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id}>
              <td>
                <span className="cell-primary">{customer.full_name}</span>
                <span className="cell-sub">{customer.email}</span>
              </td>
              <td>{customer.phone}</td>
              <td className="actions">
                <button type="button" className="danger icon-btn" onClick={() => onDelete(customer.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OrdersTable({ orders, onView, onCancel, compact }) {
  if (!orders.length) {
    return <EmptyState icon="🧾" message="No orders yet. Create your first order above." />
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Items</th>
            <th>Total</th>
            {!compact && <th />}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr
              key={order.id}
              onClick={compact && onView ? () => onView(order) : undefined}
              style={compact && onView ? { cursor: 'pointer' } : undefined}
            >
              <td>
                <span className="cell-primary">Order #{order.id}</span>
                <span className="cell-sub">{order.customer?.full_name || 'Unknown customer'}</span>
              </td>
              <td>{order.items.map((item) => `${item.product?.name} × ${item.quantity}`).join(', ')}</td>
              <td><strong>{money.format(Number(order.total_amount))}</strong></td>
              {!compact && (
                <td className="actions">
                  <button type="button" className="secondary icon-btn" onClick={() => onView(order)}>Details</button>
                  <button type="button" className="danger icon-btn" onClick={() => onCancel(order.id)}>Cancel</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OrderModal({ order, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="order-modal-title">
        <div className="modal-header">
          <h3 id="order-modal-title">Order #{order.id}</h3>
          <button type="button" className="ghost icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <dl>
            <div>
              <dt>Customer</dt>
              <dd>{order.customer?.full_name} ({order.customer?.email})</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd><span className="pill ok">{order.status}</span></dd>
            </div>
            <div>
              <dt>Line items</dt>
              <dd>
                <ul className="order-items-list">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      <span>{item.product?.name} × {item.quantity}</span>
                      <span>{money.format(Number(item.unit_price) * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
          <div className="order-total">
            <span>Total amount</span>
            <span>{money.format(Number(order.total_amount))}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon, message }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">{icon}</div>
      <p>{message}</p>
    </div>
  )
}

export default App
