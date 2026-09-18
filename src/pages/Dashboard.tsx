import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PeopleIcon from '@mui/icons-material/People';
import CategoryIcon from '@mui/icons-material/Category';
import { supabase } from '../lib/supabase';
import type { DashboardStats, Sale } from '../lib/types';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  chip?: { label: string; color: 'success' | 'warning' | 'error' | 'info' };
}

function StatCard({ title, value, icon, color, subtitle, chip }: StatCardProps) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 700 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
            {chip && (
              <Chip label={chip.label} color={chip.color} size="small" sx={{ mt: 1 }} />
            )}
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: `${color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [salesChartData, setSalesChartData] = useState<{ date: string; total: number }[]>([]);
  const [categoryStockData, setCategoryStockData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      const [
        { count: totalProducts },
        { data: activeProducts },
        { data: salesData },
        { data: recentSalesData },
        { count: totalSuppliers },
        { count: totalCategories },
        { data: categoryData },
      ] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('products').select('stock, min_stock').eq('active', true),
        supabase.from('sales').select('total, created_at').eq('status', 'completed').order('created_at', { ascending: false }).limit(30),
        supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('suppliers').select('*', { count: 'exact', head: true }),
        supabase.from('categories').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('stock, categories(name)').eq('active', true).limit(200),
      ]);

      const todayStr = new Date().toISOString().split('T')[0];
      const salesToday = salesData?.filter(s => s.created_at.startsWith(todayStr)) ?? [];
      const lowStockProducts = activeProducts?.filter(p => p.stock <= p.min_stock) ?? [];
      const totalRevenue = salesData?.reduce((sum, s) => sum + s.total, 0) ?? 0;

      setStats({
        totalProducts: totalProducts ?? 0,
        lowStockProducts: lowStockProducts.length,
        totalSalesToday: salesToday.length,
        totalRevenue,
        totalSuppliers: totalSuppliers ?? 0,
        totalCategories: totalCategories ?? 0,
      });

      setRecentSales(recentSalesData ?? []);

      // Sales chart - last 7 days
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });
      const chartData = last7.map(date => ({
        date: new Date(date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
        total: salesData?.filter(s => s.created_at.startsWith(date)).reduce((sum, s) => sum + s.total, 0) ?? 0,
      }));
      setSalesChartData(chartData);

      // Category stock distribution
      const catMap: Record<string, number> = {};
      categoryData?.forEach((p: { stock: number; categories: { name: string }[] | null }) => {
        const catName = p.categories?.[0]?.name ?? 'Sin categoría';
        catMap[catName] = (catMap[catName] ?? 0) + p.stock;
      });
      setCategoryStockData(Object.entries(catMap).map(([name, value]) => ({ name, value })));

    } catch {
      setError('Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  }

  const COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>Dashboard</Typography>

      <Grid container spacing={2.5}>
        {/* Stat Cards */}
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <StatCard
            title="Productos Activos"
            value={stats?.totalProducts ?? 0}
            icon={<InventoryIcon />}
            color="#2563eb"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <StatCard
            title="Stock Bajo"
            value={stats?.lowStockProducts ?? 0}
            icon={<WarningAmberIcon />}
            color="#d97706"
            chip={stats?.lowStockProducts ? { label: 'Requiere atención', color: 'warning' } : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <StatCard
            title="Ventas de Hoy"
            value={stats?.totalSalesToday ?? 0}
            icon={<PointOfSaleIcon />}
            color="#059669"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <StatCard
            title="Ingresos Totales"
            value={`$${(stats?.totalRevenue ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`}
            icon={<AttachMoneyIcon />}
            color="#7c3aed"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <StatCard
            title="Proveedores"
            value={stats?.totalSuppliers ?? 0}
            icon={<PeopleIcon />}
            color="#0891b2"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <StatCard
            title="Categorías"
            value={stats?.totalCategories ?? 0}
            icon={<CategoryIcon />}
            color="#dc2626"
          />
        </Grid>

        {/* Sales Line Chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Ventas - Últimos 7 días</Typography>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${Number(v).toFixed(2)}`, 'Total']} />
                  <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Stock by Category Pie */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Stock por Categoría</Typography>
              {categoryStockData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={categoryStockData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                      {categoryStockData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                  <Typography color="text.secondary">Sin datos</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Sales */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Ventas Recientes</Typography>
              {recentSales.length === 0 ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  No hay ventas registradas aún
                </Typography>
              ) : (
                <Box>
                  {recentSales.map((sale, i) => (
                    <Box key={sale.id}>
                      {i > 0 && <Divider />}
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
                        <Box>
                          <Typography variant="subtitle2">{sale.customer_name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {sale.sale_number} · {new Date(sale.created_at).toLocaleString('es-ES')}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            ${sale.total.toFixed(2)}
                          </Typography>
                          <Chip
                            label={sale.status === 'completed' ? 'Completada' : sale.status === 'pending' ? 'Pendiente' : 'Cancelada'}
                            size="small"
                            color={sale.status === 'completed' ? 'success' : sale.status === 'pending' ? 'warning' : 'error'}
                          />
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
