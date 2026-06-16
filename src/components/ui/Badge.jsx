export function Badge({ children, variant = 'default', size = 'sm', className = '' }) {
  const variants = {
    default: 'bg-secondary-100 text-secondary-700',
    primary: 'bg-primary-100 text-primary-700',
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
    error: 'bg-error-50 text-error-700',
    info: 'bg-blue-50 text-blue-700',
    active: 'bg-accent-100 text-accent-700',
    inactive: 'bg-secondary-100 text-secondary-500',
    expired: 'bg-error-50 text-error-700',
    critical: 'bg-red-100 text-red-700',
    alert: 'bg-warning-50 text-warning-700',
    valid: 'bg-success-50 text-success-700',
    pending: 'bg-yellow-50 text-yellow-700',
    approved: 'bg-success-50 text-success-700',
    rejected: 'bg-error-50 text-error-700',
    draft: 'bg-secondary-100 text-secondary-600',
    paid: 'bg-accent-100 text-accent-700',
  };
  const sizes = { xs: 'px-1.5 py-0.5 text-xs', sm: 'px-2.5 py-0.5 text-xs', md: 'px-3 py-1 text-sm' };
  return (
    <span className={`badge font-medium ${variants[variant] || variants.default} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const map = {
    Active: 'active', Inactive: 'inactive', 'On Leave': 'info', Terminated: 'error', Resigned: 'inactive',
    Pending: 'pending', Approved: 'approved', Rejected: 'rejected', Cancelled: 'inactive',
    Draft: 'draft', Processing: 'info', Paid: 'paid',
    Valid: 'valid', Expired: 'expired', Critical: 'critical', Warning: 'alert', Alert: 'alert',
    'Full-Time': 'primary', 'Part-Time': 'info', Contract: 'warning', Probation: 'pending',
  };
  return <Badge variant={map[status] || 'default'}>{status}</Badge>;
}
