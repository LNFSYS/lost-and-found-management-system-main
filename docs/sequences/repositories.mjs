const ports = {
  AuthRepository: "auth/auth",
  UserRepository: "auth/user",
  PostRepository: "posts/post",
  MatchingRepository: "matching/matching",
  ClaimRepository: "claims/claim",
  NotificationRepository: "notifications/notification",
  AppointmentRepository: "appointments/appointment",
  WarehouseRepository: "warehouse/warehouse",
  CustodyRequestRepository: "warehouse/custody-request",
  ReturnFeedbackRepository: "returns/return-feedback",
  AdminUserRepository: "admin/admin-user",
  AdminCatalogRepository: "admin/admin-catalog",
  AdminReportingRepository: "admin/admin-reporting",
  AdminAuditRepository: "admin/admin-audit",
  ReportRepository: "reports/report",
  ActivityRepository: "activity/activity",
  SystemConfigRepository: "system-config/system-config",
  MatchingTrainingRepository: null,
  DonationCampaignRepository: null,
};

// Map the final persistence operations, not just the UC's owning service.
const groups = [
  [1, 12, "UserRepository"],
  [13, 25, "PostRepository"],
  [26, 31, "MatchingRepository"],
  [32, 45, "ClaimRepository"],
  [46, 48, "NotificationRepository"],
  [49, 49, "AdminCatalogRepository"],
  [50, 57, "WarehouseRepository"],
  [58, 60, "ReturnFeedbackRepository"],
  [61, 61, "AdminCatalogRepository"],
  [62, 68, "AdminUserRepository"],
  [69, 81, "AdminCatalogRepository"],
  [82, 84, "AdminReportingRepository"],
  [85, 85, "AdminAuditRepository"],
  [86, 92, "SystemConfigRepository"],
  [93, 96, "ReportRepository"],
  [97, 97, "NotificationRepository"],
  [98, 100, "MatchingRepository"],
  [101, 105, "MatchingTrainingRepository"],
  [106, 110, "ClaimRepository"],
  [111, 111, "CustodyRequestRepository"],
  [112, 112, "ClaimRepository"],
  [113, 114, "WarehouseRepository"],
  [115, 122, "ClaimRepository"],
  [123, 125, "NotificationRepository"],
  [126, 139, "AppointmentRepository"],
  [140, 140, "ReportRepository"],
  [141, 141, "CustodyRequestRepository"],
  [142, 142, "AdminCatalogRepository"],
  [143, 145, "CustodyRequestRepository"],
  [146, 146, "CustodyRequestRepository", "WarehouseRepository"],
  [147, 147, "NotificationRepository"],
  [148, 149, "WarehouseRepository"],
  [150, 150, "NotificationRepository"],
  [151, 158, "WarehouseRepository"],
  [159, 162, "DonationCampaignRepository"],
  [163, 163, "ActivityRepository"],
  [164, 164, "ClaimRepository"],
  [165, 165, "AdminReportingRepository"],
  [166, 166, "ActivityRepository", "AdminAuditRepository"],
  [167, 167, "ActivityRepository"],
];

export function repositoriesFor(id) {
  if (!/^UC-\d{3}$/.test(id)) throw new Error(`Invalid UC ID: ${id}`);
  const number = Number(id.slice(3));
  const group = groups.find(([first, last]) => number >= first && number <= last);
  if (!group) throw new Error(`No persistence mapping for ${id}`);
  const names = [1, 4, 5, 6].includes(number) ? ["AuthRepository"] : group.slice(2);
  return names.map(name => {
    const port = ports[name];
    if (port === undefined) throw new Error(`Unknown repository: ${name}`);
    if (port === null) return { name, label: `${name} (proposed)`, source: null };
    const [module, file] = port.split("/");
    return { name, label: name, source: `apps/api-node/src/modules/${module}/application/${file}.repository.port.ts` };
  });
}
