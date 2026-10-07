export interface Appointment {
  id:string;claimId:string;postId:string;title:string;proposerId:string;finderId:string;ownerId:string;
  status:"PENDING"|"ACCEPTED"|"REJECTED"|"CANCELLED"|"COMPLETED"|"RESCHEDULED";
  proposedAt:string;handoverPointId:string|null;location:string|null;version:number;
  itemImageUrl?:string|null;
  finderResponse:"PENDING"|"CONFIRMED"|"DISPUTED";ownerResponse:"PENDING"|"CONFIRMED"|"DISPUTED";
  noShowUserId:string|null;custodyAuthorized:boolean;completedAt:string|null;
  events:Array<{id:string;action:string;actorId:string|null;createdAt:string;note?:string|null}>;
}
export type AppointmentAction="ACCEPT"|"REJECT"|"CANCEL"|"CONFIRM"|"DISPUTE"|"NO_SHOW";
export interface ActivityEvent {id:string;source:string;action:string;targetType:string;targetId:string;actorId:string|null;createdAt:string;fromStatus:string|null;toStatus:string|null}
export interface AuditFilter {query?:string;source?:string;actorId?:string;targetId?:string;from?:string;to?:string;page?:number}
export interface Journey {title:string;status:string;results:ActivityEvent[];total:number;page:number;asOf:string;hasMore:boolean;
  summary?:{custodian:"FINDER"|"STAFF"|"OWNER"|"UNKNOWN";locationClass:"FINDER_HELD"|"WAREHOUSE"|"RETURNED"|"OTHER_DISPOSITION"|"UNKNOWN";receivedAt:string|null;returnedAt:string|null;custodyHours:number|null;feedbackEligible:boolean}}
export const appointmentStatus:Record<Appointment["status"],string>={PENDING:"Chờ phản hồi",ACCEPTED:"Đã chấp nhận",REJECTED:"Đã từ chối",CANCELLED:"Đã hủy",COMPLETED:"Đã trả đồ",RESCHEDULED:"Đã đổi lịch"};
export const responseLabel={PENDING:"Chưa xác nhận",CONFIRMED:"Đã xác nhận",DISPUTED:"Cần đối soát"};
export const sourceLabel:Record<string,string>={POST:"Bài đăng",MATCHING:"Đối chiếu",CLAIM:"Xác minh",CHAT:"Trao đổi",CUSTODY:"Bàn giao cho kho",WAREHOUSE:"Kho tài sản",RETURN:"Trả đồ",FEEDBACK:"Đánh giá",APPOINTMENT:"Lịch hẹn"};
export const stateLabel:Record<string,string>={OPEN:"Đang mở",MATCHED:"Có gợi ý",RESOLVED:"Đã hoàn trả",CLOSED:"Đã đóng",EXPIRED:"Hết hạn",HIDDEN:"Đã ẩn",PENDING:"Đang chờ",ACCEPTED:"Đã chấp nhận",REJECTED:"Đã từ chối",CANCELLED:"Đã hủy",COMPLETED:"Đã trả đồ",CONVERSATION_OPEN:"Đang trao đổi",NEED_MORE_INFO:"Cần thêm thông tin",RECEIVED:"Đã tiếp nhận",STORED:"Đã lưu kho",CLAIMED:"Đang chờ trả",INTAKED:"Đã nhập kho",RETURNED:"Đã trả",DONATED:"Đã quyên tặng",DISPOSED:"Đã xử lý",TRANSFERRED:"Đã chuyển giao"};
export const eventLabel:Record<string,string>={POST_CREATED:"Đăng bài",MATCHING_AVAILABLE:"Có gợi ý đối chiếu",CLAIM_CREATED:"Bắt đầu yêu cầu đối chiếu",CONVERSATION_OPENED:"Mở cuộc trao đổi",
  PROPOSED:"Đề xuất lịch hẹn",ACCEPT:"Chấp nhận lịch hẹn",REJECT:"Từ chối lịch hẹn",CANCEL:"Hủy lịch hẹn",FINDER_CONFIRM:"Finder xác nhận đã giao",OWNER_CONFIRM:"Người mất xác nhận đã nhận",
  FINDER_DISPUTE:"Finder yêu cầu đối soát",OWNER_DISPUTE:"Người mất yêu cầu đối soát",NO_SHOW:"Báo bên còn lại không đến",RETURN_COMPLETED:"Hoàn tất trả đồ",REMINDER_QUEUED:"Đã tạo nhắc lịch",FEEDBACK_RECORDED:"Ghi nhận đánh giá",
  RECEIVED:"Tiếp nhận vào kho",STORED:"Lưu kho",RETURNED:"Trả từ kho",CUSTODY_RETURN_COMPLETED:"Hoàn tất trả từ kho",VERIFICATION_ACCEPTED:"Đồng ý gặp để đối chiếu",STAFF_CLAIM_VERIFIED:"Staff xác minh tại quầy",LEGACY_RETURN_RECORDED:"Hồ sơ cũ ghi nhận trả đồ, chưa đủ bằng chứng xác nhận"};
export function displayTime(value:string){return new Date(value).toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit",year:"numeric"});}
