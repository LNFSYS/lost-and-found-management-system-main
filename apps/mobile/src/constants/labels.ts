export const claimRoleLabels = {
  FINDER: "Người nhặt",
  CLAIMANT: "Người nhận",
} as const;

export const appTabLabels = {
  home: "Trang chủ",
  posts: "Bài đăng",
  claims: "Yêu cầu",
  appointments: "Lịch hẹn",
  profile: "Cá nhân",
  admin: "Quản trị",
  staff: "Nhân viên",
} as const;

export const appointmentEventLabels = {
  NO_SHOW: "Bên kia không đến",
} as const;

export const custodyIntakeTypeLabels = {
  CUSTODY_TRANSFER: "Bàn giao kho trường",
  WALK_IN: "Mang trực tiếp đến quầy",
} as const;

export const custodyRequestStatusLabels = {
  PENDING: "Chờ tiếp nhận",
  ACCEPTED: "Đã chấp nhận",
  INTAKED: "Đã nhập kho",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
} as const;

export const warehouseStaffLabel = "nhân viên kho";
