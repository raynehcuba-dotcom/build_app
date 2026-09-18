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
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import WarningIcon from '@mui/icons-material/Warning';
import { supabase } from '../lib/supabase';
import type { ProductWithRelations, Category, Supplier } from '../lib/types';

const UNITS = ['pcs', 'kg', 'g', 'L', 'mL', 'm', 'cm', 'caja', 'paquete', 'par', 'docena'];

interface ProductForm {
  name: string;
  sku: string;
  description: string;
  category_id: string;
  supplier_id: string;
  price: string;
  cost: string;
  stock: string;
  min_stock: string;
  unit: string;
  active: boolean;
}

const emptyForm: ProductForm = {
  name: '', sku: '', description: '', category_id: '', supplier_id: '',
  price: '', cost: '', stock: '0', min_stock: '5', unit: 'pcs', active: true,
};

export default function Products() {
  const [products, setProducts] = useState<ProductWithRelations[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: prods, error: e1 }, { data: cats }, { data: sups }] = await Promise.all([
      supabase.from('products').select('*, categories(*), suppliers(*)').order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ]);
    if (e1) setError('Error al cargar productos');
    setProducts((prods as ProductWithRelations[]) ?? []);
    setCategories(cats ?? []);
    setSuppliers(sups ?? []);
    setLoading(false);
  }

  function openCreate() {
    setForm(emptyForm);
    setEditId(null);
    setDialogOpen(true);
  }

  function openEdit(p: ProductWithRelations) {
    setForm({
      name: p.name, sku: p.sku, description: p.description ?? '', category_id: p.category_id ?? '',
      supplier_id: p.supplier_id ?? '', price: String(p.price), cost: String(p.cost),
      stock: String(p.stock), min_stock: String(p.min_stock), unit: p.unit, active: p.active,
    });
    setEditId(p.id);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.sku || !form.price) return;
    setSaving(true);
    const payload = {
      name: form.name, sku: form.sku, description: form.description || null,
      category_id: form.category_id || null, supplier_id: form.supplier_id || null,
      price: parseFloat(form.price) || 0, cost: parseFloat(form.cost) || 0,
      stock: parseInt(form.stock) || 0, min_stock: parseInt(form.min_stock) || 0,
      unit: form.unit, active: form.active,
    };
    const { error: e } = editId
      ? await supabase.from('products').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId)
      : await supabase.from('products').insert(payload);
    if (e) setError(e.message);
    else { setDialogOpen(false); loadAll(); }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const { error: e } = await supabase.from('products').update({ active: false }).eq('id', id);
    if (e) setError(e.message);
    else { setDeleteId(null); loadAll(); }
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || p.category_id === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Productos</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nuevo Producto
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Card>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              size="small" placeholder="Buscar por nombre o SKU..."
              value={search} onChange={e => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Categoría</InputLabel>
              <Select value={filterCat} onChange={e => setFilterCat(e.target.value)} label="Categoría">
                <MenuItem value="">Todas</MenuItem>
                {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
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
                    <TableCell>SKU</TableCell>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Categoría</TableCell>
                    <TableCell align="right">Precio</TableCell>
                    <TableCell align="right">Costo</TableCell>
                    <TableCell align="right">Stock</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="center">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No se encontraron productos
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(p => (
                    <TableRow key={p.id} hover>
                      <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{p.sku}</Typography></TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{p.name}</Typography>
                        {p.suppliers && <Typography variant="caption" color="text.secondary">{p.suppliers.name}</Typography>}
                      </TableCell>
                      <TableCell>{p.categories?.name ?? '-'}</TableCell>
                      <TableCell align="right">${p.price.toFixed(2)}</TableCell>
                      <TableCell align="right">${p.cost.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                          {p.stock <= p.min_stock && <WarningIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
                          <Typography variant="body2" sx={{ color: p.stock <= p.min_stock ? 'warning.main' : 'text.primary', fontWeight: p.stock <= p.min_stock ? 600 : 400 }}>
                            {p.stock} {p.unit}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={p.active ? 'Activo' : 'Inactivo'} size="small" color={p.active ? 'success' : 'default'} />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => openEdit(p)}><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Desactivar">
                          <IconButton size="small" color="error" onClick={() => setDeleteId(p.id)}><DeleteIcon fontSize="small" /></IconButton>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Nombre *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} size="small" fullWidth />
              <TextField label="SKU *" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} size="small" sx={{ width: 150 }} />
            </Box>
            <TextField label="Descripción" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} size="small" multiline rows={2} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Categoría</InputLabel>
                <Select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} label="Categoría">
                  <MenuItem value="">Sin categoría</MenuItem>
                  {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Proveedor</InputLabel>
                <Select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} label="Proveedor">
                  <MenuItem value="">Sin proveedor</MenuItem>
                  {suppliers.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Precio *" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} size="small" type="number" slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }} />
              <TextField label="Costo" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} size="small" type="number" slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Stock inicial" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} size="small" type="number" />
              <TextField label="Stock mínimo" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} size="small" type="number" />
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Unidad</InputLabel>
                <Select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} label="Unidad">
                  {UNITS.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <FormControlLabel
              control={<Switch checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />}
              label="Producto activo"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>Desactivar Producto</DialogTitle>
        <DialogContent>
          <Typography>¿Estás seguro que deseas desactivar este producto?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={() => deleteId && handleDelete(deleteId)}>
            Desactivar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
