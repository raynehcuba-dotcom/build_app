import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import { supabase } from '../lib/supabase';
import type { Sale, SaleWithItems, Product } from '../lib/types';

interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
}

export default function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [detailSale, setDetailSale] = useState<SaleWithItems | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [customer, setCustomer] = useState({ name: '', email: '', phone: '' });
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState('16');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('active', true).gt('stock', 0).order('name'),
    ]);
    setSales(s ?? []);
    setProducts(p ?? []);
    setLoading(false);
  }

  function addToCart() {
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;
    const existing = cart.find(c => c.product.id === product.id);
    if (existing) {
      setCart(cart.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { product, quantity: 1, unit_price: product.price }]);
    }
    setSelectedProduct('');
  }

  function updateQty(productId: string, delta: number) {
    setCart(prev => prev
      .map(c => c.product.id === productId ? { ...c, quantity: c.quantity + delta } : c)
      .filter(c => c.quantity > 0)
    );
  }

  const subtotal = cart.reduce((sum, c) => sum + c.quantity * c.unit_price, 0);
  const tax = subtotal * (parseFloat(taxRate) / 100 || 0);
  const total = subtotal + tax;

  async function handleSaveSale() {
    if (!customer.name || cart.length === 0) return;
    setSaving(true);
    try {
      const saleNumber = `VTA-${Date.now().toString().slice(-8)}`;
      const { data: sale, error: e1 } = await supabase.from('sales').insert({
        sale_number: saleNumber, customer_name: customer.name,
        customer_email: customer.email || null, customer_phone: customer.phone || null,
        status: 'completed', subtotal, tax, total, notes: notes || null,
      }).select().maybeSingle();
      if (e1 || !sale) throw e1 ?? new Error('No sale');

      const items = cart.map(c => ({
        sale_id: sale.id, product_id: c.product.id,
        quantity: c.quantity, unit_price: c.unit_price,
        subtotal: c.quantity * c.unit_price,
      }));
      const { error: e2 } = await supabase.from('sale_items').insert(items);
      if (e2) throw e2;

      // Update stock
      for (const c of cart) {
        await supabase.from('products').update({ stock: c.product.stock - c.quantity, updated_at: new Date().toISOString() }).eq('id', c.product.id);
        await supabase.from('stock_movements').insert({
          product_id: c.product.id, type: 'out', quantity: c.quantity,
          reason: 'sale', reference: sale.id,
        });
      }

      setNewSaleOpen(false);
      setCart([]); setCustomer({ name: '', email: '', phone: '' }); setNotes('');
      loadAll();
    } catch {
      setError('Error al registrar la venta');
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(sale: Sale) {
    const { data } = await supabase.from('sales').select('*, sale_items(*, products(*))').eq('id', sale.id).maybeSingle();
    setDetailSale(data as SaleWithItems);
    setDetailOpen(true);
  }

  const filtered = sales.filter(s => {
    const matchSearch = !search || s.customer_name.toLowerCase().includes(search.toLowerCase()) || s.sale_number.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusLabel = (s: string) => ({ completed: 'Completada', pending: 'Pendiente', cancelled: 'Cancelada' }[s] ?? s);
  const statusColor = (s: string): 'success' | 'warning' | 'error' => ({ completed: 'success', pending: 'warning', cancelled: 'error' }[s] as 'success' | 'warning' | 'error') ?? 'default';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Ventas</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewSaleOpen(true)}>
          Nueva Venta
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Card>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              size="small" placeholder="Buscar por cliente o número..."
              value={search} onChange={e => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Estado</InputLabel>
              <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} label="Estado">
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="completed">Completadas</MenuItem>
                <MenuItem value="pending">Pendientes</MenuItem>
                <MenuItem value="cancelled">Canceladas</MenuItem>
              </Select>
            </FormControl>
          </Box>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>N° Venta</TableCell>
                    <TableCell>Cliente</TableCell>
                    <TableCell>Fecha</TableCell>
                    <TableCell align="right">Subtotal</TableCell>
                    <TableCell align="right">IVA</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No hay ventas registradas
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(s => (
                    <TableRow key={s.id} hover>
                      <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.sale_number}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{s.customer_name}</Typography>
                        {s.customer_email && <Typography variant="caption" color="text.secondary">{s.customer_email}</Typography>}
                      </TableCell>
                      <TableCell><Typography variant="body2">{new Date(s.created_at).toLocaleDateString('es-ES')}</Typography></TableCell>
                      <TableCell align="right">${s.subtotal.toFixed(2)}</TableCell>
                      <TableCell align="right">${s.tax.toFixed(2)}</TableCell>
                      <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 600 }}>${s.total.toFixed(2)}</Typography></TableCell>
                      <TableCell><Chip label={statusLabel(s.status)} size="small" color={statusColor(s.status)} /></TableCell>
                      <TableCell align="center">
                        <Tooltip title="Ver detalle">
                          <IconButton size="small" onClick={() => openDetail(s)}><VisibilityIcon fontSize="small" /></IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* New Sale Dialog */}
      <Dialog open={newSaleOpen} onClose={() => setNewSaleOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Nueva Venta</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">Datos del cliente</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Nombre *" value={customer.name} onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))} size="small" fullWidth />
              <TextField label="Email" value={customer.email} onChange={e => setCustomer(c => ({ ...c, email: e.target.value }))} size="small" fullWidth />
              <TextField label="Teléfono" value={customer.phone} onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))} size="small" />
            </Box>

            <Divider />
            <Typography variant="subtitle2" color="text.secondary">Productos</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Agregar producto</InputLabel>
                <Select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} label="Agregar producto">
                  {products.map(p => (
                    <MenuItem key={p.id} value={p.id}>{p.name} — ${p.price} (stock: {p.stock})</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button variant="outlined" onClick={addToCart} disabled={!selectedProduct} startIcon={<AddIcon />}>
                Agregar
              </Button>
            </Box>

            {cart.length > 0 && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell align="center">Cantidad</TableCell>
                      <TableCell align="right">Precio Unit.</TableCell>
                      <TableCell align="right">Subtotal</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cart.map(c => (
                      <TableRow key={c.product.id}>
                        <TableCell>{c.product.name}</TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                            <IconButton size="small" onClick={() => updateQty(c.product.id, -1)}><RemoveCircleIcon fontSize="small" /></IconButton>
                            <Typography>{c.quantity}</Typography>
                            <IconButton size="small" onClick={() => updateQty(c.product.id, 1)} disabled={c.quantity >= c.product.stock}><AddCircleIcon fontSize="small" /></IconButton>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small" type="number" value={c.unit_price}
                            onChange={e => setCart(prev => prev.map(i => i.product.id === c.product.id ? { ...i, unit_price: parseFloat(e.target.value) || 0 } : i))}
                            sx={{ width: 90 }}
                            slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                          />
                        </TableCell>
                        <TableCell align="right">${(c.quantity * c.unit_price).toFixed(2)}</TableCell>
                        <TableCell>
                          <IconButton size="small" color="error" onClick={() => setCart(prev => prev.filter(i => i.product.id !== c.product.id))}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <TextField
                label="IVA (%)" value={taxRate} onChange={e => setTaxRate(e.target.value)}
                size="small" type="number" sx={{ width: 100 }}
              />
              <TextField label="Notas" value={notes} onChange={e => setNotes(e.target.value)} size="small" multiline rows={2} sx={{ flex: 1 }} />
              <Box sx={{ textAlign: 'right', minWidth: 160 }}>
                <Typography variant="body2" color="text.secondary">Subtotal: <strong>${subtotal.toFixed(2)}</strong></Typography>
                <Typography variant="body2" color="text.secondary">IVA ({taxRate}%): <strong>${tax.toFixed(2)}</strong></Typography>
                <Typography variant="h6" sx={{ mt: 0.5 }}>Total: ${total.toFixed(2)}</Typography>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setNewSaleOpen(false); setCart([]); setCustomer({ name: '', email: '', phone: '' }); }}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveSale} disabled={saving || !customer.name || cart.length === 0}>
            {saving ? 'Guardando...' : 'Registrar Venta'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Detalle de Venta — {detailSale?.sale_number}</DialogTitle>
        <DialogContent>
          {detailSale && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
              <Box>
                <Typography variant="subtitle2">Cliente: {detailSale.customer_name}</Typography>
                {detailSale.customer_email && <Typography variant="body2" color="text.secondary">{detailSale.customer_email}</Typography>}
                {detailSale.customer_phone && <Typography variant="body2" color="text.secondary">{detailSale.customer_phone}</Typography>}
              </Box>
              <Divider />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell align="center">Cant.</TableCell>
                      <TableCell align="right">Precio</TableCell>
                      <TableCell align="right">Subtotal</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detailSale.sale_items?.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{item.products?.name}</TableCell>
                        <TableCell align="center">{item.quantity}</TableCell>
                        <TableCell align="right">${item.unit_price.toFixed(2)}</TableCell>
                        <TableCell align="right">${item.subtotal.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" color="text.secondary">Subtotal: ${detailSale.subtotal.toFixed(2)}</Typography>
                <Typography variant="body2" color="text.secondary">IVA: ${detailSale.tax.toFixed(2)}</Typography>
                <Typography variant="h6">Total: ${detailSale.total.toFixed(2)}</Typography>
              </Box>
              {detailSale.notes && <Typography variant="body2" color="text.secondary">Notas: {detailSale.notes}</Typography>}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
