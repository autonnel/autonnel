import React, { useCallback, useState } from 'react';
import {
  AlertBox,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  LoadingSpinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../primitives';
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import CouponForm, { type CouponFormData } from './CouponForm';
import { ApiCallError, apiCall } from '@/lib/api/client';
import type { CouponDto } from '@/contracts/coupons';

type Coupon = CouponDto;

interface CouponManagerProps {
  initialCoupons: Coupon[];
}

type StatusBadge = { label: string; variant: 'default' | 'secondary' | 'destructive' };

const FLASH_MS = 3000;
const COLUMNS = ['Name', 'Code', 'Type', 'Value', 'Usage', 'Status', 'Actions'] as const;
const EMPTY_MESSAGE = 'No coupons yet. Create your first coupon to get started.';
const DELETE_CONFIRM = 'Delete this coupon? This action cannot be undone.';

function messageFor(err: unknown, fallback: string): string {
  return err instanceof ApiCallError ? err.message : fallback;
}

function isExpired(coupon: Coupon): boolean {
  return !!coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
}

function isExhausted(coupon: Coupon): boolean {
  return !!coupon.maxUsages && coupon.usageCount >= coupon.maxUsages;
}

function resolveStatus(coupon: Coupon): StatusBadge {
  if (!coupon.isActive) return { label: 'Inactive', variant: 'secondary' };
  if (isExpired(coupon)) return { label: 'Expired', variant: 'destructive' };
  if (isExhausted(coupon)) return { label: 'Exhausted', variant: 'secondary' };
  return { label: 'Active', variant: 'default' };
}

function renderDiscount(coupon: Coupon): string {
  const amount = parseFloat(coupon.discountValue);
  if (coupon.discountType === 'PERCENTAGE') return `${amount}%`;
  return `$${amount.toFixed(2)}`;
}

function renderUsage(coupon: Coupon): string {
  const cap = coupon.maxUsages ? ` / ${coupon.maxUsages}` : '';
  return `${coupon.usageCount}${cap}`;
}

function renderType(coupon: Coupon): string {
  return coupon.discountType === 'PERCENTAGE' ? 'Percentage' : 'Fixed';
}

function CouponRow({
  coupon,
  removing,
  onEdit,
  onRemove,
}: {
  coupon: Coupon;
  removing: boolean;
  onEdit: (coupon: Coupon) => void;
  onRemove: (id: string) => void;
}) {
  const status = resolveStatus(coupon);
  return (
    <TableRow>
      <TableCell className="font-medium">{coupon.name}</TableCell>
      <TableCell>
        <code className="px-2 py-0.5 rounded bg-muted text-xs font-mono">
          {coupon.code}
        </code>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {renderType(coupon)}
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {renderDiscount(coupon)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {renderUsage(coupon)}
      </TableCell>
      <TableCell>
        <Badge variant={status.variant}>{status.label}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(coupon)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(coupon.id)}
            disabled={removing}
            className="text-destructive hover:text-destructive"
          >
            {removing ? <LoadingSpinner size="sm" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function CouponManager({ initialCoupons }: CouponManagerProps) {
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const flashSuccess = useCallback((text: string) => {
    setSuccess(text);
    setTimeout(() => setSuccess(null), FLASH_MS);
  }, []);

  const refreshCoupons = useCallback(async () => {
    try {
      const data = await apiCall('GET /api/settings/coupons', null);
      setCoupons(data.coupons);
    } catch (err) {
      setError(messageFor(err, 'Failed to load coupons'));
    }
  }, []);

  const openCreateDialog = useCallback(() => {
    setEditingCoupon(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((coupon: Coupon) => {
    setEditingCoupon(coupon);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm(DELETE_CONFIRM)) return;
      setDeletingId(id);
      setError(null);
      try {
        await apiCall('DELETE /api/settings/coupons/:id', null, { params: { id } });
        setCoupons((prev) => prev.filter((c) => c.id !== id));
        flashSuccess('Coupon deleted');
      } catch (err) {
        setError(messageFor(err, 'Failed to delete'));
      } finally {
        setDeletingId(null);
      }
    },
    [flashSuccess],
  );

  const handleSubmit = useCallback(
    async (formData: CouponFormData) => {
      const editing = editingCoupon;
      setSaving(true);
      setError(null);
      try {
        if (editing) {
          await apiCall('PUT /api/settings/coupons/:id', formData, { params: { id: editing.id } });
        } else {
          await apiCall('POST /api/settings/coupons', formData);
        }
        setDialogOpen(false);
        setEditingCoupon(null);
        await refreshCoupons();
        flashSuccess(editing ? 'Coupon updated' : 'Coupon created');
      } catch (err) {
        setError(messageFor(err, 'Failed to save coupon'));
      } finally {
        setSaving(false);
      }
    },
    [editingCoupon, refreshCoupons, flashSuccess],
  );

  const hasCoupons = coupons.length > 0;

  return (
    <div className="space-y-6">
      {error && <AlertBox type="error" title="Error">{error}</AlertBox>}
      {success && <AlertBox type="success" title="Success">{success}</AlertBox>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tag className="w-5 h-5 text-muted-foreground" />
          <Badge variant="secondary">{coupons.length}</Badge>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Create Coupon
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{COLUMNS[0]}</TableHead>
                <TableHead>{COLUMNS[1]}</TableHead>
                <TableHead>{COLUMNS[2]}</TableHead>
                <TableHead className="text-right">{COLUMNS[3]}</TableHead>
                <TableHead className="text-right">{COLUMNS[4]}</TableHead>
                <TableHead>{COLUMNS[5]}</TableHead>
                <TableHead className="text-right">{COLUMNS[6]}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!hasCoupons ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    {EMPTY_MESSAGE}
                  </TableCell>
                </TableRow>
              ) : (
                coupons.map((coupon) => (
                  <CouponRow
                    key={coupon.id}
                    coupon={coupon}
                    removing={deletingId === coupon.id}
                    onEdit={openEditDialog}
                    onRemove={handleDelete}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent maxWidth="2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
            </DialogTitle>
          </DialogHeader>
          <CouponForm
            initialData={editingCoupon}
            saving={saving}
            onSubmit={handleSubmit}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
