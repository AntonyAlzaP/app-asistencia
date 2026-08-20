export interface Device {
  id: string;
  userId: string;
  deviceId: string;
  hostname: string | null;
  firstSeenAt: string;
  approved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  userFullName: string;
}
