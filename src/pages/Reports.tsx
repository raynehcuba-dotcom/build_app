import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { supabase } from '../lib/supabase';
import type { Sale, ProductWithRelations } from '../lib/types';

const COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#be185d', '#4f46e5'];

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salesData, setSalesData] = useState<Sale[]>([]);
  const [products, setProducts] = useState<ProductWithRelations[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; revenue: number; qty: number }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; revenue: number; orders: number }[]>([]);
  const [categoryRevenue, setCategoryRevenue] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [{ data: sales }, { data: prods }] = await Promise.all([
        supabase.from('sales').select('*').eq('status', 'completed').order('created_at', { ascending: false }).limit(500),
        supabase.from('products').select('*, categories(*), suppliers(*)').order('name'),
      ]);
      setSalesData(sales ?? []);
      setProducts((prods as ProductWithRelations[]) ?? []);

      // Top products by revenue
      const { data: items } = await supabase
        .from('sale_items')
        .select('product_id, quantity, subtotal, products(name)')
        .limit(500);
      const prodMap: Record<string, { name: string; revenue: number; qty: number }> = {};
      (items ?? []).forEach((item: { product_id: string; quantity: number; subtotal: number; products: { name: string }[] | null }) => {
        const name = item.products?.[0]?.name ?? 'N/A';
        if (!prodMap[item.product_id]) prodMap[item.product_id] = { name, revenue: 0, qty: 0 };
        prodMap[item.product_id].revenue += item.subtotal;
        prodMap[item.product_id].qty += item.quantity;
      });
      setTopProducts(Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10));

      // Monthly revenue (last 6 months)
      const months: { month: string; revenue: number; orders: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStr = d.toISOString().slice(0, 7);
        const monthSales = (sales ?? []).filter(s => s.created_at.startsWith(monthStr));
        months.push({
          month: d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
          revenue: monthSales.reduce((sum, s) => sum + s.total, 0),
          orders: monthSales.length,
        });
      }
      setMonthlyData(months);

      // Category revenue
      const catRev: Record<string, number> = {};
      (items ?? []).forEach((item: { product_id: string; subtotal: number }) => {
        const prod = (prods as ProductWithRelations[] | null)?.find(p => p.id === item.product_id);
        const catName = prod?.categories?.name ?? 'Sin categoría';
        catRev[catName] = (catRev[catName] ?? 0) + item.subtotal;
      });
      setCategoryRevenue(Object.entries(catRev).map(([name, value]) => ({ name, value })));

    } catch {
      setError('Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  }

  const totalRevenue = salesData.reduce((sum, s) => sum + s.total, 0);
  const avgTicket = salesData.length > 0 ? totalRevenue / salesData.length : 0;
  const totalUnits = topProducts.reduce((sum, p) => sum + p.qty, 0);
  const inventoryValue = products.reduce((sum, p) => sum + p.stock * p.cost, 0);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}><CircularProgress /></Box>;
  }
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>Reportes y Análisis</Typography>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card><CardContent sx={{ p: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Ingresos Totales</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>${totalRevenue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card><CardContent sx={{ p: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Ticket Promedio</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>${avgTicket.toFixed(2)}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card><CardContent sx={{ p: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Unidades Vendidas</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>{totalUnits}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <Card><CardContent sx={{ p: 2.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Valor Inventario</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>${inventoryValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</Typography>
          </CardContent></Card>
        </Grid>

        {/* Monthly Revenue */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Ingresos Mensuales (6 meses)</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(2)}`, 'Ingresos']} />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Orders Trend */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Tendencia de Pedidos</Typography>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="orders" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Products */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Top 10 Productos por Ingresos</Typography>
              {topProducts.length === 0 ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>Sin datos de ventas</Typography>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip formatter={(v) => [`${Number(v).toFixed(2)}`, 'Ingresos']} />
                    <Bar dataKey="revenue" fill="#059669" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Category Revenue Pie */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Ingresos por Categoría</Typography>
              {categoryRevenue.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={categoryRevenue} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">
                      {categoryRevenue.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => `${Number(v).toFixed(2)}`} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250 }}>
                  <Typography color="text.secondary">Sin datos</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
