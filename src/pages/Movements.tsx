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
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { supabase } from '../lib/supabase';
import type { StockMovementWithProduct, Product } from '../lib/types';

const REASONS_IN = ['purchase', 'return', 'adjustment', 'transfer'];
const REASONS_OUT = ['sale', 'damage', 'adjustment', 'transfer', 'expired'];
const REASON_LABELS: Record<string, string> = {
  purchase: 'Compra', return: 'Devolución', adjustment: 'Ajuste',
  transfer: 'Transferencia', sale: 'Venta', damage: 'Daño', expired: 'Expirado',
};

interface MovementForm {
  product_id: string;
  type: 'in' | 'out';
  quantity: string;
  reason: string;
  notes: string;
}

const emptyForm: MovementForm = { product_id: '', type: 'in', quantity: '1', reason: 'purchase', notes: '' };

export default function Movements() {
  const [movements, setMovements] = useState<StockMovementWithProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<MovementForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from('stock_movements').select('*, products(*)').order('created_at', { ascending: false }).limit(200),
      supabase.from('products').select('*').eq('active', true).order('name'),
    ]);
    setMovements((m as StockMovementWithProduct[]) ?? []);
    setProducts(p ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.product_id || !form.quantity) return;
    setSaving(true);
    const qty = parseInt(form.quantity) || 1;
    const product = products.find(p => p.id === form.product_id);
    if (!product) { setSaving(false); return; }

    const newStock = form.type === 'in' ? product.stock + qty : product.stock - qty;
    if (newStock < 0) { setError('Stock insuficiente para este movimiento'); setSaving(false); return; }

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('stock_movements').insert({
        product_id: form.product_id, type: form.type, quantity: qty,
        reason: form.reason, notes: form.notes || null,
      }),
      supabase.from('products').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', form.product_id),
    ]);
    if (e1 || e2) setError('Error al registrar movimiento');
    else { setDialogOpen(false); setForm(emptyForm); loadAll(); }
    setSaving(false);
  }

  const filtered = movements.filter(m => {
    const matchSearch = !search || m.products?.name.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || m.type === filterType;
    return matchSearch && matchType;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Movimientos de Stock</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Registrar Movimiento
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Card>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              size="small" placeholder="Buscar por producto..."
              value={search} onChange={e => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Tipo</InputLabel>
              <Select value={filterType} onChange={e => setFilterType(e.target.value)} label="Tipo">
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="in">Entradas</MenuItem>
                <MenuItem value="out">Salidas</MenuItem>
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
                    <TableCell>Producto</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell align="right">Cantidad</TableCell>
                    <TableCell>Motivo</TableCell>
                    <TableCell>Notas</TableCell>
                    <TableCell>Fecha</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No hay movimientos registrados
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(m => (
                    <TableRow key={m.id} hover>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 500 }}>{m.products?.name}</Typography></TableCell>
                      <TableCell>
                        <Chip
                          icon={m.type === 'in' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
                          label={m.type === 'in' ? 'Entrada' : 'Salida'}
                          size="small"
                          color={m.type === 'in' ? 'success' : 'error'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 600, color: m.type === 'in' ? 'success.main' : 'error.main' }}>
                          {m.type === 'in' ? '+' : '-'}{m.quantity}
                        </Typography>
                      </TableCell>
                      <TableCell>{REASON_LABELS[m.reason] ?? m.reason}</TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">{m.notes ?? '-'}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{new Date(m.created_at).toLocaleString('es-ES')}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Registrar Movimiento de Stock</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Producto *</InputLabel>
              <Select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} label="Producto *">
                {products.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.name} (stock actual: {p.stock})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Tipo</InputLabel>
                <Select value={form.type}
                  onChange={e => setForm(f => ({
                    ...f,
                    type: e.target.value as 'in' | 'out',
                    reason: e.target.value === 'in' ? 'purchase' : 'adjustment',
                  }))}
                  label="Tipo"
                >
                  <MenuItem value="in">Entrada (+)</MenuItem>
                  <MenuItem value="out">Salida (-)</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Cantidad *" value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                size="small" type="number" sx={{ width: 120 }}
                slotProps={{ input: { inputProps: { min: 1 } } }}
              />
            </Box>
            <FormControl size="small" fullWidth>
              <InputLabel>Motivo</InputLabel>
              <Select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} label="Motivo">
                {(form.type === 'in' ? REASONS_IN : REASONS_OUT).map(r => (
                  <MenuItem key={r} value={r}>{REASON_LABELS[r]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Notas" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              size="small" multiline rows={2} fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.product_id || !form.quantity}>
            {saving ? 'Guardando...' : 'Registrar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
